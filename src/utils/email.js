const nodemailer = require("nodemailer");
const EmailTemplateModel = require("../models/emailTemplate");

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

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: process.env.GMAIL_USER,
      clientId: process.env.GMAIL_CLIENT_ID,
      clientSecret: process.env.GMAIL_CLIENT_SECRET,
      refreshToken: process.env.GMAIL_REFRESH_TOKEN,
    },
  });
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

const sendUserOwnerCredentialEmail = async ({ to, username }) => {
  const transporter = getTransporter();
  const template = await EmailTemplateModel.getTemplateByKode("CREATE_USER_OWNER");

  if (!template) throw new Error("Email template CREATE_USER_OWNER not found");

  const placeholders = {
    APP_NAME: process.env.APP_NAME,
    USERNAME: username,
    ACTIVATION_LINK: `${process.env.FRONTEND_URL}/activate-account?username=${encodeURIComponent(username)}`,
    EXPIRY_DURATION: process.env.EMAIL_EXPIRY_DURATION,
    YEAR: new Date().getFullYear(),
  };

  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: compileTemplate(template.subject, placeholders),
    html: compileTemplate(template.htmlBody, placeholders),
  });
};

const sendResetPasswordEmail = async ({ to, username }) => {
  const transporter = getTransporter();
  const template = await EmailTemplateModel.getTemplateByKode("RESET_PASSWORD_OWNER");

  if (!template) throw new Error("Email template RESET_PASSWORD_OWNER not found");

  const placeholders = {
    APP_NAME: process.env.APP_NAME,
    USERNAME: username,
    ACTIVATION_LINK: `${process.env.FRONTEND_URL}/activate-account?username=${encodeURIComponent(username)}`,
    EXPIRY_DURATION: process.env.EMAIL_EXPIRY_DURATION,
    YEAR: new Date().getFullYear(),
  };

  return transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: compileTemplate(template.subject, placeholders),
    html: compileTemplate(template.htmlBody, placeholders),
  });
};

module.exports = {
  sendUserOwnerCredentialEmail,
  sendResetPasswordEmail,
};
