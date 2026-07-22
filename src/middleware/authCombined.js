const { verifyBackofficeToken } = require("./auth");
const { verifyMobileToken } = require("./authMobile");
const { isTypedHttpError } = require("../utils/httpError");
const { MOBILE_ROLES, normalizeMobileRole } = require("../domain/auth");
const { MACHINE_CONTROL_ACTOR_TYPES } = require("../domain/machineControl");

const selectAuthError = (backofficeError, mobileError) => {
  if (!isTypedHttpError(backofficeError)) return backofficeError;
  if (!isTypedHttpError(mobileError)) return mobileError;
  return mobileError;
};

const sendAuthError = (res, error, next) => {
  if (!isTypedHttpError(error) || Number(error.statusCode) >= 500) {
    return next(error);
  }

  return res.status(error.statusCode).json({
    success: false,
    code: error.code,
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

        if (normalizeMobileRole(user.role) !== MOBILE_ROLES.OWNER) {
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
        return sendAuthError(res, selectAuthError(backofficeError, mobileError), next);
      }
    }
  };
};

const authenticateBackofficeOrMobile = () => {
  return async (req, res, next) => {
    try {
      req.user = await verifyBackofficeToken(req);
      return next();
    } catch (backofficeError) {
      try {
        req.user = await verifyMobileToken(req);
        return next();
      } catch (mobileError) {
        return sendAuthError(res, selectAuthError(backofficeError, mobileError), next);
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
        const role = normalizeMobileRole(user.role) || null;
        const requestedCabangId = Number(req.params[cabangParam]);

        if (role !== MOBILE_ROLES.OWNER && role !== MOBILE_ROLES.KASIR) {
          return res.status(403).json({
            success: false,
            code: "FORBIDDEN",
            message: "Akses hanya diizinkan untuk owner atau kasir",
          });
        }

        if (role === MOBILE_ROLES.KASIR && Number(user.cabangId) !== requestedCabangId) {
          return res.status(403).json({
            success: false,
            code: "FORBIDDEN",
            message: "Kasir hanya dapat mengakses data cabang sendiri",
          });
        }

        req.user = user;
        return next();
      } catch (mobileError) {
        return sendAuthError(res, selectAuthError(backofficeError, mobileError), next);
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
        const role = normalizeMobileRole(user.role) || null;

        if (role !== MOBILE_ROLES.OWNER && role !== MOBILE_ROLES.KASIR) {
          return res.status(403).json({
            success: false,
            code: "FORBIDDEN",
            message: "Akses hanya diizinkan untuk owner atau kasir",
          });
        }

        req.user = user;
        return next();
      } catch (mobileError) {
        return sendAuthError(res, selectAuthError(backofficeError, mobileError), next);
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
        type: MACHINE_CONTROL_ACTOR_TYPES.BACKOFFICE,
        id: user.id,
        username: user.username,
      };
      return next();
    } catch (backofficeError) {
      try {
        const user = await verifyMobileToken(req);

        if (normalizeMobileRole(user.role) !== MOBILE_ROLES.OWNER) {
          return res.status(403).json({
            success: false,
            code: "FORBIDDEN",
            message: "Akses alias kontrol mesin hanya diizinkan untuk owner atau backoffice",
          });
        }

        req.user = user;
        req.machineControlActor = {
          type: MACHINE_CONTROL_ACTOR_TYPES.OWNER,
          id: user.id,
          username: user.username,
        };
        return next();
      } catch (mobileError) {
        return sendAuthError(res, selectAuthError(backofficeError, mobileError), next);
      }
    }
  };
};

module.exports = {
  authenticateBackofficeOrOwner,
  authenticateBackofficeOrMobile,
  authenticateBackofficeOrOwnerKasirCabang,
  authenticateBackofficeOrOwnerKasir,
  authenticateBackofficeOrOwnerMachineControl,
};
