@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║     WindOps BC Analyzer — 环境检查与依赖安装         ║
echo ╚══════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

:: ============================================================
:: 1. 检查 Python
:: ============================================================
echo [1/5] 检查 Python 环境...
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo   [错误] 未检测到 Python，请先安装 Python 3.11+
    echo   下载地址: https://www.python.org/downloads/
    pause
    exit /b 1
)
for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PY_VER=%%v
echo   [√] Python %PY_VER% 已安装

:: ============================================================
:: 2. 检查 Node.js
:: ============================================================
echo [2/5] 检查 Node.js 环境...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [错误] 未检测到 Node.js，请先安装 Node.js 18+
    echo   下载地址: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=1 delims=v" %%v in ('node -v 2^>^&1') do set NODE_VER=%%v
echo   [√] Node.js v%NODE_VER% 已安装

:: ============================================================
:: 3. 检查 Ollama
:: ============================================================
echo [3/5] 检查 Ollama 服务...
where ollama >nul 2>&1
if %errorlevel% neq 0 (
    echo   [警告] 未检测到 Ollama 命令行
    echo   如尚未安装，请访问 https://ollama.com 下载安装
    echo   安装后运行: ollama pull qwen2.5:14b
) else (
    for /f "tokens=*" %%v in ('ollama -v 2^>^&1') do echo   [√] %%v
    
    curl -s http://localhost:11434/api/tags >nul 2>&1
    if %errorlevel% neq 0 (
        echo   [提示] Ollama 服务未启动，请手动启动
    ) else (
        echo   [√] Ollama 服务运行中 (localhost:11434)
    )
)

:: ============================================================
:: 4. 安装 Python 后端依赖
:: ============================================================
echo.
echo [4/5] 安装 Python 后端依赖...
cd backend

echo   检查 pip...
python -m pip --version >nul 2>&1
if %errorlevel% neq 0 (
    echo   [错误] pip 不可用
    cd ..
    pause
    exit /b 1
)

echo   安装依赖包 (fastapi, uvicorn, sqlalchemy, aiosqlite, httpx, pandas, openpyxl, python-multipart, pydantic)...
python -m pip install -q fastapi uvicorn[standard] sqlalchemy aiosqlite httpx pandas openpyxl python-multipart pydantic
if %errorlevel% neq 0 (
    echo   [错误] Python 依赖安装失败，请检查网络连接
    cd ..
    pause
    exit /b 1
)

echo   验证关键依赖...
python -c "import fastapi; import uvicorn; import sqlalchemy; import aiosqlite; import httpx; import pandas; import openpyxl; import pydantic" >nul 2>&1
if %errorlevel% neq 0 (
    echo   [错误] 依赖导入验证失败，请重试
    cd ..
    pause
    exit /b 1
)
echo   [√] Python 依赖安装完成

cd ..

:: ============================================================
:: 5. 安装前端 Node 依赖
:: ============================================================
echo.
echo [5/5] 安装前端 Node.js 依赖...
cd frontend

if not exist "node_modules" (
    echo   首次安装，正在下载依赖包...
    call npm install
) else (
    echo   已有 node_modules，检查更新...
    call npm install
)
if %errorlevel% neq 0 (
    echo   [错误] 前端依赖安装失败，请检查网络连接
    cd ..
    pause
    exit /b 1
)
echo   [√] 前端依赖安装完成

cd ..

:: ============================================================
:: 完成
:: ============================================================
echo.
echo ╔══════════════════════════════════════════════════════╗
echo ║            依赖安装完成!                              ║
echo ╠══════════════════════════════════════════════════════╣
echo ║  启动后端: cd backend ^&^& python -m uvicorn          ║
echo ║           app.main:app --host 0.0.0.0 --port 8000   ║
echo ║                                                      ║
echo ║  启动前端: cd frontend ^&^& npm run dev               ║
echo ║           http://localhost:5173                      ║
echo ╠══════════════════════════════════════════════════════╣
echo ║  首次使用前请确保:                                    ║
echo ║  1. Ollama 已安装并运行                               ║
echo ║  2. 运行: ollama pull qwen2.5:14b                    ║
echo ╚══════════════════════════════════════════════════════╝
echo.

pause
