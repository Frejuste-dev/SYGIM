@echo off
setlocal

set CONTAINER_NAME=sygim_mysql
set DB_NAME=sygim_db
set DB_USER=root
set DB_PASS=local_root_password
set BACKUP_DIR=..\..\backups

if "%~1"=="" (
    echo [ERREUR] Vous devez specifier le fichier de sauvegarde a restaurer.
    echo Usage: rollback.bat nom_du_fichier.sql
    echo.
    echo Fichiers disponibles dans backups\ :
    dir /b "%BACKUP_DIR%\*.sql"
    pause
    exit /b 1
)

set TARGET_FILE=%BACKUP_DIR%\%~1

if not exist "%TARGET_FILE%" (
    echo [ERREUR] Le fichier '%TARGET_FILE%' est introuvable.
    pause
    exit /b 1
)

echo ========================================================
echo [ATTENTION] RESTAURATION DE LA BASE DE DONNEES
echo ========================================================
echo Vous etes sur le point d'ecraser les donnees actuelles par celles du fichier :
echo %TARGET_FILE%
echo.
set /p CONFIRM="Taper 'OUI' pour confirmer la restauration : "

if not "%CONFIRM%"=="OUI" (
    echo Restauration annulee.
    pause
    exit /b 0
)

echo.
echo [SYGIM] Lancement de la restauration...
docker exec -i %CONTAINER_NAME% /usr/bin/mysql -u %DB_USER% --password=%DB_PASS% %DB_NAME% < "%TARGET_FILE%"

if %ERRORLEVEL% equ 0 (
    echo.
    echo [SUCCES] Restauration terminee avec succes !
) else (
    echo.
    echo [ERREUR] Echec de la restauration.
)

endlocal
pause
