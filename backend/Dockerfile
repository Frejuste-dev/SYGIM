# ╔══════════════════════════════════════════════════════════════════╗
# ║       SYGIM — Dockerfile Backend (Node.js)                      ║
# ╚══════════════════════════════════════════════════════════════════╝

# Image de base légère
FROM node:20-alpine

# Répertoire de travail dans le container
WORKDIR /app

# Copier les fichiers de dépendances EN PREMIER (optimise le cache Docker)
COPY package*.json ./

# Installer les dépendances de production uniquement
RUN npm install --omit=dev

# Copier tout le reste du code source
COPY . .

# Exposer le port Express
EXPOSE 5000

# Healthcheck pour s'assurer que l'API répond
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:5000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))" || exit 1

# Commande de démarrage (V2 Entrypoint)
CMD ["node", "src/index.js"]
