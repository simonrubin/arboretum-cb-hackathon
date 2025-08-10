"""
WebSocket Manager for Real-time Arbitrage Alerts
Handles client connections, auto-unlock logic, and X402 paywall integration
"""
import asyncio
import json
import logging
from typing import Dict, List, Set, Optional
from datetime import datetime, timedelta
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.services.x402_service import X402PaymentService
from app.services.cdp_service import CDPService

logger = logging.getLogger(__name__)

class ArbitrageOpportunity:
    """Arbitrage opportunity data structure"""
    
    def __init__(
        self,
        id: str,
        sport: str,
        polymarket_market: str,
        kalshi_market: str,
        polymarket_price: float,
        kalshi_price: float,
        estimated_profit: float,
        required_capital: float,
        confidence: float,
        expires_at: datetime
    ):
        self.id = id
        self.sport = sport
        self.polymarket_market = polymarket_market
        self.kalshi_market = kalshi_market
        self.polymarket_price = polymarket_price
        self.kalshi_price = kalshi_price
        self.estimated_profit = estimated_profit
        self.required_capital = required_capital
        self.confidence = confidence
        self.expires_at = expires_at
        self.created_at = datetime.now()
    
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "sport": self.sport,
            "polymarket_market": self.polymarket_market,
            "kalshi_market": self.kalshi_market,
            "polymarket_price": self.polymarket_price,
            "kalshi_price": self.kalshi_price,
            "estimated_profit": self.estimated_profit,
            "required_capital": self.required_capital,
            "confidence": self.confidence,
            "expires_at": self.expires_at.isoformat(),
            "created_at": self.created_at.isoformat(),
            "time_remaining": int((self.expires_at - datetime.now()).total_seconds())
        }

class WebSocketConnection:
    """Individual WebSocket connection with user context"""
    
    def __init__(self, websocket: WebSocket, user_id: Optional[int] = None):
        self.websocket = websocket
        self.user_id = user_id
        self.connected_at = datetime.now()
        self.last_ping = datetime.now()
        self.subscribed_to_alerts = False
    
    async def send_json(self, data: dict):
        """Send JSON data to client"""
        try:
            await self.websocket.send_text(json.dumps(data))
        except Exception as e:
            logger.error(f"Failed to send message to user {self.user_id}: {e}")
            raise
    
    async def ping(self):
        """Send ping to keep connection alive"""
        await self.send_json({"type": "ping", "timestamp": datetime.now().isoformat()})
        self.last_ping = datetime.now()

