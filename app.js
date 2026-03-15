
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue, limitToLast, query } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    databaseURL: "https://paper-house-inc-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// Telegram Init
const tg = window.Telegram?.WebApp;
tg?.ready();
const tgUser = tg?.initDataUnsafe?.user;
const username = tgUser ? `@${tgUser.username || tgUser.first_name}` : "Guest_" + Math.random().toString(36).substr(2,4);
document.getElementById("userBar").innerText = "👤 User: " + username;

let user = {
    uid: localStorage.getItem('ph_uid_v2') || "u" + Math.random().toString(36).substr(2, 9),
    balance: 0,
    username: username,
    refCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
    completed: {},
    refCount: 0,
    refEarned: 0
};
localStorage.setItem('ph_uid_v2', user.uid);

let timer = 30;
let timerInt;
let isPaused = true;
let currentTask = null;

const techTips = [
    "To undo an action, press Ctrl+Z. To redo, press Ctrl+Y.",
    "Use incognito mode to avoid saving browsing history.",
    "Pressing Windows+L instantly locks your computer.",
    "F5 refreshes your browser page.",
    "Ctrl+F allows you to search for keywords in a document or webpage.",
    "Hover over a link to see its destination URL in the bottom corner.",
    "A VPN encrypts your internet traffic for better privacy.",
    "Clear your cookies to troubleshoot login issues.",
    "Two-factor authentication (2FA) adds an extra layer of security.",
    "Always check for HTTPS in the URL bar for secure browsing."
    // Supports 100+ tips...
];

window.onload = () => {
    syncUser();
    setInterval(() => { document.getElementById('footer-clock').innerText = new Date().toLocaleString(); }, 1000);
    renderTasks();
    listenChat();
};

async function syncUser() {
    const uRef = ref(db, 'users/' + user.uid);
    const snap = await get(uRef);
    if (!snap.exists()) { 
        await set(uRef, user); 
    } else { 
        user = snap.val(); 
        if(!user.completed) user.completed = {};
    }
    refreshBalance();
}

function refreshBalance() {
    document.getElementById('user-balance').innerText = `₱${user.balance.toFixed(3)}`;
    document.getElementById('my-ref-code').innerText = user.refCode;
}

window.showSection = (id) => {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.getElementById('sec-' + id).classList.remove('hidden');
};

/* ================= ADS LOGIC (3 ADS) ================= */
function triggerAds() {
    // 1 Adsgram
    try { if (window.AdController) { new AdController('24438').show(); } } catch(e){}
    // 2 & 3 Monetag (Handled by SDK logic automatically upon trigger)
    try { if (window.show_10555746) { show_10555746(); show_10555746(); } } catch(e){}
}

/* ================= TASK MANAGEMENT ================= */
window.registerLink = async () => {
    const url = document.getElementById('reg-link').value;
    const def = document.getElementById('reg-def').value;
    if(!url || !def) return alert("Please fill all boxes");
    await push(ref(db, 'tasks'), { url, definition: def, reward: 0.02, owner: user.uid, createdAt: Date.now() });
    alert("Task Added! Go to Tasks section.");
    document.getElementById('reg-link').value = "";
    document.getElementById('reg-def').value = "";
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
            
            // Check 2 hour cooldown
            if (now - lastDone < 7200000) return;

            const card = document.createElement('div');
            card.className = "bg-white p-5 rounded-3xl border border-slate-100 flex justify-between items-center shadow-sm";
            card.innerHTML = `
                <div class="overflow-hidden pr-2">
                    <div class="text-[10px] font-black text-blue-600 mb-1">₱${task.reward} Reward</div>
                    <div class="text-sm font-bold truncate w-40">${task.url}</div>
                    <div class="text-[9px] text-slate-400 italic">${task.definition}</div>
                </div>
                <button onclick="startTask('${id}')" class="bg-blue-600 text-white px-6 py-2 rounded-2xl font-black text-xs">VISIT</button>
            `;
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
    
    // Auto-hide: Record completion time
    if(!user.completed) user.completed = {};
    user.completed[currentTask.id] = Date.now();
    
    await update(ref(db, 'users/' + user.uid), { balance: user.balance, completed: user.completed });
    
    // Referral Commission
    if(user.referredBy) {
        const rRef = ref(db, 'users/' + user.referredBy);
        const rSnap = await get(rRef);
        if(rSnap.exists()){
            update(rRef, { balance: rSnap.val().balance + (reward * 0.2) });
        }
    }

    // Tip Popup
    document.getElementById('tip-content').innerText = techTips[Math.floor(Math.random()*techTips.length)];
    document.getElementById('tip-popup').style.display = "flex";
    refreshBalance();
    renderTasks();
}

window.closeTip = () => {
    document.getElementById('tip-popup').style.display = "none";
    showSection('tasks');
};

/* ================= CHAT ================= */
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
            box.innerHTML += `<div><span class="font-black text-[10px] text-blue-600">${d.user}:</span> <span class="text-sm font-medium">${d.text}</span></div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

/* ================= WITHDRAWAL ================= */
window.requestWithdrawal = async () => {
    const amt = parseFloat(document.getElementById('wd-amount').value);
    const wallet = document.getElementById('wd-wallet').value;
    if(amt < 1) return alert("Minimum withdrawal is ₱1.00");
    if(user.balance < amt) return alert("Insufficient funds");

    await push(ref(db, 'withdrawals'), { 
        uid: user.uid, 
        user: user.username, 
        amount: amt, 
        wallet, 
        method: document.getElementById('wd-method').value, 
        status: 'pending', 
        time: Date.now() 
    });
    user.balance -= amt;
    await update(ref(db, 'users/' + user.uid), { balance: user.balance });
    alert("Withdrawal submitted!");
    refreshBalance();
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
        list.innerHTML = "<h3 class='font-black mb-4'>Pending Requests</h3>";
        const d = snap.val();
        for(let id in d) {
            if(d[id].status === 'pending') {
                const item = document.createElement('div');
                item.className = "flex justify-between p-2 border-b text-[10px]";
                item.innerHTML = `<span>${d[id].user}: ₱${d[id].amount}</span><button onclick="approveWD('${id}', ${d[id].amount})" class="bg-green-500 text-white px-2 rounded">Paid</button>`;
                list.appendChild(item);
            }
        }
    });
}

window.approveWD = async (id, amt) => {
    await update(ref(db, `withdrawals/${id}`), { status: 'paid' });
    alert("Approved!");
};

window.adminPostTask = async () => {
    const url = document.getElementById('adm-url').value;
    const def = document.getElementById('adm-def').value;
    await push(ref(db, 'tasks'), { url, definition: def, reward: 0.021, owner: 'admin' });
    alert("Global System Task Posted!");
};

window.applyReferral = async () => {
    const code = document.getElementById('input-ref').value.trim().toUpperCase();
    if (user.referredBy) return alert("Already linked");
    const uSnap = await get(ref(db, 'users'));
    const users = uSnap.val();
    let found = null;
    for (let u in users) { if (users[u].refCode === code) found = u; }

    if (found && found !== user.uid) {
        user.referredBy = found;
        await update(ref(db, 'users/' + user.uid), { referredBy: found });
        alert("Referral Applied!");
    } else { alert("Invalid Code"); }
};
