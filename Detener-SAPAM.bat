@echo off
title Detener Sistema SAPAM

echo Deteniendo servidor SAPAM...
taskkill /F /IM node.exe >nul 2>&1

echo Servidor detenido.
timeout /t 2 /nobreak >nul
exit