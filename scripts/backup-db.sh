#!/bin/bash

# ==============================================================================
# BrainyGrasp — Production PostgreSQL Backup Script
# ==============================================================================
# Usage:
#   1. Make executable: chmod +x scripts/backup-db.sh
#   2. Add to crontab for daily execution at 2 AM:
#      0 2 * * * /path/to/BRAINGRASP_DEVIN/scripts/backup-db.sh >> /var/log/brainygrasp-backup.log 2>&1
# ==============================================================================

set -e

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${BACKUP_DIR:-/var/backups/brainygrasp}"
CONTAINER_NAME="${CONTAINER_NAME:-brainygrasp_postgres}"
DB_USER="${DB_USER:-postgres}"
DB_NAME="${DB_NAME:-brainygras}"
BACKUP_FILE="${BACKUP_DIR}/brainygrasp_${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "[$(date -u)] 📦 Starting PostgreSQL backup..."

# Ensure backup directory exists
mkdir -p "${BACKUP_DIR}"

# Execute pg_dump inside the Postgres container and compress on the fly
docker exec "${CONTAINER_NAME}" pg_dump -U "${DB_USER}" "${DB_NAME}" | gzip > "${BACKUP_FILE}"

# Verify backup file size
FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date -u)] ✅ Backup created successfully: ${BACKUP_FILE} (${FILE_SIZE})"

# Prune backups older than 7 days
echo "[$(date -u)] 🧹 Cleaning up backups older than 7 days..."
find "${BACKUP_DIR}" -type f -name "brainygrasp_*.sql.gz" -mtime +7 -delete

# Optional S3 off-instance sync if S3_BUCKET is specified
if [ -n "${S3_BUCKET}" ]; then
  echo "[$(date -u)] ☁️ Uploading backup to S3 bucket: ${S3_BUCKET}..."
  aws s3 cp "${BACKUP_FILE}" "s3://${S3_BUCKET}/db-backups/brainygrasp_${DB_NAME}_${TIMESTAMP}.sql.gz"
  echo "[$(date -u)] ✅ S3 upload completed."
else
  echo "[$(date -u)] ℹ️ S3_BUCKET env var not set. Skipping S3 upload step."
fi

echo "[$(date -u)] 🎉 Backup process finished."
