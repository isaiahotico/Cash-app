
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue, remove } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

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

let currentUser = {
    uid: localStorage.getItem('ph_uid') || "u" + Math.random().toString(36).substr(2, 7),
    balance: 0,
    referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
    completed: {},
    refCount: 0,
    refEarned: 0
};
localStorage.setItem('ph_uid', currentUser.uid);

let timer = 30;
let timerInterval;
let isPaused = true;
let currentTaskId = null;
let currentTaskData = null;

// INIT
window.onload = () => {
    initUser();
    startClock();
    renderTasks();
};

async function initUser() {
    // Immediate Telegram Display
    document.getElementById('tg-username').innerText = "@PaperhouseSupport";
    
    const userRef = ref(db, 'users/' + currentUser.uid);
    const snap = await get(userRef);
    if (!snap.exists()) {
        await set(userRef, currentUser);
    } else {
        currentUser = snap.val();
        if (!currentUser.completed) currentUser.completed = {};
    }
    updateUI();
    document.getElementById('my-ref-code').innerText = currentUser.referralCode;
}

function startClock() {
    setInterval(() => {
        const now = new Date();
        document.getElementById('footer-datetime').innerText = now.toLocaleString();
    }, 1000);
}

function updateUI() {
    document.getElementById('user-balance').innerText = `₱${currentUser.balance.toFixed(3)}`;
    document.getElementById('ref-count').innerText = currentUser.refCount || 0;
    document.getElementById('ref-earned').innerText = (currentUser.refEarned || 0).toFixed(2);
}

// NAVIGATION
window.showSection = (id) => {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.getElementById('sec-' + id).classList.remove('hidden');
};

// ADS SYSTEM
function triggerAds() {
    try {
        if (window.AdController) { new AdController('24438').show(); }
        // Monetag triggered by the browser processing scripts
        console.log("Ads Triggered: 1 Adsgram, 2 Monetag");
    } catch(e) {}
}

// LINK REGISTRATION FIX
window.registerLink = async () => {
    const url = document.getElementById('reg-link').value;
    const def = document.getElementById('reg-def').value;
    if (!url || !def) return alert("Fill all boxes");

    const newTaskRef = push(ref(db, 'tasks'));
    await set(newTaskRef, {
        url,
        definition: def,
        reward: 0.02,
        owner: currentUser.uid,
        createdAt: Date.now()
    });
    
    alert("Successfully Registered! View it in Tasks section.");
    document.getElementById('reg-link').value = "";
    document.getElementById('reg-def').value = "";
    showSection('tasks');
};

// RENDER TASKS (HIDE IF DONE WITHIN 2H)
function renderTasks() {
    const taskList = document.getElementById('task-list');
    onValue(ref(db, 'tasks'), (snapshot) => {
        taskList.innerHTML = "";
        const data = snapshot.val();
        if (!data) return;

        const now = Date.now();
        Object.keys(data).forEach(id => {
            const task = data[id];
            const lastDone = currentUser.completed[id] || 0;
            
            // Show only if never done or done more than 2 hours ago
            if (now - lastDone > 7200000) {
                const card = document.createElement('div');
                card.className = "bg-white p-4 rounded-xl border shadow-sm flex justify-between items-center animate-in fade-in duration-500";
                card.innerHTML = `
                    <div class="flex-grow pr-2">
                        <div class="text-xs text-blue-600 font-bold mb-1">₱${task.reward} Reward</div>
                        <div class="text-sm font-bold text-gray-800 truncate w-48">${task.url}</div>
                        <div class="text-[10px] text-gray-400 italic">${task.definition}</div>
                    </div>
                    <button onclick="viewTask('${id}')" class="bg-blue-600 text-white text-xs px-4 py-2 rounded-lg font-bold shadow-md shadow-blue-200">VISIT</button>
                `;
                taskList.appendChild(card);
            }
        });
    });
}

// TASK VIEWING LOGIC
window.viewTask = async (id) => {
    triggerAds();
    const snap = await get(ref(db, `tasks/${id}`));
    if (!snap.exists()) return;
    
    currentTaskId = id;
    currentTaskData = snap.val();
    
    document.getElementById('task-frame').src = currentTaskData.url;
    document.getElementById('task-reward-def').innerText = currentTaskData.definition;
    document.getElementById('task-overlay').style.display = "flex";
    
    timer = 30;
    isPaused = true;
    document.getElementById('timer-display').innerText = "30s";
    document.getElementById('interaction-msg').innerText = "CLICK TO START";
    document.getElementById('click-shield').style.display = "block";
    
    startTimer();
};

function startTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!isPaused) {
            timer--;
            document.getElementById('timer-display').innerText = timer + "s";
            
            if (timer > 0 && timer % 5 === 0) {
                isPaused = true;
                document.getElementById('interaction-msg').innerText = "CLICK TO RESUME";
                document.getElementById('click-shield').style.display = "block";
            }

            if (timer <= 0) {
                finishTask();
            }
        }
    }, 1000);
}

window.resumeTimer = () => {
    isPaused = false;
    document.getElementById('interaction-msg').innerText = "TIMER RUNNING...";
    document.getElementById('click-shield').style.display = "none";
};

async function finishTask() {
    clearInterval(timerInterval);
    document.getElementById('task-overlay').style.display = "none";
    
    const reward = currentTaskData.reward;
    currentUser.balance += reward;
    currentUser.completed[currentTaskId] = Date.now();
    
    await update(ref(db, 'users/' + currentUser.uid), {
        balance: currentUser.balance,
        completed: currentUser.completed
    });

    // Referral 20% commission
    if (currentUser.referredBy) {
        const refRef = ref(db, 'users/' + currentUser.referredBy);
        const refSnap = await get(refRef);
        if (refSnap.exists()) {
            const rData = refSnap.val();
            update(refRef, {
                balance: (rData.balance || 0) + (reward * 0.20),
                refEarned: (rData.refEarned || 0) + (reward * 0.20)
            });
        }
    }

    // Global Stats
    const gSnap = await get(ref(db, 'stats'));
    const gData = gSnap.val() || { totalTasks: 0 };
    update(ref(db, 'stats'), { totalTasks: gData.totalTasks + 1 });

    alert("Task Complete! Credited ₱" + reward);
    updateUI();
    showSection('home');
}

// ADMIN & WITHDRAWALS (Basic realization)
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
        div.innerHTML = "<h3 class='font-bold text-sm mb-2'>Pending</h3>";
        const d = s.val();
        for (let id in d) {
            if (d[id].status === 'pending') {
                const p = document.createElement('div');
                p.className = "border-b py-2 text-[10px] flex justify-between items-center";
                p.innerHTML = `<span>${d[id].method}: ₱${d[id].amount} (${d[id].wallet})</span>
                <button onclick="approveWD('${id}', ${d[id].amount})" class="bg-green-500 text-white px-2 rounded">Paid</button>`;
                div.appendChild(p);
            }
        }
    });
}

window.adminPostTask = async () => {
    const url = document.getElementById('adm-url').value;
    const def = document.getElementById('adm-def').value;
    await set(push(ref(db, 'tasks')), {
        url, definition: def, reward: 0.021, capacity: 100000, owner: 'admin'
    });
    alert("System Task Live!");
};

window.approveWD = async (id, amt) => {
    await update(ref(db, `withdrawals/${id}`), { status: 'approved' });
    const sSnap = await get(ref(db, 'stats'));
    const sData = sSnap.val() || { totalPaid: 0 };
    update(ref(db, 'stats'), { totalPaid: sData.totalPaid + amt });
};

window.requestWithdrawal = async () => {
    const amt = parseFloat(document.getElementById('wd-amount').value);
    if (currentUser.balance < amt) return alert("Check balance");
    const req = {
        uid: currentUser.uid,
        amount: amt,
        method: document.getElementById('wd-method').value,
        wallet: document.getElementById('wd-wallet').value,
        status: 'pending'
    };
    await push(ref(db, 'withdrawals'), req);
    currentUser.balance -= amt;
    await update(ref(db, 'users/' + currentUser.uid), { balance: currentUser.balance });
    alert("Request Sent!");
    updateUI();
};

window.applyReferral = async () => {
    const code = document.getElementById('input-ref').value.trim().toUpperCase();
    if (currentUser.referredBy) return alert("Already have a referral");
    
    const uSnap = await get(ref(db, 'users'));
    const users = uSnap.val();
    let found = null;
    for (let u in users) { if (users[u].referralCode === code) found = u; }

    if (found && found !== currentUser.uid) {
        currentUser.referredBy = found;
        await update(ref(db, 'users/' + currentUser.uid), { referredBy: found });
        const rSnap = await get(ref(db, 'users/' + found));
        update(ref(db, 'users/' + found), { refCount: (rSnap.val().refCount || 0) + 1 });
        alert("Referral Code Linked!");
    } else { alert("Invalid Code"); }
};
