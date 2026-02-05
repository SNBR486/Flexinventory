@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ======================================================
REM FlexInventory 一键启动脚本（可迁移，无需硬编码绝对路径）
REM - 默认使用脚本所在目录作为项目目录
REM - 默认 PocketBase 目录：自动识别 <项目目录>\pocketbase* 目录（可用 PB_DIR 覆盖）
REM - 可通过环境变量覆盖：PROJECT_PATH / PB_DIR / PB_PORT / FRONTEND_PORT
REM ======================================================

if not defined PROJECT_PATH set "PROJECT_PATH=%~dp0"
if "%PROJECT_PATH:~-1%"=="\" set "PROJECT_PATH=%PROJECT_PATH:~0,-1%"

if not defined PB_DIR (
  for /d %%D in ("%PROJECT_PATH%\pocketbase*") do (
    if exist "%%~fD\pocketbase.exe" (
      set "PB_DIR=%%~fD"
      goto :pb_dir_found
    )
  )
)
:pb_dir_found
if not defined PB_PORT set "PB_PORT=8090"
if not defined FRONTEND_PORT set "FRONTEND_PORT=3000"

set "PB_EXE=%PB_DIR%\pocketbase.exe"

if not exist "%PB_EXE%" (
  echo [ERROR] 未找到 PocketBase 可执行文件："%PB_EXE%"
  echo         请确认目录结构正确，或在运行前设置 PB_DIR 环境变量。
  pause
  exit /b 1
)

if not exist "%PROJECT_PATH%\package.json" (
  echo [ERROR] 未找到 package.json："%PROJECT_PATH%\package.json"
  echo         请确认脚本位于项目根目录，或在运行前设置 PROJECT_PATH。
  pause
  exit /b 1
)

echo [INFO] PROJECT_PATH=%PROJECT_PATH%
echo [INFO] PB_DIR=%PB_DIR%
echo [INFO] PocketBase=http://0.0.0.0:%PB_PORT%
echo [INFO] Frontend=http://0.0.0.0:%FRONTEND_PORT%

REM 启动 PocketBase（最小化窗口）
start "PocketBase" /min cmd /c "cd /d "%PB_DIR%" && pocketbase.exe serve --http=0.0.0.0:%PB_PORT%"

REM 等待 PocketBase 初始化
timeout /t 2 /nobreak >nul

REM 若未安装依赖，先安装（避免新电脑首次运行失败）
if not exist "%PROJECT_PATH%\node_modules" (
  echo [INFO] 首次运行：正在安装 npm 依赖...
  start "NPM Install" /min cmd /c "cd /d "%PROJECT_PATH%" && npm install"
)

REM 启动前端开发服务器（开放到局域网）
start "Vite Dev Server" /min cmd /c "cd /d "%PROJECT_PATH%" && npm run dev -- --host 0.0.0.0 --port %FRONTEND_PORT%"

REM 等待前端初始化
timeout /t 5 /nobreak >nul

REM 获取当前主机一个 IPv4（用于提示局域网访问地址）
for /f "usebackq delims=" %%i in (`powershell -NoProfile -Command "(Get-NetIPAddress -AddressFamily IPv4 ^| Where-Object {$_.IPAddress -ne '127.0.0.1' -and $_.ValidLifetime -gt 0} ^| Select-Object -First 1 -ExpandProperty IPAddress)"`) do set "HOST_IPV4=%%i"
if not defined HOST_IPV4 set "HOST_IPV4=localhost"

echo.
echo [OK] 服务已启动：
echo      PocketBase: http://%HOST_IPV4%:%PB_PORT%/
echo      Frontend  : http://%HOST_IPV4%:%FRONTEND_PORT%/
echo.
echo [TIP] 如果你把前端 dist 同步到 PocketBase 的 pb_public，
echo       局域网设备可直接访问 http://%HOST_IPV4%:%PB_PORT%/

REM 在本机默认浏览器打开前端地址
start "" "http://localhost:%FRONTEND_PORT%/"

exit /b 0
