@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║       WindOps BC Analyzer — 一键启动                  ║
echo ╚══════════════════════════════════════════════════════╝
echo.

:: 快速检查 Ollama
curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% neq 0 (
    echo [警告] Ollama 服务未运行，AI 功能将不可用
    echo 请先在另一个窗口启动 Ollama 服务
    echo.
)

echo 启动后端服务 (http://localhost:8000)...
start "BC-Analyzer-Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 3 /nobreak >nul

echo 启动前端服务 (http://localhost:5173)...
start "BC-Analyzer-Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║  后端: http://localhost:8000                         ║
echo ║  API文档: http://localhost:8000/docs                 ║
echo ║  前端: http://localhost:5173                         ║
echo ╚══════════════════════════════════════════════════════╝
echo.

pause
