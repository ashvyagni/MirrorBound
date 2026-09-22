import base64
import hmac
import hashlib
import json
import secrets
import time
import uuid
from pathlib import Path
from typing import Optional, Dict, Any

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from .database import get_connection

router = APIRouter(prefix="/auth", tags=["auth"])

# --- Crypto Utilities ---
SECRET_FILE = Path(__file__).parent.parent.parent.parent / ".auth_secret"

def get_secret() -> bytes:
    if not SECRET_FILE.exists():
        SECRET_FILE.write_bytes(secrets.token_bytes(32))
    return SECRET_FILE.read_bytes()

def hash_password(password: str) -> str:
    """Hash a password using PBKDF2 with a random salt."""
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return f"{salt}:{hashed.hex()}"

def verify_password(password: str, hashed_password: str) -> bool:
    """Verify a password against a hash."""
    try:
        salt, stored_hash = hashed_password.split(":")
        hashed = hashlib.pbkdf2_hmac(
            'sha256',
            password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        )
        return hmac.compare_digest(stored_hash, hashed.hex())
    except ValueError:
        return False

def base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def base64url_decode(data: str) -> bytes:
    padding = '=' * (4 - (len(data) % 4))
    return base64.urlsafe_b64decode(data + padding)

def create_jwt(payload: Dict[str, Any]) -> str:
    """Create a minimal HS256 JWT."""
    header = {"alg": "HS256", "typ": "JWT"}
    header_enc = base64url_encode(json.dumps(header).encode('utf-8'))
    payload_enc = base64url_encode(json.dumps(payload).encode('utf-8'))
    
    signing_input = f"{header_enc}.{payload_enc}"
    signature = hmac.new(
        get_secret(),
        signing_input.encode('utf-8'),
        hashlib.sha256
    ).digest()
    
    signature_enc = base64url_encode(signature)
    return f"{signing_input}.{signature_enc}"

def verify_jwt(token: str) -> Optional[Dict[str, Any]]:
    """Verify a JWT and return its payload, or None if invalid."""
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
            
        header_enc, payload_enc, signature_enc = parts
        signing_input = f"{header_enc}.{payload_enc}"
        
        expected_sig = hmac.new(
            get_secret(),
            signing_input.encode('utf-8'),
            hashlib.sha256
        ).digest()
        
        if not hmac.compare_digest(base64url_decode(signature_enc), expected_sig):
            return None
            
        payload = json.loads(base64url_decode(payload_enc))
        if 'exp' in payload and payload['exp'] < time.time():
            return None # Expired
            
        return payload
    except Exception:
        return None

# --- Schemas ---

class RegisterRequest(BaseModel):
    username: str
    password: str
    display_name: str

class LoginRequest(BaseModel):
    username: str
    password: str

class AuthResponse(BaseModel):
    token: str
    user_id: str
    username: str
    display_name: str
    is_admin: bool

async def ensure_admin_user():
    """Ensures the mirroradmin user exists in the DB with the fixed password."""
    admin_id = uuid.UUID('00000000-0000-0000-0000-000000000001')
    admin_user = 'mirroradmin'
    admin_pass = 'mirrordevatwork'
    
    async with get_connection() as conn:
        exists = await conn.fetchval("SELECT 1 FROM users WHERE username = $1", admin_user)
        if not exists:
            pw_hash = hash_password(admin_pass)
            await conn.execute(
                """
                INSERT INTO users (id, username, display_name, password_hash, is_admin)
                VALUES ($1, $2, $3, $4, $5)
                """,
                admin_id, admin_user, "Admin", pw_hash, True
            )

# --- Endpoints ---

@router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest):
    if len(req.username) < 3:
        raise HTTPException(status_code=400, detail="Username too short")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password too short")
    if req.username.lower() == 'mirroradmin':
        raise HTTPException(status_code=400, detail="Reserved username")
        
    user_id = str(uuid.uuid4())
    pw_hash = hash_password(req.password)
    
    async with get_connection() as conn:
        # Check if first user -> make admin
        count = await conn.fetchval("SELECT COUNT(*) FROM users")
        is_admin = (count == 0)
        
        try:
            await conn.execute(
                """
                INSERT INTO users (id, username, display_name, password_hash, is_admin)
                VALUES ($1, $2, $3, $4, $5)
                """,
                uuid.UUID(user_id), req.username, req.display_name, pw_hash, is_admin
            )
        except Exception as e: # asyncpg.exceptions.UniqueViolationError
            if 'unique' in str(e).lower() or 'duplicate' in str(e).lower():
                raise HTTPException(status_code=409, detail="Username already exists")
            raise
            
    token = create_jwt({
        "sub": user_id,
        "username": req.username,
        "is_admin": is_admin,
        "exp": time.time() + 86400 * 30 # 30 days
    })
    
    return AuthResponse(
        token=token,
        user_id=user_id,
        username=req.username,
        display_name=req.display_name,
        is_admin=is_admin
    )

@router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    async with get_connection() as conn:
        user = await conn.fetchrow(
            "SELECT id, username, display_name, password_hash, is_admin FROM users WHERE username = $1",
            req.username
        )
        
        if not user or not verify_password(req.password, user['password_hash']):
            raise HTTPException(status_code=401, detail="Invalid username or password")
            
        await conn.execute(
            "UPDATE users SET last_login = NOW() WHERE id = $1",
            user['id']
        )
        
    user_id = str(user['id'])
    is_admin = user['is_admin']
    
    token = create_jwt({
        "sub": user_id,
        "username": user['username'],
        "is_admin": is_admin,
        "exp": time.time() + 86400 * 30 # 30 days
    })
    
    return AuthResponse(
        token=token,
        user_id=user_id,
        username=user['username'],
        display_name=user['display_name'],
        is_admin=is_admin
    )

# --- Dependency ---

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    payload = verify_jwt(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload

@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    user_id = user.get("sub")
    async with get_connection() as conn:
        db_user = await conn.fetchrow(
            "SELECT id, username, display_name, is_admin FROM users WHERE id = $1",
            uuid.UUID(user_id)
        )
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
            
    return {
        "user_id": str(db_user['id']),
        "username": db_user['username'],
        "display_name": db_user['display_name'],
        "is_admin": db_user['is_admin']
    }
