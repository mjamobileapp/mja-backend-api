const express = require("express");

const UserController = require("../controller/users.js");

const router = express.Router();

const { authenticate } = require("../middleware/auth");
// CREATE - POST
router.post("/", authenticate, UserController.createNewUser);
// Get By ID
router.get("/:id", authenticate, UserController.getUserById);

// READ - GET
router.get("/", authenticate, UserController.getAllUsers);

// UPDATE - PUT
router.put("/:id", authenticate, UserController.updateUser);

// DELETE - DELETE
router.delete("/:id", authenticate, UserController.deleteUser);

// RESTORE - POST
router.post("/:id/restore", authenticate, UserController.restoreUser);

// CHANGE PASSWORD - POST
router.post("/:id/changepassword", authenticate, UserController.changePassword);

module.exports = router;
