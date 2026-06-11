const jwt = require("jsonwebtoken");

const authenticateMobile = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ message: "Akses ditolak, token tidak ditemukan" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Validasi: token harus dari JWT mobile (memiliki idMitra)
    if (!decoded.idMitra) {
      return res.status(401).json({ 
        message: "Token tidak valid untuk akses mobile" 
      });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token tidak valid" });
  }
};

module.exports = { authenticateMobile };
