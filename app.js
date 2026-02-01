
// app.js
// Use Firebase v9 modular imports via CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import { getDatabase, ref, set, push, onValue, query, orderByChild, limitToFirst, orderByValue, update, get, child } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";

// Firebase config (from your prompt)
const firebaseConfig = {
  apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
  authDomain: "freegcash-ads.firebaseapp.com",
  databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "freegcash-ads",
  storageBucket: "freegcash-ads.firebasestorage.app",
  messagingSenderId: "608086825364",
  appId: "1:608086825364:web:3a8e628d231b52c6171781",
  measurementId: "G-Z64B87ELGP"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// DOM references
const usernameDisp = document.getElementById('usernameDisp');
const balanceDisp = document.getElementById('balanceDisp');
const myCodeSpan = document.getElementById('myCode');
const refCountSpan = document.getElementById('refCount');
const refEarningsSpan = document.getElementById('refEarnings');
const btnWatch = document.getElementById('btn-watch');
const btnRefresh = document.getElementById('btn-refresh');
const chatWrap = document.getElementById('chatWrap');
const chatInput = document.getElementById('chatInput');
const sendChat = document.getElementById('sendChat');
const leaderboard = document.getElementById('leaderboard');
const claimRefBtn = document.getElementById('claimRef');
const refInput = document.getElementById('refInput');
const usernameInput = document.getElementById('usernameInput');
const saveProfile = document.getElementById('saveProfile');
const btnAdmin = document.getElementById('btn-admin');
const adminModal = document.getElementById('adminModal');
const adminLogin = document.getElementById('adminLogin');
const adminCancel = document.getElementById('adminCancel');
const adminPassField = document.getElementById('adminPass');
const gcashNum = document.getElementById('gcashNum');
const withdrawAmt = document.getElementById('withdrawAmt');
const requestWithdraw = document.getElementById('requestWithdraw');
const viewWithdraws = document.getElementById('viewWithdraws');
const btnRefreshUI = document.getElementById('btn-refresh');

// monetag globals
const MONETAG_ZONE = '10276123'; // from snippet
// Reward settings
const MAX_REWARD_PER_AD = 0.01; // PHP
const MIN_WITHDRAW = 0.02;

// App state
let currentUser = null;
let myProfile = null;
let lastAdRewardAt = 0; // local throttle to avoid double-crediting

// Utility helpers
function toFixed(n) { return Number(n).toFixed(3); }
function random6() { return Math.floor(100000 + Math.random()*900000).toString(); }

async function initAuthAndUser() {
  // sign in anonymously
  try {
    await signInAnonymously(auth);
  } catch(e) {
    console.error('Auth error', e);
  }

  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    currentUser = user;
    // load or create profile
    const userRef = ref(db, 'users/' + user.uid);
    const snap = await get(userRef);
    if (!snap.exists()) {
      // create minimal profile
      const code = random6();
      const profile = {
        username: 'User' + code,
        code,
        balance: 0,
        referralCode: code,
        referredBy: null,
        referralCount: 0,
        referralEarnings: 0,
        createdAt: Date.now()
      };
      await set(userRef, profile);
      myProfile = profile;
    } else {
      myProfile = snap.val();
    }
    setupUIWithProfile();
    attachRealtimeListeners();
  });
}

function setupUIWithProfile() {
  usernameDisp.textContent = myProfile.username || 'Guest';
  usernameInput.value = myProfile.username || '';
  balanceDisp.textContent = `₱${toFixed(myProfile.balance || 0)}`;
  myCodeSpan.textContent = myProfile.referralCode || '------';
  refCountSpan.textContent = myProfile.referralCount || 0;
  refEarningsSpan.textContent = toFixed(myProfile.referralEarnings || 0);
}

function attachRealtimeListeners() {
  // watch own profile
  const uref = ref(db, 'users/' + currentUser.uid);
  onValue(uref, (snap) => {
    if (!snap.exists()) return;
    myProfile = snap.val();
    setupUIWithProfile();
  });

  // chat messages (last 100)
  const mref = ref(db, 'messages');
  onValue(mref, (snap) => {
    chatWrap.innerHTML = '';
    const val = snap.val() || {};
    const items = Object.entries(val).sort((a,b)=>a[1].ts - b[1].ts);
    for (const [,msg] of items.slice(-200)) {
      const div = document.createElement('div');
      div.className = 'msg';
      const who = msg.username || 'Anon';
      const text = document.createElement('div');
      text.innerHTML = `<strong>${escapeHtml(who)}</strong>: ${escapeHtml(msg.text)} <div class="small" style="opacity:0.6">${new Date(msg.ts).toLocaleString()}</div>`;
      div.appendChild(text);
      chatWrap.appendChild(div);
    }
    chatWrap.scrollTop = chatWrap.scrollHeight;
  });

  // leaderboard top 10
  const usersRef = ref(db, 'users');
  onValue(usersRef, (snap) => {
    const val = snap.val() || {};
    const arr = Object.entries(val).map(([uid,u]) => ({ uid, username: u.username || 'User', balance: Number(u.balance || 0) }));
    arr.sort((a,b)=>b.balance - a.balance);
    leaderboard.innerHTML = '';
    arr.slice(0, 10).forEach((u, idx) => {
      const div = document.createElement('div');
      div.className = 'user';
      div.innerHTML = `<div>#${idx+1} ${escapeHtml(u.username)}</div><div>₱${toFixed(u.balance)}</div>`;
      leaderboard.appendChild(div);
    });
  });
}

