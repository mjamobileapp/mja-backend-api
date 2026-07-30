const express = require("express");
const MesinController = require("../controller/mesin");
const { authenticate } = require("../middleware/auth");
const { authenticateBackofficeOrOwnerKasirCabang } = require("../middleware/authCombined");
const { catchAsync } = require("../utils/catchAsync");

const router = express.Router();

router.get("/list/cabang/:cabangId", authenticateBackofficeOrOwnerKasirCabang(), catchAsync(MesinController.getListMesinMobile));
router.get("/master", authenticate, catchAsync(MesinController.getAllMasterMesin));
router.get("/esp/:espId", authenticate, catchAsync(MesinController.getMesinByEspId));
router.put("/maintenance/:idMesinDetail", authenticate, catchAsync(MesinController.setMaintenance));
router.put("/ready/:idMesinDetail", authenticate, catchAsync(MesinController.setReady));
router.post("/", authenticate, catchAsync(MesinController.createNewMesin));
router.get("/", authenticate, catchAsync(MesinController.getAllMesin));
router.get("/:id", authenticate, catchAsync(MesinController.getMesinById));
router.get("/mitra/:idMitra", authenticate, catchAsync(MesinController.getMesinByIdMitra));
router.get("/cabang/:cabangId", authenticate, catchAsync(MesinController.getMesinByIdCabang));
router.put("/:id", authenticate, catchAsync(MesinController.updateMesin));
router.delete("/:id", authenticate, catchAsync(MesinController.deleteMesin));
router.post("/:id/restore", authenticate, catchAsync(MesinController.restoreMesin));

module.exports = router;
