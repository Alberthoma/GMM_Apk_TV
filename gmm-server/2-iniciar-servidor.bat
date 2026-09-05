@echo off
title GMM Server - 2) Iniciar servidor
cd /d "%~dp0"

echo ============================================================
echo  PASO 2: iniciar GMM Server
echo ============================================================
echo.
echo Dejando el servidor encendido y escuchando peticiones de la
echo app (por defecto en http://127.0.0.1:7399).
echo.
echo NO cierres esta ventana mientras quieras usar "Te la tengo"
echo en GiveMyMovies. Para apagar el servidor, cierra esta ventana
echo o pulsa Ctrl+C.
echo.
call npm.cmd start
pause
