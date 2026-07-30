const dbPool = require("../config/database");

const SELECT_COLUMNS = "platform, latestVersion, minRequiredVersion, storeUrl, releaseNotes";

const createAppVersionModel = (executor = dbPool) => ({
  async getAllAppVersions({ forUpdate = false } = {}) {
    const suffix = forUpdate ? " FOR UPDATE" : "";
    const [rows] = await executor.execute(
      `SELECT ${SELECT_COLUMNS} FROM tbl_app_versions ORDER BY FIELD(platform, 'android', 'ios')${suffix}`
    );
    return rows;
  },

  async upsertAppVersion(version, updatedBy) {
    await executor.execute(
      `INSERT INTO tbl_app_versions
        (platform, latestVersion, minRequiredVersion, storeUrl, releaseNotes, updatedBy)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        latestVersion = VALUES(latestVersion),
        minRequiredVersion = VALUES(minRequiredVersion),
        storeUrl = VALUES(storeUrl),
        releaseNotes = VALUES(releaseNotes),
        updatedBy = VALUES(updatedBy)`,
      [version.platform, version.latestVersion, version.minRequiredVersion, version.storeUrl, version.releaseNotes, updatedBy]
    );
  },
});

const model = createAppVersionModel();
module.exports = { ...model, createAppVersionModel };
