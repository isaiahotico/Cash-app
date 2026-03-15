
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue, limitToLast, query } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ================= TELEGRAM INTEGRATION ================= */
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? `@${tgUser.username || tgUser.first_name}` : "Guest_" + Math.floor(Math.random()*9999);
document.getElementById("userBar").innerText = "👤 User: " + username;

let user = {
    uid: localStorage.getItem('ph_uid') || "u" + Math.random().toString(36).substr(2, 9),
    balance: 0,
    username: username,
    refCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
    completed: {}
};
localStorage.setItem('ph_uid', user.uid);

let timer = 30;
let timerInt;
let isPaused = true;
let currentTask = null;

const techTips = [
    "Shortcut: Ctrl + Shift + T reopens the last closed tab.",
    "Using a dark mode can save battery on OLED screens.",
    "Restarting your router every month can fix many connection issues.",
    "Google Search: Put quotes around phrases to find exact matches.",
    "Keep your OS updated to protect against the latest security threats.",
    "Clear your browser cache to speed up loading on slow sites.",
    "Alt + Tab allows you to switch between open programs instantly.",
    "Shift + Delete deletes a file permanently without moving it to the bin.",
    "Spacebar scrolls down a webpage, Shift + Spacebar scrolls up.",
    "Windows + D instantly hides all windows and shows your desktop."
    // ... logic supports up to 100 tips
];

window.onload = async () => {
    syncUser();
    setInterval(() => { document.getElementById('footer-clock').innerText = new Date().toLocaleString(); }, 1000);
    renderTasks();
    listenChat();
};

async function syncUser() {
    const uRef = ref(db, 'users/' + user.uid);
    const snap = await get(uRef);
    if (!snap.exists()) { await set(uRef, user); } 
    else { 
        user = snap.val(); 
        if(!user.completed) user.completed = {};
    }
    document.getElementById('user-balance').innerText = `₱${user.balance.toFixed(3)}`;
    document.getElementById('my-ref-code').innerText = user.refCode;
}

window.showSection = (id) => {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.getElementById('sec-' + id).classList.remove('hidden');
};

/* ================= ADS LOGIC (3 ADS) ================= */
function triggerAds() {
    // 1. Adsgram
    if (window.AdController) { new AdController('10555746').show().catch(()=>{}); }
    // 2 & 3. Monetag (Triggers automatically via script in head)
    console.log("Showing 3 Ads per click...");
}

/* ================= TASK LOGIC ================= */
window.registerLink = async () => {
    const url = document.getElementById('reg-link').value;
    const def = document.getElementById('reg-def').value;
    if(!url || !def) return alert("Fill data");
    await push(ref(db, 'tasks'), { url, definition: def, reward: 0.02, owner: user.uid, createdAt: Date.now() });
    alert("Task Registered!");
};

function renderTasks() {
    const list = document.getElementById('task-list');
    onValue(ref(db, 'tasks'), snap => {
        list.innerHTML = "";
        const data = snap.val();
        if(!data) return;
        const now = Date.now();
        Object.keys(data).forEach(id => {
            const task = data[id];
            const lastDone = user.completed[id] || 0;
            if (now - lastDone < 7200000) return; // 2 hour hide logic

            const card = document.createElement('div');
            card.className = "bg-white p-4 rounded-xl border flex justify-between items-center";
            card.innerHTML = `<div><div class="text-xs font-bold text-indigo-600">₱${task.reward}</div><div class="text-sm font-bold truncate w-40">${task.url}</div></div>
            <button onclick="startTask('${id}')" class="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-xs">VISIT</button>`;
            list.appendChild(card);
        });
    });
}

window.startTask = async (id) => {
    triggerAds();
    const snap = await get(ref(db, `tasks/${id}`));
    currentTask = { id, ...snap.val() };
    document.getElementById('task-frame').src = currentTask.url;
    document.getElementById('task-hint').innerText = currentTask.definition;
    document.getElementById('task-overlay').style.display = "flex";
    timer = 30; isPaused = true;
    document.getElementById('timer-txt').innerText = "30";
    document.getElementById('interaction-label').style.display = "block";
    document.getElementById('click-shield').style.display = "block";
    runTimer();
};

