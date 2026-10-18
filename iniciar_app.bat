@echo off
title Financiere App - Servidor Local
echo ========================================================
echo INICIANDO FINANCIERE APP
echo Usuario: Jarinson Castro
echo ========================================================
echo Acceso en esta PC:   http://localhost:3000
echo Acceso en tu iPhone: http://192.168.18.193:3000
echo.
echo Presiona Ctrl+C para detener el servidor.
echo ========================================================
python -m http.server 3000
