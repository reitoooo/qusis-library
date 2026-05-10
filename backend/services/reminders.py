from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from datetime import datetime
import requests
import os

from ..database import SessionLocal
from ..models import LendingLog, User, Book

def send_slack_webhook(message: str, webhook_url: str):
    if not webhook_url:
        return
    data = {"text": message}
    try:
        requests.post(webhook_url, json=data)
    except Exception as e:
        print(f"Error sending webhook: {e}")

def check_overdue_books():
    db: Session = SessionLocal()
    try:
        now = datetime.now()
        logs = db.query(LendingLog).filter(LendingLog.returned_at == None).all()
        
        webhook_url = os.environ.get("SLACK_WEBHOOK_URL", "")
        
        for log in logs:
            days_overdue = (now.date() - log.due_date.date()).days
            user = db.query(User).filter(User.user_id == log.user_id).first()
            book = db.query(Book).filter(Book.id == log.book_id).first()
            
            if not user or not book:
                continue

            mention = f"<@{user.notification_id}> " if user.notification_id else f"*{user.name}*さん\n"
            
            if days_overdue == -1: # Tomorrow is the deadline
                msg = f"【事前通知】{mention}明日が返却期限の本があります。\n書名: {book.title}"
                send_slack_webhook(msg, webhook_url)
                import time
                time.sleep(1.5)
            elif days_overdue > 0: # Overdue
                msg = f"【督促通知】{mention}返却期限が過ぎている本があります！（{days_overdue}日超過）\n至急部室へ返却してください。\n書名: {book.title}"
                send_slack_webhook(msg, webhook_url)
                log.remind_count += 1
                db.commit()
                import time
                time.sleep(1.5)
    finally:
        db.close()

def start_scheduler():
    scheduler = BackgroundScheduler()
    # Run once a day at 10:00 AM
    scheduler.add_job(check_overdue_books, 'cron', hour=10, minute=0)
    scheduler.start()
