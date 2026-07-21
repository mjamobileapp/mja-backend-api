const { createHttpError } = require("../utils/httpError");

const notFoundHandler = (req, res, next) => {
  next(createHttpError(404, "Route tidak ditemukan", "ROUTE_NOT_FOUND"));
};

const getDefaultErrorCode = (statusCode) => {
  if (statusCode === 401) return "UNAUTHORIZED";
  if (statusCode === 403) return "FORBIDDEN";
  if (statusCode === 404) return "NOT_FOUND";
  return statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR";
};

const errorHandler = (error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const requestedStatusCode = Number(error.statusCode || error.status);
  const statusCode = requestedStatusCode >= 400 && requestedStatusCode < 600 ? requestedStatusCode : 500;
  const isServerError = statusCode >= 500;

  if (isServerError) {
    req.log.error(
      {
        err: error,
        event: "unhandled_request_error",
        method: req.method,
        path: req.originalUrl,
        code: error.code || "INTERNAL_SERVER_ERROR",
      },
      "Unhandled request error"
    );
  }

  const response = {
    success: false,
    code: error.code || getDefaultErrorCode(statusCode),
    message: isServerError ? "Internal Server Error" : error.message,
  };

  // Keep the legacy client-facing `error` field for 4xx responses only.
  // Never expose the original server error text on 5xx responses.
  if (!isServerError) response.error = error.message;

  return res.status(statusCode).json(response);
};

module.exports = {
  createHttpError,
  errorHandler,
  getDefaultErrorCode,
  notFoundHandler,
};
