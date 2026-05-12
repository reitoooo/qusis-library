from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/lending", tags=["lending"])

@router.post("/lend", response_model=schemas.LendingLog)
def lend_book(log: schemas.LendingLogCreate, db: Session = Depends(get_db)):
    # Resolve the book — prefer book_id, fall back to isbn
    if log.book_id:
        book = db.query(models.Book).filter(
            models.Book.id == log.book_id,
            models.Book.status == models.BookStatus.AVAILABLE
        ).first()
    elif log.book_isbn:
        book = db.query(models.Book).filter(
            models.Book.isbn == log.book_isbn,
            models.Book.status == models.BookStatus.AVAILABLE
        ).first()
    else:
        raise HTTPException(status_code=422, detail="book_id または book_isbn のどちらかを指定してください")

    if not book:
        raise HTTPException(status_code=404, detail="対象の本が見つからないか、全て貸出中です")
    
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
        book.status = models.BookStatus.AVAILABLE
        
    log.returned_at = datetime.now()
    db.commit()
    db.refresh(log)
    return log
