import express from "express";
import { streamChat, shareChat, getSharedChat, chatCompletion } from "../controllers/chatController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import multer from "multer";

const router = express.Router();
const upload = multer();

router.post("/stream", verifyToken, upload.single("image"), streamChat);
router.post("/share", verifyToken, shareChat);
router.get("/shared/:id", getSharedChat);
router.post("/chat-completion", verifyToken, chatCompletion);

export default router;
