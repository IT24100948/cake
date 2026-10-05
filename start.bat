@echo off
REM Devma Cake n' Party - double-click to start (Windows). Needs Node.js 20+ and a running MySQL server.
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org ^(LTS^), then run start.bat again. & pause & exit /b 1)
if not exist node_modules (call npm install --no-audit --no-fund || (pause & exit /b 1))
node scripts\start.js %*
echo.
pause
