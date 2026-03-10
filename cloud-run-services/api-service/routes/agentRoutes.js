import express from "express";
import {
    excelAgentStream, excelAgentJson, getSearchQueries,
    getSearchResults, scrapeAndVectorize, spectraGenerate,
    analyzeUrlStream, searchOverviewStream, generateImage, transcribeAudio,
    wordAgentStream, getGallery
} from "../controllers/agentController.js";
import { verifyToken } from "../middleware/authMiddleware.js";
import multer from "multer";

const router = express.Router();
const upload = multer();
const uploadAudio = multer({ limits: { fileSize: 25 * 1024 * 1024 } });

// Main streaming endpoint
router.post("/excel-agent", verifyToken, excelAgentStream);
// Secondary JSON endpoint
router.post("/excel-agent-json", verifyToken, excelAgentJson);

// Word Agent Stream
router.post("/word-agent", verifyToken, wordAgentStream);

router.post("/generate-search-queries", verifyToken, getSearchQueries);
router.get("/search-results", verifyToken, getSearchResults);
router.post("/scrape-and-vectorize", verifyToken, scrapeAndVectorize);
router.post("/spectra-generate", verifyToken, upload.fields([{ name: 'photo1', maxCount: 1 }, { name: 'photo2', maxCount: 1 }]), spectraGenerate);
router.post("/analyze-url-stream", verifyToken, analyzeUrlStream);
router.post("/search-overview-stream", verifyToken, searchOverviewStream);
router.post("/generate-image", verifyToken, generateImage);
router.get("/gallery/:email", verifyToken, getGallery);
router.post("/api/transcribe", uploadAudio.single("audio"), transcribeAudio);

export default router;

