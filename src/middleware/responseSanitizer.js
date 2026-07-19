const sanitizeServerErrorPayload = (payload) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const { serverMessage, details, error, ...safePayload } = payload;
  return {
    ...safePayload,
    message: "Internal Server Error",
  };
};

const sanitizeServerErrorResponse = (req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (payload) => {
    const safePayload = res.statusCode >= 500 ? sanitizeServerErrorPayload(payload) : payload;
    return originalJson(safePayload);
  };

  next();
};

module.exports = {
  sanitizeServerErrorPayload,
  sanitizeServerErrorResponse,
};
