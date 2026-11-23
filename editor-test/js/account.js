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
export async function deleteAccount() {
  if (!currentUser) return;
  const items = await list();
  for (const g of items) await remove(g.id);
  try {
    await A.deleteUser(currentUser);
  } catch (e) {
    if (e && e.code === 'auth/requires-recent-login') {
      await A.reauthenticateWithPopup(currentUser, new A.GoogleAuthProvider());
      await A.deleteUser(auth.currentUser);
    } else throw e;
  }
}
