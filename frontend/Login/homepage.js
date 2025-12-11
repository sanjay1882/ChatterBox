



import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import { getFirestore, getDoc, doc } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js";
import { firebaseConfig } from './firebaseConfig.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

onAuthStateChanged(auth, (user) => {
  if (user) {

    const loggedInUserId = localStorage.getItem('loggedInUserId') || user.uid;
    localStorage.setItem('loggedInUserId', loggedInUserId);
    localStorage.setItem('loggedInUserEmail', user.email);


    document.getElementById("logout").style.display = "block";




  } else {
    window.location.href = 'Login/index.html';
  }
});


const logoutButton = document.getElementById('logout');
logoutButton.addEventListener('click', () => {

  localStorage.removeItem('loggedInUserId');

  signOut(auth)
    .then(() => {
      window.location.href = 'index.html';



    })
    .catch((error) => {
      console.error('Error Signing out:', error);
    });
});
