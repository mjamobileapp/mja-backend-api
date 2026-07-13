const express = require("express");

const UserController = require("../controller/users.js");
const { publicLoginRateLimiter } = require("../middleware/publicAuthRateLimit");

const router = express.Router();

// CREATE - POST
router.post("/", publicLoginRateLimiter, UserController.loginUser);

module.exports = router;
