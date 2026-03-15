
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

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

// Global State
let user = {
    uid: localStorage.getItem('ph_uid') || "u" + Math.random().toString(36).substr(2, 8),
    balance: 0,
    tg: localStorage.getItem('ph_tg') || "",
    refCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
    completed: {},
    refCount: 0,
    refEarned: 0
};
localStorage.setItem('ph_uid', user.uid);

let timer = 30;
let timerInt;
let isPaused = true;
let activeTask = null;

// App Start
window.onload = async () => {
    if (!user.tg) {
        let username = prompt("Enter your real Telegram Username (without @):");
        user.tg = "@" + (username || "Guest" + Math.floor(Math.random()*1000));
        localStorage.setItem('ph_tg', user.tg);
    }
    document.getElementById('display-tg').innerText = user.tg;
    
    await syncUser();
    updateClock();
    renderTasks();
};

async function syncUser() {
    const userRef = ref(db, 'users/' + user.uid);
    const snap = await get(userRef);
    if (!snap.exists()) {
        await set(userRef, user);
    } else {
        user = snap.val();
        if (!user.completed) user.completed = {};
    }
    updateBalanceUI();
    document.getElementById('my-ref-code').innerText = user.refCode;
    document.getElementById('ref-count').innerText = user.refCount || 0;
    document.getElementById('ref-earned').innerText = "₱" + (user.refEarned || 0).toFixed(2);
}

function updateBalanceUI() {
    document.getElementById('user-balance').innerText = `₱${user.balance.toFixed(3)}`;
}

function updateClock() {
    setInterval(() => {
        document.getElementById('footer-clock').innerText = new Date().toLocaleString();
    }, 1000);
}

window.showSection = (id) => {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.getElementById('sec-' + id).classList.remove('hidden');
};

// ADS LOGIC
function showAds() {
    if (window.AdController) { new AdController('10555746').show(); }
    console.log("Triggered 1 Adsgram and Monetag Background Scripts");
}

// TASK LOGIC
window.registerLink = async () => {
    const url = document.getElementById('reg-link').value;
    const def = document.getElementById('reg-def').value;
    if (!url || !def) return alert("Fill all fields");

    const taskRef = push(ref(db, 'tasks'));
    await set(taskRef, {
        url,
        definition: def,
        reward: 0.02,
        owner: user.uid,
        createdAt: Date.now()
    });
    alert("Task Added Successfully!");
    document.getElementById('reg-link').value = "";
    document.getElementById('reg-def').value = "";
    renderTasks();
    showSection('tasks');
};

function renderTasks() {
    const taskList = document.getElementById('task-list');
    const now = Date.now();
    
    onValue(ref(db, 'tasks'), (snap) => {
        taskList.innerHTML = "";
        const data = snap.val();
        if (!data) return;

        Object.keys(data).forEach(id => {
            const task = data[id];
            const lastDone = user.completed[id] || 0;
            
            // HIDE Logic: If finished within last 2 hours
            if (now - lastDone < 7200000) return;

            const card = document.createElement('div');
            card.className = "bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex justify-between items-center";
            card.innerHTML = `
                <div>
                    <div class="text-xs font-bold text-indigo-600 mb-1">Reward: ₱${task.reward}</div>
                    <div class="text-sm font-black text-slate-800 truncate w-40">${task.url}</div>
                    <div class="text-[10px] text-slate-400 font-medium">${task.definition}</div>
                </div>
                <button onclick="startTask('${id}')" class="bg-indigo-600 text-white px-5 py-2 rounded-xl font-bold text-sm shadow-lg shadow-indigo-100">VISIT</button>
            `;
            taskList.appendChild(card);
        });
    });
}

window.startTask = async (id) => {
    showAds();
    const snap = await get(ref(db, `tasks/${id}`));
    activeTask = { id, ...snap.val() };
    
    document.getElementById('task-frame').src = activeTask.url;
    document.getElementById('task-desc').innerText = activeTask.definition;
    document.getElementById('task-overlay').style.display = "flex";
    
    timer = 30;
    isPaused = true;
    document.getElementById('timer-val').innerText = "30";
    document.getElementById('interaction-label').style.display = "block";
    document.getElementById('click-blocker').style.display = "block";
    
    runTimer();
};

