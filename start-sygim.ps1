# SYGIM v2.0 - Lancement Démonstration
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "      SYGIM v2.0 - Système de Gestion Immobilière" -ForegroundColor Cyan
Write-Host "            Lancement de l'Environnement Démo" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$baseDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "[1/3] Démarrage du Backend API sur le port 5000..." -ForegroundColor Yellow
Start-Process cmd.exe -ArgumentList "/k cd /d `"$baseDir\backend`" && npm start"

Write-Host "[2/3] Démarrage du Frontend React sur le port 5173..." -ForegroundColor Yellow
Start-Process cmd.exe -ArgumentList "/k cd /d `"$baseDir\frontend`" && npm run dev"

Start-Sleep -Seconds 3

Write-Host "[3/3] Ouverture du navigateur sur http://localhost:5173/login ..." -ForegroundColor Green
Start-Process "http://localhost:5173/login"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Green
Write-Host " SYGIM est prêt pour la démonstration !" -ForegroundColor Green
Write-Host " URL : http://localhost:5173/login" -ForegroundColor White
Write-Host ""
Write-Host " Comptes Démo :" -ForegroundColor White
Write-Host "  - Administrateur : admin     / Admin2026!" -ForegroundColor Cyan
Write-Host "  - Gestionnaire   : manager   / Mgr2026!" -ForegroundColor Cyan
Write-Host "  - Collecteur     : korede    / Korede2026!" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Green

