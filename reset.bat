@echo off
REM Devma Cake n' Party - double-click to reset (Windows, uses Docker Desktop)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\devma.ps1" -Reset %*
echo.
pause
