@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================
echo MUT Shuttle - Oracle Web Server
echo ============================================

set /p ORACLE_USER=Oracle Username: 
set /p ORACLE_PASSWORD=Oracle Password: 

set ORACLE_CONNECT_STRING=203.209.54.16:1521/database1
set PORT=3000

if not exist node_modules (
  echo Installing packages...
  call npm install
  if errorlevel 1 pause & exit /b 1
)

echo.
echo Open: http://localhost:3000
echo Test DB: http://localhost:3000/api/health
echo.

call npm start
pause