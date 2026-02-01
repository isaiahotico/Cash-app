
/* app.js — type="module" */
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot, collection,
  addDoc, query, where, orderBy, limit, updateDoc, serverTimestamp,
  runTransaction, increment, getDocs // Import getDocs for queries
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

/* === CONFIG === */
const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.appspot.com",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781",
  measurementId: "G-Z64B87ELGP"
};

const HIGH_REWARD = 0.0065;
const RANDOM_REWARD = 0.0012;
const HIGH_COOLDOWN_MS = 30 * 1000;
const RANDOM_COOLDOWN_MS = 10 * 60 * 1000;
const INITIAL_AD_COOLDOWN_MS = 3 * 60 * 1000; // 3 minutes
const MIN_WITHDRAW = 1.00; // 1 piso
const REFERRAL_BONUS_PERCENT = 0.10; // 10% of referral's earnings

const AD_ZONES = ['show_10276123', 'show_10337795', 'show_10337853'];

/* === INIT FIREBASE === */
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
signInAnonymously(auth).catch(console.error);

const tg = window.Telegram.WebApp;
tg.expand();

let authUid = null;
let userDocRef = null;
let userData = {};
let isAdminUIOpen = false;

/* --- UTIL --- */
function getRandomAdZone() {
  const idx = Math.floor(Math.random() * AD_ZONES.length);
  return window[AD_ZONES[idx]];
}

function formatMoney(n) {
  return parseFloat(n).toFixed(4);
}

// --- Initial Telegram User Data ---
// Get Telegram user data immediately on load
const tUser = tg.initDataUnsafe?.user || { id: `tg_${Date.now()}`, first_name: 'User', username: null };
const tgId = tUser.id?.toString();
const currentDisplayName = tUser.username ? `@${tUser.username}` : (tUser.first_name || 'Anonymous');
// Use Telegram username as referral code if available, otherwise Firebase UID (will be set later)
let currentReferralCode = tUser.username ? tUser.username.toLowerCase() : null; 

// Display initial Telegram user data immediately
document.getElementById('user-display').innerText = currentDisplayName;
// If referral code is not yet set (because authUid is null), display a placeholder
document.getElementById('my-ref-code').innerText = currentReferralCode || 'Loading...';


