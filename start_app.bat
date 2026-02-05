@echo off
REM 启动PocketBase服务（隐藏窗口）
start /b "" powershell -WindowStyle Hidden -ExecutionPolicy Bypass -Command "Set-Location 'C:\Users\User\Downloads\pocketbase_0.36.2_windows_amd64'; .\pocketbase.exe serve"

REM 等待2秒让PocketBase启动
timeout /t 2 /nobreak >nul

REM 启动npm开发服务器（使用cmd隐藏窗口）
set "PROJECT_PATH=C:\Users\User\Desktop\New folder (8)\flexinventory (6)"
start /min cmd /c "cd /d "%PROJECT_PATH%" && npm run dev"

REM 等待8秒让npm服务器启动
timeout /t 8 /nobreak >nul

REM 尝试打开网页
start http://172.26.23.254:3000/

REM 等待5秒检查网页是否可访问
timeout /t 5 /nobreak >nul

REM 如果网页无法访问，运行npm install
powershell -WindowStyle Hidden -ExecutionPolicy Bypass -Command "$url='http://172.26.23.254:3000/'; try { $null = Invoke-WebRequest -Uri $url -TimeoutSec 3 -UseBasicParsing -ErrorAction Stop } catch { Set-Location '%PROJECT_PATH%'; cmd /c 'npm install && npm run dev' }"

exit
