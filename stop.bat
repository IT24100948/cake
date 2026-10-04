@echo off
REM Devma Cake n' Party - double-click to stop (Windows, uses Docker Desktop)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\devma.ps1" -Stop %*
echo.
pause
