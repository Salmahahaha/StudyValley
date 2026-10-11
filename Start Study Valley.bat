@echo off
title Study Valley
cd /d "%~dp0"

rem Already running? Just open it.
"%SystemRoot%\System32\netstat.exe" -ano | "%SystemRoot%\System32\findstr.exe" ":5173" | "%SystemRoot%\System32\findstr.exe" "LISTENING" >nul
if %errorlevel%==0 (
  start "" http://localhost:5173
  exit /b
)

echo Starting Study Valley... keep this window open while you use it.
echo (Close this window to stop it. Your progress stays saved.)
echo.
call npm run dev -- --open --strictPort
pause
