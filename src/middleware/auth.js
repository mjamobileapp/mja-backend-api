const jwt = require("jsonwebtoken");
const dbPool = require("../config/database");
const { TOKEN_TYPES } = require("../utils/jwt");
const { createHttpError, isTypedHttpError } = require("../utils/httpError");

/**
 * Memverifikasi token JWT backoffice dan memvalidasi keaktifan user secara real-time.
 * Mengembalikan data profil user terupdate langsung dari database tbl_users.
 * * @param {Object} req - Express request object
 * @returns {Object} currentUser - Objek profil user dari database yang up-to-date
 */
const verifyBackofficeToken = async (req) => {
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

  // 3. Token mobile atau token JWT lain tidak boleh digunakan sebagai token backoffice.
  if (decoded.tokenType !== TOKEN_TYPES.BACKOFFICE) {
    throw createHttpError(401, "Token tidak valid untuk akses backoffice", "INVALID_TOKEN_TYPE");
  }

  // 4. Validasi struktur dasar token backoffice
  if (!decoded.id || !decoded.username || !decoded.role) {
    throw createHttpError(401, "Token tidak valid untuk akses backoffice", "INVALID_TOKEN");
  }

  // 5. Validasi real-time status User lewat database (1 Single Query ke tbl_users)
  // Menghilangkan referensi ke tbl_mitra karena ini merupakan sistem internal pemilik laundry
  const [users] = await dbPool.execute(
    `SELECT 
        id, 
        roleId AS role, 
        username, 
        statusAktif
     FROM tbl_users 
     WHERE id = ?`,
    [decoded.id]
  );

  // Jika user tidak ditemukan di database (kemungkinan akun telah di-hard delete)
  if (users.length === 0) {
    throw createHttpError(403, "Akses Ditolak: Akun tidak terdaftar di sistem", "ACCOUNT_NOT_FOUND");
  }

  const currentUser = users[0];

  // Token harus tetap mewakili akun yang sama. Ini mencegah id dari tabel lain
  // dipetakan menjadi akun backoffice yang kebetulan memakai id identik.
  if (
    currentUser.username !== decoded.username ||
    String(currentUser.role) !== String(decoded.role)
  ) {
    throw createHttpError(401, "Token tidak valid untuk akses backoffice", "TOKEN_IDENTITY_MISMATCH");
  }

  // 6. Validasi Keaktifan Akun Individu
  if (!currentUser.statusAktif) {
    throw createHttpError(403, "Akses Ditolak: Akun Anda telah dinonaktifkan", "USER_DEACTIVATED");
  }

  return currentUser;
};

/**
 * Middleware: authenticate
 * Langsung mengembalikan respon JSON error ke klien secara instan tanpa masuk global handler.
 * Sangat aman digunakan untuk seluruh route backoffice API.
 */
const authenticate = async (req, res, next) => {
  try {
    // Jalankan verifikasi token & database guard
    req.user = await verifyBackofficeToken(req);
    next();
  } catch (err) {
    if (!isTypedHttpError(err) || Number(err.statusCode) >= 500) {
      return next(err);
    }

    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
    });
  }
};

module.exports = {
  verifyBackofficeToken,
  authenticate,
};
