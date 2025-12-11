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


    form.style.display = 'block';
    form.classList.add('active');

    if (form.id === 'number-verify') {

        const phoneForm = document.getElementById('number-verify');
        if (!phoneForm.querySelector('#phone-number')) {

            window.location.reload();
        }
    }
}


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




document.addEventListener('DOMContentLoaded', function() {
    showForm(signInForm);
});