const jwt = require("jsonwebtoken");
const dbPool = require("../config/database");

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

  // 3. Validasi struktur dasar token backoffice
  if (!decoded.id || !decoded.username || !decoded.role) {
    const error = new Error("Token tidak valid untuk akses backoffice");
    error.statusCode = 401;
    error.code = "INVALID_TOKEN";
    throw error;
  }

  // 4. Validasi real-time status User lewat database (1 Single Query ke tbl_users)
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
    const error = new Error("Akses Ditolak: Akun tidak terdaftar di sistem");
    error.statusCode = 403;
    error.code = "ACCOUNT_NOT_FOUND";
    throw error;
  }

  const currentUser = users[0];

  // 5. Validasi Keaktifan Akun Individu
  if (!currentUser.statusAktif) {
    const error = new Error("Akses Ditolak: Akun Anda telah dinonaktifkan");
    error.statusCode = 403;
    error.code = "USER_DEACTIVATED";
    throw error;
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
    console.error("Authentication Error:", err);
    const statusCode = err.statusCode || 401;
    return res.status(statusCode).json({
      success: false,
      code: err.code || "UNAUTHORIZED",
      message: err.message,
    });
  }
};

module.exports = {
  verifyBackofficeToken,
  authenticate,
};
