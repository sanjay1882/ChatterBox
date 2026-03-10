import UserCredit from "../models/UserCredit.js";
import crypto from "crypto";

// ── Helpers ─────────────────────────────────────────────────────────
const ensureCredit = async (email) => {
    let credit = await UserCredit.findOne({ email });
    if (!credit) {
        credit = await UserCredit.create({ email });
    }
    // Reset image credits monthly
    const now = new Date();
    const resetDate = new Date(credit.creditResetDate);
    if (now.getFullYear() > resetDate.getFullYear() ||
        now.getMonth() > resetDate.getMonth()) {
        credit.imageCreditsUsed = 0;
        credit.creditResetDate = new Date(now.getFullYear(), now.getMonth(), 1);
        await credit.save();
    }
    return credit;
};

// ── GET /credits/:email ──────────────────────────────────────────────
export const getCredits = async (req, res) => {
    try {
        // Bypass credits as requested, making it completely free with unlimited access.
        return res.json({
            plan: 'pro',
            imageCreditsUsed: 0,
            imageCreditLimit: null,
            imageCreditsLeft: null,
            excelFileLimit: 9999,
            periodEnd: null,
        });
    } catch (e) {
        console.error('getCredits error:', e);
        res.status(500).json({ error: 'Internal error' });
    }
};

// ── POST /credits/image/consume ──────────────────────────────────────
export const consumeImageCredit = async (req, res) => {
    try {
        // Bypass credits as requested, making it completely free with unlimited access.
        return res.json({ ok: true, creditsLeft: null });
    } catch (e) {
        console.error('consumeImageCredit error:', e);
        res.status(500).json({ error: 'Internal error' });
    }
};

// ── POST /credits/razorpay/order ─────────────────────────────────────
export const createRazorpayOrder = async (req, res) => {
    try {
        const { email, plan } = req.body;

        const Razorpay = (await import('razorpay')).default;
        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        // Amount in paise (₹499 = 49900 paise for monthly, ₹4499 = 449900 for annual)
        const amounts = { monthly: 49900, annual: 449900 };
        const amount = amounts[plan] || amounts.monthly;

        const order = await razorpay.orders.create({
            amount,
            currency: 'INR',
            receipt: `treevit_${email}_${Date.now()}`,
            notes: { email, plan }
        });

        return res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID
        });
    } catch (e) {
        console.error('createRazorpayOrder error:', e.message);
        res.status(500).json({ error: 'Could not create payment order: ' + e.message });
    }
};

// ── POST /credits/razorpay/verify ────────────────────────────────────
export const verifyRazorpayPayment = async (req, res) => {
    try {
        const { email, plan, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        // Verify HMAC signature
        const body = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ error: 'Invalid payment signature' });
        }

        // Activate Pro plan
        const credit = await ensureCredit(email);
        credit.plan = 'pro';
        credit.imageCreditLimit = 999999;
        credit.excelFileLimit = 999;
        credit.razorpaySubscriptionId = razorpay_payment_id;

        // Set period end based on plan
        const periodEnd = new Date();
        if (plan === 'annual') {
            periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        } else {
            periodEnd.setMonth(periodEnd.getMonth() + 1);
        }
        credit.periodEnd = periodEnd;
        await credit.save();

        return res.json({ ok: true, plan: 'pro', periodEnd });
    } catch (e) {
        console.error('verifyRazorpayPayment error:', e);
        res.status(500).json({ error: 'Verification failed' });
    }
};

// ── POST /credits/stripe/checkout ────────────────────────────────────
export const createStripeCheckout = async (req, res) => {
    try {
        const { email, plan } = req.body;
        const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);

        // Price IDs must be created in your Stripe Dashboard
        const priceIds = {
            monthly: process.env.STRIPE_PRICE_MONTHLY,
            annual: process.env.STRIPE_PRICE_ANNUAL,
        };

        const priceId = priceIds[plan] || priceIds.monthly;
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8081';

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            customer_email: email,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${frontendUrl}/?upgrade=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${frontendUrl}/?upgrade=cancelled`,
            metadata: { email, plan }
        });

        return res.json({ url: session.url });
    } catch (e) {
        console.error('createStripeCheckout error:', e.message);
        res.status(500).json({ error: 'Could not create checkout session: ' + e.message });
    }
};

// ── POST /credits/stripe/webhook ─────────────────────────────────────
export const stripeWebhook = async (req, res) => {
    try {
        const stripe = (await import('stripe')).default(process.env.STRIPE_SECRET_KEY);
        const sig = req.headers['stripe-signature'];
        let event;

        try {
            event = stripe.webhooks.constructEvent(
                req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET
            );
        } catch (err) {
            return res.status(400).send(`Webhook signature error: ${err.message}`);
        }

        if (event.type === 'customer.subscription.created' ||
            event.type === 'customer.subscription.updated') {
            const subscription = event.data.object;
            const email = subscription.metadata?.email;
            if (!email) return res.json({ received: true });

            const credit = await ensureCredit(email);
            if (subscription.status === 'active') {
                credit.plan = 'pro';
                credit.imageCreditLimit = 999999;
                credit.excelFileLimit = 999;
                credit.stripeCustomerId = subscription.customer;
                credit.stripeSubscriptionId = subscription.id;
                credit.periodEnd = new Date(subscription.current_period_end * 1000);
            }
            await credit.save();
        }

        if (event.type === 'customer.subscription.deleted') {
            const subscription = event.data.object;
            const email = subscription.metadata?.email;
            if (email) {
                const credit = await ensureCredit(email);
                credit.plan = 'free';
                credit.imageCreditLimit = 5;
                credit.excelFileLimit = 1;
                credit.periodEnd = null;
                await credit.save();
            }
        }

        return res.json({ received: true });
    } catch (e) {
        console.error('stripeWebhook error:', e);
        res.status(500).json({ error: 'Internal error' });
    }
};
