const express = require("express");
const TransaksiController = require("../controller/transaksi");
const { authenticateBackofficeOrOwnerMachineControl } = require("../middleware/authCombined");
const { catchAsync } = require("../utils/catchAsync");

const router = express.Router();

router.post("/startmesin", authenticateBackofficeOrOwnerMachineControl(), catchAsync(TransaksiController.startMesin));
router.post("/startmesinbyowner", authenticateBackofficeOrOwnerMachineControl(), catchAsync(TransaksiController.startMesinByOwner));
router.post("/stopmesin", authenticateBackofficeOrOwnerMachineControl(), catchAsync(TransaksiController.stopMesin));

module.exports = router;
