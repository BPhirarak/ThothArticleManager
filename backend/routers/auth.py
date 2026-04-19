"""Authentication router — AD login + local fallback, user management, access logs."""
import hashlib, secrets, os
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional, List
from database import get_db
from models import User, AccessLog
from config import settings

router = APIRouter()


# ── Helpers ────────────────────────────────────────────────────────────────
def hash_pw(pw: str) -> str:
    return hashlib.sha256(pw.encode()).hexdigest()


def get_admin_list() -> list[str]:
    return [u.strip().lower() for u in settings.ADMIN_USERS.split(",") if u.strip()]


def seed_admins(db: Session):
    """Ensure default admin users exist in DB."""
    for email in get_admin_list():
        existing = db.query(User).filter(User.username == email).first()
        if not existing:
            db.add(User(username=email, display_name=email.split("@")[0],
                        role="admin", is_active=True, created_by="system"))
    db.commit()


def write_log(db: Session, username: str, action: str, detail: str = "", ip: str = ""):
    db.add(AccessLog(username=username, action=action, detail=detail, ip=ip))
    db.commit()


def get_current_user(x_username: str = Header(None), db: Session = Depends(get_db)) -> Optional[User]:
    if not x_username:
        return None
    return db.query(User).filter(User.username == x_username, User.is_active == True).first()


def require_admin(x_username: str = Header(None), db: Session = Depends(get_db)) -> User:
    user = db.query(User).filter(User.username == x_username, User.is_active == True).first()
    if not user or user.role != "admin":
        raise HTTPException(403, "Admin only")
    return user


