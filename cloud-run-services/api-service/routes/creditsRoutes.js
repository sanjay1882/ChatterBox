import express from "express";
import {
    getCredits,
    consumeImageCredit,
    createRazorpayOrder,
    verifyRazorpayPayment,
    createStripeCheckout,
    stripeWebhook
} from "../controllers/creditsController.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public: Stripe webhook (must have raw body)
router.post("/stripe/webhook", express.raw({ type: 'application/json' }), stripeWebhook);

// Authenticated routes
router.get("/:email", verifyToken, getCredits);
router.post("/image/consume", verifyToken, consumeImageCredit);
router.post("/razorpay/order", verifyToken, createRazorpayOrder);
router.post("/razorpay/verify", verifyToken, verifyRazorpayPayment);
router.post("/stripe/checkout", verifyToken, createStripeCheckout);

export default router;
