const express = require("express");
const MitraController = require("../controller/mitra");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.post("/", authenticate, MitraController.createNewMitra);

module.exports = router;
