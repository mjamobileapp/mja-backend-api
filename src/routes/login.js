const express = require("express");

const UserController = require("../controller/users.js");

const router = express.Router();

// CREATE - POST
router.post("/", UserController.loginUser);

module.exports = router;
