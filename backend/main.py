from fastapi import FastAPI, Header, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from . import models
from .database import engine
from .routers import books, users, lending

from .services import reminders

models.Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(title="蔵書管理システム API", lifespan=lifespan)

import os

# Configure CORS
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
origins = [
    "http://localhost",
    "http://localhost:5173",
    FRONTEND_URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(books.router)
app.include_router(users.router)
app.include_router(lending.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Book Management System API"}

@app.get("/api/cron/check-overdue")
def trigger_overdue_check(background_tasks: BackgroundTasks, cron_secret: str = Header(None, alias="X-Cron-Secret")):
    expected_secret = os.environ.get("CRON_SECRET")
    if expected_secret and cron_secret != expected_secret:
        raise HTTPException(status_code=401, detail="Invalid CRON secret")
    
    background_tasks.add_task(reminders.check_overdue_books)
    return {"message": "Overdue check started"}
