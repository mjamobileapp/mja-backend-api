const { getPublicAuthRateLimitConfig } = require("../config/environment");

const MAX_TRACKED_CLIENTS = 10000;

const getClientKey = (req) => req.ip || req.socket?.remoteAddress || "unknown";

const createPublicAuthRateLimiter = ({
  keyPrefix,
  windowMs,
  maxAttempts,
  now = () => Date.now(),
} = {}) => {
  const configuredRateLimit = getPublicAuthRateLimitConfig();
  const effectiveWindowMs = windowMs ?? configuredRateLimit.windowMs;
  const effectiveMaxAttempts = maxAttempts ?? configuredRateLimit.maxAttempts;
  const attemptsByClient = new Map();

  return (req, res, next) => {
    const currentTime = now();
    const key = `${keyPrefix || "public-auth"}:${getClientKey(req)}`;
    const previousAttempts = attemptsByClient.get(key) || [];
    const activeAttempts = previousAttempts.filter((attemptedAt) => currentTime - attemptedAt < effectiveWindowMs);

    if (activeAttempts.length >= effectiveMaxAttempts) {
      return res.status(429).json({
        code: "TOO_MANY_REQUESTS",
        message: "Terlalu banyak percobaan. Silakan coba kembali nanti.",
      });
    }

    activeAttempts.push(currentTime);
    attemptsByClient.set(key, activeAttempts);

    if (attemptsByClient.size > MAX_TRACKED_CLIENTS) {
      for (const [clientKey, attempts] of attemptsByClient) {
        if (attempts.every((attemptedAt) => currentTime - attemptedAt >= effectiveWindowMs)) {
          attemptsByClient.delete(clientKey);
        }

        if (attemptsByClient.size <= MAX_TRACKED_CLIENTS) break;
      }
    }

    while (attemptsByClient.size > MAX_TRACKED_CLIENTS) {
      const oldestClientKey = attemptsByClient.keys().next().value;
      attemptsByClient.delete(oldestClientKey);
    }

    return next();
  };
};

const publicLoginRateLimiter = createPublicAuthRateLimiter({ keyPrefix: "login" });
const publicActivationRateLimiter = createPublicAuthRateLimiter({ keyPrefix: "activation" });
const publicPasswordResetRateLimiter = createPublicAuthRateLimiter({ keyPrefix: "password-reset" });

module.exports = {
  createPublicAuthRateLimiter,
  publicActivationRateLimiter,
  publicLoginRateLimiter,
  publicPasswordResetRateLimiter,
};
