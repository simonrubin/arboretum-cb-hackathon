"""
Arbitrage opportunities API endpoints
"""
import logging
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.core.firebase import read_arbs

logger = logging.getLogger(__name__)
router = APIRouter()

class ArbitrageOpportunityResponse(BaseModel):
    opportunities: List[Any]

@router.get("/", response_model=ArbitrageOpportunityResponse)
async def get_opportunities() -> List[Dict[str, Any]]:
    """Get current arbitrage opportunities"""
    opps = read_arbs()
    for opp in opps:
        opp["id"] = opp["trade_a"]["id"] + opp["trade_b"]["id"]
    return ArbitrageOpportunityResponse(opportunities=opps)

@router.get("/{opportunity_id}", response_model=ArbitrageOpportunityResponse)
async def get_opportunity(opportunity_id: str) -> Dict[str, Any]:
    """Get specific arbitrage opportunity"""
    # Mock single opportunity
    if opportunity_id == "NBA_HEAT_LAKERS_001":
        return ArbitrageOpportunityResponse(
            id="NBA_HEAT_LAKERS_001",
            sport="NBA",
            polymarket_market="Miami Heat to beat Lakers",
            kalshi_market="BBALL-25JAN19-HEAT",
            polymarket_price=0.45,
            kalshi_price=0.58,
            estimated_profit=28.50,
            required_capital=200.0,
            confidence=0.92,
            expires_at=(datetime.now() + timedelta(hours=2)).isoformat(),
            created_at=datetime.now().isoformat(),
            time_remaining=7200
        )
    
    raise HTTPException(status_code=404, detail="Opportunity not found")