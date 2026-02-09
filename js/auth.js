// js/auth.js

function $(id) {
  return document.getElementById(id);
}

// Redirect helpers
function goToApp() {
  window.location.href = "index.html";
}
function goToLogin() {
  window.location.href = "login.html";
}

// Call this on login.html
function initLoginPage() {
  const form = $("loginForm");
  const errorBox = $("errorBox");

  // If already logged in, go to app
  auth.onAuthStateChanged((user) => {
    if (user) goToApp();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorBox.textContent = "";

    const email = $("email").value.trim();
    const password = $("password").value;

    try {
      // Keep user logged in across refresh / reopen
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

      await auth.signInWithEmailAndPassword(email, password);
      goToApp();
    } catch (err) {
      errorBox.textContent = err.message;
    }
  });
}

// Call this on index.html to protect the app
function requireAuthOnAppPage() {
  auth.onAuthStateChanged((user) => {
    if (!user) goToLogin();
    // If user exists, we stay on app page.
    // Later steps will load notes for user.uid here.
  });
}

// Logout button handler
async function logout() {
  try {
    await auth.signOut();
    goToLogin();
  } catch (err) {
    alert(err.message);
  }
}
