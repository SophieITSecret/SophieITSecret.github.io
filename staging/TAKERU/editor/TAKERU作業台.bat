@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ==================================================
echo   TAKERU Editor - starting...
echo   The browser will open automatically.
echo   To quit, just close this black window.
echo ==================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found.
  echo Please install Node.js, then run this again.
  echo https://nodejs.org/
  echo.
  pause
  exit /b
)

node server.js

echo.
echo Server stopped. Press any key to close.
pause >nul