// Basic XSS escape
function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); });
}

// Chat send
sendChat.addEventListener('click', async () => {
  const text = chatInput.value.trim();
  if (!text) return;
  const msg = { uid: currentUser.uid, username: myProfile.username || 'Anon', text, ts: Date.now() };
  await push(ref(db, 'messages'), msg);
  chatInput.value = '';
});

// Save profile username
saveProfile.addEventListener('click', async () => {
  const name = usernameInput.value.trim();
  if (!name) return alert('Enter username');
  const uref = ref(db, 'users/' + currentUser.uid);
  await update(uref, { username: name });
  alert('Saved');
});

// Claim referral (link to referrer code)
claimRefBtn.addEventListener('click', async () => {
  const code = (refInput.value || '').trim();
  if (!/^\d{6}$/.test(code)) return alert('Enter a valid 6-digit code');
  if (myProfile.referredBy) return alert('Already linked to a referrer');
  // find referrer by referralCode
  const snap = await get(ref(db, 'users'));
  const users = snap.val() || {};
  const target = Object.entries(users).find(([uid,u]) => u.referralCode === code);
  if (!target) return alert('Code not found');
  const [ruid, rprofile] = target;
  if (ruid === currentUser.uid) return alert('Cannot use your own code');
  // link
  await update(ref(db, 'users/' + currentUser.uid), { referredBy: ruid });
  // increment referrer's referralCount
  const rrRef = ref(db, 'users/' + ruid);
  const rrSnap = await get(rrRef);
  const rr = rrSnap.val() || {};
  const newCount = (rr.referralCount || 0) + 1;
  await update(rrRef, { referralCount: newCount });
  alert('Referral linked. Future rewards will give your referrer 8% bonus.');
});

// Withdraw request
requestWithdraw.addEventListener('click', async () => {
  const number = (gcashNum.value || '').trim();
  const amt = Number(withdrawAmt.value || 0);
  if (!/^(09|\+639)\d{9}$/.test(number) && !/^\d{10,13}$/.test(number)) {
    if (!confirm('GCash number looks unusual. Continue?')) return;
  }
  if (isNaN(amt) || amt < MIN_WITHDRAW) return alert(`Min withdraw is ₱${MIN_WITHDRAW}`);
  if (amt > (myProfile.balance || 0)) return alert('Not enough balance');
  // create withdraw request
  const w = {
    uid: currentUser.uid,
    username: myProfile.username || 'User',
    number,
    amount: Number(amt.toFixed(3)),
    status: 'pending',
    createdAt: Date.now()
  };
  await push(ref(db, 'withdrawals'), w);
  // optionally deduct balance immediately (reserved)
  const userRef = ref(db, 'users/' + currentUser.uid);
  const newBalance = Number((myProfile.balance - amt).toFixed(6));
  await update(userRef, { balance: newBalance });
  alert('Withdraw request sent. Admin will process it.');
});

// view my requests dialog (simple alert)
viewWithdraws.addEventListener('click', async () => {
  const snap = await get(ref(db, 'withdrawals'));
  const items = snap.val() || {};
  const mine = Object.values(items).filter(x=>x.uid === currentUser.uid);
  if (mine.length === 0) return alert('No requests');
  let s = 'Your requests:\n';
  mine.forEach(m => s += `${m.amount} PHP → ${m.number} (status: ${m.status})\n`);
  alert(s);
});

// UI refresh
btnRefreshUI.addEventListener('click', () => {
  location.reload();
});

// Admin modal
btnAdmin.addEventListener('click', () => {
  adminModal.classList.remove('hidden');
});
adminCancel.addEventListener('click', () => {
  adminModal.classList.add('hidden');
});
adminLogin.addEventListener('click', () => {
  const pass = adminPassField.value || '';
  if (pass === 'Propetas12') {
    adminModal.classList.add('hidden');
    openAdminPanel();
  } else {
    alert('Wrong password');
  }
});

