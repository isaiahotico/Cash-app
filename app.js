
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, serverTimestamp, query, orderByChild, limitToLast } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// Initialize
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const tg = window.Telegram.WebApp;
tg.expand();

const userId = tg.initDataUnsafe?.user?.id || "test_user_123";
const userName = tg.initDataUnsafe?.user?.first_name || "User";
let userBalance = 0;

// Initialize User
async function initUser() {
    const userRef = ref(db, 'users/' + userId);
    const snapshot = await get(userRef);
    
    if (!snapshot.exists()) {
        const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        await set(userRef, {
            username: userName,
            balance: 0,
            referralCode: referralCode,
            referralsCount: 0,
            usedReferral: false
        });
    }
    
    onValue(userRef, (snap) => {
        const data = snap.val();
        userBalance = data.balance || 0;
        document.getElementById('userBalance').innerText = `₱${userBalance.toFixed(2)}`;
        document.getElementById('myReferralCode').innerText = data.referralCode;
    });
}

// Monetag Ads Logic
window.watchAd = function() {
    if (typeof show_10276123 === 'function') {
        show_10276123().then(() => {
            const newBalance = userBalance + 0.01;
            update(ref(db, 'users/' + userId), { balance: newBalance });
            alert('Congrats! You earned ₱0.01');
        }).catch(e => {
            alert('Ad failed to load. Try again.');
        });
    } else {
        alert('Ad SDK not ready');
    }
};

// Tabs Navigation
window.showTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if(tabId === 'leaderboard') loadLeaderboard();
    if(tabId === 'chat') loadChat();
};

// Leaderboard Logic
function loadLeaderboard() {
    const usersRef = query(ref(db, 'users'), orderByChild('balance'), limitToLast(10));
    onValue(usersRef, (snap) => {
        const list = document.getElementById('leaderboardList');
        list.innerHTML = "";
        const users = [];
        snap.forEach(child => { users.push(child.val()); });
        users.reverse().forEach((u, i) => {
            list.innerHTML += `<div class="flex justify-between p-3 bg-white rounded-lg shadow-sm border-l-4 border-sky-400">
                <span>${i+1}. ${u.username}</span>
                <span class="font-bold text-sky-600">₱${u.balance.toFixed(2)}</span>
            </div>`;
        });
    });
}

// Chat Logic
window.sendMessage = function() {
    const text = document.getElementById('chatInput').value;
    if(!text) return;
    push(ref(db, 'chats'), {
        user: userName,
        text: text,
        time: serverTimestamp()
    });
    document.getElementById('chatInput').value = "";
};

function loadChat() {
    const chatRef = query(ref(db, 'chats'), limitToLast(20));
    onValue(chatRef, (snap) => {
        const container = document.getElementById('chatMessages');
        container.innerHTML = "";
        snap.forEach(msg => {
            const d = msg.val();
            container.innerHTML += `<div class="p-2 bg-sky-50 rounded shadow-sm text-sm">
                <b class="text-sky-700">${d.user}:</b> ${d.text}
            </div>`;
        });
        container.scrollTop = container.scrollHeight;
    });
}

// Withdrawal Logic
window.requestWithdrawal = async function() {
    const gcash = document.getElementById('gcashNumber').value;
    if(gcash.length < 10) return alert("Enter valid GCash number");
    if(userBalance < 0.02) return alert("Minimum withdrawal is ₱0.02");

    const wdRef = push(ref(db, 'withdrawals'));
    await set(wdRef, {
        userId, userName, gcash, amount: userBalance, status: 'pending'
    });
    await update(ref(db, 'users/' + userId), { balance: 0 });
    alert("Withdrawal Requested!");
};

// Admin Logic
window.checkAdmin = function() {
    const pass = document.getElementById('adminPass').value;
    if(pass === "Propetas12") {
        document.getElementById('adminLoginPanel').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        loadAdminData();
    } else {
        alert("Wrong Password");
    }
};

function loadAdminData() {
    onValue(ref(db, 'withdrawals'), (snap) => {
        const container = document.getElementById('adminWithdrawals');
        container.innerHTML = "";
        snap.forEach(wd => {
            const data = wd.val();
            container.innerHTML += `<div class="border-b p-2 text-xs">
                ${data.userName} | ${data.gcash} | ₱${data.amount}
                <button class="bg-green-500 text-white px-2 rounded ml-2">Paid</button>
            </div>`;
        });
    });
}

// Referral Logic
window.claimReferral = async function() {
    const code = document.getElementById('inputReferral').value.trim();
    const userRef = ref(db, 'users/' + userId);
    const snap = await get(userRef);
    if(snap.val().usedReferral) return alert("Already claimed a referral");

    // Search for code
    const usersSnap = await get(ref(db, 'users'));
    let referrerId = null;
    usersSnap.forEach(u => {
        if(u.val().referralCode === code && u.key !== userId) referrerId = u.key;
    });

    if(referrerId) {
        // Reward referrer 0.01
        const refRef = ref(db, 'users/' + referrerId);
        const refSnap = await get(refRef);
        update(refRef, { 
            balance: (refSnap.val().balance || 0) + 0.01,
            referralsCount: (refSnap.val().referralsCount || 0) + 1
        });
        update(userRef, { usedReferral: true });
        alert("Referral Applied! Referrer earned 0.01");
    } else {
        alert("Invalid code");
    }
};

initUser();
