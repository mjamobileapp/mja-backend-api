const jwt = require("jsonwebtoken");
const dbPool = require("../config/database");

const verifyMobileToken = async (req) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    const error = new Error("Akses ditolak, token tidak ditemukan");
    error.statusCode = 401;
    throw error;
  }

  const token = authHeader.split(" ")[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET);

  // Validasi: token harus dari JWT mobile (memiliki idMitra)
  if (!decoded.idMitra) {
    const error = new Error("Token tidak valid untuk akses mobile");
    error.statusCode = 401;
    throw error;
  }

  const [mitra] = await dbPool.execute(
    "SELECT id FROM tbl_mitra WHERE id = ? AND statusAktif = 1",
    [decoded.idMitra]
  );

  if (mitra.length === 0) {
    const error = new Error("Token Tidak Valid: Mitra tidak ditemukan atau tidak aktif");
    error.statusCode = 401;
    throw error;
  }

  return decoded;
};

const authenticateMobile = async (req, res, next) => {
  try {
    req.user = await verifyMobileToken(req);
    next();
  } catch (err) {
    if (err.message === "Akses ditolak, token tidak ditemukan") {
      return res
        .status(401)
        .json({ message: "Akses ditolak, token tidak ditemukan" });
    }

    if (err.message === "Token tidak valid untuk akses mobile") {
      return res.status(401).json({
        message: "Token tidak valid untuk akses mobile",
      });
    }

    if (err.message === "Token Tidak Valid: Mitra tidak ditemukan atau tidak aktif") {
      return res.status(401).json({
        message: "Token Tidak Valid: Mitra tidak ditemukan atau tidak aktif",
      });
    }

    return res.status(401).json({ message: "Token tidak valid" });
  }
};

const authenticateMobileWithErrorResponse = async (req, res, next) => {
  try {
    req.user = await verifyMobileToken(req);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token tidak valid" });
  }
};

module.exports = { authenticateMobile, authenticateMobileWithErrorResponse };
