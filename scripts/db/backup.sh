#!/bin/bash

# Configuration
CONTAINER_NAME="${CONTAINER_NAME:-sygim_mysql}"
DB_NAME="${DB_NAME:-sygim_db}"
DB_USER="${DB_USER:-root}"
: "${DB_PASS:?La variable d'environnement DB_PASS doit etre definie}"
BACKUP_DIR="../../backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/sygim_backup_${TIMESTAMP}.sql"

echo "========================================================"
echo "[SYGIM] Lancement de la sauvegarde de la base de donnees"
echo "========================================================"
echo "Conteneur : ${CONTAINER_NAME}"
echo "Fichier   : ${BACKUP_FILE}"

# Assurer que le repertoire backups existe
mkdir -p "${BACKUP_DIR}"

# Execution de mysqldump via docker exec (mot de passe transmis par variable d'environnement)
docker exec -e MYSQL_PWD="${DB_PASS}" "${CONTAINER_NAME}" /usr/bin/mysqldump -u "${DB_USER}" "${DB_NAME}" > "${BACKUP_FILE}"

if [ $? -eq 0 ]; then
    echo ""
    echo "[SUCCES] Sauvegarde terminee avec succes !"
    echo "Emplacement : ${BACKUP_FILE}"
else
    echo ""
    echo "[ERREUR] Echec de la sauvegarde. Verifiez que le conteneur Docker '${CONTAINER_NAME}' est en cours d'execution."
    rm -f "${BACKUP_FILE}"
    exit 1
fi