/* === AUTH STATE === */
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  authUid = user.uid;

  // If currentReferralCode was null, set it to authUid now
  if (!currentReferralCode) {
    currentReferralCode = authUid;
    document.getElementById('my-ref-code').innerText = currentReferralCode;
  }

  userDocRef = doc(db, 'users', authUid);

  // Check telegram index for duplicates
  const tgIndexRef = doc(db, 'telegramIndex', tgId);

  // Create or initialize user atomically:
  const existingUserSnap = await getDoc(userDocRef);
  const tgIndexSnap = await getDoc(tgIndexRef);

  // Duplicate detection: if telegramIndex maps to another uid -> mark duplicate
  let isDuplicate = false;
  if (tgIndexSnap.exists()) {
    const mappedUid = tgIndexSnap.data().uid;
    if (mappedUid !== authUid) {
      isDuplicate = true;
    }
  } else {
    // try to set index (best-effort, not strictly atomic across clients)
    await setDoc(tgIndexRef, { uid: authUid, createdAt: serverTimestamp() }).catch(() => {});
  }

  if (!existingUserSnap.exists()) {
    await setDoc(userDocRef, {
      authUid,
      telegramId: tgId,
      username: currentDisplayName, // Store current Telegram display name
      referralCode: currentReferralCode, // Store current referral code
      refBy: null, // Who referred this user
      refCount: 0, // How many users this user referred
      refBonus: 0, // Earned bonus from referrals
      balance: 0,
      totalAds: 0,
      lastHighReward: 0,
      lastRandomReward: 0,
      lastInitialAd: 0,
      isDuplicate,
      isBanned: !!isDuplicate,
      createdAt: serverTimestamp()
    });
  } else {
    // If user exists, update their username and referralCode in case it changed
    const existing = existingUserSnap.data();
    const updates = {};
    if (existing.telegramId && existing.telegramId !== tgId) {
      // Another telegram id linked — keep as-is but set duplicate flag
      updates.isDuplicate = true;
      updates.isBanned = true;
    }
    // Only update if the value from Telegram is different from what's in Firestore
    if (existing.username !== currentDisplayName) {
      updates.username = currentDisplayName;
    }
    if (existing.referralCode !== currentReferralCode) {
      updates.referralCode = currentReferralCode;
    }
    if (Object.keys(updates).length > 0) {
      await updateDoc(userDocRef, updates).catch(()=>{});
    }
  }

  // Start listening user document
  onSnapshot(userDocRef, (snap) => {
    if (!snap.exists()) return;
    userData = snap.data();
    document.getElementById('user-balance').innerText = formatMoney(userData.balance || 0);
    document.getElementById('total-ads').innerText = (userData.totalAds || 0);
    document.getElementById('txt-ref-c').innerText = (userData.refCount || 0);
    document.getElementById('txt-ref-b').innerText = `₱${formatMoney(userData.refBonus || 0)}`;

    // Disable bind button if already referred
    const bindBtn = document.querySelector('#home .glass button.btn-grad'); // More specific selector
    const refBinderInput = document.getElementById('ref-binder');
    if (userData.refBy) {
      refBinderInput.value = userData.refBy;
      refBinderInput.disabled = true;
      bindBtn.disabled = true;
      bindBtn.innerText = 'BOUND';
    } else {
      refBinderInput.disabled = false;
      bindBtn.disabled = false;
      bindBtn.innerText = 'BIND';
    }

    // If banned, warn
    if (userData.isBanned) {
      tg.showAlert("Account flagged as duplicate/ banned. Contact admin.");
    }
    // Show initial ad if cooldown passed
    tryShowInitialAd();
  });

  // Start listeners for chat/leaderboard/withdrawals
  setupRealtimeListeners();
});

/* === REALTIME LISTENERS === */
function setupRealtimeListeners() {
  // Leaderboard: top 10 by balance
  const lbQuery = query(collection(db, 'users'), orderBy('balance', 'desc'), limit(10));
  onSnapshot(lbQuery, (snap) => {
    const el = document.getElementById('leaderboard-list');
    el.innerHTML = '';
    snap.forEach(docSnap => {
      const d = docSnap.data();
      const highlight = (docSnap.id === authUid) ? 'border-2 border-sky-500' : '';
      el.innerHTML += `<div class="glass p-3 ${highlight} flex justify-between"><div>${d.username}</div><div>₱${formatMoney(d.balance||0)}</div></div>`;
    });
  });

  // Chat
  const chatQuery = query(collection(db, 'chat'), orderBy('createdAt', 'asc'));
  onSnapshot(chatQuery, (snap) => {
    const box = document.getElementById('chat-box');
    box.innerHTML = '';
    snap.forEach(docSnap => {
      const m = docSnap.data();
      // Format timestamp for display
      const date = m.createdAt?.toDate ? m.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      box.innerHTML += `<div class="p-2 bg-blue-50 rounded-md"><b>${m.user}</b> <span class="text-gray-500 text-xs">${date}</span>: ${m.text}</div>`;
    });
    box.scrollTop = box.scrollHeight; // Auto-scroll to bottom
  });

  // User's withdrawals
  const wQuery = query(collection(db, 'withdrawals'), where('authUid', '==', authUid), orderBy('createdAt', 'desc'));
  onSnapshot(wQuery, (snap) => {
    const el = document.getElementById('withdrawal-history');
    el.innerHTML = '';
    snap.forEach(docSnap => {
      const w = docSnap.data();
      const date = w.createdAt?.toDate ? w.createdAt.toDate().toLocaleString() : '';
      const statusClass = w.status === 'Paid' ? 'text-green-600' : (w.status === 'Pending' ? 'text-orange-500' : 'text-red-600');
      el.innerHTML += `<div class="p-2 border-b flex justify-between"><div><div class="font-bold">₱${parseFloat(w.amount).toFixed(4)} → ${w.gcash}</div><div class="text-xs text-gray-500">${date}</div></div><div class="${statusClass} font-semibold">${w.status}</div></div>`;
    });
  });

  // Admin view for withdrawals (if admin UI open we will query all)
}

