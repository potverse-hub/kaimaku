@echo off
echo ========================================
echo   Kaimaku - Starting Server
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Check and install dependencies
echo Checking dependencies...
if not exist "node_modules" (
    echo Installing dependencies...
) else (
    echo Verifying dependencies are installed...
)
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies
    echo Please check your internet connection and try again
    pause
    exit /b 1
)
echo.

REM Start the server
echo Starting server...
echo.
echo Server will be available at: http://localhost:3000
echo.
echo Press Ctrl+C to stop the server
echo.

REM Start server and open browser after a delay
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3000"

REM Start the server (this will block until Ctrl+C)
npm start

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ERROR: Server failed to start
    echo Please check the error messages above
    pause
)
