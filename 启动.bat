@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 食鉴 AI - 本地开发服务
set NUXT_TELEMETRY_DISABLED=1

echo.
echo  ============================================
echo    食鉴 AI  本地开发服务
echo  ============================================
echo.
echo  浏览器打开： http://localhost:3000
echo  首次启动要编译，等 30 秒左右是正常的。
echo  关掉这个窗口 = 停止服务。
echo  ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [!] 没有找到 Node.js。
  echo      请先安装 https://nodejs.org ，安装时勾选 Add to PATH，
  echo      装完关掉这个窗口再双击一次。
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo  [!] 还没装依赖，现在执行 npm install ...（第一次要几分钟）
  call npm install
  if errorlevel 1 (
    echo.
    echo  [!] 依赖安装失败。把上面的报错原样发给维护者。
    pause
    exit /b 1
  )
)

if not exist ".env" (
  if exist ".env.example" (
    copy ".env.example" ".env" >nul
    echo  [!] 已从 .env.example 复制出 .env。
    echo      请用记事本打开 .env，把 GLM_API_KEY 填上，保存后再双击本文件。
    start notepad .env
    pause
    exit /b 1
  )
)

call npm run dev

echo.
echo  服务已停止。按任意键关闭窗口。
pause
