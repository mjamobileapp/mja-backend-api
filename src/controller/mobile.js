const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const UserMobileModel = require("../models/userMobile");
const UsersModel = require("../models/users");
const { generateToken } = require("../utils/jwt");

const loginUser = async (req, res) => {
  const { body } = req;

  // 1. Validasi Input
  const requiredFields = ["username", "password", "deviceId", "deviceName"];
  const missingFields = requiredFields.filter((field) => !body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  const { username, password, deviceId, deviceName } = body;

  try {
    // 2. Cari User
    const user = await UserMobileModel.getUserByUsername(username);

    if (!user) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    // 3. Verifikasi Password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    // 4. Validasi Device ID
    if (user.deviceId === null) {
      // Device pertama kali - binding device
      await UserMobileModel.updateDeviceId(user.id, deviceId, deviceName);
    } else {
      // Sudah terikat device - bandingkan
      if (user.deviceId !== deviceId) {
        return res.status(403).json({
          message: "Error 403: Akun ini tidak dapat digunakan di perangkat ini",
        });
      }
    }

        // 5. Generate Token
        const token = generateToken({
      id: user.id,
      username: user.username,
      idMitra: user.idMitra,
      cabangId: user.cabangId || null,
      id_role: user.role === "owner" ? 1 : 2, // Mapping role ke id_role
    });

    // 6. Proses Role Kasir
    if (user.role === "kasir") {
      // a. Insert absensi
      await UserMobileModel.createAbsensi(user.id, user.cabangId);

      // b. Insert notifikasi ke owner
      await UserMobileModel.createNotifikasi(
        user.idMitra,
        user.cabangId,
        "ABSENSI",
        "Kasir Mulai Shift",
        `Kasir ${user.namaLengkap} telah login dan memulai shift di cabang.`
      );

      // c. Push Notification (opsional - untuk implementasi Firebase FCM nanti)
      // TODO: Kirim push notification ke Firebase untuk user owner
    }

    // 7. Return Response Sukses
    return res.status(200).json({
      message: "Login successful",
      data: {
        id: user.id,
        username: user.username,
        role: user.role,
        idMitra: String(user.idMitra),
        cabangId: String(user.cabangId) || null,
        namaLengkap: user.namaLengkap,
        noTelp: user.noTelp,
        email: user.email,
        statusAktif: user.statusAktif,
        deviceId: user.deviceId === null ? deviceId : user.deviceId,
        deviceName: user.deviceName === null ? deviceName : user.deviceName,
        token: token,
      },
    });
  } catch (error) {
    console.error("Mobile Login error:", error);
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

const activateAccount = async (req, res) => {
  const { body } = req;
  const { token, password, confirmPassword } = body;

  // 1. Validasi input
  const requiredFields = ["token", "password", "confirmPassword"];
  const missingFields = requiredFields.filter((field) => !body[field]);

  if (missingFields.length > 0) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: missingFields,
    });
  }

  // 2. Validasi password dan confirmPassword harus sama
  if (password !== confirmPassword) {
    return res.status(400).json({
      error: "Password dan konfirmasi password tidak cocok",
    });
  }

  // 3. Validasi minimal panjang password (6 karakter)
  if (password.length < 6) {
    return res.status(400).json({
      error: "Password minimal 6 karakter",
    });
  }

    try {
      // 4. Verifikasi token JWT
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "MJA_SECRET_KEY");

      const { username, role } = decoded;
      const isBackoffice = role === "backoffice";

      // 5. Cari user di database
      let user;
      if (isBackoffice) {
        const [rows] = await UsersModel.getUserByUsername(username);
        user = rows[0];
        if (!user) throw new Error("data not found");
      } else {
        user = await UserMobileModel.getUserByUsernameWithoutStatusFilter(username);
      }

      // 6. Validasi berdasarkan type token
      if (decoded.type === "activation") {
        // Aktivasi akun baru

        // 6a. Cek apakah user sudah aktif
        // if (user.statusAktif === 1) {
        //   return res.status(400).json({
        //     error: "Akun sudah aktif",
        //   });
        // }

        // 6b. Hash password baru
        const hashedPassword = await bcrypt.hash(password, 10);

        // 6c. Update statusAktif menjadi 1 (aktif) dan update password
        // await UserMobileModel.updateStatusAktifByUsername(username);
        if (isBackoffice) {
          await UsersModel.updatePasswordByUsername(username, hashedPassword);
        } else {
          await UserMobileModel.updatePasswordByUsername(username, hashedPassword);
        }

      } else if (decoded.type === "reset_password") {
        // Reset password (tanpa update statusAktif)

        // Validasi: user harus sudah aktif
        if (user.statusAktif === 0) {
          return res.status(400).json({
            error: "Akun belum diaktivasi, silakan aktivasi terlebih dahulu",
          });
        }

        // Hash password baru
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update password saja
        if (isBackoffice) {
          await UsersModel.updatePasswordByUsername(username, hashedPassword);
        } else {
          await UserMobileModel.updatePasswordByUsername(username, hashedPassword);
        }

      } else {
        // Type token tidak dikenal
        return res.status(400).json({
          error: "Token tidak valid",
        });
      }

      // 7. Ambil data user terbaru setelah proses
      let activatedUser;
      if (isBackoffice) {
        const [rows] = await UsersModel.getUserByUsername(username);
        activatedUser = rows[0];
        delete activatedUser.password;
      } else {
        activatedUser = await UserMobileModel.getUserByUsernameWithoutStatusFilter(username);
      }

      // 8. Return response sukses (pesan berbeda tergantung type)
      const message = decoded.type === "activation"
        ? "Akun berhasil diaktivasi"
        : "Password berhasil diubah";

      res.status(200).json({
        message: message,
        data: activatedUser,
      });
    } catch (error) {
      // Handle error spesifik
      if (error.message === "data not found") {
        return res.status(400).json({
          error: "Token tidak valid atau sudah kedaluwarsa",
        });
      }

      if (error.name === "TokenExpiredError") {
        return res.status(400).json({
          error: "Token sudah kedaluwarsa",
        });
      }

      if (error.name === "JsonWebTokenError") {
        return res.status(400).json({
          error: "Token tidak valid",
        });
      }

      res.status(500).json({
        message: "Server Error",
        serverMessage: error.message,
      });
    }
};

const logoutUser = async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({
      message: "Bad request, missing required fields",
      missingFields: ["username"],
    });
  }

  try {
    // Cari user di database untuk memastikan username valid dan ambil datanya
    const user = await UserMobileModel.getUserByUsername(username);

    if (!user) {
      return res.status(404).json({
        error: "Username tidak ditemukan",
      });
    }

    // Proses khusus jika role = kasir
    if (user.role === "kasir") {
      // a. Input data logout ke tbl_absensi
      await UserMobileModel.recordAbsensiLogout(user.id, user.cabangId);

      // b. Input data ke tbl_notifikasi untuk owner
      await UserMobileModel.createNotifikasi(
        user.idMitra,
        user.cabangId,
        "ABSENSI",
        "Kasir Selesai Shift",
        `Kasir ${user.namaLengkap} telah logout dan menyelesaikan shift di cabang.`
      );
    }

    return res.status(200).json({
      message: "Logout User Successfully",
      data: {
        username: user.username,
      },
    });
  } catch (error) {
    console.error("Mobile Logout error:", error);
    res.status(500).json({
      message: "Server Error",
      serverMessage: error.message,
    });
  }
};

module.exports = {
  loginUser,
  activateAccount,
  logoutUser,
};
