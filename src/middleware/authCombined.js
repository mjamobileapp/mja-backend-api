const { verifyBackofficeToken } = require("./auth");
const { verifyMobileToken } = require("./authMobile");

const sendAuthError = (res, error) => {
  const statusCode = error.statusCode || 401;

  return res.status(statusCode).json({
    success: false,
    code: error.code || "UNAUTHORIZED",
    message: error.message,
  });
};

const authenticateBackofficeOrOwner = (options = {}) => {
  const { mitraParam = "idMitra" } = options;

  return async (req, res, next) => {
    try {
      req.user = await verifyBackofficeToken(req);
      return next();
    } catch (backofficeError) {
      try {
        const user = await verifyMobileToken(req);
        const requestedMitraId = Number(req.params[mitraParam]);

        if (user.role !== "owner") {
          return res.status(403).json({
            success: false,
            code: "FORBIDDEN",
            message: "Akses hanya diizinkan untuk owner",
          });
        }

        if (Number(user.idMitra) !== requestedMitraId) {
          return res.status(403).json({
            success: false,
            code: "FORBIDDEN",
            message: "Owner hanya dapat mengakses data mitra sendiri",
          });
        }

        req.user = user;
        return next();
      } catch (mobileError) {
        const error = mobileError.statusCode ? mobileError : backofficeError;
        return sendAuthError(res, error);
      }
    }
  };
};

module.exports = {
  authenticateBackofficeOrOwner,
};
