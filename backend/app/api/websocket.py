"""
WebSocket API endpoints for real-time arbitrage alerts
"""
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from typing import Optional

from app.services.websocket_manager import WebSocketManager

logger = logging.getLogger(__name__)
router = APIRouter()

# Global WebSocket manager instance
websocket_manager = WebSocketManager()

@router.websocket("/ws/opportunities")
async def websocket_opportunities(
    websocket: WebSocket,
    user_id: Optional[int] = Query(None)
):
    """
    WebSocket endpoint for real-time arbitrage opportunities
    
    Query Parameters:
    - user_id: Optional user ID for authenticated connections
    
    Message Types Sent:
    - connected: Initial connection confirmation
    - arbitrage_opportunity: New arbitrage opportunities (auto-unlocked or preview)
    - trade_execution: Trade execution status updates
    - profit_distribution: Profit distribution confirmations
    - eligibility_status: User eligibility for auto-unlock
    - ping: Keepalive messages
    """
    await websocket_manager.connect(websocket, user_id)
    
    try:
        while True:
            # Listen for client messages
            data = await websocket.receive_text()
            
            # Handle client messages
            try:
                import json
                message = json.loads(data)
                await handle_client_message(websocket, user_id, message)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({
                    "type": "error",
                    "message": "Invalid JSON format",
                    "timestamp": "now"
                }))
                
    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected for user {user_id}")
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
    finally:
        await websocket_manager.disconnect(websocket, user_id)

async def handle_client_message(websocket: WebSocket, user_id: Optional[int], message: dict):
    """Handle messages from WebSocket clients"""
    message_type = message.get("type", "")
    
    if message_type == "pong":
        # Client responding to ping - no action needed
        pass
    elif message_type == "subscribe_alerts":
        # Client wants to subscribe to alerts
        if user_id:
            connection = websocket_manager.connections.get(user_id)
            if connection:
                connection.subscribed_to_alerts = True
                await connection.send_json({
                    "type": "subscription_confirmed",
                    "message": "Subscribed to real-time arbitrage alerts",
                    "timestamp": "now"
                })
        else:
            await websocket.send_text(json.dumps({
                "type": "error", 
                "message": "Authentication required for alert subscription",
                "timestamp": "now"
            }))
    elif message_type == "request_demo_opportunity":
        # Client requesting a demo opportunity (for testing)
        await websocket_manager.send_demo_opportunity()
    else:
        # Unknown message type
        await websocket.send_text(json.dumps({
            "type": "error",
            "message": f"Unknown message type: {message_type}",
            "timestamp": "now"
        }))

@router.get("/ws/stats")
async def websocket_stats():
    """Get WebSocket connection statistics"""
    return {
        "authenticated_connections": len(websocket_manager.connections),
        "anonymous_connections": len(websocket_manager.anonymous_connections),
        "total_connections": len(websocket_manager.connections) + len(websocket_manager.anonymous_connections),
        "demo_opportunities_available": len(websocket_manager.demo_opportunities)
    }

@router.post("/ws/broadcast/demo")
async def broadcast_demo_opportunity():
    """Broadcast a demo arbitrage opportunity (for testing)"""
    await websocket_manager.send_demo_opportunity()
    return {"message": "Demo opportunity broadcasted", "status": "success"}