/* === ADS: initial auto interstitial (cooldown 3min) === */
function tryShowInitialAd() {
  if (!userData) return;
  const last = userData.lastInitialAd || 0;
  const now = Date.now();
  if (now - last < INITIAL_AD_COOLDOWN_MS) return; // still in cooldown

  const adFunc = getRandomAdZone();
  try {
    adFunc({
      type: 'inApp',
      inAppSettings: { frequency: 1, capping: 0.1, interval: 30, timeout: 5, everyPage: false }
    });
    // Update lastInitialAd
    updateDoc(userDocRef, { lastInitialAd: now }).catch(()=>{});
  } catch(e) {
    console.error('Initial ad show failed', e);
    // No alert for initial ad as it's background
  }
}

/* === AD REWARD FUNCTIONS === */
async function processAdReward(rewardAmount) {
  const now = Date.now();
  const updates = {
    balance: increment(rewardAmount),
    totalAds: increment(1),
  };

  // If user was referred, give bonus to referrer
  if (userData.refBy) {
    const referrerUsername = userData.refBy;
    // Query by referralCode (which is the username)
    const referrerQuerySnapshot = await getDocs(query(collection(db, 'users'), where('referralCode', '==', referrerUsername), limit(1)));
    
    if (!referrerQuerySnapshot.empty) {
      const referrerDocRef = referrerQuerySnapshot.docs[0].ref;
      const bonus = rewardAmount * REFERRAL_BONUS_PERCENT;
      await updateDoc(referrerDocRef, { refBonus: increment(bonus) });
    }
  }
  
  await updateDoc(userDocRef, updates);
  tg.showAlert(`You earned ₱${rewardAmount.toFixed(4)}!`);
}


window.watchHighRewardAd = async function() {
  if (!userData || userData.isBanned) return tg.showAlert('Account is banned or not ready.');
  const now = Date.now();
  if ((now - (userData.lastHighReward || 0)) < HIGH_COOLDOWN_MS) return tg.showAlert('Wait 30s cooldown.');

  const ad = getRandomAdZone();
  tg.MainButton.setText('LOADING AD...').show();

  try {
    const adResult = await ad(); // Monetag SDK might return a promise or value
    if (adResult && adResult.status === 'error') { // Check if Monetag ad failed
        throw new Error('Monetag ad failed to load or show.');
    }
    await updateDoc(userDocRef, { lastHighReward: now }); // Update last ad time first
    await processAdReward(HIGH_REWARD); // Then process reward and referral
    tg.MainButton.hide();
  } catch (e) {
    tg.MainButton.hide();
    console.error('High reward ad failed:', e);
    tg.showAlert('Ad failed or skipped. Please try again later.');
  }
};

window.watchRandomRewardAd = async function() {
  if (!userData || userData.isBanned) return tg.showAlert('Account is banned or not ready.');
  const now = Date.now();
  if ((now - (userData.lastRandomReward || 0)) < RANDOM_COOLDOWN_MS) return tg.showAlert('Wait 10min cooldown.');

  const ad = getRandomAdZone();
  tg.MainButton.setText('LOADING POP...').show();

  try {
    const adResult = await ad('pop'); // Monetag SDK might return a promise or value
    if (adResult && adResult.status === 'error') { // Check if Monetag ad failed
        throw new Error('Monetag ad failed to load or show.');
    }
    await updateDoc(userDocRef, { lastRandomReward: now }); // Update last ad time first
    await processAdReward(RANDOM_REWARD); // Then process reward and referral
    tg.MainButton.hide();
  } catch (e) {
    tg.MainButton.hide();
    console.error('Random reward ad failed:', e);
    tg.showAlert('Popup ad failed or skipped. Please try again later.');
  }
};

