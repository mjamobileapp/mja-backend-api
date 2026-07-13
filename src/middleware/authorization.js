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

module.exports = { requireMobileOwner };
