from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas
from ..database import get_db
from ..auth import verify_admin

router = APIRouter(prefix="/users", tags=["users"])

@router.get("/", response_model=List[schemas.User])
def read_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _: bool = Depends(verify_admin)):
    users = db.query(models.User).offset(skip).limit(limit).all()
    return users

@router.post("/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db), _: bool = Depends(verify_admin)):
    db_user = db.query(models.User).filter(models.User.user_id == user.user_id).first()
    if db_user:
        raise HTTPException(status_code=400, detail="User ID already registered")
    db_item = models.User(**user.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.post("/bulk")
def create_users_bulk(users: List[schemas.UserCreate], db: Session = Depends(get_db), _: bool = Depends(verify_admin)):
    added_count = 0
    skipped_count = 0
    
    for user_data in users:
        # Check if user already exists
        existing = db.query(models.User).filter(models.User.user_id == user_data.user_id).first()
        if existing:
            skipped_count += 1
            continue
            
        db_item = models.User(**user_data.model_dump())
        db.add(db_item)
        added_count += 1
        
    db.commit()
    return {"detail": f"{added_count}名のユーザーを登録し、{skipped_count}名をスキップしました。"}

@router.get("/{user_id}", response_model=schemas.User)
def read_user(user_id: str, db: Session = Depends(get_db), _: bool = Depends(verify_admin)):
    db_user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user

@router.get("/{user_id}/lending-logs", response_model=List[schemas.LendingLog])
def read_user_lending_logs(user_id: str, pin_code: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.pin_code != pin_code:
        raise HTTPException(status_code=401, detail="PINコードが間違っています")
        
    logs = db.query(models.LendingLog).filter(models.LendingLog.user_id == user_id).all()
    return logs

@router.post("/{user_id}/verify-pin")
def verify_pin(user_id: str, payload: schemas.PinVerify, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.pin_code != payload.pin_code:
        raise HTTPException(status_code=401, detail="PINコードが間違っています")
    return {"status": "ok"}

@router.post("/{user_id}/change-pin")
def change_pin(user_id: str, payload: schemas.PinChange, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.pin_code != payload.old_pin:
        raise HTTPException(status_code=401, detail="現在のPINコードが間違っています")
    
    if len(payload.new_pin) != 4 or not payload.new_pin.isdigit():
        raise HTTPException(status_code=400, detail="新しいPINは4桁の数字で入力してください")
        
    user.pin_code = payload.new_pin
    db.commit()
    return {"status": "ok"}

@router.put("/{user_id}", response_model=schemas.User)
def update_user(user_id: str, user_update: schemas.UserUpdate, db: Session = Depends(get_db), _: bool = Depends(verify_admin)):
    db_user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_user, key, value)
        
    db.commit()
    db.refresh(db_user)
    return db_user

@router.delete("/{user_id}")
def delete_user(user_id: str, db: Session = Depends(get_db), _: bool = Depends(verify_admin)):
    db_user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Check if user has active lending logs
    active_logs = db.query(models.LendingLog).filter(
        models.LendingLog.user_id == user_id, 
        models.LendingLog.returned_at == None
    ).first()
    if active_logs:
        raise HTTPException(status_code=400, detail="未返却の本があるため削除できません")
        
    db.delete(db_user)
    db.commit()
    return {"detail": "User deleted successfully"}
