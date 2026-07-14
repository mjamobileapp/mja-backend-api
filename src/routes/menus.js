const express = require("express");

const MenuController = require("../controller/menus");

const router = express.Router();

const { authenticate } = require("../middleware/auth");
const { catchAsync } = require("../utils/catchAsync");

// CREATE - POST
router.post("/", authenticate, catchAsync(MenuController.createNewMenu));
// Get By ID
router.get("/:id", authenticate, catchAsync(MenuController.getById));

// READ - GET
router.get("/", authenticate, catchAsync(MenuController.getAll));

// UPDATE - put
router.put("/:id", authenticate, catchAsync(MenuController.updateMenu));

// DELETE - DELETE
router.delete("/:id", authenticate, catchAsync(MenuController.deleteMenu));

module.exports = router;
