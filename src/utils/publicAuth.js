const RESET_PASSWORD_ACCEPTED_MESSAGE = "Jika akun terdaftar, tautan reset password akan dikirim ke email terdaftar.";

const sendResetPasswordAccepted = (res) =>
  res.status(202).json({
    message: RESET_PASSWORD_ACCEPTED_MESSAGE,
  });

module.exports = {
  RESET_PASSWORD_ACCEPTED_MESSAGE,
  sendResetPasswordAccepted,
};
