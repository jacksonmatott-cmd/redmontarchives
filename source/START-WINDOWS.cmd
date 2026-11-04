@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 24 LTS from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci --no-fund --no-audit
  if errorlevel 1 goto failed
)
call npm run build
if errorlevel 1 goto failed
call npm run demo
if errorlevel 1 goto failed
call npm run dev -- --open
pause
exit /b
:failed
echo Setup failed. Keep this window open to read the error above.
pause
exit /b 1
