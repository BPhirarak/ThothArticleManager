@echo off
set ROOT=%~dp0

echo Starting SYS Knowledge Hub...
echo.

cd /d "%ROOT%backend"
if not exist "venv" python -m venv venv
call venv\Scripts\activate.bat
pip install -q -r requirements.txt
python seed_data.py
start "SYS-Backend" cmd /k "cd /d "%ROOT%backend" && call venv\Scripts\activate.bat && uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

cd /d "%ROOT%frontend"
if not exist "node_modules" npm install
start "SYS-Frontend" cmd /k "cd /d "%ROOT%frontend" && npm run dev"

echo.
echo  Frontend : http://localhost:5173
echo  API Docs : http://localhost:8000/docs
timeout /t 3 >nul
start http://localhost:5173
pause