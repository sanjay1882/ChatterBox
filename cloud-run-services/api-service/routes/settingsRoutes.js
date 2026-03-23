import express from "express";
import { updateTheme, updateVoice, updateModel } from "../controllers/settingsController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/theme", verifyToken, updateTheme);
router.post("/voice", verifyToken, updateVoice);
router.post("/model", verifyToken, updateModel);

export default router;
