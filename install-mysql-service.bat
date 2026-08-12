@echo off
echo ============================================
echo   Install MySQL XAMPP as Windows Service
echo   (Auto-start saat laptop menyala)
echo ============================================
echo.

:: Check admin privileges
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Script ini harus dijalankan sebagai Administrator!
    echo Klik kanan file ini lalu pilih "Run as administrator"
    pause
    exit /b 1
)

echo [1/3] Installing MySQL service...
"C:\xampp\mysql\bin\mysqld.exe" --install mysql --defaults-file="C:\xampp\mysql\bin\my.ini"

echo [2/3] Setting service to auto-start...
sc config mysql start=auto

echo [3/3] Starting MySQL now...
net start mysql

echo.
echo ============================================
echo   DONE! MySQL akan otomatis jalan setiap
echo   laptop dinyalakan.
echo ============================================
pause
