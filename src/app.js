const path = require("path");
const express = require("express");
const cors = require("cors");
const middlewareLogRequest = require("./middleware/logs");
const { authenticate } = require("./middleware/auth");
const { getAllowedOrigins, getTrustProxy } = require("./config/environment");
const { errorHandler, notFoundHandler, createHttpError } = require("./middleware/errorHandler");
const { sanitizeServerErrorResponse } = require("./middleware/responseSanitizer");
const { catchAsync } = require("./utils/catchAsync");

const usersRoutes = require("./routes/users");
const loginRoutes = require("./routes/login");
const logoutRoutes = require("./routes/logout");
const roleRoutes = require("./routes/roles");
const menuRoutes = require("./routes/menus");
const { getMenuHeader } = require("./controller/menus");
const aksesRoutes = require("./routes/akses");
const mitraRoutes = require("./routes/mitra");
const cabangRoutes = require("./routes/cabang");
const mesinRoutes = require("./routes/mesin");
const masterItemRoutes = require("./routes/masterItem");
const userOwnerRoutes = require("./routes/userOwner");
const mobileRoutes = require("./routes/mobile");
const kasirRoutes = require("./routes/kasir");
const absensiKasirRoutes = require("./routes/absensiKasir");
const settingStokMitraRoutes = require("./routes/settingStokMitra");
const dashboardRoutes = require("./routes/dashboard");
const cashflowRoutes = require("./routes/cashflow");
const historyRoutes = require("./routes/history");
const historyKasirRoutes = require("./routes/historyKasir");
const hargaCabangRoutes = require("./routes/hargaCabang");
const transaksiRoutes = require("./routes/transaksi");
const transaksiStartMesinRoutes = require("./routes/transaksiStartMesin");

const createApp = ({ environment = process.env } = {}) => {
  const app = express();
  const uploadsPath = path.join(__dirname, "..", "uploads");
  const allowedOrigins = getAllowedOrigins(environment);
  app.set("trust proxy", getTrustProxy(environment));

  app.use(middlewareLogRequest);
  app.use(sanitizeServerErrorResponse);
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }

        return callback(createHttpError(403, "Origin tidak diizinkan oleh CORS", "CORS_FORBIDDEN"));
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      credentials: true,
    })
  );
  app.use(express.json());
  app.use("/uploads", express.static(uploadsPath));
  app.use("/assets", express.static(path.join(__dirname, "..", "public", "images")));

  app.use("/api/backoffice/users", usersRoutes);
  app.use("/api/backoffice/login", loginRoutes);
  app.use("/api/backoffice/logout", logoutRoutes);
  app.use("/api/backoffice/roles", roleRoutes);
  app.use("/api/backoffice/menus", menuRoutes);
  app.get("/api/backoffice/getMenuHeader", authenticate, catchAsync(getMenuHeader));
  app.use("/api/backoffice/akses", aksesRoutes);
  app.use("/api/backoffice/mitra", mitraRoutes);
  app.use("/api/backoffice/cabang", cabangRoutes);
  app.use("/api/backoffice/mesin", mesinRoutes);
  app.use("/api/backoffice/item", masterItemRoutes);
  app.use("/api/backoffice/userowner", userOwnerRoutes);
  app.use("/api/mobile", mobileRoutes);
  app.use("/api/transaksi", transaksiStartMesinRoutes);
  app.use("/api/kasir/transaksi", transaksiRoutes);
  app.use("/api/owner/kasir", kasirRoutes);
  app.use("/api/kasir/absensi", absensiKasirRoutes);
  app.use("/api/owner/stokmitra", settingStokMitraRoutes);
  app.use("/api/backoffice/dashboard", dashboardRoutes);
  app.use("/api/owner", cashflowRoutes);
  app.use("/api/owner/history", historyRoutes);
  app.use("/api/kasir/history", historyKasirRoutes);
  app.use("/api/owner/settingharga", hargaCabangRoutes);

  app.get("/", (req, res) => {
    res.send("API Monitoring working!");
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

module.exports = { createApp };
