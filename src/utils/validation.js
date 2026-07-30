const isMissingValue = (value) =>
  value === undefined || value === null || (typeof value === "string" && value.trim() === "");

const getMissingRequiredFields = (body, fields) =>
  fields.filter((field) => isMissingValue(body?.[field]));

const withAuthenticatedAuditUsername = (body, user, fieldName) => ({
  ...body,
  [fieldName]: user?.username || body?.[fieldName],
});

module.exports = {
  getMissingRequiredFields,
  isMissingValue,
  withAuthenticatedAuditUsername,
};
