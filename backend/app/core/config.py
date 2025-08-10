"""
Configuration settings for Arboretum backend
"""
import os
from typing import Optional
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    """Application settings"""
    
    # App settings
    APP_NAME: str = "Arboretum"
    DEBUG: bool = True
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    
    # Database settings
    DATABASE_URL: str = "sqlite+aiosqlite:///./arboretum.db"
    
    # X402 Protocol settings
    BASE_SEPOLIA_RPC_URL: str = "https://sepolia.base.org"
    USDC_CONTRACT_ADDRESS: str = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"  # Base Sepolia USDC
    SERVICE_WALLET_ADDRESS: str = ""
    SERVICE_PRIVATE_KEY: str = ""

    # Firebase settings
    FIREBASE_KEY_B64: str = ""
    
    # CDP SDK settings
    CDP_API_KEY: str = ""
    CDP_API_SECRET: str = ""
    # CDP Data SQL API
    CDP_DATA_API_KEY: str = ""
    
    # External API settings
    POLYMARKET_API_URL: str = "https://clob.polymarket.com"
    KALSHI_API_URL: str = "https://api.elections.kalshi.com/trade-api/v2"
    POLYMARKET_API_KEY: str = ""
    KALSHI_API_KEY: str = ""
    
    # WebSocket settings
    REDIS_URL: str = "redis://localhost:6379"
    
    # Security
    SECRET_KEY: str = "dev_secret_key_change_in_production"
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    
    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "arboretum.log"
    
    # Demo settings
    DEMO_MODE: bool = True
    MOCK_PAYMENTS: bool = True
    MOCK_TRADES: bool = True
    
    # Trading settings
    EXECUTION_FEE_USDC: float = 2.00
    PROFIT_SHARE_PERCENT: float = 5.0
    MIN_PROFIT_THRESHOLD: float = 10.0
    
    class Config:
        env_file = ".env"
        case_sensitive = True

# Global settings instance
settings = Settings()

# Validation
if not settings.SERVICE_WALLET_ADDRESS and not settings.DEBUG:
    raise ValueError("SERVICE_WALLET_ADDRESS must be set for production")
    
if not settings.SERVICE_PRIVATE_KEY and not settings.DEBUG:
    raise ValueError("SERVICE_PRIVATE_KEY must be set for production")