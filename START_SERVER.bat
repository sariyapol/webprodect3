@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo MUT Shuttle - Oracle Web Server
echo ============================================
set /p ORACLE_USER=Oracle Username (example LAB04HW): 
set /p ORACLE_PASSWORD=Oracle Password: 
set /p ORACLE_CONNECT_STRING=Connect String [localhost:1521/XEPDB1]: 
if "%ORACLE_CONNECT_STRING%"=="" set ORACLE_CONNECT_STRING=localhost:1521/XEPDB1
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
