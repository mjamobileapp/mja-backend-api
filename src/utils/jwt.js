const jwt = require("jsonwebtoken");

const generateToken = (user) => {
  console.log(user);
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      // Tambahkan role atau level di sini
      role: user.id_role,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
};

module.exports = { generateToken };
