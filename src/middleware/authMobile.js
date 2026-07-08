const jwt = require("jsonwebtoken");
const dbPool = require("../config/database");

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
    const error = new Error("Akses ditolak, token tidak ditemukan");
    error.statusCode = 401;
    throw error;
  }

  const token = authHeader.split(" ")[1];
  let decoded;

  try {
    // 2. Decode JWT secara matematis (Verifikasi signature)
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    const error = new Error(
      err.name === "TokenExpiredError" 
        ? "Sesi Anda telah berakhir, silakan login kembali" 
        : "Token tidak valid atau telah kedaluwarsa"
    );
    error.statusCode = 401;
    error.code = err.name === "TokenExpiredError" ? "TOKEN_EXPIRED" : "INVALID_TOKEN";
    throw error;
  }

  // 3. Validasi struktur dasar token mobile
  if (!decoded.id || !decoded.idMitra) {
    const error = new Error("Token tidak valid untuk akses mobile");
    error.statusCode = 401;
    throw error;
  }

  // 4. Validasi real-time status User, Mitra, & Cabang (1 Single Query dengan JOIN)
  // Menggunakan LEFT JOIN untuk cabang karena akun role Owner memiliki cabangId = NULL di database
  const [users] = await dbPool.execute(
    `SELECT 
        u.id, 
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
    const error = new Error("Akses Ditolak: Akun atau Mitra tidak terdaftar di sistem");
    error.statusCode = 403;
    error.code = "ACCOUNT_NOT_FOUND";
    throw error;
  }

  const currentUser = users[0];

  // 5. Validasi Keaktifan Perusahaan/Mitra (SaaS Tenant Security)
  if (!currentUser.mitraAktif) {
    const error = new Error("Akses Ditolak: Mitra telah dinonaktifkan");
    error.statusCode = 403;
    error.code = "TENANT_DEACTIVATED";
    throw error;
  }

  // 6. Validasi Keaktifan Cabang (Khusus untuk user yang memiliki cabangId seperti KASIR)
  if (currentUser.cabangId && currentUser.cabangAktif === 0) {
    const error = new Error("Akses Ditolak: Cabang telah dinonaktifkan");
    error.statusCode = 403;
    error.code = "BRANCH_DEACTIVATED";
    throw error;
  }

  // 7. Validasi Keaktifan Akun Kasir/Owner individu
  if (!currentUser.userAktif) {
    const error = new Error("Akses Ditolak: Akun Anda telah dinonaktifkan");
    error.statusCode = 403;
    error.code = "USER_DEACTIVATED";
    throw error;
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