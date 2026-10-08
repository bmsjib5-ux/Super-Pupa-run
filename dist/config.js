// Settings for the online parts of the game (sign-in, cloud save, top-ups).
// This file is plain JavaScript on purpose so it can be edited without a
// build step. The Firebase web config is public by design; the secret keys
// live only on the API server (see server/README.md).
window.PUPA_CONFIG = {
  // The API server (server/ in this repo, deployed on Render).
  apiBase: "https://super-pupa-run-api.onrender.com",
  // Firebase web app config from the Firebase console
  // (Project settings → Your apps → SDK setup and configuration).
  // Leave null until it is set up: the sign-in button then stays hidden.
  firebase: null
  // Example:
  // firebase: {
  //   apiKey: "AIza...",
  //   authDomain: "super-pupa-run.firebaseapp.com",
  //   projectId: "super-pupa-run",
  //   appId: "1:1234567890:web:abcdef"
  // }
};
