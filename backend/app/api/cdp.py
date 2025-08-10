"""
CDP (Coinbase Developer Platform) API endpoints
"""
import logging
from fastapi import APIRouter, HTTPException
from app.services.cdp_service import CDPService

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/service-wallet")
async def get_service_wallet():
    """Get the service wallet address for receiving payments"""
    try:
        cdp_service = CDPService()
        address = cdp_service.get_service_wallet_address()
        
        if not address:
            raise HTTPException(status_code=500, detail="Service wallet not available")
        
        return {
            "address": address,
            "network": "base-sepolia",
            "currency": "USDC"
        }
        
    except Exception as e:
        logger.error(f"Error getting service wallet: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/verify-payment")
async def verify_payment(
    from_address: str,
    amount: float,
    transaction_hash: str
):
    """Verify USDC payment transaction"""
    try:
        cdp_service = CDPService()
        
        result = await cdp_service.verify_usdc_payment(
            from_address=from_address,
            expected_amount=amount,
            transaction_hash=transaction_hash
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Payment verification error: {e}")
        raise HTTPException(status_code=500, detail="Payment verification failed")