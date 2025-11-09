 

 import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signInWithPopup, 
    GoogleAuthProvider,
    onAuthStateChanged, 
    signOut,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    PhoneAuthProvider,
    signInWithCredential
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { 
    getFirestore, 
    setDoc, 
    doc 
} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";


// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let confirmationResult = null;
let recaptchaVerifier = null;

// Initialize reCAPTCHA
function initializeRecaptcha() {
    recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        'size': 'invisible',
        'callback': (response) => {
            // reCAPTCHA solved, allow signInWithPhoneNumber.
            console.log('reCAPTCHA solved');
        }
    });
}

// Message display functions
function showMessage(message, divId) {
    const messageDiv = document.getElementById(divId);
    messageDiv.style.display = "block";
    messageDiv.style.backgroundColor = "red";
    messageDiv.innerHTML = message;
    messageDiv.style.opacity = 1;
    setTimeout(function() {
        messageDiv.style.opacity = 0;
    }, 5000);
}

function CreatedMessage(message, divId) {
    const messageDiv = document.getElementById(divId);
    messageDiv.style.display = "block";
    messageDiv.style.backgroundColor = "green";
    messageDiv.innerHTML = message;
    messageDiv.style.opacity = 1;
    setTimeout(function() {
        messageDiv.style.opacity = 0;
    }, 5000);
}

// Google Sign In
document.getElementById('googleSignInBtn')?.addEventListener('click', () => {
    signInWithPopup(auth, provider)
        .then((result) => {
            const user = result.user;
            CreatedMessage('Login successful!', 'signInMessage');
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 2000);
        })
        .catch((error) => {
            const errorCode = error.code;
            showMessage(errorCode, 'signInMessage');
        });
});

// Sign Up with Email
document.getElementById('submitSignUp')?.addEventListener('click', (event) => {
    event.preventDefault();
    const email = document.getElementById('rEmail').value;
    const password = document.getElementById('rPassword').value;
    const firstName = document.getElementById('fName').value;
    const lastName = document.getElementById('lName').value;

    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            const userData = {
                email: email,
                firstName: firstName,
                lastName: lastName,
                createdAt: new Date().toISOString()
            };
            
            CreatedMessage('Account Created Successfully', 'signUpMessage');
            
            const docRef = doc(db, "users", user.uid);
            setDoc(docRef, userData)
                .then(() => {
                    setTimeout(() => {
                        window.location.href = '../index.html';
                    }, 2000);
                })
                .catch((error) => {
                    console.error("Error writing document", error);
                });
        })
        .catch((error) => {
            const errorCode = error.code;
            if (errorCode == 'auth/email-already-in-use') {
                showMessage('Email Address Already Exists!', 'signUpMessage');
            } else if (errorCode == 'auth/weak-password') {
                showMessage('Password should be at least 6 characters', 'signUpMessage');
            } else {
                showMessage('Unable to create User', 'signUpMessage');
            }
        });
});

// Sign In with Email
document.getElementById('submitSignIn')?.addEventListener('click', (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            CreatedMessage('Login successful', 'signInMessage');
            const user = userCredential.user;
            localStorage.setItem('loggedInUserId', user.uid);
            
            setTimeout(() => {
                window.location.href = '../index.html';
            }, 2000);
        })
        .catch((error) => {
            const errorCode = error.code;
            if (errorCode === 'auth/invalid-credential') {
                showMessage('Incorrect Email or Password', 'signInMessage');
            } else if (errorCode === 'auth/user-not-found') {
                showMessage('Account does not Exist', 'signInMessage');
            } else {
                showMessage('Login failed. Please try again.', 'signInMessage');
            }
        });
});

// Phone Number Authentication
document.getElementById('submitNumber')?.addEventListener('click', async (event) => {
    event.preventDefault();
    const phoneNumber = document.getElementById('phone-number').value;
    
    if (!phoneNumber) {
        showMessage('Please enter a phone number', 'phoneMessage');
        return;
    }

    // Format phone number (add country code if missing)
    let formattedNumber = phoneNumber;
    if (!phoneNumber.startsWith('+')) {
        formattedNumber = '+91' + phoneNumber; // Default to India, you can change this
    }

    try {
        // Initialize reCAPTCHA if not already done
        if (!recaptchaVerifier) {
            initializeRecaptcha();
        }

        // Send verification code
        confirmationResult = await signInWithPhoneNumber(auth, formattedNumber, recaptchaVerifier);
        
        // Show OTP verification form
        showOTPVerificationForm(formattedNumber);
        
    } catch (error) {
        console.error('Error sending verification code:', error);
        if (error.code === 'auth/invalid-phone-number') {
            showMessage('Invalid phone number format', 'phoneMessage');
        } else if (error.code === 'auth/too-many-requests') {
            showMessage('Too many attempts. Please try again later.', 'phoneMessage');
        } else {
            showMessage('Error sending verification code: ' + error.message, 'phoneMessage');
        }
        
        // Reset reCAPTCHA on error
        if (recaptchaVerifier) {
            recaptchaVerifier.clear();
            recaptchaVerifier = null;
        }
    }
});

