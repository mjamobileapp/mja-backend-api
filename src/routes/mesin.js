const express = require("express");
const MesinController = require("../controller/mesin");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.get("/esp/:espId", authenticate, MesinController.getMesinByEspId);
router.post("/", authenticate, MesinController.createNewMesin);
router.get("/", authenticate, MesinController.getAllMesin);
router.get("/:id", authenticate, MesinController.getMesinById);
router.get("/mitra/:idMitra", authenticate, MesinController.getMesinByIdMitra);
router.get("/cabang/:cabangId", authenticate, MesinController.getMesinByIdCabang);
router.put("/:id", authenticate, MesinController.updateMesin);
router.delete("/:id", authenticate, MesinController.deleteMesin);
router.post("/:id/restore", authenticate, MesinController.restoreMesin);

module.exports = router;
