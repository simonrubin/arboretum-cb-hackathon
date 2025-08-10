"""
Balances API endpoints for Polymarket and Kalshi account balances.
"""

from fastapi import APIRouter, HTTPException, Header
from typing import Optional
import logging
import random

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/polymarket")
async def get_polymarket_balance(
    wallet_address: Optional[str] = Header(None, alias="wallet-address"),
    api_key: Optional[str] = Header(None, alias="api-key")
):
    """
    Get Polymarket account balance.
    
    Headers:
    - wallet-address: The user's wallet address
    - api-key: Polymarket API key
    """
    try:
        logger.info(f"Fetching Polymarket balance for wallet: {wallet_address}")
        
        if not api_key:
            logger.warning("No Polymarket API key provided")
            raise HTTPException(status_code=400, detail="Polymarket API key required")
        
        # For demo purposes, return mock data
        # TODO: Implement proper Polymarket client initialization
        balance = round(random.uniform(100, 1000), 2)
        
        logger.info(f"Successfully retrieved Polymarket balance: {balance}")
        
        return {
            "platform": "polymarket",
            "balance": balance,
            "currency": "USDC",
            "wallet_address": wallet_address,
            "success": True
        }
        
    except Exception as e:
        logger.error(f"Error fetching Polymarket balance: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to fetch Polymarket balance: {str(e)}"
        )


@router.get("/kalshi")
async def get_kalshi_balance(
    wallet_address: Optional[str] = Header(None, alias="wallet-address"),
    api_key: Optional[str] = Header(None, alias="api-key"),
    api_secret: Optional[str] = Header(None, alias="api-secret")
):
    """
    Get Kalshi account balance.
    
    Headers:
    - wallet-address: The user's wallet address  
    - api-key: Kalshi API key
    - api-secret: Kalshi API secret
    """
    try:
        logger.info(f"Fetching Kalshi balance for wallet: {wallet_address}")
        
        if not api_key or not api_secret:
            logger.warning("Missing Kalshi API credentials")
            raise HTTPException(
                status_code=400, 
                detail="Both Kalshi API key and secret are required"
            )
        
        # For demo purposes, return mock data
        # TODO: Implement proper Kalshi client initialization with RSA keys
        balance = round(random.uniform(50, 500), 2)
        
        logger.info(f"Successfully retrieved Kalshi balance: {balance}")
        
        return {
            "platform": "kalshi",
            "balance": balance,
            "currency": "USD",
            "wallet_address": wallet_address,
            "success": True
        }
        
    except Exception as e:
        logger.error(f"Error fetching Kalshi balance: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to fetch Kalshi balance: {str(e)}"
        )


@router.get("/summary")
async def get_balance_summary(
    wallet_address: Optional[str] = Header(None, alias="wallet-address"),
    polymarket_api_key: Optional[str] = Header(None, alias="polymarket-api-key"),
    kalshi_api_key: Optional[str] = Header(None, alias="kalshi-api-key"),
    kalshi_api_secret: Optional[str] = Header(None, alias="kalshi-api-secret")
):
    """
    Get combined balance summary from both platforms.
    """
    summary = {
        "wallet_address": wallet_address,
        "balances": {},
        "total_usd": 0.0,
        "success": True,
        "errors": []
    }
    
    # Fetch Polymarket balance if API key provided
    if polymarket_api_key:
        try:
            # Demo mock balance
            poly_balance = round(random.uniform(100, 1000), 2)
            summary["balances"]["polymarket"] = {
                "balance": poly_balance,
                "currency": "USDC"
            }
            summary["total_usd"] += poly_balance
        except Exception as e:
            summary["errors"].append(f"Polymarket: {str(e)}")
    
    # Fetch Kalshi balance if API credentials provided
    if kalshi_api_key and kalshi_api_secret:
        try:
            # Demo mock balance
            kalshi_balance = round(random.uniform(50, 500), 2)
            summary["balances"]["kalshi"] = {
                "balance": kalshi_balance,
                "currency": "USD"
            }
            summary["total_usd"] += kalshi_balance
        except Exception as e:
            summary["errors"].append(f"Kalshi: {str(e)}")
    
    return summary