function runTimer() {
    clearInterval(timerInt);
    timerInt = setInterval(() => {
        if (!isPaused) {
            timer--;
            document.getElementById('timer-val').innerText = timer;
            
            // Auto-pause every 5 seconds
            if (timer > 0 && timer % 5 === 0) {
                isPaused = true;
                document.getElementById('interaction-label').innerText = "CLICK WEB TO RESUME";
                document.getElementById('interaction-label').style.display = "block";
                document.getElementById('click-blocker').style.display = "block";
            }

            if (timer <= 0) {
                completeTask();
            }
        }
    }, 1000);
}

window.handleInteraction = () => {
    isPaused = false;
    document.getElementById('interaction-label').style.display = "none";
    document.getElementById('click-blocker').style.display = "none";
};

async function completeTask() {
    clearInterval(timerInt);
    document.getElementById('task-overlay').style.display = "none";
    
    const reward = activeTask.reward;
    user.balance += reward;
    
    // Auto-hide fix: Store completion timestamp
    if(!user.completed) user.completed = {};
    user.completed[activeTask.id] = Date.now();
    
    // Save to DB
    await update(ref(db, 'users/' + user.uid), {
        balance: user.balance,
        completed: user.completed
    });

    // Referral 20% credit
    if (user.referredBy) {
        const rRef = ref(db, 'users/' + user.referredBy);
        const rSnap = await get(rRef);
        if (rSnap.exists()) {
            const rd = rSnap.val();
            update(rRef, {
                balance: (rd.balance || 0) + (reward * 0.2),
                refEarned: (rd.refEarned || 0) + (reward * 0.2)
            });
        }
    }

    alert(`Success! ₱${reward} credited to your balance.`);
    updateBalanceUI();
    renderTasks(); // Immediate refresh to hide task
    showSection('home');
}

// WITHDRAWAL FIX
window.handleWithdrawal = async () => {
    const amt = parseFloat(document.getElementById('wd-amount').value);
    const wallet = document.getElementById('wd-wallet').value;
    const method = document.getElementById('wd-method').value;

    if (amt > user.balance || amt <= 0) return alert("Insufficient Balance");
    if (!wallet) return alert("Enter wallet details");

    const wdData = {
        uid: user.uid,
        tg: user.tg,
        amount: amt,
        method: method,
        wallet: wallet,
        status: 'pending',
        time: Date.now()
    };

    await push(ref(db, 'withdrawals'), wdData);
    user.balance -= amt;
    await update(ref(db, 'users/' + user.uid), { balance: user.balance });
    
    alert("Withdrawal submitted for approval!");
    updateBalanceUI();
};

// ADMIN
window.checkAdmin = () => {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-auth').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        loadAdmin();
    }
};

function loadAdmin() {
    onValue(ref(db, 'stats'), s => {
        const d = s.val() || { totalPaid: 0, totalTasks: 0 };
        document.getElementById('adm-total-paid').innerText = "₱" + d.totalPaid.toFixed(2);
        document.getElementById('adm-total-tasks').innerText = d.totalTasks;
    });

    onValue(ref(db, 'withdrawals'), s => {
        const div = document.getElementById('admin-withdrawals');
        div.innerHTML = "<h3 class='font-black mb-4'>Pending</h3>";
        const d = s.val();
        for (let id in d) {
            if (d[id].status === 'pending') {
                const item = document.createElement('div');
                item.className = "flex justify-between items-center bg-slate-50 p-3 rounded-xl mb-2 text-[10px]";
                item.innerHTML = `
                    <span>${d[id].tg}: ${d[id].method} ₱${d[id].amount} (${d[id].wallet})</span>
                    <button onclick="approveWD('${id}', ${d[id].amount})" class="bg-green-600 text-white px-3 py-1 rounded-lg">Pay</button>
                `;
                div.appendChild(item);
            }
        }
    });
}

window.approveWD = async (id, amt) => {
    await update(ref(db, `withdrawals/${id}`), { status: 'paid' });
    const sSnap = await get(ref(db, 'stats'));
    const sData = sSnap.val() || { totalPaid: 0 };
    update(ref(db, 'stats'), { totalPaid: sData.totalPaid + amt });
    alert("Marked as Paid");
};

window.adminPostTask = async () => {
    const url = document.getElementById('adm-url').value;
    const def = document.getElementById('adm-def').value;
    await set(push(ref(db, 'tasks')), {
        url, definition: def, reward: 0.021, owner: 'admin'
    });
    alert("System Broadcaster Live!");
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
        const rSnap = await get(ref(db, 'users/' + found));
        update(ref(db, 'users/' + found), { refCount: (rSnap.val().refCount || 0) + 1 });
        alert("Referral Applied!");
    } else { alert("Invalid Code"); }
};
