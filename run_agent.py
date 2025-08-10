#!/usr/bin/env python3
"""
Arboretum Agent Runner - CLI interface for AI agents
"""
import sys
import os

# Add src to path  
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

from agents.agent_cli import cli

if __name__ == "__main__":
    cli()