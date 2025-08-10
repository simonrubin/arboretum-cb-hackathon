"""
User management API endpoints
"""
import logging
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()

class UserCreateRequest(BaseModel):
    wallet_address: str
    email: str = ""

class UserUpdateRequest(BaseModel):
    email: str = ""
    risk_tolerance: float = 100.0
    max_daily_trades: int = 10

class UserResponse(BaseModel):
    id: int
    wallet_address: str
    email: str
    risk_tolerance: float
    max_daily_trades: int
    created_at: str

@router.post("/", response_model=UserResponse)
async def create_user(
    request: UserCreateRequest,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Create new user account"""
    try:
        # Check if user already exists
        from sqlalchemy import select
        stmt = select(User).where(User.wallet_address == request.wallet_address)
        result = await db.execute(stmt)
        existing_user = result.scalar_one_or_none()
        
        if existing_user:
            raise HTTPException(
                status_code=400,
                detail="User with this wallet address already exists"
            )
        
        # Create new user
        user = User(
            wallet_address=request.wallet_address,
            email=request.email,
            risk_tolerance=100.0,  # Default $100 max per trade
            max_daily_trades=10    # Default 10 trades per day
        )
        
        db.add(user)
        await db.commit()
        await db.refresh(user)
        
        return UserResponse(
            id=user.id,
            wallet_address=user.wallet_address,
            email=user.email,
            risk_tolerance=user.risk_tolerance,
            max_daily_trades=user.max_daily_trades,
            created_at=user.created_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create user: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get user by ID"""
    try:
        user = await db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return UserResponse(
            id=user.id,
            wallet_address=user.wallet_address,
            email=user.email,
            risk_tolerance=user.risk_tolerance,
            max_daily_trades=user.max_daily_trades,
            created_at=user.created_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    request: UserUpdateRequest,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Update user settings"""
    try:
        user = await db.get(User, user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update user fields
        if request.email:
            user.email = request.email
        user.risk_tolerance = request.risk_tolerance
        user.max_daily_trades = request.max_daily_trades
        
        await db.commit()
        await db.refresh(user)
        
        return UserResponse(
            id=user.id,
            wallet_address=user.wallet_address,
            email=user.email,
            risk_tolerance=user.risk_tolerance,
            max_daily_trades=user.max_daily_trades,
            created_at=user.created_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update user {user_id}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.get("/wallet/{wallet_address}", response_model=UserResponse)
async def get_user_by_wallet(
    wallet_address: str,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """Get user by wallet address"""
    try:
        from sqlalchemy import select
        stmt = select(User).where(User.wallet_address == wallet_address)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        return UserResponse(
            id=user.id,
            wallet_address=user.wallet_address,
            email=user.email,
            risk_tolerance=user.risk_tolerance,
            max_daily_trades=user.max_daily_trades,
            created_at=user.created_at.isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get user by wallet {wallet_address}: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")