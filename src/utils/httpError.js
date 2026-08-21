const createHttpError = (statusCode, message, code, options = {}) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  error.expose = options.expose === true;
  return error;
};

const isTypedHttpError = (error) => {
  const statusCode = Number(error?.statusCode);
  return Number.isInteger(statusCode) && statusCode >= 400 && statusCode < 600 && typeof error?.code === "string";
};

module.exports = { createHttpError, isTypedHttpError };
