const AppVersionModel = require("../models/appVersion");
const AuditModel = require("../models/auditBackoffice");
const { withTransaction } = require("../utils/transaction");
const { buildBackofficeAuditData } = require("./auditBackoffice");
const { BACKOFFICE_AUDIT_ACTIONS, BACKOFFICE_AUDIT_ENTITIES } = require("../domain/auditBackoffice");
const { mapAppVersionRows } = require("../domain/appVersion");

const createAppVersionService = ({
  transaction = withTransaction,
  appVersionModelFactory = AppVersionModel.createAppVersionModel,
  auditModelFactory = AuditModel.createAuditBackofficeModel,
  auditBuilder = buildBackofficeAuditData,
} = {}) => ({
  async updateAppVersions({ versions, updatedBy, auditEvent }) {
    return transaction(async (connection) => {
      const appVersionModel = appVersionModelFactory(connection);
      const auditModel = auditModelFactory(connection);
      const oldRows = await appVersionModel.getAllAppVersions({ forUpdate: true });
      const oldByPlatform = new Map(oldRows.map((row) => [row.platform, row]));

      for (const version of versions) {
        await appVersionModel.upsertAppVersion(version, updatedBy);
      }

      const newRows = await appVersionModel.getAllAppVersions();
      const newByPlatform = new Map(newRows.map((row) => [row.platform, row]));

      for (const version of versions) {
        const auditData = auditBuilder({
          ...auditEvent,
          actionType: BACKOFFICE_AUDIT_ACTIONS.UPDATE,
          entityName: BACKOFFICE_AUDIT_ENTITIES.APP_VERSION,
          entityId: version.platform,
          oldValues: oldByPlatform.get(version.platform) || null,
          newValues: newByPlatform.get(version.platform) || null,
        });
        await auditModel.insertAudit(auditData);
      }

      return mapAppVersionRows(newRows);
    });
  },
});

const service = createAppVersionService();
module.exports = { ...service, createAppVersionService };
