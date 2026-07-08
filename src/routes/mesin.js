const express = require("express");
const MesinController = require("../controller/mesin");
const { authenticate } = require("../middleware/auth");

const router = express.Router();

router.get("/list/cabang/:cabangId", authenticate, MesinController.getListMesinMobile);
router.get("/master", authenticate, MesinController.getAllMasterMesin);
router.get("/esp/:espId", authenticate, MesinController.getMesinByEspId);
router.put("/maintenance/:idMesinDetail", authenticate, MesinController.setMaintenance);
router.put("/ready/:idMesinDetail", authenticate, MesinController.setReady);
router.post("/", authenticate, MesinController.createNewMesin);
router.get("/", authenticate, MesinController.getAllMesin);
router.get("/:id", authenticate, MesinController.getMesinById);
router.get("/mitra/:idMitra", authenticate, MesinController.getMesinByIdMitra);
router.get("/cabang/:cabangId", authenticate, MesinController.getMesinByIdCabang);
router.put("/:id", authenticate, MesinController.updateMesin);
router.delete("/:id", authenticate, MesinController.deleteMesin);
router.post("/:id/restore", authenticate, MesinController.restoreMesin);

module.exports = router;
