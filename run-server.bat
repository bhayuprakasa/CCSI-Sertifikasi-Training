@echo off
:start
echo [%date% %time%] Starting CCSI Training Server...
cd /d "D:\Bhayu\Project Claude\Dashboard Training CCSI"
node server.js
echo [%date% %time%] Server stopped. Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto start
