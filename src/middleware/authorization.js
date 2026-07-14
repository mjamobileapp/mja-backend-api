const dbPool = require("../config/database");

const sendForbiddenResponse = (res) =>
  res.status(403).json({
    success: false,
    code: "FORBIDDEN",
    message: "Anda tidak memiliki izin untuk mengakses resource ini",
  });

const requireBackofficeMenuAccess = (menuUrl) => async (req, res, next) => {
  try {
    const [accessRows] = await dbPool.execute(
      `SELECT 1
       FROM tbl_akses a
       INNER JOIN tbl_menu m ON m.id = a.menuId
       WHERE a.roleId = ? AND m.url = ? AND a.akses = 1
       LIMIT 1`,
      [req.user.role, menuUrl]
    );

    if (accessRows.length === 0) {
      return sendForbiddenResponse(res);
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

const requireBackofficeSelfOrMenuAccess = (menuUrl, usernameParam = "email") => (req, res, next) => {
  if (req.user?.username === req.params?.[usernameParam]) {
    return next();
  }

  return requireBackofficeMenuAccess(menuUrl)(req, res, next);
};

const requireMobileOwner = (req, res, next) => {
  const role = String(req.user?.role || "").toLowerCase();

  if (role !== "owner") {
    return res.status(403).json({
      success: false,
      code: "FORBIDDEN",
      message: "Akses hanya diizinkan untuk owner",
    });
  }

  return next();
};

const requireMobileKasir = (req, res, next) => {
  const role = String(req.user?.role || "").toLowerCase();

  if (role !== "kasir") {
    return res.status(403).json({
      success: false,
      code: "FORBIDDEN",
      message: "Akses hanya diizinkan untuk kasir",
    });
  }

  return next();
};

module.exports = {
  requireBackofficeMenuAccess,
  requireBackofficeSelfOrMenuAccess,
  requireMobileOwner,
  requireMobileKasir,
};
