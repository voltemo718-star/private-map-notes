// js/firebase.js

const firebaseConfig = {
  apiKey: "AIzaSyCebRAQB4iGrKOU2-xMjzDzcnZCXymfoL0",
  authDomain: "mapa-6da40.firebaseapp.com",
  projectId: "mapa-6da40",
  storageBucket: "mapa-6da40.firebasestorage.app",
  messagingSenderId: "975099856680",
  appId: "1:975099856680:web:b13f2922fc5ffed3a8321d",
  measurementId: "G-NEZ9T8MB1L"
};

// Initialize Firebase (compat)
firebase.initializeApp(firebaseConfig);

// Services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
