// Drumsheet: optional accounts (Google sign-in) with grooves saved online (Firebase Firestore, EU).
// This module is only loaded when someone signs in, or was signed in before, so visitors
// without an account make no requests to Google at all.
import { firebaseConfig } from './firebase-config.js';

const V = '13.2.0';
const BASE = 'https://www.gstatic.com/firebasejs/' + V + '/';

let app, auth, db, A, F;
let currentUser = null;
const listeners = [];

export function isConfigured() {
  return !!(firebaseConfig && firebaseConfig.apiKey);
}

async function init() {
  if (app) return;
  if (!isConfigured()) throw new Error('Accounts are not set up yet.');
  const appMod = await import(BASE + 'firebase-app.js');
  A = await import(BASE + 'firebase-auth.js');
  F = await import(BASE + 'firebase-firestore.js');
  app = appMod.initializeApp(firebaseConfig);
  auth = A.getAuth(app);
  db = F.getFirestore(app);
  await new Promise((resolve) => {
    let first = true;
    A.onAuthStateChanged(auth, (u) => {
      currentUser = u;
      try {
        if (u) localStorage.setItem('benSignedIn', '1');
        else localStorage.removeItem('benSignedIn');
      } catch (e) {
        /* ignore */
      }
      listeners.forEach((fn) => fn(u));
      if (first) {
        first = false;
        resolve();
      }
    });
  });
}

// start quietly if this browser was signed in last time
export async function restore() {
  let was = false;
  try {
    was = localStorage.getItem('benSignedIn') === '1';
  } catch (e) {
    /* ignore */
  }
  if (!was || !isConfigured()) return null;
  try {
    await init();
  } catch (e) {
    console.warn('Drumsheet account:', e);
  }
  return currentUser;
}

export function user() {
  return currentUser;
}

export function onChange(fn) {
  listeners.push(fn);
}

export async function signIn() {
  await init();
  const provider = new A.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await A.signInWithPopup(auth, provider);
  } catch (e) {
    if (e && e.code === 'auth/popup-blocked') {
      await A.signInWithRedirect(auth, provider);
      return null;
    }
    if (e && (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request')) return null;
    throw e;
  }
  return currentUser;
}

// --- email + password accounts (Firebase stores only a secure hash; nobody can read passwords) ---
export async function signUpEmail(email, password) {
  await init();
  const cred = await A.createUserWithEmailAndPassword(auth, email, password);
  try {
    await A.sendEmailVerification(cred.user);
  } catch (e) {
    /* not fatal */
  }
  return cred.user;
}

export async function signInEmail(email, password) {
  await init();
  const cred = await A.signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function resetPassword(email) {
  await init();
  await A.sendPasswordResetEmail(auth, email);
}

export async function resendVerification() {
  if (currentUser) await A.sendEmailVerification(currentUser);
}

export async function reloadUser() {
  if (currentUser) await currentUser.reload();
  return auth && auth.currentUser;
}

// which way this user signs in: 'password' or 'google.com'
export function method() {
  if (!currentUser) return null;
  const p = currentUser.providerData.map((x) => x.providerId);
  return p.includes('password') ? 'password' : p[0] || null;
}

async function reauth(askPassword) {
  if (method() === 'password') {
    const pw = await askPassword('Enter your current password to confirm');
    if (!pw) throw new Error('Cancelled');
    await A.reauthenticateWithCredential(currentUser, A.EmailAuthProvider.credential(currentUser.email, pw));
  } else {
    await A.reauthenticateWithPopup(currentUser, new A.GoogleAuthProvider());
  }
}

export async function changePassword(currentPw, newPw) {
  await A.reauthenticateWithCredential(currentUser, A.EmailAuthProvider.credential(currentUser.email, currentPw));
  await A.updatePassword(currentUser, newPw);
}

// readable messages for the most common errors
export function message(e) {
  const c = (e && e.code) || '';
  const m = {
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/wrong-password': 'Wrong password.',
    'auth/user-not-found': 'No account with this email.',
    'auth/email-already-in-use': 'There is already an account with this email. Sign in instead, or use "Forgot password".',
    'auth/invalid-email': 'That email address does not look right.',
    'auth/weak-password': 'Choose a longer password (at least 8 characters).',
    'auth/password-does-not-meet-requirements': 'Choose a stronger password (at least 8 characters).',
    'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
    'auth/network-request-failed': 'No connection. Check your internet and try again.',
    'auth/requires-recent-login': 'Please sign in again and retry.',
    'auth/missing-password': 'Enter a password.',
  };
  return m[c] || (e && e.message) || String(e);
}

export async function signOut() {
  if (!auth) return;
  await A.signOut(auth);
}

function grooveCol() {
  return F.collection(db, 'users', currentUser.uid, 'grooves');
}

export async function list() {
  const snap = await F.getDocs(grooveCol());
  const out = [];
  snap.forEach((d) => out.push(Object.assign({ id: d.id }, d.data())));
  out.sort((a, b) => (b.saved || 0) - (a.saved || 0));
  return out;
}

export async function save(item) {
  await F.setDoc(F.doc(grooveCol(), item.id), {
    name: String(item.name).slice(0, 80),
    q: String(item.q),
    saved: Math.floor(item.saved || Date.now()),
  });
}

export async function remove(id) {
  await F.deleteDoc(F.doc(grooveCol(), id));
}

// delete all grooves, then the account itself (Google asks to confirm if the sign-in is old)
export async function deleteAccount(askPassword) {
  if (!currentUser) return;
  // confirm who it is first, so grooves are never deleted while the account stays
  await reauth(askPassword);
  const items = await list();
  for (const g of items) await remove(g.id);
  await A.deleteUser(auth.currentUser);
}
