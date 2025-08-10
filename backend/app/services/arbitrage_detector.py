"""
Arbitrage Detection Service
Continuously monitors prediction markets for arbitrage opportunities
"""
import asyncio
import logging
import random
from datetime import datetime, timedelta
from typing import List, Dict, Any
from app.services.websocket_manager import WebSocketManager, ArbitrageOpportunity

logger = logging.getLogger(__name__)

class ArbitrageDetector:
    """Background service that detects arbitrage opportunities"""
    
    def __init__(self):
        self.running = False
        self.websocket_manager = None
        self.detection_task = None
        
    async def start(self):
        """Start the arbitrage detection background task"""
        if self.running:
            return
            
        self.running = True
        self.websocket_manager = WebSocketManager()
        
        # Start background task for detection
        self.detection_task = asyncio.create_task(self._detection_loop())
        
        # Start keepalive task for WebSocket connections
        asyncio.create_task(self.websocket_manager.start_keepalive_task())
        
        logger.info("🔍 Arbitrage detector started")
        
    async def stop(self):
        """Stop the arbitrage detection"""
        self.running = False
        if self.detection_task:
            self.detection_task.cancel()
            try:
                await self.detection_task
            except asyncio.CancelledError:
                pass
        logger.info("🛑 Arbitrage detector stopped")
        
    async def _detection_loop(self):
        """Main detection loop - runs continuously"""
        while self.running:
            try:
                # Wait between detection cycles (every 30-60 seconds for demo)
                await asyncio.sleep(random.uniform(30, 60))
                
                if not self.running:
                    break
                    
                # Mock arbitrage detection
                opportunity = await self._detect_mock_opportunity()
                
                if opportunity:
                    logger.info(f"📈 Found arbitrage: {opportunity.sport} - ${opportunity.estimated_profit:.2f} profit")
                    
                    # Broadcast to all connected clients
                    await self.websocket_manager.broadcast_opportunity(opportunity)
                    
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Detection loop error: {e}")
                await asyncio.sleep(5)  # Brief pause before retrying
                
    async def _detect_mock_opportunity(self) -> ArbitrageOpportunity:
        """Mock arbitrage opportunity detection for demo"""
        
        # Mock market data
        mock_opportunities = [
            {
                "id": f"NBA_{random.randint(1000, 9999)}",
                "sport": "NBA",
                "polymarket_market": "Lakers vs Heat - Lakers Win",
                "kalshi_market": "BBALL-25JAN19-LAL",
                "polymarket_price": round(random.uniform(0.35, 0.55), 2),
                "kalshi_price": round(random.uniform(0.45, 0.65), 2),
            },
            {
                "id": f"NFL_{random.randint(1000, 9999)}",
                "sport": "NFL",
                "polymarket_market": "Chiefs vs Bills - Chiefs Win", 
                "kalshi_market": "NFL-25JAN26-KC",
                "polymarket_price": round(random.uniform(0.40, 0.60), 2),
                "kalshi_price": round(random.uniform(0.50, 0.70), 2),
            },
            {
                "id": f"MLB_{random.randint(1000, 9999)}",
                "sport": "MLB",
                "polymarket_market": "Yankees vs Dodgers Game 1",
                "kalshi_market": "MLB-25OCT15-NYY",
                "polymarket_price": round(random.uniform(0.45, 0.60), 2),
                "kalshi_price": round(random.uniform(0.55, 0.70), 2),
            }
        ]
        
        # Pick random opportunity
        opp_data = random.choice(mock_opportunities)
        
        # Calculate arbitrage metrics
        poly_price = opp_data["polymarket_price"]
        kalshi_price = opp_data["kalshi_price"]
        
        # Only create opportunity if there's actually an arbitrage
        if kalshi_price > poly_price + 0.05:  # At least 5% spread
            required_capital = random.uniform(100, 300)
            gross_profit = required_capital * (kalshi_price - poly_price)
            estimated_profit = gross_profit - 2.0  # Minus execution fee
            
            if estimated_profit > 10:  # Minimum $10 profit
                return ArbitrageOpportunity(
                    id=opp_data["id"],
                    sport=opp_data["sport"],
                    polymarket_market=opp_data["polymarket_market"],
                    kalshi_market=opp_data["kalshi_market"],
                    polymarket_price=poly_price,
                    kalshi_price=kalshi_price,
                    estimated_profit=round(estimated_profit, 2),
                    required_capital=round(required_capital, 2),
                    confidence=random.uniform(0.75, 0.95),
                    expires_at=datetime.now() + timedelta(minutes=random.randint(15, 45))
                )
        
        return None  # No arbitrage opportunity found
        
    async def get_current_opportunities(self) -> List[Dict[str, Any]]:
        """Get currently active arbitrage opportunities"""
        # Return demo opportunities from WebSocketManager
        if self.websocket_manager:
            return [opp.to_dict() for opp in self.websocket_manager.demo_opportunities]
        return []