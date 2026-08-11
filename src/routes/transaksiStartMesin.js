const express = require("express");
const TransaksiController = require("../controller/transaksi");
const {
  authenticateBackofficeMachineControl,
  authenticateBackofficeOrOwnerMachineControl,
} = require("../middleware/authCombined");
const { catchAsync } = require("../utils/catchAsync");

const router = express.Router();

router.post("/startmesin", authenticateBackofficeOrOwnerMachineControl(), catchAsync(TransaksiController.startMesin));
router.post("/startmesinbybackoffice", authenticateBackofficeMachineControl(), catchAsync(TransaksiController.startMesinByBackoffice));
router.post("/startmesinbyowner", authenticateBackofficeOrOwnerMachineControl(), catchAsync(TransaksiController.startMesinByOwner));
router.post("/stopmesin", authenticateBackofficeOrOwnerMachineControl(), catchAsync(TransaksiController.stopMesin));
router.post("/stopmesinbybackoffice", authenticateBackofficeMachineControl(), catchAsync(TransaksiController.stopMesinByBackoffice));
router.post("/stopmesinbyowner", authenticateBackofficeOrOwnerMachineControl(), catchAsync(TransaksiController.stopMesinByOwner));

module.exports = router;
