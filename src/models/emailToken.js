const dbPool = require("../config/database");

const createEmailTokenModel = (executor = dbPool) => ({
  async registerOneTimeToken({ jti, username, tokenType, expiresAt }) {
    const [result] = await executor.execute(
      `INSERT INTO tbl_email_one_time_token (jti, username, tokenType, expiresAt)
       VALUES (?, ?, ?, ?)`,
      [jti, username, tokenType, expiresAt]
    );
    return result.insertId;
  },
  async consumeOneTimeToken({ jti, username, tokenType }) {
    const [result] = await executor.execute(
      `UPDATE tbl_email_one_time_token
       SET usedAt = UTC_TIMESTAMP()
       WHERE jti = ? AND username = ? AND tokenType = ?
         AND usedAt IS NULL AND expiresAt > UTC_TIMESTAMP()`,
      [jti, username, tokenType]
    );
    return Number(result.affectedRows) === 1;
  },
});

module.exports = { ...createEmailTokenModel(), createEmailTokenModel };
