import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useCredits } from '../../contexts/CreditsContext';


const BACKEND = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:3000');

const REASON_COPY = {
    image: {
        icon: 'bx-image-alt',
        title: "You've Used All 5 Free Images",
        subtitle: "Upgrade to Pro for unlimited AI image generation — no caps, ever.",
    },
    excel: {
        icon: 'bx-spreadsheet',
        title: "Multi-File Upload is Pro Only",
        subtitle: "Upload multiple spreadsheets at once with Excel Agent Pro.",
    },
    model: {
        icon: 'bx-brain',
        title: "This Model Requires Pro",
        subtitle: "Unlock GPT-4o, Claude 3.5 & Gemini Advanced with a Pro plan.",
    },
    default: {
        icon: 'bx-rocket',
        title: "Upgrade to Treevit Pro",
        subtitle: "Unlimited models, images, and agent access in one plan.",
    },
};

const PRO_FEATURES = [
    'All AI models — GPT-4o, Claude, Gemini Pro',
    'Unlimited image generation',
    'Excel Agent — multiple files',
    'Unlimited chat history',
    'Priority response speed',
];

const FREE_FEATURES = [
    'Gemini & Qwen models',
    '5 images / month',
    'Excel Agent (1 file)',
    'Last 10 sessions',
];

export default function UpgradeModal() {
    const { user, token } = useAuth();
    const { upgradeModal, closeUpgradeModal, refetchCredits } = useCredits();
    const [billing, setBilling] = useState('monthly');
    const [loadingStripe, setLoadingStripe] = useState(false);
    const [loadingRazorpay, setLoadingRazorpay] = useState(false);
    const [error, setError] = useState('');

    if (!upgradeModal.open) return null;

    const copy = REASON_COPY[upgradeModal.reason] || REASON_COPY.default;
    const price = billing === 'annual' ? '₹374' : '₹499';
    const priceNote = billing === 'annual' ? '₹4,499/year — save 25%' : 'per month';
    const usdPrice = billing === 'annual' ? '≈ $5.4/mo' : '≈ $6/mo';

    // ── Razorpay (UPI / India) ───────────────────────────────────────
    const handleRazorpay = async () => {
        setLoadingRazorpay(true);
        setError('');
        try {
            const res = await fetch(`${BACKEND}/credits/razorpay/order`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ email: user.email, plan: billing }),
            });
            const orderData = await res.json();
            if (!orderData.orderId) {
                setError(orderData.error || 'Could not create payment order.');
                setLoadingRazorpay(false);
                return;
            }

            const options = {
                key: orderData.key,
                amount: orderData.amount,
                currency: orderData.currency,
                name: 'Treevit Pro',
                description: `Pro Plan — ${billing}`,
                order_id: orderData.orderId,
                handler: async (response) => {
                    const verifyRes = await fetch(`${BACKEND}/credits/razorpay/verify`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({
                            email: user.email, plan: billing,
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        }),
                    });
                    const vd = await verifyRes.json();
                    if (vd.ok) {
                        await refetchCredits();
                        closeUpgradeModal();
                    } else {
                        setError('Payment verification failed. Contact support.');
                    }
                },
                prefill: { email: user.email },
                theme: { color: '#673ab7' },
            };
            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (e) {
            setError('Network error. Please try again.');
        }
        setLoadingRazorpay(false);
    };

    // ── Stripe (International cards) ─────────────────────────────────
    const handleStripe = async () => {
        setLoadingStripe(true);
        setError('');
        try {
            const res = await fetch(`${BACKEND}/credits/stripe/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ email: user.email, plan: billing }),
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                setError(data.error || 'Failed to start checkout.');
            }
        } catch (e) {
            setError('Network error. Please try again.');
        }
        setLoadingStripe(false);
    };

    return (
        <div
            className="upgrade-overlay"
            onClick={(e) => { if (e.target === e.currentTarget) closeUpgradeModal(); }}
        >
            <div className="upgrade-modal">
                {/* Close */}
                <button className="upgrade-close" onClick={closeUpgradeModal}>
                    <i className="bx bx-x" />
                </button>

                {/* Header — icon left, text right (compact row) */}
                <div className="upgrade-header">
                    <div className="upgrade-icon-ring">
                        <i className={`bx ${copy.icon}`} />
                    </div>
                    <div className="upgrade-header-text">
                        <h2 className="upgrade-title">{copy.title}</h2>
                        <p className="upgrade-subtitle">{copy.subtitle}</p>
                    </div>
                </div>

                {/* Billing toggle */}
                <div className="billing-toggle">
                    <button
                        className={`billing-btn ${billing === 'monthly' ? 'active' : ''}`}
                        onClick={() => setBilling('monthly')}
                    >
                        Monthly
                    </button>
                    <button
                        className={`billing-btn ${billing === 'annual' ? 'active' : ''}`}
                        onClick={() => setBilling('annual')}
                    >
                        Annual <span className="save-badge">SAVE 25%</span>
                    </button>
                </div>

                {/* Price */}
                <div className="upgrade-price-row">
                    <span className="upgrade-price">{price}</span>
                    <div className="upgrade-price-meta">
                        <span>{priceNote}</span>
                        <span className="usd-note">{usdPrice}</span>
                    </div>
                </div>

                {/* Feature comparison */}
                <div className="upgrade-features">
                    <div className="features-col">
                        <p className="features-col-label">✨ Pro</p>
                        {PRO_FEATURES.map((f, i) => (
                            <div key={i} className="feature-row pro">
                                <i className="bx bxs-check-circle" />
                                <span>{f}</span>
                            </div>
                        ))}
                    </div>
                    <div className="features-divider" />
                    <div className="features-col">
                        <p className="features-col-label">🆓 Free</p>
                        {FREE_FEATURES.map((f, i) => (
                            <div key={i} className="feature-row free">
                                <i className="bx bx-check-circle" />
                                <span>{f}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Error */}
                {error && (
                    <p className="upgrade-error">
                        <i className="bx bx-error-circle" /> {error}
                    </p>
                )}

                {/* Payment buttons */}
                <div className="upgrade-actions">
                    <button
                        className="pay-btn razorpay-btn"
                        onClick={handleRazorpay}
                        disabled={loadingRazorpay || loadingStripe}
                    >
                        {loadingRazorpay
                            ? <><i className="bx bx-loader-alt bx-spin" /> Processing…</>
                            : <><i className="bx bx-qr-scan" /> Pay with UPI / Cards — India</>
                        }
                    </button>
                    <button
                        className="pay-btn stripe-btn"
                        onClick={handleStripe}
                        disabled={loadingStripe || loadingRazorpay}
                    >
                        {loadingStripe
                            ? <><i className="bx bx-loader-alt bx-spin" /> Redirecting…</>
                            : <><i className="bx bx-credit-card" /> Pay with Card — International</>
                        }
                    </button>
                </div>

                <p className="upgrade-footer">
                    🔒 Secure payment · Cancel anytime · Instant activation
                </p>
            </div>
        </div>
    );
}