// Show OTP verification form
function showOTPVerificationForm(phoneNumber) {
    const phoneForm = document.getElementById('number-verify');
    phoneForm.innerHTML = `
        <h1 class="form-title">Verify OTP</h1>
        <form method="post" action="">
            <div id="otpMessage" class="messageDiv" style="display:none;"></div>
            <div class="input-group">
                <i class="fas fa-sms"></i>
                <input type="text" id="otp-code" placeholder="Enter 6-digit OTP" required maxlength="6">
                <label for="otp-code">OTP Code</label>
            </div>
            <p style="color: #ccc; text-align: center; margin-bottom: 20px;">
                OTP sent to ${phoneNumber}
            </p>
            <button class="btn" id="verifyOtp">Verify OTP</button>
        </form>
        <div class="links" style="margin-top: 20px;">
            <button id="resendOtp">Resend OTP</button>
            <button id="backToPhone" style="margin-top: 10px;">Change Phone Number</button>
        </div>
        <div id="recaptcha-container"></div>
    `;

    // Verify OTP
    document.getElementById('verifyOtp').addEventListener('click', verifyOTP);
    
    // Resend OTP
    document.getElementById('resendOtp').addEventListener('click', resendOTP);
    
    // Back to phone number entry
    document.getElementById('backToPhone').addEventListener('click', () => {
        window.location.reload(); // Reload to show original phone form
    });
}

// Verify OTP
async function verifyOTP(event) {
    event.preventDefault();
    const otpCode = document.getElementById('otp-code').value;
    
    if (!otpCode || otpCode.length !== 6) {
        showMessage('Please enter a valid 6-digit OTP', 'otpMessage');
        return;
    }

    try {
        const result = await confirmationResult.confirm(otpCode);
        const user = result.user;
        
        CreatedMessage('Phone verification successful!', 'otpMessage');
        
        // Save user to Firestore
        const userData = {
            phoneNumber: user.phoneNumber,
            createdAt: new Date().toISOString()
        };
        
        const docRef = doc(db, "users", user.uid);
        await setDoc(docRef, userData);
        
        localStorage.setItem('loggedInUserId', user.uid);
        
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 2000);
        
    } catch (error) {
        console.error('Error verifying OTP:', error);
        if (error.code === 'auth/invalid-verification-code') {
            showMessage('Invalid OTP code', 'otpMessage');
        } else if (error.code === 'auth/code-expired') {
            showMessage('OTP has expired. Please request a new one.', 'otpMessage');
        } else {
            showMessage('Error verifying OTP: ' + error.message, 'otpMessage');
        }
    }
}

// Resend OTP
async function resendOTP() {
    const phoneNumber = document.getElementById('phone-number').value;
    let formattedNumber = phoneNumber;
    
    if (!phoneNumber.startsWith('+')) {
        formattedNumber = '+91' + phoneNumber;
    }

    try {
        if (!recaptchaVerifier) {
            initializeRecaptcha();
        }

        confirmationResult = await signInWithPhoneNumber(auth, formattedNumber, recaptchaVerifier);
        CreatedMessage('OTP resent successfully!', 'otpMessage');
        
    } catch (error) {
        console.error('Error resending OTP:', error);
        showMessage('Error resending OTP: ' + error.message, 'otpMessage');
    }
}

// Auth State Listener
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('User is logged in:', user.phoneNumber || user.email);
    } else {
        console.log('User is logged out');
    }
});

// Initialize reCAPTCHA when phone form is loaded
document.addEventListener('DOMContentLoaded', function() {
    // This will be called when the phone form becomes active
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const phoneForm = document.getElementById('number-verify');
                if (phoneForm.classList.contains('active')) {
                    // Initialize reCAPTCHA when phone form is shown
                    setTimeout(() => {
                        if (!recaptchaVerifier) {
                            initializeRecaptcha();
                        }
                    }, 1000);
                }
            }
        });
    });

    const phoneForm = document.getElementById('number-verify');
    if (phoneForm) {
        observer.observe(phoneForm, { attributes: true });
    }
});