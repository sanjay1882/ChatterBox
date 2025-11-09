


import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.1/firebase-app.js";
import {getAuth, onAuthStateChanged, signOut} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-auth.js";
import{getFirestore, getDoc, doc} from "https://www.gstatic.com/firebasejs/10.11.1/firebase-firestore.js"

 

const app = initializeApp(firebaseConfig);


const auth = getAuth(app);
const db = getFirestore(app);


onAuthStateChanged(auth, (user) => {
  if (user) {
   
    const loggedInUserId = localStorage.getItem('loggedInUserId') || user.uid;
    localStorage.setItem('loggedInUserId', loggedInUserId);

    
    document.getElementById("userbtn").style.display = "none";
    document.getElementById("logout").style.display = "block";
    document.getElementById("loggedUserFName").innerText = user.displayName || user.email;
    document.getElementById("loggedUserEmail").innerText= user.email;
  } else {

    window.location.href = 'login.html';
  }
});


const logoutButton = document.getElementById('logout');
logoutButton.addEventListener('click', () => {

  localStorage.removeItem('loggedInUserId');

  signOut(auth)
    .then(() => {
     
      window.location.href = 'index.html';
      console.log("logout-Sucessful")
      document.getElementById("loginbtn").style.display = "block";
      document.getElementById("logout").style.display = "none";
    })
    .catch((error) => {
      console.error('Error Signing out:', error);
    });
});