# ── Login ──────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login")
async def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    seed_admins(db)
    ip = request.client.host if request.client else ""
    admin_list = get_admin_list()

    # ── AD Login ───────────────────────────────────────────────────────────
    if settings.AD_LOGIN_URL:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.post(settings.AD_LOGIN_URL, json={
                    "email": body.username,
                    "password": body.password,
                })
            if resp.status_code != 200:
                write_log(db, body.username, "login_failed", f"AD status {resp.status_code}", ip)
                raise HTTPException(401, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")

            ad_data = resp.json()
            ad_username = ad_data.get("email", body.username).lower()
            ad_display = ad_data.get("display_name", ad_username.split("@")[0])

            # Determine role
            role = "admin" if ad_username in admin_list else "user"

            # Upsert user in DB
            user = db.query(User).filter(User.username == ad_username).first()
            if not user:
                user = User(username=ad_username, display_name=ad_display,
                            role=role, is_active=True, created_by="ad")
                db.add(user)
            else:
                user.display_name = ad_display
                user.role = role
                user.is_active = True
            db.commit()
            db.refresh(user)

            write_log(db, ad_username, "login", "AD login success", ip)
            token = secrets.token_hex(32)
            return {"token": token, "username": ad_username,
                    "display_name": ad_display, "role": role}

        except HTTPException:
            raise
        except Exception as e:
            # AD unreachable — check if user is in ADMIN_USERS list (allow bypass for admins)
            print(f"[AUTH] AD error: {type(e).__name__}: {e}")
            uname_lower = body.username.lower()
            if uname_lower in admin_list:
                # Admin user: create/update in DB and allow login without AD
                role = "admin"
                display = uname_lower.split("@")[0]
                user = db.query(User).filter(User.username == uname_lower).first()
                if not user:
                    user = User(username=uname_lower, display_name=display,
                                role=role, is_active=True, created_by="ad_bypass")
                    db.add(user)
                    db.commit()
                write_log(db, uname_lower, "login", f"AD bypass (unreachable): {type(e).__name__}", ip)
                token = secrets.token_hex(32)
                return {"token": token, "username": uname_lower,
                        "display_name": display, "role": role}
            # Non-admin: fall through to local DB
            print(f"[AUTH] Falling back to local DB for {body.username}")

    # ── Local DB Login ─────────────────────────────────────────────────────
    user = db.query(User).filter(User.username == body.username).first()
    if not user or not hasattr(user, '_password_hash'):
        # Check local_users table via raw query for password
        from sqlalchemy import text
        row = db.execute(
            text("SELECT * FROM local_users WHERE username=:u"),
            {"u": body.username}
        ).fetchone()
        if not row or row.password_hash != hash_pw(body.password):
            write_log(db, body.username, "login_failed", "invalid credentials", ip)
            raise HTTPException(401, "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง")
        role = row.role
        display = row.display_name or body.username
        # Upsert into users
        user = db.query(User).filter(User.username == body.username).first()
        if not user:
            user = User(username=body.username, display_name=display,
                        role=role, is_active=True, created_by="local")
            db.add(user)
            db.commit()
    else:
        role = user.role
        display = user.display_name

    write_log(db, body.username, "login", "local login", ip)
    token = secrets.token_hex(32)
    return {"token": token, "username": body.username,
            "display_name": display, "role": role}


@router.post("/logout")
def logout(x_username: str = Header(None), db: Session = Depends(get_db)):
    if x_username:
        write_log(db, x_username, "logout")
    return {"ok": True}


@router.get("/me")
def me(x_username: str = Header(None), db: Session = Depends(get_db)):
    if not x_username:
        raise HTTPException(401, "Not authenticated")
    user = db.query(User).filter(User.username == x_username).first()
    if not user:
        raise HTTPException(401, "User not found")
    return {"username": user.username, "display_name": user.display_name,
            "role": user.role, "is_active": user.is_active}


# ── User Management (Admin) ────────────────────────────────────────────────
class UserCreate(BaseModel):
    username: str
    display_name: str = ""
    role: str = "user"


@router.get("/users")
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [{"id": u.id, "username": u.username, "display_name": u.display_name,
             "role": u.role, "is_active": u.is_active,
             "created_at": u.created_at.isoformat() if u.created_at else ""} for u in users]


@router.post("/users")
def create_user(body: UserCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.username == body.username).first()
    if existing:
        raise HTTPException(400, "ชื่อผู้ใช้นี้มีอยู่แล้ว")
    user = User(username=body.username,
                display_name=body.display_name or body.username.split("@")[0],
                role=body.role, is_active=True, created_by=admin.username)
    db.add(user)
    db.commit()
    write_log(db, admin.username, "create_user", f"created {body.username} role={body.role}")
    return {"ok": True}


@router.put("/users/{user_id}")
def update_user(user_id: int, body: dict, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if "role" in body:
        user.role = body["role"]
    if "is_active" in body:
        user.is_active = body["is_active"]
    if "display_name" in body:
        user.display_name = body["display_name"]
    db.commit()
    write_log(db, admin.username, "update_user", f"updated user_id={user_id}")
    return {"ok": True}


@router.delete("/users/{user_id}")
def delete_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.username in get_admin_list():
        raise HTTPException(400, "ไม่สามารถลบ default admin ได้")
    db.delete(user)
    db.commit()
    write_log(db, admin.username, "delete_user", f"deleted {user.username}")
    return {"ok": True}


# ── Access Logs (Admin) ────────────────────────────────────────────────────
@router.get("/logs")
def get_logs(
    username: str = None, action: str = None, limit: int = 200,
    admin: User = Depends(require_admin), db: Session = Depends(get_db)
):
    q = db.query(AccessLog).order_by(AccessLog.created_at.desc())
    if username:
        q = q.filter(AccessLog.username.ilike(f"%{username}%"))
    if action:
        q = q.filter(AccessLog.action == action)
    logs = q.limit(limit).all()
    return [{"id": l.id, "username": l.username, "action": l.action,
             "detail": l.detail, "ip": l.ip,
             "created_at": l.created_at.isoformat() if l.created_at else ""} for l in logs]


# ── System Settings (Admin) ────────────────────────────────────────────────
@router.get("/settings")
def get_settings(admin: User = Depends(require_admin)):
    from config import settings
    return {
        "CHAT_MAX_TOKENS": settings.CHAT_MAX_TOKENS,
        "REPORT_MAX_TOKENS": settings.REPORT_MAX_TOKENS,
        "LLM_PROVIDER": settings.LLM_PROVIDER,
        "OPENAI_MODEL": settings.OPENAI_MODEL,
        "BEDROCK_MODEL_ID": settings.BEDROCK_MODEL_ID,
        "AWS_REGION": settings.AWS_REGION,
    }


@router.post("/settings")
def update_settings(body: dict, admin: User = Depends(require_admin)):
    """Update runtime settings (persists until restart)."""
    from config import settings
    if "CHAT_MAX_TOKENS" in body:
        val = int(body["CHAT_MAX_TOKENS"])
        if 256 <= val <= 32000:
            settings.CHAT_MAX_TOKENS = val
    if "REPORT_MAX_TOKENS" in body:
        val = int(body["REPORT_MAX_TOKENS"])
        if 1024 <= val <= 32000:
            settings.REPORT_MAX_TOKENS = val
    return {"ok": True, "CHAT_MAX_TOKENS": settings.CHAT_MAX_TOKENS, "REPORT_MAX_TOKENS": settings.REPORT_MAX_TOKENS}