/* === REFERRAL FUNCTIONS === */
window.bindReferrer = async function() {
  if (!userData || userData.isBanned) return tg.showAlert('Account is banned or not ready.');
  const referrerCode = document.getElementById('ref-binder').value.trim().toLowerCase();

  if (!referrerCode) return tg.showAlert('Please enter a referrer code.');
  if (referrerCode === userData.referralCode) return tg.showAlert("You cannot refer yourself.");
  if (userData.refBy) return tg.showAlert("You are already referred by someone.");

  // Find referrer by their referralCode
  const referrerQuerySnapshot = await getDocs(query(collection(db, 'users'), where('referralCode', '==', referrerCode), limit(1)));
  
  if (!referrerQuerySnapshot.empty) {
    const referrerDocRef = referrerQuerySnapshot.docs[0].ref;
    
    try {
      await runTransaction(db, async (tx) => {
        // Update current user's refBy
        tx.update(userDocRef, { refBy: referrerCode });
        // Increment referrer's refCount
        tx.update(referrerDocRef, { refCount: increment(1) });
      });
      tg.showAlert(`Successfully bound to referrer: ${referrerCode}`);
    } catch (e) {
      console.error("Error binding referrer:", e);
      tg.showAlert("Failed to bind referrer. Please try again.");
    }
  } else {
    tg.showAlert("Referrer not found. Please check the code.");
  }
};

window.claimBonus = async function() {
  if (!userData || userData.isBanned) return tg.showAlert('Account is banned or not ready.');
  if ((userData.refBonus || 0) <= 0) return tg.showAlert("No bonus to claim.");

  try {
    await runTransaction(db, async (tx) => {
      const uSnap = await tx.get(userDocRef);
      if (!uSnap.exists()) throw 'User doc missing';
      const currentRefBonus = uSnap.data().refBonus || 0;
      if (currentRefBonus <= 0) throw 'No bonus to claim';

      tx.update(userDocRef, {
        balance: increment(currentRefBonus),
        refBonus: 0
      });
    });
    tg.showAlert(`Claimed ₱${formatMoney(userData.refBonus)} from bonus pool!`);
  } catch (e) {
    console.error("Error claiming bonus:", e);
    tg.showAlert("Failed to claim bonus. Please try again.");
  }
};

/* === CHAT SEND === */
window.sendMessage = async function() {
  const text = document.getElementById('chat-input').value.trim();
  if (!text) return;
  const displayName = userData.username || 'Unknown';
  await addDoc(collection(db, 'chat'), { user: displayName, text, createdAt: serverTimestamp() });
  document.getElementById('chat-input').value = '';
};

/* === WITHDRAWALS === */
window.requestWithdrawal = async function() {
  const gcash = document.getElementById('gcash-num').value.trim();
  const amount = parseFloat(document.getElementById('wd-amount').value);
  if (!gcash || gcash.length < 10) return tg.showAlert('Enter valid GCash number.');
  if (!amount || amount < MIN_WITHDRAW) return tg.showAlert(`Minimum withdrawal is ₱${MIN_WITHDRAW.toFixed(2)}.`);
  if (amount > (userData.balance || 0)) return tg.showAlert('Insufficient balance.');

  // Create withdrawal doc with status Pending and deduct balance using transaction
  try {
    await runTransaction(db, async (tx) => {
      const uRef = userDocRef;
      const uSnap = await tx.get(uRef);
      if (!uSnap.exists()) throw 'User doc missing';
      const curBal = uSnap.data().balance || 0;
      if (curBal < amount) throw 'Insufficient balance';
      // deduct
      tx.update(uRef, { balance: curBal - amount });
      // create withdrawal
      const wRef = collection(db, 'withdrawals');
      tx.set(doc(wRef), {
        authUid,
        telegramId: userData.telegramId || null,
        username: userData.username || null,
        gcash,
        amount: parseFloat(amount.toFixed(4)),
        status: 'Pending',
        createdAt: serverTimestamp()
      });
    });
    tg.showAlert('Withdrawal requested. Await admin approval.');
  } catch (e) {
    console.error(e);
    tg.showAlert('Error creating withdrawal: ' + (e.message || e));
  }
}

