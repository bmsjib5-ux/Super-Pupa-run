// Settings for the online parts of the game (sign-in, cloud save, top-ups).
// This file is plain JavaScript on purpose so it can be edited without a
// build step. The Firebase web config is public by design; the secret keys
// live only on the API server (see server/README.md).
window.PUPA_CONFIG = {
  // The API server (server/ in this repo, deployed on Render).
  apiBase: "https://super-pupa-run-api.onrender.com",
  // Firebase web app config from the Firebase console
  // (Project settings → Your apps → SDK setup and configuration).
  // Set to null to hide the sign-in button.
  firebase: {
    apiKey: "AIzaSyA7S9IUjn3u3M1jeqjpG87nxxf2TiRujXg",
    authDomain: "super-pupa-run.firebaseapp.com",
    projectId: "super-pupa-run",
    storageBucket: "super-pupa-run.firebasestorage.app",
    messagingSenderId: "880454440350",
    appId: "1:880454440350:web:28bab6d723e59f42b9328f"
  }
};
