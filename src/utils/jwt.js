const jwt = require("jsonwebtoken");

const TOKEN_TYPES = Object.freeze({
  BACKOFFICE: "backoffice",
  MOBILE: "mobile",
});

const generateToken = (user, tokenType) => {
  if (!Object.values(TOKEN_TYPES).includes(tokenType)) {
    throw new Error("Tipe token tidak valid");
  }

  const userId = user.id ?? user.id_user;

  // Bangun payload JWT
  const payload = {
    id: userId,
    username: user.username,
    role: user.id_role,
    tokenType,
  };
  
    // Tambahkan idMitra jika ada
  if (user.idMitra) {
    payload.idMitra = user.idMitra;
  }

  // Tambahkan cabangId jika ada
  if (user.cabangId) {
    payload.cabangId = user.cabangId;
  }
  
  return jwt.sign(
    payload,
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
};

module.exports = { generateToken, TOKEN_TYPES };
