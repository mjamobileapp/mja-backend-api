const express = require("express");
const MitraController = require("../controller/mitra");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.post("/", authenticate, MitraController.createNewMitra);
router.get("/", authenticate, MitraController.getAllMitra);
router.get("/:id", authenticate, MitraController.getMitraById);
router.put("/:id", authenticate, MitraController.updateMitra);
router.delete("/:id", authenticate, MitraController.deleteMitra);
router.post("/:id/restore", authenticate, MitraController.restoreMitra);

module.exports = router;
