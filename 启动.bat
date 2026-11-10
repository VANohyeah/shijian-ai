@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 食鉴 AI - 开发服务器

echo.
echo  ============================================
echo    食鉴 AI  开发服务器
echo  ============================================
echo.
echo   启动后请打开浏览器访问：
echo   http://localhost:3000
echo.
echo   关闭这个窗口 = 停止服务
echo  ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo  [!] 没有找到 Node.js，请先安装：https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo  [!] 还没有安装依赖，正在执行 npm install ...（约 3 分钟）
  call npm install
)

call npm run dev

echo.
echo  服务已停止。
pause
