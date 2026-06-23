const jwt = require("jsonwebtoken");

const generateToken = (user) => {
  console.log(user);
  
  // Bangun payload JWT
  const payload = {
    id: user.id,
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
    { expiresIn: "1d" }
  );
};

module.exports = { generateToken };