class WebSocketManager:
    """Manages WebSocket connections and real-time arbitrage alerts"""
    
    def __init__(self):
        self.connections: Dict[int, WebSocketConnection] = {}  # user_id -> connection
        self.anonymous_connections: Set[WebSocket] = set()
        self.x402_service = X402PaymentService()
        self.cdp_service = CDPService()
        
        # Demo data for development
        self.demo_opportunities = []
        self._generate_demo_opportunities()
        
        logger.info("WebSocket Manager initialized")
    
    async def connect(self, websocket: WebSocket, user_id: Optional[int] = None):
        """Accept new WebSocket connection"""
        await websocket.accept()
        
        if user_id:
            # Authenticated connection
            if user_id in self.connections:
                # Close existing connection
                try:
                    await self.connections[user_id].websocket.close()
                except:
                    pass
            
            self.connections[user_id] = WebSocketConnection(websocket, user_id)
            logger.info(f"User {user_id} connected to WebSocket")
            
            # Send welcome message
            await self.connections[user_id].send_json({
                "type": "connected",
                "user_id": user_id,
                "message": "Connected to Arboretum real-time alerts",
                "timestamp": datetime.now().isoformat()
            })
            
            # Check if user is eligible for auto-alerts
            await self._check_user_eligibility(user_id)
            
        else:
            # Anonymous connection
            self.anonymous_connections.add(websocket)
            logger.info("Anonymous user connected to WebSocket")
            
            await websocket.send_text(json.dumps({
                "type": "connected",
                "message": "Connected to Arboretum. Sign up for personalized alerts!",
                "timestamp": datetime.now().isoformat()
            }))
    
    async def disconnect(self, websocket: WebSocket, user_id: Optional[int] = None):
        """Handle WebSocket disconnection"""
        if user_id and user_id in self.connections:
            del self.connections[user_id]
            logger.info(f"User {user_id} disconnected from WebSocket")
        elif websocket in self.anonymous_connections:
            self.anonymous_connections.discard(websocket)
            logger.info("Anonymous user disconnected from WebSocket")
    
    async def broadcast_opportunity(self, opportunity: ArbitrageOpportunity):
        """Broadcast arbitrage opportunity to eligible users"""
        message_data = {
            "type": "arbitrage_opportunity",
            "opportunity": opportunity.to_dict(),
            "timestamp": datetime.now().isoformat()
        }
        
        # Send to all connected users with eligibility check
        for user_id, connection in list(self.connections.items()):
            try:
                # Check if user is eligible for auto-unlock
                eligibility = await self._check_auto_unlock_eligibility(user_id, opportunity)
                
                if eligibility["eligible"]:
                    # Send auto-unlocked opportunity
                    unlocked_message = {
                        **message_data,
                        "status": "auto_unlocked",
                        "eligibility": eligibility,
                        "action_required": "none",
                        "message": f"✅ Auto-unlocked! Executing ${opportunity.estimated_profit:.2f} arbitrage..."
                    }
                    await connection.send_json(unlocked_message)
                    
                    # Trigger auto-execution
                    asyncio.create_task(self._auto_execute_opportunity(user_id, opportunity))
                    
                else:
                    # Send preview only
                    preview_message = {
                        **message_data,
                        "status": "preview_only",
                        "eligibility": eligibility,
                        "action_required": "payment_or_funding",
                        "message": f"💰 ${opportunity.estimated_profit:.2f} arbitrage found! Fund account to auto-unlock."
                    }
                    await connection.send_json(preview_message)
                    
            except WebSocketDisconnect:
                # Connection was closed
                await self.disconnect(connection.websocket, user_id)
            except Exception as e:
                logger.error(f"Failed to send opportunity to user {user_id}: {e}")
        
        # Send preview to anonymous users
        anonymous_message = {
            **message_data,
            "status": "preview_only",
            "message": "🔒 Sign up and connect wallet to unlock arbitrage opportunities!",
            "call_to_action": "register"
        }
        
        for websocket in list(self.anonymous_connections):
            try:
                await websocket.send_text(json.dumps(anonymous_message))
            except:
                self.anonymous_connections.discard(websocket)
    
    async def _check_user_eligibility(self, user_id: int):
        """Check user eligibility and send status update"""
        try:
            async with AsyncSessionLocal() as db:
                user = await db.get(User, user_id)
                if not user:
                    return
                
                eligibility = await self.x402_service.validate_auto_unlock_eligibility(
                    user, 100.0  # Sample trade amount
                )
                
                connection = self.connections.get(user_id)
                if connection:
                    await connection.send_json({
                        "type": "eligibility_status",
                        "eligible": eligibility["eligible"],
                        "details": eligibility,
                        "timestamp": datetime.now().isoformat()
                    })
                    
        except Exception as e:
            logger.error(f"Failed to check eligibility for user {user_id}: {e}")
    
    async def _check_auto_unlock_eligibility(
        self, 
        user_id: int, 
        opportunity: ArbitrageOpportunity
    ) -> dict:
        """Check if opportunity should auto-unlock for user"""
        try:
            async with AsyncSessionLocal() as db:
                user = await db.get(User, user_id)
                if not user:
                    return {"eligible": False, "reason": "user_not_found"}
                
                return await self.x402_service.validate_auto_unlock_eligibility(
                    user, opportunity.required_capital
                )
                
        except Exception as e:
            logger.error(f"Auto-unlock eligibility check failed for user {user_id}: {e}")
            return {"eligible": False, "reason": "eligibility_check_failed", "error": str(e)}
    
    async def _auto_execute_opportunity(self, user_id: int, opportunity: ArbitrageOpportunity):
        """Execute arbitrage opportunity automatically for user"""
        try:
            async with AsyncSessionLocal() as db:
                user = await db.get(User, user_id)
                if not user:
                    return
                
                connection = self.connections.get(user_id)
                if not connection:
                    return
                
                # Send execution started message
                await connection.send_json({
                    "type": "trade_execution",
                    "status": "started",
                    "opportunity_id": opportunity.id,
                    "message": f"🚀 Executing {opportunity.sport} arbitrage...",
                    "timestamp": datetime.now().isoformat()
                })
                
                # Simulate execution delay
                await asyncio.sleep(2)
                
                # Mock execution result (in real implementation, this would call trading APIs)
                execution_result = await self._mock_trade_execution(opportunity)
                
                if execution_result["success"]:
                    # Send success message
                    await connection.send_json({
                        "type": "trade_execution",
                        "status": "completed",
                        "opportunity_id": opportunity.id,
                        "result": execution_result,
                        "message": f"✅ Trade completed! Profit: ${execution_result['net_profit']:.2f}",
                        "timestamp": datetime.now().isoformat()
                    })
                    
                    # Distribute profits using CDP
                    if execution_result['net_profit'] > 0:
                        await self._distribute_profits(user, execution_result, opportunity.id)
                        
                else:
                    # Send failure message
                    await connection.send_json({
                        "type": "trade_execution",
                        "status": "failed",
                        "opportunity_id": opportunity.id,
                        "error": execution_result["error"],
                        "message": f"❌ Trade failed: {execution_result['error']}",
                        "timestamp": datetime.now().isoformat()
                    })
                    
        except Exception as e:
            logger.error(f"Auto-execution failed for user {user_id}: {e}")
            connection = self.connections.get(user_id)
            if connection:
                await connection.send_json({
                    "type": "trade_execution",
                    "status": "error",
                    "opportunity_id": opportunity.id,
                    "error": str(e),
                    "message": f"⚠️ Execution error: {str(e)}",
                    "timestamp": datetime.now().isoformat()
                })
    
    async def _mock_trade_execution(self, opportunity: ArbitrageOpportunity) -> dict:
        """Mock trade execution for demo (90% success rate)"""
        import random
        
        # Simulate execution time
        await asyncio.sleep(random.uniform(1, 3))
        
        # 90% success rate for demo
        if random.random() < 0.9:
            # Successful execution
            execution_fee = 2.00
            gross_profit = opportunity.estimated_profit * random.uniform(0.8, 1.1)  # Some variance
            platform_fee = gross_profit * 0.05  # 5% platform fee
            net_profit = gross_profit - platform_fee - execution_fee
            
            return {
                "success": True,
                "gross_profit": gross_profit,
                "execution_fee": execution_fee,
                "platform_fee": platform_fee,
                "net_profit": max(0, net_profit),  # Ensure non-negative
                "polymarket_fill": {"status": "filled", "price": opportunity.polymarket_price},
                "kalshi_fill": {"status": "filled", "price": opportunity.kalshi_price}
            }
        else:
            # Failed execution (rollback scenario)
            return {
                "success": False,
                "error": "Kalshi order failed - position rolled back",
                "rollback_cost": random.uniform(1.0, 4.0),
                "net_profit": -2.0  # Lost execution fee
            }
    
    async def _distribute_profits(self, user: User, execution_result: dict, opportunity_id: str):
        """Distribute profits to user wallet using CDP"""
        try:
            if execution_result["net_profit"] <= 0:
                return
            
            # Use CDP service to send profits
            distribution_result = await self.cdp_service.send_usdc(
                recipient_address=user.wallet_address,
                amount=execution_result["net_profit"],
                memo=f"Arbitrage profit from {opportunity_id}"
            )
            
            connection = self.connections.get(user.id)
            if connection and distribution_result["success"]:
                await connection.send_json({
                    "type": "profit_distribution",
                    "status": "completed",
                    "amount": execution_result["net_profit"],
                    "transaction_hash": distribution_result["transaction_hash"],
                    "message": f"💰 ${execution_result['net_profit']:.2f} sent to your wallet!",
                    "timestamp": datetime.now().isoformat()
                })
                
        except Exception as e:
            logger.error(f"Profit distribution failed for user {user.id}: {e}")
    
    def _generate_demo_opportunities(self):
        """Generate demo arbitrage opportunities for testing"""
        from datetime import datetime, timedelta
        
        demo_data = [
            {
                "id": "NBA_HEAT_LAKERS_001",
                "sport": "NBA",
                "polymarket_market": "Miami Heat to beat Lakers",
                "kalshi_market": "BBALL-25JAN19-HEAT", 
                "polymarket_price": 0.45,
                "kalshi_price": 0.58,
                "estimated_profit": 28.50,
                "required_capital": 200.0,
                "confidence": 0.92
            },
            {
                "id": "NFL_BILLS_CHIEFS_002", 
                "sport": "NFL",
                "polymarket_market": "Buffalo Bills to beat Chiefs",
                "kalshi_market": "NFL-25JAN26-BILLS",
                "polymarket_price": 0.38,
                "kalshi_price": 0.49, 
                "estimated_profit": 22.10,
                "required_capital": 150.0,
                "confidence": 0.87
            },
            {
                "id": "MLB_YANKEES_DODGERS_003",
                "sport": "MLB", 
                "polymarket_market": "Yankees beat Dodgers Game 1",
                "kalshi_market": "MLB-25OCT15-NYY",
                "polymarket_price": 0.52,
                "kalshi_price": 0.63,
                "estimated_profit": 18.75,
                "required_capital": 125.0,
                "confidence": 0.81
            }
        ]
        
        for data in demo_data:
            opportunity = ArbitrageOpportunity(
                id=data["id"],
                sport=data["sport"],
                polymarket_market=data["polymarket_market"],
                kalshi_market=data["kalshi_market"],
                polymarket_price=data["polymarket_price"],
                kalshi_price=data["kalshi_price"],
                estimated_profit=data["estimated_profit"],
                required_capital=data["required_capital"],
                confidence=data["confidence"],
                expires_at=datetime.now() + timedelta(minutes=30)
            )
            self.demo_opportunities.append(opportunity)
    
    async def send_demo_opportunity(self):
        """Send a random demo opportunity (for testing)"""
        if self.demo_opportunities:
            import random
            opportunity = random.choice(self.demo_opportunities)
            
            # Update expiry time
            opportunity.expires_at = datetime.now() + timedelta(minutes=30)
            
            await self.broadcast_opportunity(opportunity)
    
    async def start_keepalive_task(self):
        """Start background task to keep connections alive"""
        while True:
            try:
                # Send ping to all connections every 30 seconds
                for user_id, connection in list(self.connections.items()):
                    try:
                        await connection.ping()
                    except:
                        await self.disconnect(connection.websocket, user_id)
                
                # Clean up stale anonymous connections
                for websocket in list(self.anonymous_connections):
                    try:
                        await websocket.send_text(json.dumps({
                            "type": "ping",
                            "timestamp": datetime.now().isoformat()
                        }))
                    except:
                        self.anonymous_connections.discard(websocket)
                
                await asyncio.sleep(30)
                
            except Exception as e:
                logger.error(f"Keepalive task error: {e}")
                await asyncio.sleep(5)