import mongoose from "mongoose";

const UserCreditSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    plan: {
        type: String,
        enum: ['free', 'pro'],
        default: 'free'
    },
    imageCreditsUsed: {
        type: Number,
        default: 0
    },
    imageCreditLimit: {
        type: Number,
        default: 5 // Free plan: 5 per month
    },
    excelFileLimit: {
        type: Number,
        default: 1 // Free plan: 1 file at a time
    },
    stripeCustomerId: {
        type: String,
        default: null
    },
    stripeSubscriptionId: {
        type: String,
        default: null
    },
    razorpaySubscriptionId: {
        type: String,
        default: null
    },
    periodEnd: {
        type: Date,
        default: null // null = no active subscription (free)
    },
    // Track when image credits were last reset (monthly)
    creditResetDate: {
        type: Date,
        default: () => {
            const d = new Date();
            d.setDate(1); // First of current month
            d.setHours(0, 0, 0, 0);
            return d;
        }
    }
}, {
    timestamps: true
});

// Helper method: returns true if user can still generate images
UserCreditSchema.methods.canGenerateImage = function () {
    if (this.plan === 'pro') return true;
    return this.imageCreditsUsed < this.imageCreditLimit;
};

// Helper method: returns remaining image credits
UserCreditSchema.methods.imageCreditsLeft = function () {
    if (this.plan === 'pro') return Infinity;
    return Math.max(0, this.imageCreditLimit - this.imageCreditsUsed);
};

const UserCredit = mongoose.model("UserCredit", UserCreditSchema);

export default UserCredit;
