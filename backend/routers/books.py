from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import requests

from .. import models, schemas
from ..database import get_db
from ..auth import verify_admin

router = APIRouter(prefix="/books", tags=["books"])

def fetch_book_info_openbd(isbn: str):
    url = f"https://api.openbd.jp/v1/get?isbn={isbn}"
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if data and data[0]:
                summary = data[0].get("summary", {})
                return {
                    "title": summary.get("title", ""),
                    "author": summary.get("author", "")
                }
    except Exception as e:
        print(f"OpenBD fetch error: {e}")
    return None

def fetch_book_info_google(isbn: str):
    url = f"https://www.googleapis.com/books/v1/volumes?q=isbn:{isbn}"
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            data = response.json()
            if "items" in data and len(data["items"]) > 0:
                volume_info = data["items"][0].get("volumeInfo", {})
                authors = volume_info.get("authors", [])
                return {
                    "title": volume_info.get("title", ""),
                    "author": ", ".join(authors) if authors else ""
                }
    except Exception as e:
        print(f"Google Books fetch error: {e}")
    return None

@router.get("/", response_model=List[schemas.Book])
def read_books(skip: int = 0, limit: int = 50, search: str = None, db: Session = Depends(get_db)):
    from sqlalchemy import func
    query = db.query(
        models.Book,
        func.count(models.Reservation.id).label("reservation_count")
    ).outerjoin(
        models.Reservation, 
        (models.Reservation.book_id == models.Book.id) & (models.Reservation.status == models.ReservationStatus.ACTIVE)
    )
    
    if search:
        query = query.filter(models.Book.title.contains(search) | models.Book.author.contains(search))
        
    results = query.group_by(models.Book.id).order_by(models.Book.id).offset(skip).limit(limit).all()
    
    books = []
    for book, res_count in results:
        book.reservation_count = res_count
        books.append(book)
        
    return books

@router.post("/", response_model=schemas.Book)
def create_book(book: schemas.BookCreate, db: Session = Depends(get_db), _: bool = Depends(verify_admin)):
    # If title is empty, try to fetch from API
    if not book.title:
        info = fetch_book_info_openbd(book.isbn)
        if not info:
            info = fetch_book_info_google(book.isbn)
        
        if info:
            book.title = info["title"]
            book.author = info["author"]
        else:
            raise HTTPException(status_code=404, detail="Book info not found in external APIs. Please provide title and author manually.")
            
    db_item = models.Book(**book.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@router.get("/{isbn}", response_model=schemas.Book)
def read_book(isbn: str, db: Session = Depends(get_db)):
    book = db.query(models.Book).filter(models.Book.isbn == isbn).first()
    if book is None:
        raise HTTPException(status_code=404, detail="Book not found")
    return book

@router.put("/{book_id}", response_model=schemas.Book)
def update_book(book_id: int, book_update: schemas.BookUpdate, db: Session = Depends(get_db), _: bool = Depends(verify_admin)):
    db_book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not db_book:
        raise HTTPException(status_code=404, detail="Book not found")
    
    update_data = book_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_book, key, value)
        
    db.commit()
    db.refresh(db_book)
    return db_book

@router.delete("/{book_id}")
def delete_book(book_id: int, db: Session = Depends(get_db), _: bool = Depends(verify_admin)):
    db_book = db.query(models.Book).filter(models.Book.id == book_id).first()
    if not db_book:
        raise HTTPException(status_code=404, detail="Book not found")
        
    if db_book.status == models.BookStatus.LENT:
        raise HTTPException(status_code=400, detail="貸出中の本は削除できません")
        
    db.delete(db_book)
    db.commit()
    return {"detail": "Book deleted successfully"}
