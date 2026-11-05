@echo off
title SYGIM v2.0 - Lancement Démonstration
color 0A
echo ========================================================
echo       SYGIM v2.0 - Système de Gestion Immobilière
echo             Lancement de l'Environnement Démo
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/3] Démarrage du Backend API sur le port 5000...
start "SYGIM Backend (API Port 5000)" cmd /k "cd /d ""%~dp0backend"" && npm start"

echo [2/3] Démarrage du Frontend React sur le port 5173...
start "SYGIM Frontend (Port 5173)" cmd /k "cd /d ""%~dp0frontend\react-app"" && npm run dev"

echo.
echo Application en cours d'initialisation...
timeout /t 3 /nobreak >nul

echo [3/3] Ouverture de votre navigateur sur http://localhost:5173/login ...
start http://localhost:5173/login

echo.
echo ========================================================
echo  SYGIM est prêt pour la démonstration !
echo  URL : http://localhost:5173/login
echo.
echo  Comptes de Démonstration disponibles :
echo   - Administrateur : admin     / Admin2026!
echo   - Gestionnaire   : manager   / Mgr2026!
echo   - Collecteur     : korede    / Korede2026!
echo   - Comptable      : comptable / Cpt2026!
echo ========================================================
echo.
pause

