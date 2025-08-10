#!/usr/bin/env python3
"""
Arboretum Service Runner - Start the X402 arbitrage service
"""
import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from core.x402_service import X402ArbitrageService

if __name__ == "__main__":
    print("🌳 Starting Arboretum - AI Agent Marketplace for Prediction Market Arbitrage")
    print("🔗 Built on X402 protocol with Coinbase CDP integration")
    print("=" * 70)
    
    service = X402ArbitrageService()
    service.run(host="0.0.0.0", port=8000)