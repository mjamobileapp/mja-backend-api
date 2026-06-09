const dbPool = require("../config/database");

const getTemplateByKode = async (kodeTemplate) => {
  try {
    const [rows] = await dbPool.execute(
      "SELECT subject, htmlBody FROM tbl_email_templates WHERE kodeTemplate = ?",
      [kodeTemplate]
    );
    return rows[0];
  } catch (error) {
    throw error;
  }
};

module.exports = { getTemplateByKode };