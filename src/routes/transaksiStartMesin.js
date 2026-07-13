const express = require("express");
const TransaksiController = require("../controller/transaksi");
const { authenticateBackofficeOrOwnerMachineControl } = require("../middleware/authCombined");

const router = express.Router();

router.post("/startmesin", authenticateBackofficeOrOwnerMachineControl(), TransaksiController.startMesin);
router.post("/stopmesin", authenticateBackofficeOrOwnerMachineControl(), TransaksiController.stopMesin);

module.exports = router;
