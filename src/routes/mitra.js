const express = require("express");
const MitraController = require("../controller/mitra");
const { authenticate } = require("../middleware/auth");
const { catchAsync } = require("../utils/catchAsync");

const router = express.Router();

router.post("/", authenticate, catchAsync(MitraController.createNewMitra));
router.get("/", authenticate, catchAsync(MitraController.getAllMitra));
router.get("/:id", authenticate, catchAsync(MitraController.getMitraById));
router.put("/:id", authenticate, catchAsync(MitraController.updateMitra));
router.delete("/:id", authenticate, catchAsync(MitraController.deleteMitra));
router.post("/:id/restore", authenticate, catchAsync(MitraController.restoreMitra));

module.exports = router;
