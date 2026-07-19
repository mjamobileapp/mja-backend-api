const logRequest = (req, res, next) => {
  const requestLogEnabled = String(process.env.REQUEST_LOG || "").toLowerCase() === "true";

  if (requestLogEnabled && req.method !== "OPTIONS") {
    console.log(`Terjadi request ${req.method} ke PATH: ${req.path}`);
  }

  next();
};

module.exports = logRequest;
