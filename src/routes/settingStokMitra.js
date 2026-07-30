const express = require("express");
const router = express.Router();
const SettingStokController = require("../controller/settingStokMitra");
const { authenticateMobile } = require("../middleware/authMobile");
const { catchAsync } = require("../utils/catchAsync");

router.use(authenticateMobile);
router.get("/", catchAsync(SettingStokController.getAllSettings));
router.get("/mitra/:idMitra", catchAsync(SettingStokController.getSettingByIdMitra));
router.post("/", catchAsync(SettingStokController.createNewSetting));
router.put("/:id", catchAsync(SettingStokController.updateSetting));

module.exports = router;
