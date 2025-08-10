#!/bin/bash
# Quick start script for Arboretum

# Activate virtual environment
source venv/bin/activate

# Check if we should run service or agent
if [ "$1" == "agent" ]; then
    echo "🤖 Starting Arboretum Agent CLI..."
    python run_agent.py demo
elif [ "$1" == "service" ]; then
    echo "🌳 Starting Arboretum X402 Service..."
    python run_service.py
else
    echo "Usage: ./run.sh [service|agent]"
    echo "  service - Start the X402 arbitrage service"
    echo "  agent   - Run agent demo"
fi