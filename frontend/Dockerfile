# ╔═══════════════════════════════════════════════════════════════════╗
# ║       SYGIM — Dockerfile Frontend (Nginx + React SPA)           ║
# ╚═══════════════════════════════════════════════════════════════════╝

# Étape 1: Build de l'application React
FROM node:20-alpine AS builder
WORKDIR /app
# Copier les fichiers package.json et package-lock.json
COPY package*.json ./
# Installer les dépendances
RUN npm ci
# Copier le reste du code source
COPY . ./
# Compiler l'application pour la production
RUN npm run build

# Étape 2: Image Nginx pour servir la SPA compilée
FROM nginx:1.25-alpine
# Copier la configuration Nginx
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
# Copier les fichiers compilés (dist/)
COPY --from=builder /app/dist /usr/share/nginx/html/
# Exposer le port Nginx
EXPOSE 80
# Démarrer Nginx
CMD ["nginx", "-g", "daemon off;"]
