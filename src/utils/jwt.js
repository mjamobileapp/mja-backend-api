const jwt = require("jsonwebtoken");

const generateToken = (user) => {
  console.log(user);
  
  const userId = user.id ?? user.id_user;

  // Bangun payload JWT
  const payload = {
    id: userId,
    username: user.username,
    role: user.id_role,
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

module.exports = { generateToken };
