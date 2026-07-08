# ╔══════════════════════════════════════════════════════════════════╗
# ║       SYGIM — Dockerfile Frontend (Nginx + SPA)                 ║
# ╚══════════════════════════════════════════════════════════════════╝

# Étape 1: Image de base Nginx pour servir la SPA
FROM nginx:1.25-alpine

# Copier la configuration Nginx
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Copier les fichiers statiques (HTML/CSS/JS/assets)
COPY .  /usr/share/nginx/html/

# Exposer le port Nginx
EXPOSE 80

# Démarrer Nginx
CMD ["nginx", "-g", "daemon off;"]
