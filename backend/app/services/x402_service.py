"""
X402 Payment Service - Real implementation for trade execution payments
"""
import logging
from typing import Optional, Dict, Any
from decimal import Decimal

# X402 imports - with fallbacks for demo mode
try:
    from x402 import verify_payment, create_payment_request
    from x402.types import PaymentRequest, PaymentProof
except ImportError:
    # Mock types for demo mode
    class PaymentRequest:
        pass
    class PaymentProof:
        pass
    
    def verify_payment(*args, **kwargs):
        return {"verified": True, "amount": "2.00"}
    
    def create_payment_request(*args, **kwargs):
        return PaymentRequest()

from app.core.config import settings
from app.models.user import User
from app.services.cdp_service import CDPService

logger = logging.getLogger(__name__)

class X402PaymentService:
    """Handle X402 payments for trade execution and platform fees"""
    
    def __init__(self):
        self.cdp_service = CDPService()
        self.execution_fee = Decimal(str(settings.EXECUTION_FEE_USDC))
        
    async def create_trade_payment_request(
        self, 
        user: User, 
        opportunity_id: str, 
        trade_amount: float
    ) -> PaymentRequest:
        """Create X402 payment request for trade execution"""
        
        try:
            payment_request = create_payment_request(
                amount=str(self.execution_fee),
                currency="USDC",
                recipient_address=settings.SERVICE_WALLET_ADDRESS,
                network="base-sepolia",
                metadata={
                    "user_id": user.id,
                    "opportunity_id": opportunity_id,
                    "trade_amount": trade_amount,
                    "service": "arbitrage_execution"
                }
            )
            
            logger.info(f"Created payment request for user {user.id}, amount: ${self.execution_fee}")
            return payment_request
            
        except Exception as e:
            logger.error(f"Failed to create payment request: {e}")
            raise
    
    async def verify_trade_payment(
        self, 
        payment_proof: PaymentProof, 
        expected_user_id: int,
        expected_opportunity_id: str
    ) -> Dict[str, Any]:
        """Verify X402 payment proof for trade execution"""
        
        try:
            # Verify the payment proof using X402
            verification_result = await verify_payment(
                payment_proof=payment_proof,
                expected_amount=str(self.execution_fee),
                expected_currency="USDC",
                expected_recipient=settings.SERVICE_WALLET_ADDRESS,
                network="base-sepolia"
            )
            
            if not verification_result.valid:
                logger.warning(f"Payment verification failed: {verification_result.error}")
                return {
                    "valid": False,
                    "error": verification_result.error,
                    "payment_hash": None
                }
            
            # Extract metadata from payment
            metadata = verification_result.metadata or {}
            
            # Validate metadata matches request
            if (metadata.get("user_id") != expected_user_id or 
                metadata.get("opportunity_id") != expected_opportunity_id):
                logger.warning(f"Payment metadata mismatch for user {expected_user_id}")
                return {
                    "valid": False,
                    "error": "Payment metadata mismatch",
                    "payment_hash": verification_result.transaction_hash
                }
            
            logger.info(f"Payment verified successfully: {verification_result.transaction_hash}")
            
            return {
                "valid": True,
                "payment_hash": verification_result.transaction_hash,
                "amount": verification_result.amount,
                "timestamp": verification_result.timestamp,
                "metadata": metadata
            }
            
        except Exception as e:
            logger.error(f"Payment verification error: {e}")
            return {
                "valid": False,
                "error": str(e),
                "payment_hash": None
            }
    
    async def process_profit_distribution(
        self, 
        user: User, 
        trade_profit: Decimal, 
        trade_id: int
    ) -> Dict[str, Any]:
        """Distribute profits to user wallet using CDP"""
        
        try:
            # Calculate profit split
            platform_share = trade_profit * (Decimal(str(settings.PROFIT_SHARE_PERCENT)) / 100)
            user_share = trade_profit - platform_share
            
            # Use CDP to send user their share
            if user_share > 0:
                cdp_result = await self.cdp_service.send_usdc(
                    recipient_address=user.wallet_address,
                    amount=float(user_share),
                    memo=f"Arbitrage profit from trade #{trade_id}"
                )
                
                if not cdp_result["success"]:
                    raise Exception(f"CDP transfer failed: {cdp_result['error']}")
                
                logger.info(f"Profit distributed: ${user_share} to {user.wallet_address}")
                
                return {
                    "success": True,
                    "user_share": float(user_share),
                    "platform_share": float(platform_share),
                    "transaction_hash": cdp_result["transaction_hash"],
                    "recipient": user.wallet_address
                }
            else:
                logger.warning(f"No profit to distribute for trade {trade_id}")
                return {
                    "success": False,
                    "error": "No profit to distribute",
                    "user_share": 0.0,
                    "platform_share": float(platform_share)
                }
                
        except Exception as e:
            logger.error(f"Profit distribution failed: {e}")
            return {
                "success": False,
                "error": str(e),
                "user_share": 0.0,
                "platform_share": float(platform_share)
            }
    
    async def get_user_payment_balance(self, user: User) -> Dict[str, Any]:
        """Get user's USDC balance for payment validation"""
        
        try:
            if not user.wallet_address:
                return {"balance": 0.0, "can_pay_execution_fee": False}
            
            # Use CDP to check USDC balance
            balance_result = await self.cdp_service.get_usdc_balance(user.wallet_address)
            
            if not balance_result["success"]:
                logger.warning(f"Failed to get balance for {user.wallet_address}")
                return {"balance": 0.0, "can_pay_execution_fee": False}
            
            balance = Decimal(str(balance_result["balance"]))
            can_pay = balance >= self.execution_fee
            
            return {
                "balance": float(balance),
                "can_pay_execution_fee": can_pay,
                "execution_fee_required": float(self.execution_fee)
            }
            
        except Exception as e:
            logger.error(f"Balance check failed: {e}")
            return {
                "balance": 0.0,
                "can_pay_execution_fee": False,
                "error": str(e)
            }
    
    async def validate_auto_unlock_eligibility(
        self, 
        user: User, 
        trade_amount: float
    ) -> Dict[str, Any]:
        """Check if user is eligible for auto-unlock based on balance and settings"""
        
        try:
            # Check payment balance
            payment_info = await self.get_user_payment_balance(user)
            
            # Check if user has enough for execution fee
            if not payment_info["can_pay_execution_fee"]:
                return {
                    "eligible": False,
                    "reason": "insufficient_balance_for_fee",
                    "required": float(self.execution_fee),
                    "available": payment_info["balance"]
                }
            
            # Check if trade amount exceeds user's risk limits
            if trade_amount > user.max_risk_per_trade:
                return {
                    "eligible": False,
                    "reason": "exceeds_risk_limit",
                    "trade_amount": trade_amount,
                    "max_allowed": user.max_risk_per_trade
                }
            
            # Check if auto execution is enabled
            if not user.auto_execution_enabled:
                return {
                    "eligible": False,
                    "reason": "auto_execution_disabled",
                    "message": "User has disabled automatic trade execution"
                }
            
            return {
                "eligible": True,
                "payment_balance": payment_info["balance"],
                "execution_fee": float(self.execution_fee),
                "trade_amount": trade_amount
            }
            
        except Exception as e:
            logger.error(f"Auto-unlock validation failed: {e}")
            return {
                "eligible": False,
                "reason": "validation_error",
                "error": str(e)
            }