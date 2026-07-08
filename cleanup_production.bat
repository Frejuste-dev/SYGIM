@echo off
REM ╔══════════════════════════════════════════════════════════════════╗
REM ║           SYGIM — Script de Nettoyage Production                ║
REM ║     Prépare l'application pour la livraison client              ║
REM ╚══════════════════════════════════════════════════════════════════╝
REM
REM USAGE: Double-cliquer ou exécuter: cleanup_production.bat
REM ⚠️  ATTENTION: Supprime les fichiers de debug et données de test

setlocal enabledelayedexpansion
color 0E
echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║     SYGIM PRODUCTION CLEANUP                                ║
echo ║     Nettoyage avant livraison client                        ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.

REM Couleurs
set "SUCCESS=[✓]"
set "ERROR=[✗]"
set "WARNING=[!]"
set "INFO=[*]"

echo %INFO% Nettoyage en cours...
echo.

REM 1. Supprimer fichiers de debug
echo %INFO% Suppression fichiers de debug...
if exist "backend\fix_admin.js" (
    del "backend\fix_admin.js"
    echo %SUCCESS% Supprimé: backend\fix_admin.js
) else (
    echo %WARNING% Non trouvé: backend\fix_admin.js
)

REM 2. Supprimer server_log.txt
echo.
echo %INFO% Suppression des logs...
if exist "backend\server_log.txt" (
    del "backend\server_log.txt"
    echo %SUCCESS% Supprimé: backend\server_log.txt
) else (
    echo %WARNING% Non trouvé: backend\server_log.txt
)

REM 3. Supprimer ancien adapter bugué
echo.
echo %INFO% Suppression ancien adapter...
if exist "frontend\js\api\adapter.js" (
    del "frontend\js\api\adapter.js"
    echo %SUCCESS% Supprimé: frontend\js\api\adapter.js
) else (
    echo %WARNING% Non trouvé: frontend\js\api\adapter.js
)

REM 4. Renommer adapter_new.js en adapter.js
echo.
echo %INFO% Configuration nouveau adapter...
if exist "frontend\js\api\adapter_new.js" (
    if not exist "frontend\js\api\adapter.js" (
        move "frontend\js\api\adapter_new.js" "frontend\js\api\adapter.js" >nul
        echo %SUCCESS% Activé: frontend\js\api\adapter.js
    ) else (
        echo %ERROR% adapter.js existe déjà!
    )
) else (
    echo %WARNING% Non trouvé: frontend\js\api\adapter_new.js
)

REM 5. Supprimer node_modules (optionnel, à recréer)
echo.
echo %WARNING% Les node_modules peuvent être supprimés et recréés en production
echo %INFO% (Gagne ~500MB, à recréer avec: npm install --production)

REM 6. Vérifier .gitignore
echo.
echo %INFO% Vérification .gitignore...
if exist ".gitignore" (
    findstr /L ".env" ".gitignore" >nul
    if !errorlevel! equ 0 (
        echo %SUCCESS% .gitignore contient .env
    ) else (
        echo %ERROR% .gitignore ne contient pas .env!
        echo %WARNING% Ajouter manuellement: .env, .env.production
    )
) else (
    echo %ERROR% .gitignore non trouvé!
)

REM 7. Créer fichier .env.production.example
echo.
echo %INFO% Création fichier de configuration...
if not exist "backend\.env.production" (
    copy "backend\.env.example" "backend\.env.production" >nul
    echo %SUCCESS% Créé: backend\.env.production
    echo %WARNING% Éditer avec les vraies valeurs avant déploiement!
) else (
    echo %WARNING% backend\.env.production existe déjà
)

REM 8. Afficher résumé
echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║                NETTOYAGE TERMINÉ                            ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.

echo %INFO% PROCHAINES ÉTAPES:
echo.
echo 1. Éditer backend\.env.production avec les vraies valeurs:
echo    - DB_PASSWORD (sécurisé)
echo    - JWT_SECRET (sécurisé)
echo    - CORS_ORIGIN (votre domaine)
echo.
echo 2. Copier .env.production vers .env:
echo    copy backend\.env.production backend\.env
echo.
echo 3. Nettoyer la BD:
echo    node backend\database\clean_production.js
echo.
echo 4. Créer utilisateurs:
echo    Utiliser API: POST /api/auth/register
echo    Voir GUIDE_PRODUCTION.md
echo.
echo 5. Tester l'application:
echo    npm start
echo    Ouvrir http://localhost:5000
echo.

echo %SUCCESS% Application prête pour livraison!
echo %INFO% Lire GUIDE_PRODUCTION.md pour détails
echo.

pause
