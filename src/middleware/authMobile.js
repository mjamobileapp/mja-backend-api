const jwt = require("jsonwebtoken");
const dbPool = require("../config/database");
const { TOKEN_TYPES } = require("../utils/jwt");
const { createHttpError } = require("../utils/httpError");

/**
 * Memverifikasi token JWT mobile dan memvalidasi keaktifan user, mitra (tenant),
 * serta cabang yang bersangkutan secara real-time.
 * Mengembalikan data profil user terupdate langsung dari database.
 * * @param {Object} req - Express request object
 * @returns {Object} currentUser - Objek profil user dari database yang up-to-date
 */
const verifyMobileToken = async (req) => {
  const authHeader = req.headers.authorization;

  // 1. Validasi keberadaan format Bearer Token
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw createHttpError(401, "Akses ditolak, token tidak ditemukan", "UNAUTHORIZED");
  }

  const token = authHeader.split(" ")[1];
  let decoded;

  try {
    // 2. Decode JWT secara matematis (Verifikasi signature)
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const message =
      err.name === "TokenExpiredError" 
        ? "Sesi Anda telah berakhir, silakan login kembali" 
        : "Token tidak valid atau telah kedaluwarsa";
    const code = err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN";
    throw createHttpError(401, message, code);
  }

  // 3. Token backoffice atau token JWT lain tidak boleh digunakan sebagai token mobile.
  if (decoded.tokenType !== TOKEN_TYPES.MOBILE) {
    throw createHttpError(401, "Token tidak valid untuk akses mobile", "INVALID_TOKEN_TYPE");
  }

  // 4. Validasi struktur dasar token mobile
  if (!decoded.id || !decoded.idMitra) {
    throw createHttpError(401, "Token tidak valid untuk akses mobile", "INVALID_TOKEN");
  }

  // 5. Validasi real-time status User, Mitra, & Cabang (1 Single Query dengan JOIN)
  // Menggunakan LEFT JOIN untuk cabang karena akun role Owner memiliki cabangId = NULL di database
  const [users] = await dbPool.execute(
    `SELECT 
        u.id, 
        u.username,
        u.idMitra, 
        u.cabangId, 
        u.role, 
        u.namaLengkap, 
        u.statusAktif AS userAktif, 
        m.statusAktif AS mitraAktif,
        c.statusAktif AS cabangAktif
     FROM tbl_users_mobile u
     INNER JOIN tbl_mitra m ON u.idMitra = m.id
     LEFT JOIN tbl_cabang c ON u.cabangId = c.id
     WHERE u.id = ?`,
    [decoded.id]
  );

  // Jika user/mitra tidak ditemukan di database
  if (users.length === 0) {
    throw createHttpError(
      403,
      "Akses Ditolak: Akun atau Mitra tidak terdaftar di sistem",
      "ACCOUNT_NOT_FOUND"
    );
  }

  const currentUser = users[0];

  // 6. Validasi Keaktifan Perusahaan/Mitra (SaaS Tenant Security)
  if (!currentUser.mitraAktif) {
    throw createHttpError(403, "Akses Ditolak: Mitra telah dinonaktifkan", "TENANT_DEACTIVATED");
  }

  // 7. Validasi Keaktifan Cabang (Khusus untuk user yang memiliki cabangId seperti KASIR)
  if (currentUser.cabangId && currentUser.cabangAktif === 0) {
    throw createHttpError(403, "Akses Ditolak: Cabang telah dinonaktifkan", "BRANCH_DEACTIVATED");
  }

  // 8. Validasi Keaktifan Akun Kasir/Owner individu
  if (!currentUser.userAktif) {
    throw createHttpError(403, "Akses Ditolak: Akun Anda telah dinonaktifkan", "USER_DEACTIVATED");
  }

  return currentUser;
};

/**
 * Middleware 1: authenticateMobile
 * Meneruskan error ke global error handler Express (next(err))
 */
const authenticateMobile = async (req, res, next) => {
  try {
    req.user = await verifyMobileToken(req);
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Middleware 2: authenticateMobileWithErrorResponse
 * Langsung mengembalikan respon JSON error ke klien secara instan tanpa masuk global handler.
 */
const authenticateMobileWithErrorResponse = async (req, res, next) => {
  try {
    req.user = await verifyMobileToken(req);
    next();
  } catch (err) {
    const statusCode = err.statusCode || 401;
    return res.status(statusCode).json({
      success: false,
      code: err.code || "UNAUTHORIZED",
      message: err.message,
    });
  }
};

module.exports = {
  verifyMobileToken,
  authenticateMobile,
  authenticateMobileWithErrorResponse,
};
