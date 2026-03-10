import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isGuest, setIsGuest] = useState(false);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                const idToken = await firebaseUser.getIdToken();
                setUser(firebaseUser);
                setToken(idToken);
                setIsGuest(false);
                localStorage.setItem('fb_token', idToken);
            } else {
                // Check if continuing as guest
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
        setUser(null);
        setToken(null);
        setIsGuest(false);
    };

    const continueAsGuest = () => {
        localStorage.setItem('guest_mode', 'true');
        setIsGuest(true);
        setUser({ displayName: 'Guest', email: 'guest@treevit.local', photoURL: null });
        setLoading(false);
    };

    // Refresh token periodically
    useEffect(() => {
        const interval = setInterval(async () => {
            if (auth.currentUser) {
                const newToken = await auth.currentUser.getIdToken(true);
                setToken(newToken);
                localStorage.setItem('fb_token', newToken);
            }
        }, 55 * 60 * 1000); // every 55 min
        return () => clearInterval(interval);
    }, []);

    return (
        <AuthContext.Provider value={{ user, token, loading, isGuest, logout, continueAsGuest }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
