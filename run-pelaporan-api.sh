#!/bin/bash

# Script untuk menjalankan Pelaporan API Gateway

echo "==========================================="
echo "  Pelaporan API Gateway Startup Script"
echo "==========================================="
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed"
    echo "   Please install Node.js 18 or higher"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js version must be 18 or higher"
    echo "   Current version: $(node --version)"
    exit 1
fi

echo "✓ Node.js version: $(node --version)"
echo ""

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies"
        exit 1
    fi
    echo "✓ Dependencies installed"
    echo ""
fi

# Check if pelaporan-api.js exists
if [ ! -f "pelaporan-api.js" ]; then
    echo "❌ Error: pelaporan-api.js not found"
    exit 1
fi

echo "✓ pelaporan-api.js found"
echo ""

# Set PROJECT_ROOT environment variable
export PROJECT_ROOT=$(pwd)
echo "✓ PROJECT_ROOT set to: $PROJECT_ROOT"
echo ""

# Start the API server
echo "🚀 Starting Pelaporan API Gateway..."
echo ""

# Check if custom port is provided
if [ -n "$1" ]; then
    PORT=$1 node pelaporan-api.js
else
    node pelaporan-api.js
fi
