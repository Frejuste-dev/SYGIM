@echo off
setlocal

:: Recuperer la date et l'heure au format YYYYMMDD_HHMMSS
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set TIMESTAMP=%datetime:~0,8%_%datetime:~8,6%

set CONTAINER_NAME=sygim_mysql
set DB_NAME=sygim_db
set DB_USER=root
set DB_PASS=local_root_password
set BACKUP_DIR=..\..\backups
set BACKUP_FILE=%BACKUP_DIR%\sygim_backup_%TIMESTAMP%.sql

echo ========================================================
echo [SYGIM] Lancement de la sauvegarde de la base de donnees
echo ========================================================
echo Conteneur : %CONTAINER_NAME%
echo Fichier   : %BACKUP_FILE%

:: Assurer que le repertoire backups existe
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

:: Execution de mysqldump via docker exec
docker exec %CONTAINER_NAME% /usr/bin/mysqldump -u %DB_USER% --password=%DB_PASS% %DB_NAME% > "%BACKUP_FILE%"

if %ERRORLEVEL% equ 0 (
    echo.
    echo [SUCCES] Sauvegarde terminee avec succes !
    echo Emplacement : %BACKUP_FILE%
) else (
    echo.
    echo [ERREUR] Echec de la sauvegarde. Verifiez que le conteneur Docker '%CONTAINER_NAME%' est en cours d'execution.
    if exist "%BACKUP_FILE%" del "%BACKUP_FILE%"
)

endlocal
pause
