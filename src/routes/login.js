const express = require("express");

const UserController = require("../controller/users.js");
const { publicLoginRateLimiter } = require("../middleware/publicAuthRateLimit");
const { catchAsync } = require("../utils/catchAsync");

const router = express.Router();

// CREATE - POST
router.post("/", publicLoginRateLimiter, catchAsync(UserController.loginUser));

module.exports = router;
