require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
// Middleware & Utility
const middlewareLogRequest = require("./middleware/logs");
const { authenticate } = require("./middleware/auth");
const dbPool = require("./config/database");
// Route Modules
const usersRoutes = require("./routes/users");
const loginRoutes = require("./routes/login");
const roleRoutes = require("./routes/roles");
const menuRoutes = require("./routes/menus");
const { getMenuHeader, getAll } = require("./controller/menus");
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

const app = express();
const PORT = process.env.PORT || 9090;
const uploadsPath = path.join(__dirname, "..", "uploads");
app.use("/uploads", express.static(uploadsPath));
console.log("STATIC UPLOADS PATH:", uploadsPath);

/* ===========================================================
   1. GLOBAL MIDDLEWARE
=============================================================*/
app.use(middlewareLogRequest);

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3100",
  "http://dev.appadentis.cloud",
  "http://appadentis.cloud",
  "https://appadentis.cloud",
  "http://148.230.102.45:3100",
];

// CORS
app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  }),
);

// JSON parser
app.use(express.json());

/* ===========================================================
   2. STATIC FILES (PENTING: taruh sebelum routes!)
=============================================================*/
app.use("/assets", express.static(path.join(__dirname, "..", "public", "images")));

/* ===========================================================
   3. CONFIG UPLOAD (MULTER)
=============================================================*/

/* ===========================================================
   4. ROUTES
=============================================================*/
app.use("/api/backoffice/users", usersRoutes);
app.use("/api/backoffice/login", loginRoutes);
app.use("/api/backoffice/roles", roleRoutes);
app.use("/api/backoffice/menus", menuRoutes);
app.use("/api/backoffice/getMenuHeader", authenticate, getMenuHeader);
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
// ================= rencana ==================

app.get("/", (req, res) => {
  res.send("API Monitoring working!");
});

// Middleware to serve static files
// app.use("/uploads", express.static("uploads"));

// =====================================

app.use((err, req, res, next) => {
  console.error("ERROR LOG:", err.stack); // Tambahkan log untuk memudahkan debug

  res.status(err.status || 500);
  res.json({
    message: err.message || "Internal Server Error",
  });
});

// app.use(cors());

app.listen(PORT, () => {
  console.log(`Server berhasil di running di port ${PORT}`);
});
