from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from .models import BookStatus

class BookBase(BaseModel):
    isbn: str
    title: str
    author: str
    status: BookStatus = BookStatus.AVAILABLE
    location: Optional[str] = None

class BookCreate(BookBase):
    pass

class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    status: Optional[BookStatus] = None
    location: Optional[str] = None

class Book(BookBase):
    id: int
    class Config:
        orm_mode = True
        from_attributes = True

class UserBase(BaseModel):
    user_id: str
    name: str
    pin_code: Optional[str] = "0000"
    notification_id: Optional[str] = None
    is_active: bool = True

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    name: Optional[str] = None
    pin_code: Optional[str] = None
    notification_id: Optional[str] = None
    is_active: Optional[bool] = None

class User(UserBase):
    class Config:
        orm_mode = True
        from_attributes = True

class LendingLogBase(BaseModel):
    user_id: str
    
class LendingLogCreate(LendingLogBase):
    book_isbn: Optional[str] = None  # ISBN or 'NO_ISBN'
    book_id: Optional[int] = None    # Alternative: directly specify book ID
    pin_code: str
    due_date: Optional[datetime] = None

class LendingLog(LendingLogBase):
    id: int
    book_id: int
    borrowed_at: datetime
    due_date: datetime
    returned_at: Optional[datetime] = None
    remind_count: int
    book: Book

    class Config:
        orm_mode = True
        from_attributes = True

class PinVerify(BaseModel):
    pin_code: str

class PinChange(BaseModel):
    old_pin: str
    new_pin: str
