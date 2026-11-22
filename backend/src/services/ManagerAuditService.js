const { pool } = require('../config/database');

class ManagerAuditService {
  /**
   * Enregistre une action d'audit immuable et génère éventuellement une notification
   */
  static async logAction({
    userId,
    operationType,
    operationLabel,
    propertyId = null,
    propertyRef = null,
    ownerId = null,
    ownerName = null,
    targetSummary = '',
    description = '',
    oldValues = null,
    newValues = null,
    status = 'SUCCESS',
    notification = null,
    notifyRoles = null,
    notifyUserIds = null,
  }) {
    try {
      const summary = targetSummary || `${propertyRef || 'Bien'} / ${ownerName || 'Propriétaire'}`;

      // 1. Insertion dans manager_activity_logs
      await pool.query(
        `INSERT INTO manager_activity_logs (
          user_id, operation_type, operation_label, property_id, property_ref,
          owner_id, owner_name, target_summary, description,
          old_values, new_values, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          userId || 1,
          operationType,
          operationLabel,
          propertyId,
          propertyRef,
          ownerId,
          ownerName,
          summary,
          description,
          oldValues ? JSON.stringify(oldValues) : null,
          newValues ? JSON.stringify(newValues) : null,
          status,
        ]
      );

      // 2. Création automatique ou personnalisée d'une notification
      if (notification) {
        const recipientIds = new Set();

        if (Array.isArray(notifyUserIds)) {
          notifyUserIds.filter(Boolean).forEach((id) => recipientIds.add(Number(id)));
        }

        if (Array.isArray(notifyRoles) && notifyRoles.length > 0) {
          const placeholders = notifyRoles.map(() => '?').join(',');
          const [roleUsers] = await pool.query(
            `SELECT id FROM users WHERE active = 1 AND role IN (${placeholders})`,
            notifyRoles
          );
          for (const row of roleUsers) {
            recipientIds.add(Number(row.id));
          }
        }

        if (recipientIds.size === 0 && userId) {
          recipientIds.add(Number(userId));
        }

        for (const targetUserId of recipientIds) {
          await pool.query(
            `INSERT INTO user_notifications (
              user_id, type, category, title, message, reference_link, is_read, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, 0, NOW())`,
            [
              targetUserId,
              notification.type || (status === 'SUCCESS' ? 'SUCCESS' : 'WARNING'),
              notification.category || 'SYSTEM',
              notification.title || operationLabel,
              notification.message || description || summary,
              notification.referenceLink || null,
            ]
          );
        }
      }
    } catch (err) {
      console.error('[ManagerAuditService] Erreur lors de la journalisation:', err.message);
    }
  }
}

module.exports = ManagerAuditService;
