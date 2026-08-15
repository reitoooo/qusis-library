from fastapi import APIRouter, Depends, HTTPException, Header
from ..auth import verify_admin
from sqlalchemy.orm import Session, joinedload
from datetime import datetime
from typing import List

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/reservations", tags=["reservations"])

@router.post("/", response_model=schemas.Reservation)
def create_reservation(payload: schemas.ReservationCreate, db: Session = Depends(get_db)):
    # ユーザーの検証
    user = db.query(models.User).filter(models.User.user_id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="ユーザーが見つかりません")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="このユーザーはアクティブではありません")
    if user.pin_code != payload.pin_code:
        raise HTTPException(status_code=401, detail="PINコードが間違っています")

    # 本の検証
    book = db.query(models.Book).filter(models.Book.id == payload.book_id).first()
    if not book:
        raise HTTPException(status_code=404, detail="本が見つかりません")
    if book.status != models.BookStatus.LENT:
        raise HTTPException(status_code=400, detail="この本は現在貸出中ではないため、そのまま借りることができます")

    # 自分が借りている本は予約できない
    active_lending = db.query(models.LendingLog).filter(
        models.LendingLog.book_id == payload.book_id,
        models.LendingLog.returned_at == None
    ).first()
    
    if active_lending and active_lending.user_id == payload.user_id:
        raise HTTPException(status_code=400, detail="自分が現在借りている本は予約できません")

    # 既に予約中かどうか
    existing_reservation = db.query(models.Reservation).filter(
        models.Reservation.book_id == payload.book_id,
        models.Reservation.user_id == payload.user_id,
        models.Reservation.status == models.ReservationStatus.ACTIVE
    ).first()
    if existing_reservation:
        raise HTTPException(status_code=400, detail="既にこの本を予約しています")

    # 予約作成
    reservation = models.Reservation(
        book_id=payload.book_id,
        user_id=payload.user_id,
        reserved_at=datetime.now(),
        status=models.ReservationStatus.ACTIVE
    )
    db.add(reservation)
    db.commit()
    db.refresh(reservation)
    
    return reservation

@router.post("/{reservation_id}/cancel", response_model=schemas.Reservation)
def cancel_reservation(reservation_id: int, payload: schemas.PinVerify, user_id: str = Header(None), db: Session = Depends(get_db)):
    if not user_id:
        raise HTTPException(status_code=401, detail="user-id ヘッダーが必要です")
        
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user or user.pin_code != payload.pin_code:
        raise HTTPException(status_code=401, detail="PINコードが間違っています")
        
    reservation = db.query(models.Reservation).filter(
        models.Reservation.id == reservation_id,
        models.Reservation.user_id == user_id
    ).first()
    
    if not reservation:
        raise HTTPException(status_code=404, detail="予約が見つかりません")
    
    if reservation.status != models.ReservationStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="この予約は既にキャンセルまたは完了しています")
        
    reservation.status = models.ReservationStatus.CANCELLED
    db.commit()
    db.refresh(reservation)
    return reservation

@router.get("/me", response_model=List[schemas.Reservation])
def get_my_reservations(user_id: str, pin_code: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user or user.pin_code != pin_code:
        raise HTTPException(status_code=401, detail="PINコードが間違っています")
    
    reservations = db.query(models.Reservation).options(
        joinedload(models.Reservation.book)
    ).filter(
        models.Reservation.user_id == user_id,
        models.Reservation.status == models.ReservationStatus.ACTIVE
    ).all()
    
    return reservations

@router.get("/all", response_model=List[schemas.Reservation])
def get_all_reservations(db: Session = Depends(get_db), _: bool = Depends(verify_admin)):
    reservations = db.query(models.Reservation).options(
        joinedload(models.Reservation.book),
        joinedload(models.Reservation.user)
    ).order_by(models.Reservation.reserved_at.desc()).all()
    
    return reservations
