const signUpButton = document.getElementById('signUpButton');
const signInButton = document.getElementById('signInButton');
const backToSignIn = document.getElementById('backToSignIn');
const signInForm = document.getElementById('signIn');
const signUpForm = document.getElementById('signup');
const MobileForm = document.getElementById('phone-auth');
const NumberForm = document.getElementById('number-verify');

function showForm(form) {
    // Hide all forms
    [signInForm, signUpForm, NumberForm].forEach(f => {
        f.style.display = 'none';
        f.classList.remove('active');
    });

    // Show the selected form
    form.style.display = 'block';
    form.classList.add('active');
    
    // Reset forms when switching
    if (form.id === 'number-verify') {
        // Reset phone form to initial state
        const phoneForm = document.getElementById('number-verify');
        if (!phoneForm.querySelector('#phone-number')) {
            // Reload the phone form if it was modified for OTP
            window.location.reload();
        }
    }
}

// Event Listeners for form switching
if (signUpButton) {
    signUpButton.addEventListener('click', () => showForm(signUpForm));
}

if (signInButton) {
    signInButton.addEventListener('click', () => showForm(signInForm));
}

if (MobileForm) {
    MobileForm.addEventListener('click', () => showForm(NumberForm));
}

if (backToSignIn) {
    backToSignIn.addEventListener('click', () => showForm(signInForm));
}

// Prevent Dev Tools and Page Source
document.addEventListener('keydown', (event) => {
    if (
        event.key === 'F12' || 
        event.keyCode === 123 || 
        (event.ctrlKey && event.shiftKey && (event.key === 'I' || event.key === 'J')) || 
        (event.ctrlKey && event.key === 'U')
    ) {
        event.preventDefault();
    }
});

// Right-click context menu disable
document.addEventListener('contextmenu', (event) => {
    event.preventDefault();
});

// Initialize - show sign in form by default
document.addEventListener('DOMContentLoaded', function() {
    showForm(signInForm);
});