const nodemailer = require("nodemailer");
const EmailTemplateModel = require("../models/emailTemplate");
const jwt = require("jsonwebtoken");
const { getEmailSendTimeoutMs, getRequiredJwtSecret } = require("../config/environment");
const { ACCOUNT_TYPES, MOBILE_ROLES } = require("../domain/auth");

const getTransporter = () => {
  const requiredConfig = [
    "GMAIL_USER",
    "GMAIL_CLIENT_ID",
    "GMAIL_CLIENT_SECRET",
    "GMAIL_REFRESH_TOKEN",
    "MAIL_FROM",
  ];

  const missingConfig = requiredConfig.filter((key) => !process.env[key]);
  if (missingConfig.length > 0) {
    throw new Error(`Konfigurasi email OAuth2 belum lengkap: ${missingConfig.join(", ")}`);
  }

  const timeoutMs = getEmailSendTimeoutMs();

  return nodemailer.createTransport({
    service: "gmail",
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
    dnsTimeout: timeoutMs,
    auth: {
      type: "OAuth2",
      user: process.env.GMAIL_USER,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    },
  });
};

const createEmailTimeoutError = (timeoutMs) => {
  const error = new Error(`Pengiriman email melebihi batas waktu ${timeoutMs}ms`);
  error.code = "EMAIL_SEND_TIMEOUT";
  return error;
};

const sendMailWithTimeout = async (transporter, message, timeoutMs = getEmailSendTimeoutMs()) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      transporter.close?.();
      reject(createEmailTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([transporter.sendMail(message), timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

/**
 * Fungsi Helper untuk mengganti placeholder {{KEY}} dengan value sesungguhnya
 */
const compileTemplate = (template, data) => {
  let content = template;
  for (const key in data) {
    const placeholder = `{{${key}}}`;
    content = content.replace(new RegExp(placeholder, "g"), data[key]);
  }
  return content;
};

/**
 * Mengonversi durasi human-readable ke format yang dimengerti jsonwebtoken (ms library)
 * Contoh: "24 Jam" -> "24h", "1 Hari" -> "1d", "30 Menit" -> "30m"
 */
const convertExpiryToJwt = (duration) => {
  if (!duration) return "24h";
  return duration.toLowerCase()
    .replace(/ jam/g, "h")
    .replace(/ hari/g, "d")
    .replace(/ menit/g, "m")
    .trim();
};

const sendUserMobileCredentialEmail = async ({ to, username, role }) => {
  const transporter = getTransporter();
  
  // Pilih template berdasarkan role
  const kodeTemplate = role === MOBILE_ROLES.KASIR ? "CREATE_USER_KASIR" : "CREATE_USER_OWNER";
  const template = await EmailTemplateModel.getTemplateByKode(kodeTemplate);

  if (!template) throw new Error(`Email template ${kodeTemplate} not found`);

  // Generate Token dengan masa berlaku dari .env
  const token = jwt.sign(
    { username, type: 'activation', role }, 
    getRequiredJwtSecret(),
    { expiresIn: convertExpiryToJwt(process.env.EMAIL_EXPIRY_DURATION) }
  );

  const placeholders = {
    APP_NAME: process.env.APP_NAME,
    USERNAME: username,
    ACTIVATION_LINK: `${process.env.FRONTEND_URL}/activate-account?token=${token}&type=activateUser`,
    EXPIRY_DURATION: process.env.EMAIL_EXPIRY_DURATION,
    YEAR: new Date().getFullYear(),
  };

  return sendMailWithTimeout(transporter, {
    from: process.env.MAIL_FROM,
    to,
    subject: compileTemplate(template.subject, placeholders),
    html: compileTemplate(template.htmlBody, placeholders),
  });
};

const sendResetPasswordEmail = async ({ to, username, role }) => {
  const transporter = getTransporter();
  
  // Pilih template berdasarkan role
  let kodeTemplate;
  if (role === ACCOUNT_TYPES.BACKOFFICE) {
    kodeTemplate = "RESET_PASSWORD_BACKOFFICE";
  }else if (role === ACCOUNT_TYPES.KASIR) {
    kodeTemplate = "RESET_PASSWORD_KASIR";
  } else {
    kodeTemplate = "RESET_PASSWORD_OWNER"; // Default ke owner jika role tidak dikenali
  }

  const template = await EmailTemplateModel.getTemplateByKode(kodeTemplate);

  if (!template) throw new Error(`Email template ${kodeTemplate} not found`);

  // Generate Token dengan masa berlaku dari .env
  const token = jwt.sign(
    { username, type: 'reset_password', role }, 
    getRequiredJwtSecret(),
    { expiresIn: convertExpiryToJwt(process.env.EMAIL_EXPIRY_DURATION) }
  );

  const placeholders = {
    APP_NAME: process.env.APP_NAME,
    USERNAME: username,
    ACTIVATION_LINK: `${process.env.FRONTEND_URL}/activate-account?token=${token}&type=forgotPassword`,
    EXPIRY_DURATION: process.env.EMAIL_EXPIRY_DURATION,
    YEAR: new Date().getFullYear(),
  };

  return sendMailWithTimeout(transporter, {
    from: process.env.MAIL_FROM,
    to,
    subject: compileTemplate(template.subject, placeholders),
    html: compileTemplate(template.htmlBody, placeholders),
  });
};

module.exports = {
  sendMailWithTimeout,
  sendUserMobileCredentialEmail,
  sendResetPasswordEmail,
};
