import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isGuest, setIsGuest] = useState(false);
    const [googleAccessToken, setGoogleAccessToken] = useState(() => localStorage.getItem('google_access_token') || null);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const idToken = await firebaseUser.getIdToken();
                setUser(firebaseUser);
                setToken(idToken);
                setIsGuest(false);
                localStorage.setItem('fb_token', idToken);
                setGoogleAccessToken(localStorage.getItem('google_access_token') || null);
            } else {
                const guestMode = localStorage.getItem('guest_mode') === 'true';
                if (guestMode) {
                    setIsGuest(true);
                    setUser({ displayName: 'Guest', email: 'guest@treevit.local', photoURL: null });
                } else {
                    setUser(null);
                    setToken(null);
                }
            }
            setLoading(false);
        });
        return unsub;
    }, []);

    const logout = async () => {
        await signOut(auth);
        localStorage.removeItem('fb_token');
        localStorage.removeItem('guest_mode');
        localStorage.removeItem('google_access_token');
        setUser(null);
        setToken(null);
        setGoogleAccessToken(null);
        setIsGuest(false);
    };

    const continueAsGuest = () => {
        localStorage.setItem('guest_mode', 'true');
        setIsGuest(true);
        setUser({ displayName: 'Guest', email: 'guest@treevit.local', photoURL: null });
        setLoading(false);
    };

    const getFreshToken = async () => {
        if (auth.currentUser) {
            const newToken = await auth.currentUser.getIdToken(true);
            setToken(newToken);
            localStorage.setItem('fb_token', newToken);
            return newToken;
        }
        return token;
    };

    useEffect(() => {
        const interval = setInterval(async () => {
            if (auth.currentUser) {
                const newToken = await auth.currentUser.getIdToken(true);
                setToken(newToken);
                localStorage.setItem('fb_token', newToken);
            }
            setGoogleAccessToken(localStorage.getItem('google_access_token') || null);
        }, 55 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const syncGoogleToken = () => {
            setGoogleAccessToken(localStorage.getItem('google_access_token') || null);
        };
        window.addEventListener('storage', syncGoogleToken);
        return () => window.removeEventListener('storage', syncGoogleToken);
    }, []);

    const value = useMemo(() => ({
        user,
        token,
        loading,
        isGuest,
        logout,
        continueAsGuest,
        getFreshToken,
        googleAccessToken,
        googleConnected: Boolean(googleAccessToken),
    }), [user, token, loading, isGuest, googleAccessToken]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
