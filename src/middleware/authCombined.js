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

const authenticateBackofficeOrOwnerKasirCabang = (options = {}) => {
  const { cabangParam = "cabangId" } = options;

  return async (req, res, next) => {
    try {
      req.user = await verifyBackofficeToken(req);
      return next();
    } catch (backofficeError) {
      try {
        const user = await verifyMobileToken(req);
        const role = user.role ? String(user.role).toLowerCase() : null;
        const requestedCabangId = Number(req.params[cabangParam]);

        if (role !== "owner" && role !== "kasir") {
          return res.status(403).json({
            success: false,
            code: "FORBIDDEN",
            message: "Akses hanya diizinkan untuk owner atau kasir",
          });
        }

        if (role === "kasir" && Number(user.cabangId) !== requestedCabangId) {
          return res.status(403).json({
            success: false,
            code: "FORBIDDEN",
            message: "Kasir hanya dapat mengakses data cabang sendiri",
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

const authenticateBackofficeOrOwnerKasir = () => {
  return async (req, res, next) => {
    try {
      req.user = await verifyBackofficeToken(req);
      return next();
    } catch (backofficeError) {
      try {
        const user = await verifyMobileToken(req);
        const role = user.role ? String(user.role).toLowerCase() : null;

        if (role !== "owner" && role !== "kasir") {
          return res.status(403).json({
            success: false,
            code: "FORBIDDEN",
            message: "Akses hanya diizinkan untuk owner atau kasir",
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

const authenticateBackofficeOrOwnerMachineControl = () => {
  return async (req, res, next) => {
    try {
      const user = await verifyBackofficeToken(req);
      req.user = user;
      req.machineControlActor = {
        type: "backoffice",
        id: user.id,
        username: user.username,
      };
      return next();
    } catch (backofficeError) {
      try {
        const user = await verifyMobileToken(req);

        if (String(user.role || "").toLowerCase() !== "owner") {
          return res.status(403).json({
            success: false,
            code: "FORBIDDEN",
            message: "Akses alias kontrol mesin hanya diizinkan untuk owner atau backoffice",
          });
        }

        req.user = user;
        req.machineControlActor = {
          type: "owner",
          id: user.id,
          username: user.username,
        };
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
  authenticateBackofficeOrOwnerKasirCabang,
  authenticateBackofficeOrOwnerKasir,
  authenticateBackofficeOrOwnerMachineControl,
};
