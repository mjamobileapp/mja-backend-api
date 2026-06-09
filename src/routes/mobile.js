const express = require("express");
const MobileController = require("../controller/mobile");

const router = express.Router();

// Public route (tanpa authenticate middleware)
router.post("/login", MobileController.loginUser);

module.exports = router;
