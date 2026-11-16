@echo off
title SYGIM - Cloudflare Tunnel Quick Start
echo ===================================================
echo     SYGIM - Demarrage du Cloudflare Tunnel
echo     Exposition securisee de l'API Node.js (5000)
echo ===================================================
echo.
echo Connexion au reseau Cloudflare en cours...
echo Une URL publique https://xxxx.trycloudflare.com va apparaitre ci-dessous.
echo Copiez cette URL dans Cloudflare Pages (Variable VITE_API_URL).
echo.
"%~dp0cloudflared.exe" tunnel --url http://localhost:5000
pause
