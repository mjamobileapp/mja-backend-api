const { randomUUID } = require("node:crypto");
const pinoHttp = require("pino-http");
const logger = require("../utils/logger");

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const requestLoggingEnabled = String(process.env.REQUEST_LOG || "").toLowerCase() === "true";

const middlewareLogRequest = pinoHttp({
  logger,
  quietReqLogger: true,
  genReqId(req, res) {
    const incomingId = req.headers["x-request-id"];
    const requestId =
      typeof incomingId === "string" && REQUEST_ID_PATTERN.test(incomingId)
        ? incomingId
        : randomUUID();

    res.setHeader("X-Request-Id", requestId);
    return requestId;
  },
  autoLogging: requestLoggingEnabled
    ? { ignore: (req) => req.method === "OPTIONS" }
    : false,
  customLogLevel(req, res, err) {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
});

module.exports = middlewareLogRequest;
