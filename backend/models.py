from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Enum
from sqlalchemy.orm import relationship
import enum
from .database import Base

class BookStatus(str, enum.Enum):
    AVAILABLE = "貸出可能"
    LENT = "貸出中"
    RESERVED = "予約取り置き中"
    DISCARDED = "廃棄"
    LOST = "紛失"

class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    isbn = Column(String, index=True)
    title = Column(String, index=True)
    author = Column(String)
    status = Column(Enum(BookStatus), default=BookStatus.AVAILABLE)
    location = Column(String)
    
    lending_logs = relationship("LendingLog", back_populates="book")

class User(Base):
    __tablename__ = "users"

    user_id = Column(String, primary_key=True, index=True)
    name = Column(String)
    pin_code = Column(String, default="0000")
    notification_id = Column(String, nullable=True) # Discord/Slack ID
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)

    lending_logs = relationship("LendingLog", back_populates="user")

class LendingLog(Base):
    __tablename__ = "lending_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    book_id = Column(Integer, ForeignKey("books.id"))
    user_id = Column(String, ForeignKey("users.user_id"))
    borrowed_at = Column(DateTime)
    due_date = Column(DateTime)
    returned_at = Column(DateTime, nullable=True)
    remind_count = Column(Integer, default=0)
    is_extension_requested = Column(Boolean, default=False)

    book = relationship("Book", back_populates="lending_logs")
    user = relationship("User", back_populates="lending_logs")

class ReservationStatus(str, enum.Enum):
    ACTIVE = "予約中"
    FULFILLED = "完了"
    CANCELLED = "キャンセル"

class Reservation(Base):
    __tablename__ = "reservations"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    book_id = Column(Integer, ForeignKey("books.id"))
    user_id = Column(String, ForeignKey("users.user_id"))
    reserved_at = Column(DateTime)
    status = Column(Enum(ReservationStatus), default=ReservationStatus.ACTIVE)

    book = relationship("Book")
    user = relationship("User")
