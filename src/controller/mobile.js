const bcrypt = require("bcrypt");
const UserMobileModel = require("../models/userMobile");
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

module.exports = {
  loginUser,
};
