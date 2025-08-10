"""
Arboretum Hackathon Backend
Real X402 + CDP integration for arbitrage trading platform
"""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# X402 payment middleware for FastAPI - with fallback
try:
    from x402.fastapi.middleware import require_payment
    X402_AVAILABLE = True
except ImportError:
    print("⚠️ X402 middleware not available - running in demo mode")
    X402_AVAILABLE = False
    
    # Mock middleware function for demo mode
    def require_payment(*args, **kwargs):
        def decorator(func):
            return func
        return decorator

# Our application modules
from app.core.config import settings
from app.api.main import api_router
from app.core.database import init_db
from app.services.arbitrage_detector import ArbitrageDetector
from app.services.websocket_manager import WebSocketManager

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown"""
    # Initialize database
    await init_db()
    
    # Start background arbitrage detection
    arbitrage_detector = ArbitrageDetector()
    websocket_manager = WebSocketManager()
    
    # Store in app state for access in routes
    app.state.arbitrage_detector = arbitrage_detector
    app.state.websocket_manager = websocket_manager
    
    # Start background tasks
    await arbitrage_detector.start()
    
    yield
    
    # Cleanup
    await arbitrage_detector.stop()

# Create FastAPI app
app = FastAPI(
    title="Arboretum API",
    description="Arbitrage trading platform with X402 payments and CDP integration",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "https://arboretum-demo.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Apply X402 payment middleware to trade execution endpoint (if available) unless in DEMO_MODE
if X402_AVAILABLE and settings.SERVICE_WALLET_ADDRESS and not settings.DEMO_MODE:
    app.middleware("http")(
        require_payment(
            path="/api/v1/trades/execute",
            price="$0.01",  # $0.01 execution fee per trade (testing)
            pay_to_address=settings.SERVICE_WALLET_ADDRESS,
            network="base-sepolia",
            description="Execute arbitrage trade opportunity",
            input_schema={
                "type": "object",
                "properties": {
                    "opportunity_id": {"type": "string", "description": "Arbitrage opportunity ID"},
                    "user_id": {"type": "integer", "description": "User ID"}
                },
                "required": ["opportunity_id", "user_id"]
            },
            output_schema={
                "type": "object", 
                "properties": {
                    "success": {"type": "boolean"},
                    "trade_id": {"type": "string"},
                    "gross_profit": {"type": "number"},
                    "net_profit": {"type": "number"},
                    "execution_fee": {"type": "number"},
                    "platform_fee": {"type": "number"}
                }
            }
        )
    )
    print("✅ X402 payment middleware enabled for /api/v1/trades/execute (price: $0.01)")
else:
    print("💡 Running trade execution in demo mode (no payment required)")

# Outer middleware to allow CORS preflight on trade execution during testing
from starlette.requests import Request
from starlette.responses import Response

@app.middleware("http")
async def allow_trade_options_preflight(request: Request, call_next):
    if request.method == "OPTIONS" and request.url.path == "/api/v1/trades/execute":
        # Minimal CORS response for preflight
        headers = {
            "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
            "Vary": "Origin",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": request.headers.get("access-control-request-headers", "*"),
            "Access-Control-Max-Age": "86400",
        }
        return Response(status_code=200, headers=headers)
    return await call_next(request)

# Include API routes
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Arboretum Arbitrage Platform",
        "version": "1.0.0",
        "status": "operational",
        "features": [
            "X402 micropayments for trade alerts",
            "CDP wallet integration", 
            "Real-time arbitrage detection",
            "Automated trade execution"
        ]
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": os.times().elapsed}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app", 
        host="0.0.0.0", 
        port=8000, 
        reload=True,
        log_level="info"
    )