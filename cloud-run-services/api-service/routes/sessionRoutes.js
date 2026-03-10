import express from "express";
import { getSessions, getSessionById, softDeleteSession, getPublicSession, toggleShareSession } from "../controllers/sessionController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/public/:id", getPublicSession);
router.get("/:email", verifyToken, getSessions);
router.get("/:email/:id", verifyToken, getSessionById);
router.patch("/:email/:id/soft-delete", verifyToken, softDeleteSession);
router.post("/:email/:id/share", verifyToken, toggleShareSession);

export default router;
