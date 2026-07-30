const dbPool = require("../config/database");

const getTemplateByKode = async (kodeTemplate) => {
  const [rows] = await dbPool.execute(
    "SELECT subject, htmlBody FROM tbl_email_templates WHERE kodeTemplate = ?",
    [kodeTemplate]
  );
  return rows[0];
};

module.exports = { getTemplateByKode };
