const express = require("express");
const MitraController = require("../controller/mitra");

const router = express.Router();

router.post("/", MitraController.createNewMitra);

module.exports = router;