// Admin panel (client-side)
function openAdminPanel() {
  const panelHtml = `
    Admin Dashboard
    1) View pending withdrawals and mark paid
    2) Broadcast message (push to /messages)
    3) Credit a user
  `;
  const action = prompt(panelHtml + "\nEnter option number (1=withdraws,2=broadcast,3=credit user)");
  if (action === '1') {
    showWithdrawsAdmin();
  } else if (action === '2') {
    const text = prompt('Broadcast message text');
    if (text) {
      push(ref(db, 'messages'), { uid: 'admin', username: 'Admin', text, ts: Date.now() });
      alert('Broadcasted');
    }
  } else if (action === '3') {
    const uid = prompt('Enter user UID to credit:');
    const amt = parseFloat(prompt('Amount to credit (PHP)'));
    if (uid && !isNaN(amt)) {
      applyCredit(uid, amt);
    }
  } else {
    alert('Cancelled or unknown option');
  }
}

async function showWithdrawsAdmin() {
  const snap = await get(ref(db, 'withdrawals'));
  const list = snap.val() || {};
  const pending = Object.entries(list).filter(([k,v]) => v.status === 'pending');
  if (pending.length === 0) return alert('No pending withdrawals');
  for (const [key, w] of pending) {
    const ok = confirm(`Request: ${w.username} - ₱${w.amount} to ${w.number}\nApprove? (OK=yes, Cancel=no)`);
    if (ok) {
      await update(ref(db, 'withdrawals/' + key), { status: 'paid', processedAt: Date.now(), admin: 'web-admin' });
      alert('Marked as paid. You should now perform real payout via GCash manually.');
    } else {
      // reject: credit back user
      await update(ref(db, 'withdrawals/' + key), { status: 'rejected', processedAt: Date.now() });
      // credit back
      const ur = ref(db, 'users/' + w.uid);
      const uSnap = await get(ur);
      const udata = uSnap.val() || {};
      const newBal = Number(((udata.balance || 0) + Number(w.amount)).toFixed(6));
      await update(ur, { balance: newBal });
      alert('Rejected and balance returned to user.');
    }
  }
}

async function applyCredit(uid, amt) {
  const ur = ref(db, 'users/' + uid);
  const snap = await get(ur);
  if (!snap.exists()) return alert('User not found');
  const u = snap.val();
  const newBal = Number(((u.balance || 0) + Number(amt)).toFixed(6));
  await update(ur, { balance: newBal });
  alert('Credited');
}

// Credit user after ad reward
async function rewardUser(amount) {
  // throttle: local time to prevent duplicate rewards
  const now = Date.now();
  if (now - lastAdRewardAt < 2000) {
    console.warn('Ad rewarded too fast, ignoring duplicate.');
    return;
  }
  lastAdRewardAt = now;

  if (!currentUser) return;
  amount = Math.min(amount, MAX_REWARD_PER_AD);
  // update my balance atomically via read-modify-update
  const uref = ref(db, 'users/' + currentUser.uid);
  const snap = await get(uref);
  const u = snap.val() || {};
  const newBalance = Number(((u.balance || 0) + amount).toFixed(6));
  await update(uref, { balance: newBalance });

  // referral 8%
  if (u.referredBy) {
    const refUid = u.referredBy;
    const rRef = ref(db, 'users/' + refUid);
    const rSnap = await get(rRef);
    if (rSnap.exists()) {
      const r = rSnap.val();
      const bonus = Number((amount * 0.08).toFixed(6));
      const newRBal = Number(((r.balance || 0) + bonus).toFixed(6));
      const newReferralEarnings = Number(((r.referralEarnings || 0) + bonus).toFixed(6));
      await update(rRef, { balance: newRBal, referralEarnings: newReferralEarnings });
    }
  }

  alert(`You were rewarded ₱${toFixed(amount)}!`);
}

// Hook Monetag ad callbacks
window.openAd = function(format) {
  // show monetag accordingly
  try {
    if (format === 'pop') {
      window.show_10276123('pop').then(() => {
        // rewarded popup: user watched (or closed interstitial)
        rewardUser(MAX_REWARD_PER_AD);
      }).catch(e => {
        console.warn('Ad error', e);
      });
    } else {
      // default rewarded interstitial
      window.show_10276123().then(() => {
        rewardUser(MAX_REWARD_PER_AD);
      }).catch(e => console.warn('Ad error', e));
    }
  } catch (e) {
    console.error('Monetag not loaded or error', e);
    alert('Ad SDK not available. Make sure SDK loads.');
  }
};

// Also the blue top "Watch Ad" button triggers same
btnWatch.addEventListener('click', () => {
  openAd('rewarded');
});

// initial boot
initAuthAndUser();

// simple utilities to load top users etc could be added

// small helper to get once
async function get(refpath) {
  return (await import("https://www.gstatic.com/firebasejs/9.22.2/firebase-database.js")).get(ref(refpath));
}
