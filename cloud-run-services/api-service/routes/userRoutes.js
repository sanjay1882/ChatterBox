import express from "express";
import { getUserPreferences, updateUserPreferences, getUserGallery } from "../controllers/userController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/preferences/:email", verifyToken, getUserPreferences);
router.post("/preferences", verifyToken, updateUserPreferences);
router.get("/gallery/:email", verifyToken, getUserGallery);

export default router;
