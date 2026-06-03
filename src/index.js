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
const aksesRoutes = require("./routes/akses");
const mitraRoutes = require("./routes/mitra");
const cabangRoutes = require("./routes/cabang");

const app = express();
const PORT = process.env.PORT || 9090;
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
console.log("STATIC PATH:", path.join(__dirname, "uploads"));

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
app.use("/assets", express.static("public/images"));

/* ===========================================================
   3. CONFIG UPLOAD (MULTER)
=============================================================*/

/* ===========================================================
   4. ROUTES
=============================================================*/
app.use("/users", usersRoutes);
app.use("/login", loginRoutes);
app.use("/roles", roleRoutes);
app.use("/menus", menuRoutes);
app.use("/akses", aksesRoutes);
app.use("/mitra", mitraRoutes);
app.use("/cabang", cabangRoutes);
// ================= rencana ==================

app.get("/", (req, res) => {
  res.send("API Monitoring working!");
});

// Middleware to serve static files
// app.use("/uploads", express.static("uploads"));

// =====================================

app.use((err, req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, OPTIONS, PUT, PATCH, DELETE",
  );
  res.json({
    message: err.message,
  });
});

// app.use(cors());

app.listen(PORT, () => {
  console.log(`Server berhasil di running di port ${PORT}`);
});
