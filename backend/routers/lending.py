from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timedelta
from typing import List
import os

from .. import models, schemas
from ..database import get_db
from ..auth import verify_admin
from ..services.reminders import send_slack_webhook

router = APIRouter(prefix="/lending", tags=["lending"])

@router.get("/active")
def get_active_lendings(db: Session = Depends(get_db), _: bool = Depends(verify_admin)):
    """Return all currently active (not yet returned) lending logs."""
    logs = db.query(models.LendingLog).options(
        joinedload(models.LendingLog.user),
        joinedload(models.LendingLog.book)
    ).filter(
        models.LendingLog.returned_at == None
    ).order_by(models.LendingLog.borrowed_at.desc()).all()

    result = []
    for log in logs:
        result.append({
            "id": log.id,
            "user_id": log.user_id,
            "user_name": log.user.name if log.user else "不明",
            "book_id": log.book_id,
            "book_title": log.book.title if log.book else "不明",
            "book_author": log.book.author if log.book else "",
            "borrowed_at": log.borrowed_at.isoformat(),
            "due_date": log.due_date.isoformat(),
            "is_overdue": datetime.now() > log.due_date,
            "is_extension_requested": log.is_extension_requested,
        })

    return result

@router.get("/history")
def get_lending_history(skip: int = 0, limit: int = 50, db: Session = Depends(get_db), _: bool = Depends(verify_admin)):
    """Return all lending logs, ordered by borrowed_at desc."""
    from sqlalchemy import func
    logs = db.query(models.LendingLog).options(
        joinedload(models.LendingLog.user),
        joinedload(models.LendingLog.book)
    ).order_by(func.coalesce(models.LendingLog.returned_at, models.LendingLog.borrowed_at).desc()).offset(skip).limit(limit).all()

    result = []
    for log in logs:
        result.append({
            "id": log.id,
            "user_id": log.user_id,
            "user_name": log.user.name if log.user else "不明",
            "book_id": log.book_id,
            "book_title": log.book.title if log.book else "不明",
            "book_author": log.book.author if log.book else "",
            "borrowed_at": log.borrowed_at.isoformat() if log.borrowed_at else "",
            "due_date": log.due_date.isoformat() if log.due_date else "",
            "returned_at": log.returned_at.isoformat() if log.returned_at else None,
            "is_overdue": not log.returned_at and log.due_date and datetime.now() > log.due_date,
            "is_extension_requested": log.is_extension_requested,
        })

    return result