/* === ADMIN UI & ACTIONS === */
window.checkAdmin = async function() {
  const pass = document.getElementById('admin-pass').value;
  // IMPORTANT: Replace 'Propetas12' with a secure, server-side verified password or admin UID check.
  // For production, DO NOT hardcode passwords here.
  if (pass !== 'Propetas12') return alert('Wrong password');

  // show admin content
  document.getElementById('admin-login').classList.add('hidden');
  document.getElementById('admin-content').classList.remove('hidden');
  isAdminUIOpen = true;
  loadAllWithdrawalsForAdmin();
};

async function loadAllWithdrawalsForAdmin() {
  const wCol = collection(db, 'withdrawals');
  const q = query(wCol, orderBy('createdAt', 'desc'));
  onSnapshot(q, (snap) => {
    const list = document.getElementById('withdrawal-list');
    list.innerHTML = '';
    snap.forEach(docSnap => {
      const w = docSnap.data();
      const id = docSnap.id;
      const date = w.createdAt?.toDate ? w.createdAt.toDate().toLocaleString() : '';
      let controls = '';
      if (w.status === 'Pending') {
        controls = `<button onclick="adminApprove('${id}')" class="bg-green-600 text-white px-2 py-1 rounded mr-2">Approve</button>
                    <button onclick="adminReject('${id}')" class="bg-red-600 text-white px-2 py-1 rounded">Reject & Refund</button>`;
      } else {
        controls = `<span class="text-sm">${w.status}</span>`;
      }
      list.innerHTML += `<div class="p-3 border rounded-md"><div class="flex justify-between"><div><b>₱${parseFloat(w.amount).toFixed(4)}</b> → ${w.gcash}<div class="text-xs text-gray-500">${w.username} • ${date}</div></div><div>${controls}</div></div></div>`;
    });
  });
}

window.adminApprove = async function(withdrawId) {
  if (!confirm('Confirm approve and mark Paid?')) return;
  const wRef = doc(db, 'withdrawals', withdrawId);
  // mark as Paid and set processedAt
  await updateDoc(wRef, { status: 'Paid', processedAt: serverTimestamp(), processedBy: authUid }).catch(e => tg.showAlert('Err:' + e));
  tg.showAlert('Marked as Paid. User will see update automatically.');
};

window.adminReject = async function(withdrawId) {
  if (!confirm('Reject request and refund?')) return;
  const wRef = doc(db, 'withdrawals', withdrawId);
  const wSnap = await getDoc(wRef);
  if (!wSnap.exists()) return;
  const w = wSnap.data();
  const amount = w.amount || 0;
  const userRefFor = doc(db, 'users', w.authUid);
  // perform refund + set status in transaction
  await runTransaction(db, async (tx) => {
    const uSnap = await tx.get(userRefFor);
    if (!uSnap.exists()) throw 'User missing';
    const curBal = uSnap.data().balance || 0;
    tx.update(userRefFor, { balance: curBal + amount });
    tx.update(wRef, { status: 'Rejected', processedAt: serverTimestamp(), processedBy: authUid });
  }).catch(e => tg.showAlert('Refund failed: ' + e));
  tg.showAlert('Rejected and refunded.');
};

/* === NAVIGATION === */
window.showPage = function(pageId, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('nav-active'));
  if (btn) btn.classList.add('nav-active');
};

/* === OPTIONAL: auto in-app interstitial on each page show (we already show on load when cooldown passes) === */
/* Additional cooldown handling for high/random buttons UI (client-side) */
setInterval(() => {
  const now = Date.now();
  const highRemaining = (userData.lastHighReward || 0) + HIGH_COOLDOWN_MS - now;
  const randRemaining = (userData.lastRandomReward || 0) + RANDOM_COOLDOWN_MS - now;
  document.getElementById('cooldown-high').innerText = highRemaining > 0 ? `Cooldown: ${Math.ceil(highRemaining/1000)}s` : 'Ready';
  document.getElementById('cooldown-random').innerText = randRemaining > 0 ? `Cooldown: ${Math.ceil(randRemaining/1000)}s` : 'Ready';
}, 1000);
