# 📋 CREDENTIALS PRODUCTION - SYGIM

**Document Confidentiel**  

---

## 🔐 ACCÈS BASE DE DONNÉES

### MySQL Server
```
Host:      <production-db-host>
Port:      <production-db-port>
Database:  <production-db-name>
User:      <production-db-user>
Password:  <production-db-password>
```

---

## 🔑 SECRETS DE CONFIGURATION

### Fichier d'environnement (backend)
```env
# Database
DB_HOST=<production-db-host>
DB_PORT=<production-db-port>
DB_USER=<production-db-user>
DB_PASSWORD=<production-db-password>
DB_NAME=<production-db-name>

# Security
JWT_SECRET=<production-jwt-secret>
JWT_REFRESH_SECRET=<production-refresh-secret>
```

---

**Note : Ne mettez jamais de valeurs réelles dans un document versionné ou non sécurisé.**
