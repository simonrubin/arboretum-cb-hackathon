"""
Trade Unlock API endpoints
Track which opportunities have been unlocked by payment
"""
import logging
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import json
import os
from datetime import datetime

logger = logging.getLogger(__name__)
router = APIRouter()

# Simple JSON file storage for demo (in production would use database)
UNLOCKS_FILE = "unlocked_opportunities.json"

class UnlockRecord(BaseModel):
    opportunity_id: str
    user_wallet: str
    payment_hash: str
    unlock_timestamp: str
    payment_amount: float

def load_unlocks() -> List[Dict]:
    """Load unlocks from JSON file"""
    try:
        if os.path.exists(UNLOCKS_FILE):
            with open(UNLOCKS_FILE, 'r') as f:
                return json.load(f)
        return []
    except Exception as e:
        logger.error(f"Failed to load unlocks: {e}")
        return []

def save_unlocks(unlocks: List[Dict]):
    """Save unlocks to JSON file"""
    try:
        with open(UNLOCKS_FILE, 'w') as f:
            json.dump(unlocks, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save unlocks: {e}")

@router.post("/record")
async def record_unlock(unlock: UnlockRecord):
    """Record that an opportunity has been unlocked"""
    try:
        unlocks = load_unlocks()
        
        # Check if already unlocked
        existing = next((u for u in unlocks if 
                        u.get("opportunity_id") == unlock.opportunity_id and 
                        u.get("user_wallet") == unlock.user_wallet), None)
        
        if existing:
            return {
                "success": True,
                "message": "Opportunity already unlocked",
                "unlock_timestamp": existing.get("unlock_timestamp")
            }
        
        # Add new unlock record
        unlock_data = {
            "opportunity_id": unlock.opportunity_id,
            "user_wallet": unlock.user_wallet,
            "payment_hash": unlock.payment_hash,
            "unlock_timestamp": unlock.unlock_timestamp,
            "payment_amount": unlock.payment_amount
        }
        
        unlocks.append(unlock_data)
        save_unlocks(unlocks)
        
        logger.info(f"Recorded unlock for opportunity {unlock.opportunity_id} by wallet {unlock.user_wallet}")
        
        return {
            "success": True,
            "message": "Unlock recorded successfully",
            "unlock_timestamp": unlock.unlock_timestamp
        }
        
    except Exception as e:
        logger.error(f"Failed to record unlock: {e}")
        raise HTTPException(status_code=500, detail="Failed to record unlock")

@router.get("/check/{opportunity_id}")
async def check_unlock(opportunity_id: str, wallet_address: str):
    """Check if an opportunity has been unlocked for a specific wallet"""
    try:
        unlocks = load_unlocks()
        
        unlock_record = next((u for u in unlocks if 
                             u.get("opportunity_id") == opportunity_id and 
                             u.get("user_wallet") == wallet_address.lower()), None)
        
        if unlock_record:
            return {
                "unlocked": True,
                "unlock_timestamp": unlock_record.get("unlock_timestamp"),
                "payment_hash": unlock_record.get("payment_hash"),
                "payment_amount": unlock_record.get("payment_amount")
            }
        else:
            return {
                "unlocked": False
            }
            
    except Exception as e:
        logger.error(f"Failed to check unlock: {e}")
        raise HTTPException(status_code=500, detail="Failed to check unlock status")

@router.get("/user/{wallet_address}")
async def get_user_unlocks(wallet_address: str):
    """Get all unlocked opportunities for a wallet"""
    try:
        unlocks = load_unlocks()
        
        user_unlocks = [u for u in unlocks if u.get("user_wallet") == wallet_address.lower()]
        
        return {
            "wallet_address": wallet_address,
            "unlocked_opportunities": user_unlocks,
            "total_unlocked": len(user_unlocks)
        }
        
    except Exception as e:
        logger.error(f"Failed to get user unlocks: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user unlocks")