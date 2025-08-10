#!/bin/bash
# Arboretum Setup Script

echo "🌳 Setting up Arboretum virtual environment..."

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔌 Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "⬆️  Upgrading pip..."
pip install --upgrade pip

# Install requirements
echo "📥 Installing dependencies..."
pip install -r requirements.txt

# Test installation
echo "🧪 Testing installation..."
python -c "from src.core.x402_service import X402ArbitrageService; print('✅ All imports working')" || echo "❌ Import test failed"

echo "✅ Setup complete!"
echo ""
echo "To activate the environment manually:"
echo "  source venv/bin/activate"
echo ""
echo "To start the service:"
echo "  python run_service.py"
echo ""
echo "To try the agent CLI:"
echo "  python run_agent.py demo"