function runTimer() {
    clearInterval(timerInt);
    timerInt = setInterval(() => {
        if(!isPaused) {
            timer--;
            document.getElementById('timer-txt').innerText = timer;
            if (timer > 0 && timer % 5 === 0) pauseTimer();
            if (timer <= 0) finishTask();
        }
    }, 1000);
}

function pauseTimer() {
    isPaused = true;
    document.getElementById('interaction-label').style.display = "block";
    document.getElementById('click-shield').style.display = "block";
}

window.resumeTimer = () => {
    isPaused = false;
    document.getElementById('interaction-label').style.display = "none";
    document.getElementById('click-shield').style.display = "none";
};

async function finishTask() {
    clearInterval(timerInt);
    document.getElementById('task-overlay').style.display = "none";
    const reward = currentTask.reward;
    user.balance += reward;
    user.completed[currentTask.id] = Date.now();
    
    await update(ref(db, 'users/' + user.uid), { balance: user.balance, completed: user.completed });
    
    // Referral Commission
    if(user.referredBy) {
        const rRef = ref(db, 'users/' + user.referredBy);
        const rSnap = await get(rRef);
        if(rSnap.exists()) {
            update(rRef, { balance: rSnap.val().balance + (reward * 0.2) });
        }
    }

    // Tech Tip Reward Popup
    const randomTip = techTips[Math.floor(Math.random() * techTips.length)];
    document.getElementById('tip-content').innerText = randomTip;
    document.getElementById('tip-popup').style.display = "flex";
    
    document.getElementById('user-balance').innerText = `₱${user.balance.toFixed(3)}`;
    renderTasks();
}

window.closeTip = () => {
    document.getElementById('tip-popup').style.display = "none";
    showSection('home');
};

/* ================= CHAT LOGIC ================= */
window.sendMessage = () => {
    const msg = document.getElementById('chat-input').value;
    if(!msg) return;
    push(ref(db, 'chat'), { user: user.username, text: msg, time: Date.now() });
    document.getElementById('chat-input').value = "";
};

function listenChat() {
    onValue(query(ref(db, 'chat'), limitToLast(20)), snap => {
        const box = document.getElementById('chat-box');
        box.innerHTML = "";
        snap.forEach(m => {
            const d = m.val();
            box.innerHTML += `<div><span class="font-bold text-indigo-600">${d.user}:</span> <span>${d.text}</span></div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

/* ================= WITHDRAWAL (MIN ₱1) ================= */
window.requestWithdrawal = async () => {
    const amt = parseFloat(document.getElementById('wd-amount').value);
    const wallet = document.getElementById('wd-wallet').value;
    if(amt < 1) return alert("Minimum withdrawal is ₱1.00");
    if(user.balance < amt) return alert("Insufficient balance");

    await push(ref(db, 'withdrawals'), { uid: user.uid, user: user.username, amount: amt, wallet, status: 'pending', time: Date.now() });
    user.balance -= amt;
    await update(ref(db, 'users/' + user.uid), { balance: user.balance });
    alert("Withdrawal Requested!");
    document.getElementById('user-balance').innerText = `₱${user.balance.toFixed(3)}`;
};

/* ================= ADMIN ================= */
window.checkAdmin = () => {
    if(document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-auth').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        loadAdmin();
    }
};

function loadAdmin() {
    onValue(ref(db, 'withdrawals'), snap => {
        const list = document.getElementById('admin-wd-list');
        list.innerHTML = "";
        const data = snap.val();
        for(let id in data) {
            if(data[id].status === 'pending') {
                const item = document.createElement('div');
                item.className = "flex justify-between text-[10px] p-2 border-b";
                item.innerHTML = `<span>${data[id].user}: ₱${data[id].amount}</span><button onclick="approveWD('${id}', ${data[id].amount})" class="bg-green-500 text-white px-2 rounded">Approve</button>`;
                list.appendChild(item);
            }
        }
    });
}

window.approveWD = async (id, amt) => {
    await update(ref(db, `withdrawals/${id}`), { status: 'paid' });
    const sSnap = await get(ref(db, 'stats'));
    const paid = (sSnap.val()?.paid || 0) + amt;
    update(ref(db, 'stats'), { paid });
    alert("Paid!");
};

window.adminPostTask = async () => {
    const url = document.getElementById('adm-url').value;
    const def = document.getElementById('adm-def').value;
    await push(ref(db, 'tasks'), { url, definition: def, reward: 0.021, owner: 'admin' });
    alert("System Task Posted!");
};
