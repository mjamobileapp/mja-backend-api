const express = require("express");
const router = express.Router();
const aksesController = require("../controller/akses");
const { authenticate } = require("../middleware/auth");

router.get("/role/:idRole", authenticate, aksesController.getAksesRole);
router.post("/role/:idRole", authenticate, aksesController.saveAksesRole);
router.get("/user/:email", authenticate, aksesController.getAksesByUser);

module.exports = router;