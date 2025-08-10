"""
User models for Arboretum platform
"""
from typing import Optional, List
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from pydantic import BaseModel, EmailStr
from datetime import datetime

from app.core.database import Base

class User(Base):
    """User database model"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    wallet_address = Column(String, unique=True, index=True)
    
    # Risk management settings
    max_risk_per_trade = Column(Float, default=100.0)
    min_account_balance = Column(Float, default=500.0) 
    daily_risk_limit = Column(Float, default=1000.0)
    auto_funding_enabled = Column(Boolean, default=True)
    
    # Trading settings
    profit_threshold = Column(Float, default=15.0)  # Minimum profit %
    auto_execution_enabled = Column(Boolean, default=True)
    
    # Account balances (cached from external APIs)
    polymarket_balance = Column(Float, default=0.0)
    kalshi_balance = Column(Float, default=0.0)
    base_wallet_balance = Column(Float, default=0.0)
    
    # Account linking
    polymarket_api_key = Column(String, nullable=True)
    kalshi_api_key = Column(String, nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)
    
    # Relationships
    trades = relationship("Trade", back_populates="user", cascade="all, delete-orphan", foreign_keys="Trade.user_id")

class Trade(Base):
    """Trade execution record"""
    __tablename__ = "trades"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Trade details
    opportunity_id = Column(String, nullable=False)
    polymarket_order_id = Column(String, nullable=True)
    kalshi_order_id = Column(String, nullable=True)
    
    # Financial details
    position_size = Column(Float, nullable=False)
    execution_fee = Column(Float, nullable=False)
    gross_profit = Column(Float, default=0.0)
    net_profit = Column(Float, default=0.0)
    platform_fee = Column(Float, default=0.0)
    
    # Status and timing
    status = Column(String, default="pending")  # pending, success, failed, rolled_back
    executed_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Metadata
    trade_data = Column(JSON)  # Store full trade details
    
    # Relationships
    user = relationship("User", back_populates="trades", foreign_keys=[user_id])

# Pydantic models for API

class UserBase(BaseModel):
    email: EmailStr
    wallet_address: Optional[str] = None

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    max_risk_per_trade: Optional[float] = None
    min_account_balance: Optional[float] = None
    daily_risk_limit: Optional[float] = None
    auto_funding_enabled: Optional[bool] = None
    profit_threshold: Optional[float] = None
    auto_execution_enabled: Optional[bool] = None

class UserResponse(UserBase):
    id: int
    max_risk_per_trade: float
    min_account_balance: float
    daily_risk_limit: float
    auto_funding_enabled: bool
    profit_threshold: float
    auto_execution_enabled: bool
    polymarket_balance: float
    kalshi_balance: float
    base_wallet_balance: float
    created_at: datetime
    is_active: bool
    
    class Config:
        from_attributes = True

class TradeCreate(BaseModel):
    opportunity_id: str
    position_size: float

class TradeResponse(BaseModel):
    id: int
    opportunity_id: str
    position_size: float
    execution_fee: float
    gross_profit: float
    net_profit: float
    platform_fee: float
    status: str
    executed_at: datetime
    completed_at: Optional[datetime]
    
    class Config:
        from_attributes = True