import { useState } from 'react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
} from 'firebase/auth';
import { auth } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';


const GoogleSVG = () => (
    <svg width="18" height="18" viewBox="0 0 18 18">
        <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" />
        <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z" />
        <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 6.294C4.672 4.169 6.656 3.58 9 3.58Z" />
    </svg>
);

const Logo = () => (
    <div className="auth-logo">
        <svg width="36" height="36" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="10" fill="#141414" />
            <path d="M12 20L17 25L28 14" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Treevit</span>
    </div>
);

export default function LoginPage() {
    const { continueAsGuest } = useAuth();
    const [page, setPage] = useState('signin'); // signin | signup
    const [msg, setMsg] = useState({ text: '', type: 'error' });
    const [loading, setLoading] = useState(false);

    // Form fields
    const [email, setEmail] = useState('');
    const [password, setPass] = useState('');
    const [fName, setFName] = useState('');
    const [lName, setLName] = useState('');
    const [rEmail, setREmail] = useState('');
    const [rPass, setRPass] = useState('');

    const showMsg = (text, type = 'error') => {
        setMsg({ text, type });
        setTimeout(() => setMsg({ text: '', type: 'error' }), 5000);
    };

    const handleSignIn = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            const code = err.code;
            if (code === 'auth/invalid-credential') showMsg('Incorrect Email or Password');
            else if (code === 'auth/user-not-found') showMsg('Account does not Exist');
            else showMsg('Login failed. Please try again.');
        } finally { setLoading(false); }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createUserWithEmailAndPassword(auth, rEmail, rPass);
            showMsg('Account Created Successfully', 'success');
        } catch (err) {
            const code = err.code;
            if (code === 'auth/email-already-in-use') showMsg('Email Address Already Exists!');
            else if (code === 'auth/weak-password') showMsg('Password should be at least 6 characters');
            else showMsg('Unable to create User');
        } finally { setLoading(false); }
    };

    const handleGoogle = async () => {
        setLoading(true);
        try {
            await signInWithPopup(auth, new GoogleAuthProvider());
        } catch (err) {
            showMsg(err.code);
        } finally { setLoading(false); }
    };

    const MsgDiv = ({ id }) => msg.text ? (
        <div id={id} className="messageDiv show" style={{
            backgroundColor: msg.type === 'success' ? 'green' : 'red',
            color: '#fff',
            display: 'block',
        }}>{msg.text}</div>
    ) : <div id={id} className="messageDiv" />;

    return (
        <div className="auth-root">

            {/* ── Sign In ── */}
            <div className={`auth-page ${page === 'signin' ? 'active' : ''}`} id="signIn">
                <Logo />
                <h1 className="auth-title">Welcome back</h1>
                <p className="auth-sub">Sign in to your account</p>
                <MsgDiv id="signInMessage" />
                <form className="auth-form" onSubmit={handleSignIn}>
                    <div className="field">
                        <label htmlFor="email">Email address</label>
                        <input type="email" id="email" placeholder="you@example.com" required value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <div className="field">
                        <label htmlFor="password">Password</label>
                        <input type="password" id="password" placeholder="••••••••" required value={password} onChange={e => setPass(e.target.value)} />
                    </div>
                    <button className={`btn-primary${loading ? ' loading' : ''}`} type="submit">Continue</button>
                </form>
                <div className="divider"><span>or</span></div>
                <div className="social-btns">
                    <button className="btn-social" id="googleSignInBtn" onClick={handleGoogle} type="button">
                        <GoogleSVG /> Continue with Google
                    </button>
                    {/* <button className="btn-social" type="button" onClick={continueAsGuest}>
                        <i className='bx bx-user' /> Continue as Guest
                    </button> */}
                </div>
                <p className="auth-switch">
                    Don't have an account?&nbsp;
                    <button className="link-btn" onClick={() => { setMsg({ text: '', type: 'error' }); setPage('signup'); }}>Sign up</button>
                </p>
            </div>

            {/* ── Sign Up ── */}
            <div className={`auth-page ${page === 'signup' ? 'active' : ''}`} id="signup">
                <Logo />
                <h1 className="auth-title">Create account</h1>
                <p className="auth-sub">Get started for free</p>
                <MsgDiv id="signUpMessage" />
                <form className="auth-form" onSubmit={handleSignUp}>
                    <div className="field-row">
                        <div className="field">
                            <label htmlFor="fName">First name</label>
                            <input type="text" id="fName" placeholder="Jane" required value={fName} onChange={e => setFName(e.target.value)} />
                        </div>
                        <div className="field">
                            <label htmlFor="lName">Last name</label>
                            <input type="text" id="lName" placeholder="Doe" required value={lName} onChange={e => setLName(e.target.value)} />
                        </div>
                    </div>
                    <div className="field">
                        <label htmlFor="rEmail">Email address</label>
                        <input type="email" id="rEmail" placeholder="you@example.com" required value={rEmail} onChange={e => setREmail(e.target.value)} />
                    </div>
                    <div className="field">
                        <label htmlFor="rPassword">Password</label>
                        <input type="password" id="rPassword" placeholder="Min. 8 characters" required value={rPass} onChange={e => setRPass(e.target.value)} />
                    </div>
                    <button className={`btn-primary${loading ? ' loading' : ''}`} type="submit">Create account</button>
                </form>
                <p className="auth-switch">
                    Already have an account?&nbsp;
                    <button className="link-btn" onClick={() => { setMsg({ text: '', type: 'error' }); setPage('signin'); }}>Sign in</button>
                </p>
            </div>
        </div>
    );
}
