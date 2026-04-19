#!/bin/bash
# SYS Knowledge Hub — Start Script

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "╔══════════════════════════════════════════╗"
echo "║       SYS Knowledge Hub v1.0.0           ║"
echo "╚══════════════════════════════════════════╝"

# --- Backend ---
echo ""
echo "[1/3] Setting up Python backend..."
cd "$ROOT/backend"

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "  ⚠  Created .env from .env.example — please add your OPENAI_API_KEY"
fi

if [ ! -d "venv" ]; then
  echo "  Creating Python virtual environment..."
  python3 -m venv venv
fi

source venv/bin/activate
pip install -q -r requirements.txt

echo "[2/3] Seeding database..."
python seed_data.py

echo "[3/3] Starting backend (port 8000)..."
uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!

# --- Frontend ---
echo ""
cd "$ROOT/frontend"
echo "Installing frontend dependencies..."
npm install --silent

echo "Starting frontend (port 5173)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ SYS Knowledge Hub is running!"
echo "   Frontend : http://localhost:5173"
echo "   API Docs : http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop all services."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
