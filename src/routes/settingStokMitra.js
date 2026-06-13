const express = require("express");
const router = express.Router();
const SettingStokController = require("../controller/settingStokMitra");
const { authenticate } = require("../middleware/auth");

router.use(authenticate);
router.get("/", SettingStokController.getAllSettings);
router.get("/mitra/:idMitra", SettingStokController.getSettingByIdMitra);
router.post("/", SettingStokController.createNewSetting);
router.put("/:id", SettingStokController.updateSetting);

module.exports = router;