@echo off
title GMM Server - 1) Configurar carpetas y escanear
cd /d "%~dp0"

echo ============================================================
echo  PASO 1: configurar carpetas y escanear
echo ============================================================
echo.

if not exist "PRIVADO\configuracion.json" (
    echo Primera vez: creando la configuracion privada...
    call npm.cmd run configurar
    echo.
)

echo Se va a abrir el archivo de configuracion en el Bloc de notas.
echo Dentro, en "carpetas", anade o cambia la ruta de tus peliculas
echo (una entrada por carpeta o disco). Ejemplo:
echo.
echo    "carpetas": [
echo      { "nombre": "Peliculas", "ruta": "D:\\Videos\\Movies" },
echo      { "nombre": "Externo",   "ruta": "E:\\Peliculas" }
echo    ]
echo.
echo GUARDA el archivo (Ctrl+S) y CIERRA el Bloc de notas para
echo continuar con el escaneo.
echo.
notepad "PRIVADO\configuracion.json"

echo.
echo Escaneando las carpetas configuradas...
echo.
call npm.cmd run escanear

echo.
echo ============================================================
echo  Listo. Ahora haz doble clic en "2-iniciar-servidor.bat"
echo  para arrancar GMM Server y poder conectarlo desde la app.
echo ============================================================
pause
