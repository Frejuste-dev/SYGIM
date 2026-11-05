#!/bin/bash

# Configuration
CONTAINER_NAME="sygim_mysql"
DB_NAME="sygim_db"
DB_USER="root"
DB_PASS="local_root_password"
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

# Execution de mysqldump via docker exec
docker exec ${CONTAINER_NAME} /usr/bin/mysqldump -u ${DB_USER} --password=${DB_PASS} ${DB_NAME} > "${BACKUP_FILE}"

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
