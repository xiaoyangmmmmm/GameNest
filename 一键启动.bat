@echo off
setlocal
cd /d "%~dp0"
title GameNest Test Launcher

echo.
echo ========================================
echo        GameNest Test Launcher
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Please install Node.js first.
  goto :failed
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found. Please reinstall Node.js.
  goto :failed
)

if not exist "package.json" (
  echo [ERROR] package.json was not found.
  echo Put this launcher in the GameNest project root and try again.
  goto :failed
)

if not exist "node_modules\electron\package.json" (
  echo [SETUP] Installing project dependencies. Please wait...
  call npm install
  if errorlevel 1 (
    echo [ERROR] Dependency installation failed. Check your network or npm settings.
    goto :failed
  )
)

if not exist "node_modules\electron\dist\electron.exe" (
  echo [SETUP] Repairing the Electron runtime. Please wait...
  call node "node_modules\electron\install.js"
  if errorlevel 1 (
    echo [ERROR] Electron repair failed. Check your network and try again.
    goto :failed
  )
)

if /i "%~1"=="--check" (
  echo [OK] The launch environment is ready.
  exit /b 0
)

echo [START] Opening GameNest...
echo.
call npm start
if errorlevel 1 (
  echo.
  echo [ERROR] GameNest failed to start. See the message above.
  goto :failed
)

endlocal
exit /b 0

:failed
echo.
pause
endlocal
exit /b 1
