const express = require("express");

const MenuController = require("../controller/menus");

const router = express.Router();

const { authenticate } = require("../middleware/auth");

// CREATE - POST
router.post("/", authenticate, MenuController.createNewMenu);
// Get By ID
router.get("/:id", authenticate, MenuController.getById);

// READ - GET
router.get("/", authenticate, MenuController.getAll);

// UPDATE - put
router.put("/:id", authenticate, MenuController.updateMenu);

// DELETE - DELETE
router.delete("/:id", authenticate, MenuController.deleteMenu);

module.exports = router;
