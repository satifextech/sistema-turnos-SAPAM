@echo off
title Sistema de Turnos SAPAM

cd /d "%~dp0"

echo ==========================================
echo      SISTEMA DE TURNOS SAPAM
echo ==========================================
echo.

if not exist node_modules (
    echo Instalando dependencias...
    call npm install

    if errorlevel 1 (
        echo.
        echo No se pudieron instalar las dependencias.
        pause
        exit /b 1
    )
)

echo Iniciando servidor...
start "Servidor SAPAM" cmd /k "npm start"

timeout /t 4 /nobreak >nul

echo Abriendo recepcion...
start "" "http://localhost:3000/recepcion/"

echo Abriendo panel administrador...
start "" "http://localhost:3000/admin"

echo.
echo Sistema iniciado correctamente.
echo Esta ventana puede cerrarse.
timeout /t 3 /nobreak >nul
exit