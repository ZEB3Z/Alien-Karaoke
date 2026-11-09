@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 20 or newer from https://nodejs.org, then open this file again.
  pause
  exit /b 1
)
if not exist dist\index.html (
  echo The built app is missing. Run npm install and npm run build first.
  pause
  exit /b 1
)
if not defined PORT set PORT=4173
start "" "http://localhost:%PORT%"
node scripts\serve.mjs
pause
