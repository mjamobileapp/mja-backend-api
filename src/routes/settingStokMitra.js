const express = require("express");
const router = express.Router();
const SettingStokController = require("../controller/settingStokMitra");
const { authenticateMobile } = require("../middleware/authMobile");

router.use(authenticateMobile);
router.get("/", SettingStokController.getAllSettings);
router.get("/mitra/:idMitra", SettingStokController.getSettingByIdMitra);
router.post("/", SettingStokController.createNewSetting);
router.put("/:id", SettingStokController.updateSetting);

module.exports = router;