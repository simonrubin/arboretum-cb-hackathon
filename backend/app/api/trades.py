"""
Trade execution API endpoints
Protected by X402 payment middleware
"""
import logging
from typing import Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.x402_service import X402PaymentService
from app.services.websocket_manager import WebSocketManager
from app.services.cdp_service import CDPService
from app.core.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()

class TradeExecutionRequest(BaseModel):
    opportunity_id: str
    user_id: int
    payment_hash: str  # X402 payment transaction hash
    wallet_address: str  # User's wallet address

class TradeExecutionResponse(BaseModel):
    success: bool
    trade_id: str
    gross_profit: float
    net_profit: float
    execution_fee: float
    platform_fee: float
    message: str

@router.post("/execute", response_model=TradeExecutionResponse)
async def execute_trade(
    request: TradeExecutionRequest,
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Execute arbitrage trade (protected by X402 payment)
    
    Requires payment verification before trade execution.
    """
    try:
        # Initialize services
        x402_service = X402PaymentService()
        cdp_service = CDPService()
        websocket_manager = WebSocketManager()
        
        # Get user from database
        from app.models.user import User
        user = await db.get(User, request.user_id)
        if not user:
            if settings.DEMO_MODE:
                # Create a demo user on the fly for local testing
                from datetime import datetime
                demo_email = f"demo+{datetime.utcnow().timestamp()}@arboretum.local"
                user = User(email=demo_email, wallet_address=request.wallet_address)
                db.add(user)
                await db.flush()  # assign id
            else:
                raise HTTPException(status_code=404, detail="User not found")
        
        # Verify X402 payment before executing trade
        payment_verification = await cdp_service.verify_usdc_payment(
            from_address=request.wallet_address,
            expected_amount=0.01,  # $0.01 USDC execution fee
            transaction_hash=request.payment_hash
        )
        
        if not payment_verification.get("verified", False):
            raise HTTPException(
                status_code=402,
                detail=f"Payment verification failed: {payment_verification.get('error', 'Invalid payment')}"
            )
        
        # Record the unlock for this opportunity
        try:
            from datetime import datetime
            unlock_data = {
                "opportunity_id": request.opportunity_id,
                "user_wallet": request.wallet_address.lower(),
                "payment_hash": request.payment_hash,
                "unlock_timestamp": datetime.utcnow().isoformat(),
                "payment_amount": payment_verification.get("amount", 0.01)
            }
            
            # Save to unlock records (using simple JSON storage)
            from app.api.unlocks import save_unlocks, load_unlocks
            unlocks = load_unlocks()
            
            # Check if not already unlocked
            existing = next((u for u in unlocks if 
                            u.get("opportunity_id") == request.opportunity_id and 
                            u.get("user_wallet") == request.wallet_address.lower()), None)
            
            if not existing:
                unlocks.append(unlock_data)
                save_unlocks(unlocks)
                logger.info(f"Recorded unlock for opportunity {request.opportunity_id}")
            
        except Exception as e:
            logger.warning(f"Failed to record unlock: {e}")
            # Don't fail the trade execution for unlock recording issues
        
        # Mock trade execution (in real implementation, this would call trading APIs)
        execution_result = await _execute_arbitrage_trade(
            request.opportunity_id, 
            user,
            db,
            verified_payment=payment_verification
        )
        
        if execution_result["success"]:
            # Send success message via WebSocket
            connection = websocket_manager.connections.get(request.user_id)
            if connection:
                await connection.send_json({
                    "type": "trade_execution",
                    "status": "completed",
                    "opportunity_id": request.opportunity_id,
                    "result": execution_result,
                    "message": f" Trade completed! Net profit: ${execution_result['net_profit']:.2f}"
                })
            
            return TradeExecutionResponse(
                success=True,
                trade_id=execution_result["trade_id"],
                gross_profit=execution_result["gross_profit"],
                net_profit=execution_result["net_profit"],
                execution_fee=execution_result["execution_fee"],
                platform_fee=execution_result["platform_fee"],
                message="Trade executed successfully"
            )
        else:
            # Send failure message via WebSocket
            connection = websocket_manager.connections.get(request.user_id)
            if connection:
                await connection.send_json({
                    "type": "trade_execution",
                    "status": "failed",
                    "opportunity_id": request.opportunity_id,
                    "error": execution_result["error"],
                    "message": f" Trade failed: {execution_result['error']}"
                })
            
            raise HTTPException(
                status_code=400, 
                detail=f"Trade execution failed: {execution_result['error']}"
            )
            
    except Exception as e:
        logger.error(f"Trade execution error: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def _execute_arbitrage_trade(
    opportunity_id: str, 
    user: Any, 
    db: AsyncSession,
    verified_payment: Dict[str, Any]
) -> Dict[str, Any]:
    """Mock arbitrage trade execution with verified payment"""
    import random
    import uuid
    
    # Simulate execution delay
    import asyncio
    await asyncio.sleep(1)
    
    # 90% success rate for demo
    if random.random() < 0.9:
        # Successful execution
        execution_fee = verified_payment.get("amount", 0.01)  # Actual paid amount
        gross_profit = random.uniform(15.0, 50.0)
        platform_fee = gross_profit * 0.05  # 5% platform fee
        net_profit = gross_profit - platform_fee
        
        return {
            "success": True,
            "trade_id": f"trade_{uuid.uuid4().hex[:8]}",
            "gross_profit": gross_profit,
            "execution_fee": execution_fee,
            "platform_fee": platform_fee,
            "net_profit": max(0, net_profit),
            "polymarket_fill": {"status": "filled", "price": random.uniform(0.4, 0.6)},
            "kalshi_fill": {"status": "filled", "price": random.uniform(0.5, 0.7)}
        }
    else:
        # Failed execution
        return {
            "success": False,
            "error": "Market conditions changed - arbitrage no longer profitable",
            "trade_id": f"failed_{uuid.uuid4().hex[:8]}"
        }

@router.get("/history/{user_id}")
async def get_trade_history(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get user's trade execution history"""
    # Mock trade history for demo
    return {
        "user_id": user_id,
        "trades": [
            {
                "trade_id": "trade_abc123",
                "opportunity_id": "NBA_HEAT_LAKERS_001", 
                "executed_at": "2025-01-10T15:30:00Z",
                "gross_profit": 28.50,
                "net_profit": 25.08,
                "execution_fee": 2.00,
                "platform_fee": 1.42,
                "status": "completed"
            }
        ],
        "total_trades": 1,
        "total_profit": 25.08
    }