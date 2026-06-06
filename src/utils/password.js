const bcrypt = require("bcrypt");
const crypto = require("crypto");

const generateAndHashPassword = async (length = 8) => {
  // Menghasilkan random string yang lebih kompleks (Alphanumeric + Spesial Karakter)
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+";
  let password = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = crypto.randomInt(0, charset.length);
    password += charset[randomIndex];
  }

  // Melakukan hash menggunakan bcrypt
  const hashedPassword = await bcrypt.hash(password, 10);
  return { password, hashedPassword };
};

module.exports = { generateAndHashPassword };