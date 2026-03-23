import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';

const CreditsContext = createContext(null);

const BACKEND = import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? '/api' : 'http://127.0.0.1:3000');

export function CreditsProvider({ children }) {
    const { user, token, loading: authLoading } = useAuth();

    const [credits, setCredits] = useState({
        plan: 'free',
        imageCreditsLeft: 5,
        imageCreditLimit: 5,
        imageCreditsUsed: 0,
        excelFileLimit: 1,
        periodEnd: null,
    });
    const [loading, setLoading] = useState(true);
    const [upgradeModal, setUpgradeModal] = useState({ open: false, reason: '' });

    const fetchCredits = useCallback(async () => {
        if (!user?.email || !token) return;
        try {
            const url = `${BACKEND}/credits/${encodeURIComponent(user.email)}`;
            console.log("[CreditsContext] fetching from:", url);
            const res = await fetch(url, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) {
              console.error("[CreditsContext] HTTP Error:", res.status, res.statusText);
              return;
            }
            const data = await res.json();
            setCredits(data);
        } catch (e) {
            console.error('[CreditsContext] Critical Fail:', e.message, e);
        } finally {
            setLoading(false);
        }
    }, [user, token]);

    useEffect(() => {
        if (!authLoading && user) {
            fetchCredits();
        } else if (!authLoading) {
            setLoading(false);
        }
    }, [authLoading, user, fetchCredits]);

    // Check if user can generate an image; if not, open upgrade modal
    const checkImageGeneration = useCallback(() => {
        if (credits.plan === 'pro') return true;
        if (credits.imageCreditsLeft !== null && credits.imageCreditsLeft <= 0) {
            setUpgradeModal({ open: true, reason: 'image' });
            return false;
        }
        return true;
    }, [credits]);

    // Check if user can upload more files to Excel Agent; if not, show modal
    const checkExcelFileUpload = useCallback((currentFileCount) => {
        if (credits.plan === 'pro') return true;
        if (currentFileCount >= credits.excelFileLimit) {
            setUpgradeModal({ open: true, reason: 'excel' });
            return false;
        }
        return true;
    }, [credits]);

    // Check if user can use a premium model
    const checkPremiumModel = useCallback((modelValue) => {
        const FREE_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'qwen'];
        const isFree = FREE_MODELS.some(m => modelValue.toLowerCase().includes(m.toLowerCase()));
        if (!isFree && credits.plan !== 'pro') {
            setUpgradeModal({ open: true, reason: 'model' });
            return false;
        }
        return true;
    }, [credits]);

    // Consume one image credit after successful generation
    const consumeImageCredit = useCallback(async () => {
        if (credits.plan === 'pro' || !user?.email) return;
        try {
            await fetch(`${BACKEND}/credits/image/consume`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ email: user.email })
            });
            // Optimistically decrement locally
            setCredits(prev => ({
                ...prev,
                imageCreditsLeft: Math.max(0, (prev.imageCreditsLeft ?? 1) - 1),
                imageCreditsUsed: (prev.imageCreditsUsed ?? 0) + 1,
            }));
        } catch (e) {
            console.warn('Could not consume image credit:', e.message);
        }
    }, [credits.plan, user, token]);

    const isPro = credits.plan === 'pro';
    const openUpgradeModal = (reason = '') => setUpgradeModal({ open: true, reason });
    const closeUpgradeModal = () => setUpgradeModal({ open: false, reason: '' });

    return (
        <CreditsContext.Provider value={{
            credits,
            loading,
            isPro,
            upgradeModal,
            openUpgradeModal,
            closeUpgradeModal,
            checkImageGeneration,
            checkExcelFileUpload,
            checkPremiumModel,
            consumeImageCredit,
            refetchCredits: fetchCredits,
        }}>
            {children}
        </CreditsContext.Provider>
    );
}

export function useCredits() {
    const ctx = useContext(CreditsContext);
    if (!ctx) throw new Error('useCredits must be used inside <CreditsProvider>');
    return ctx;
}
