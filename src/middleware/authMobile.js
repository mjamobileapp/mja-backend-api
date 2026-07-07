const jwt = require("jsonwebtoken");

const verifyMobileToken = (req) => {
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

  return decoded;
};

const authenticateMobile = (req, res, next) => {
  try {
    req.user = verifyMobileToken(req);
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

    return res.status(401).json({ message: "Token tidak valid" });
  }
};

const authenticateMobileWithErrorResponse = (req, res, next) => {
  try {
    req.user = verifyMobileToken(req);
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token tidak valid" });
  }
};

module.exports = { authenticateMobile, authenticateMobileWithErrorResponse };
