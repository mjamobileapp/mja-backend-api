const pino = require("pino");

const isDevelopment = process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";

const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['set-cookie']",
      "res.headers['set-cookie']",
      "req.body.password",
      "req.body.confirmPassword",
      "req.body.ConfirmNewPassword",
      "req.body.token",
      "req.body.otp",
      "password",
      "confirmPassword",
      "ConfirmNewPassword",
      "token",
      "otp",
    ],
    censor: "[REDACTED]",
  },
  ...(isDevelopment
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:yyyy-mm-dd HH:MM:ss.l o",
            ignore: "pid,hostname",
          },
        },
      }
    : {}),
});

module.exports = logger;
