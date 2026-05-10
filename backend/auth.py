import os
from fastapi import Header, HTTPException

def verify_admin(x_admin_password: str = Header(None)):
    expected_password = os.environ.get("ADMIN_PASSWORD", "admin")
    if not x_admin_password or x_admin_password != expected_password:
        raise HTTPException(status_code=401, detail="Invalid or missing admin password")