@router.post("/lend", response_model=schemas.LendingLog)
def lend_book(log: schemas.LendingLogCreate, db: Session = Depends(get_db)):
    # Resolve the book — prefer book_id, fall back to isbn
    if log.book_id:
        book = db.query(models.Book).filter(
            models.Book.id == log.book_id,
            models.Book.status.in_([models.BookStatus.AVAILABLE, models.BookStatus.RESERVED])
        ).first()
    elif log.book_isbn:
        book = db.query(models.Book).filter(
            models.Book.isbn == log.book_isbn,
            models.Book.status.in_([models.BookStatus.AVAILABLE, models.BookStatus.RESERVED])
        ).first()
    else:
        raise HTTPException(status_code=422, detail="book_id または book_isbn のどちらかを指定してください")

    if not book:
        raise HTTPException(status_code=404, detail="対象の本が見つからないか、全て貸出中です")
        
    # Check if reserved
    if book.status == models.BookStatus.RESERVED:
        first_reservation = db.query(models.Reservation).filter(
            models.Reservation.book_id == book.id,
            models.Reservation.status == models.ReservationStatus.ACTIVE
        ).order_by(models.Reservation.reserved_at.asc()).first()
        if not first_reservation or first_reservation.user_id != log.user_id:
            raise HTTPException(status_code=400, detail="この本は他のユーザーに予約取り置きされています")
        # Mark reservation as FULFILLED
        first_reservation.status = models.ReservationStatus.FULFILLED
    
    # Check if user exists and is active
    user = db.query(models.User).filter(models.User.user_id == log.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is not active")
    if user.pin_code != log.pin_code:
        raise HTTPException(status_code=401, detail="PINコードが間違っています")

    now = datetime.now()
    due_date = log.due_date if log.due_date else now + timedelta(days=14)

    db_log = models.LendingLog(
        book_id=book.id,
        user_id=log.user_id,
        borrowed_at=now,
        due_date=due_date
    )
    
    book.status = models.BookStatus.LENT
    
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

@router.post("/return")
def return_book(isbn: str = None, book_id: int = None, user_id: str = None, db: Session = Depends(get_db)):
    # Resolve by book_id first, then isbn
    if book_id:
        active_logs = db.query(models.LendingLog).filter(
            models.LendingLog.book_id == book_id,
            models.LendingLog.returned_at == None
        ).all()
    elif isbn:
        active_logs = db.query(models.LendingLog).join(models.Book).filter(
            models.Book.isbn == isbn,
            models.LendingLog.returned_at == None
        ).all()
    else:
        raise HTTPException(status_code=422, detail="book_id または isbn のどちらかを指定してください")
    
    if not active_logs:
        raise HTTPException(status_code=404, detail="この本の貸出記録が見つかりません")
        
    if len(active_logs) > 1 and not user_id:
        candidates = [{"user_id": log.user_id, "name": log.user.name} for log in active_logs]
        raise HTTPException(status_code=409, detail={"message": "複数人が同じ本を借りています。返却者を選択してください。", "candidates": candidates})
        
    if user_id:
        log = next((l for l in active_logs if l.user_id == user_id), None)
        if not log:
            raise HTTPException(status_code=404, detail="指定されたユーザーはこの本を借りていません")
    else:
        log = active_logs[0]
        
    book = db.query(models.Book).filter(models.Book.id == log.book_id).first()
    if book:
        first_reservation = db.query(models.Reservation).filter(
            models.Reservation.book_id == book.id,
            models.Reservation.status == models.ReservationStatus.ACTIVE
        ).order_by(models.Reservation.reserved_at.asc()).first()
        
        if first_reservation:
            book.status = models.BookStatus.RESERVED
            webhook_url = os.environ.get("SLACK_WEBHOOK_URL", "")
            if webhook_url:
                reserver = first_reservation.user
                user_mention = f"<@{reserver.notification_id}>" if reserver and reserver.notification_id else f"*{reserver.name}*"
                msg = f"【予約本が返却されました】\n{user_mention} さん\n予約していた『{book.title}』が返却され、あなたのために取り置きされています！\n貸出処理を行ってください。"
                send_slack_webhook(msg, webhook_url)
        else:
            book.status = models.BookStatus.AVAILABLE
        
    log.returned_at = datetime.now()
    db.commit()
    db.refresh(log)
    return log

@router.post("/{log_id}/extend", response_model=schemas.LendingLog)
def extend_lending(log_id: int, payload: schemas.LendingExtend, db: Session = Depends(get_db)):
    log = db.query(models.LendingLog).filter(models.LendingLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="貸出記録が見つかりません")
    if log.returned_at:
        raise HTTPException(status_code=400, detail="既に返却済みの本です")
        
    user = db.query(models.User).filter(models.User.user_id == log.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    if user.pin_code != payload.pin_code:
        raise HTTPException(status_code=401, detail="PINコードが間違っています")

    if log.is_extension_requested:
        raise HTTPException(status_code=400, detail="既に延長申請中です")

    # Check for active reservations
    first_reservation = db.query(models.Reservation).filter(
        models.Reservation.book_id == log.book_id,
        models.Reservation.status == models.ReservationStatus.ACTIVE
    ).first()
    
    if first_reservation:
        webhook_url = os.environ.get("SLACK_WEBHOOK_URL", "")
        if webhook_url:
            user_mention = f"<@{user.notification_id}>" if user.notification_id else f"*{user.name}*"
            book_title = log.book.title if log.book else "不明な本"
            msg = f"【延長申請 自動却下】\n{user_mention} さん\n申し訳ありませんが、『{book_title}』には他のユーザーからの予約が入っているため、延長できません。\n元の期限（{log.due_date.strftime('%Y/%m/%d')}）までに返却をお願いします。"
            send_slack_webhook(msg, webhook_url)
        raise HTTPException(status_code=400, detail="この本は予約が入っているため延長できません")

    # 延長申請中フラグを立てる
    log.is_extension_requested = True
    db.commit()
    db.refresh(log)
    
    # Slackへ通知
    webhook_url = os.environ.get("SLACK_WEBHOOK_URL", "")
    if webhook_url:
        admins = db.query(models.User).filter(models.User.is_admin == True).all()
        admin_mentions = " ".join([f"<@{a.notification_id}>" for a in admins if a.notification_id]) or "<!channel>"
        
        user_mention = f"<@{user.notification_id}>" if user.notification_id else f"*{user.name}*"
        book_title = log.book.title if log.book else "不明な本"
        msg = f"【延長申請】{admin_mentions}\n{user_mention} さんから『{book_title}』の延長申請がありました。\n管理者画面から確認・承認を行ってください。"
        send_slack_webhook(msg, webhook_url)
        
    return log

@router.post("/{log_id}/approve-extension", response_model=schemas.LendingLog)
def approve_extension(log_id: int, db: Session = Depends(get_db), _: bool = Depends(verify_admin)):
    log = db.query(models.LendingLog).filter(models.LendingLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="貸出記録が見つかりません")
    if not log.is_extension_requested:
        raise HTTPException(status_code=400, detail="延長申請されていません")
        
    log.due_date = log.due_date + timedelta(days=14)
    log.is_extension_requested = False
    db.commit()
    db.refresh(log)
    
    webhook_url = os.environ.get("SLACK_WEBHOOK_URL", "")
    if webhook_url:
        admins = db.query(models.User).filter(models.User.is_admin == True).all()
        admin_mentions = " ".join([f"<@{a.notification_id}>" for a in admins if a.notification_id]) or "<!channel>"
        
        user = db.query(models.User).filter(models.User.user_id == log.user_id).first()
        user_mention = f"<@{user.notification_id}>" if user and user.notification_id else (f"*{user.name}*" if user else "ユーザー")
        book_title = log.book.title if log.book else "不明な本"
        msg = f"【延長申請 許可】{admin_mentions}\n{user_mention} さん\n『{book_title}』の延長申請が許可され、返却期限が {log.due_date.strftime('%Y/%m/%d')} に延長されました。"
        send_slack_webhook(msg, webhook_url)

    return log

@router.post("/{log_id}/reject-extension", response_model=schemas.LendingLog)
def reject_extension(log_id: int, db: Session = Depends(get_db), _: bool = Depends(verify_admin)):
    log = db.query(models.LendingLog).filter(models.LendingLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="貸出記録が見つかりません")
    if not log.is_extension_requested:
        raise HTTPException(status_code=400, detail="延長申請されていません")
        
    log.is_extension_requested = False
    db.commit()
    db.refresh(log)

    webhook_url = os.environ.get("SLACK_WEBHOOK_URL", "")
    if webhook_url:
        admins = db.query(models.User).filter(models.User.is_admin == True).all()
        admin_mentions = " ".join([f"<@{a.notification_id}>" for a in admins if a.notification_id]) or "<!channel>"
        
        user = db.query(models.User).filter(models.User.user_id == log.user_id).first()
        user_mention = f"<@{user.notification_id}>" if user and user.notification_id else (f"*{user.name}*" if user else "ユーザー")
        book_title = log.book.title if log.book else "不明な本"
        msg = f"【延長申請 却下】{admin_mentions}\n{user_mention} さん\n申し訳ありませんが、『{book_title}』の延長申請は却下されました。元の期限（{log.due_date.strftime('%Y/%m/%d')}）までに返却してください。"
        send_slack_webhook(msg, webhook_url)

    return log
