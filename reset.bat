@echo off
REM Devma Cake n' Party - double-click to wipe the database and load fresh demo data (Windows).
cd /d "%~dp0"
if not exist node_modules (call npm install --no-audit --no-fund || (pause & exit /b 1))
node scripts\setup.js --reset %*
echo.
pause
