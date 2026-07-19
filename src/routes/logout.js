const express = require("express");
const UserController = require("../controller/users");
const { authenticate } = require("../middleware/auth");
const { catchAsync } = require("../utils/catchAsync");
const router = express.Router();
router.post("/", authenticate, catchAsync(UserController.logoutUser));
module.exports = router;
