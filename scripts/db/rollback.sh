#!/bin/bash

# Configuration
CONTAINER_NAME="sygim_mysql"
DB_NAME="sygim_db"
DB_USER="root"
DB_PASS="local_root_password"
BACKUP_DIR="../../backups"

if [ -z "$1" ]; then
    echo "[ERREUR] Vous devez specifier le fichier de sauvegarde a restaurer."
    echo "Usage: ./rollback.sh nom_du_fichier.sql"
    echo ""
    echo "Fichiers disponibles dans backups/ :"
    ls -1 "${BACKUP_DIR}"/*.sql 2>/dev/null | xargs -n 1 basename
    exit 1
fi

TARGET_FILE="${BACKUP_DIR}/$1"

if [ ! -f "${TARGET_FILE}" ]; then
    echo "[ERREUR] Le fichier '${TARGET_FILE}' est introuvable."
    exit 1
fi

echo "========================================================"
echo "[ATTENTION] RESTAURATION DE LA BASE DE DONNEES"
echo "========================================================"
echo "Vous etes sur le point d'ecraser les donnees actuelles par celles du fichier :"
echo "${TARGET_FILE}"
echo ""
read -p "Taper 'OUI' pour confirmer la restauration : " CONFIRM

if [ "$CONFIRM" != "OUI" ]; then
    echo "Restauration annulee."
    exit 0
fi

echo ""
echo "[SYGIM] Lancement de la restauration..."
docker exec -i ${CONTAINER_NAME} /usr/bin/mysql -u ${DB_USER} --password=${DB_PASS} ${DB_NAME} < "${TARGET_FILE}"

if [ $? -eq 0 ]; then
    echo ""
    echo "[SUCCES] Restauration terminee avec succes !"
else
    echo ""
    echo "[ERREUR] Echec de la restauration."
    exit 1
fi
