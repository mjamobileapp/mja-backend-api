const express = require("express");
const MitraController = require("../controller/mitra");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.post("/", authenticate, MitraController.createNewMitra);
router.put("/:id", authenticate, MitraController.updateMitra);
router.delete("/:id", authenticate, MitraController.deleteMitra);

module.exports = router;
