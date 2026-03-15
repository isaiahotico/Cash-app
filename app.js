
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

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

// State
let currentUser = {
    uid: "user_" + Math.random().toString(36).substr(2, 9), // Simple session for demo
    balance: 0,
    referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
    completed: {}
};

let timer = 30;
let timerInterval;
let isPaused = true;
let currentTask = null;

// Initial Load
window.onload = () => {
    initUser();
    renderTasks();
    document.getElementById('my-ref-code').innerText = currentUser.referralCode;
};

async function initUser() {
    const userRef = ref(db, 'users/' + currentUser.uid);
    const snapshot = await get(userRef);
    if (!snapshot.exists()) {
        await set(userRef, currentUser);
    } else {
        currentUser = snapshot.val();
    }
    updateUI();
}

function updateUI() {
    document.getElementById('user-balance').innerText = `Balance: ₱${currentUser.balance.toFixed(3)}`;
    document.getElementById('ref-count').innerText = currentUser.refCount || 0;
    document.getElementById('ref-earned').innerText = (currentUser.refEarned || 0).toFixed(2);
}

// Section Control
window.showSection = (id) => {
    document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
    document.getElementById('sec-' + id).classList.remove('hidden');
};

// ADS LOGIC (Monetag & Adsgram)
function triggerAds() {
    // 1 Adsgram
    if (window.AdController) {
        const ad = new AdController('24438');
        ad.show().catch(() => {});
    }
    // 2 Monetag (handled by script tag usually, but we can trigger re-checks if they provide a function)
    console.log("Displaying 3 Ads (1 Adsgram, 2 Monetag)");
}

// TASK LOGIC
window.registerLink = async () => {
    const url = document.getElementById('reg-link').value;
    const def = document.getElementById('reg-def').value;
    if (!url) return alert("Enter URL");

    const newTaskRef = push(ref(db, 'tasks'));
    await set(newTaskRef, {
        url,
        definition: def,
        owner: currentUser.uid,
        capacity: 100,
        clicks: 0,
        reward: 0.02,
        type: 'user'
    });
    alert("Link Registered!");
    renderTasks();
};

window.renderTasks = () => {
    onValue(ref(db, 'tasks'), (snapshot) => {
        const list = document.getElementById('task-list');
        list.innerHTML = "";
        const data = snapshot.val();
        const now = Date.now();

        for (let id in data) {
            const task = data[id];
            // Check 2-hour cooldown
            const lastDone = currentUser.completed ? currentUser.completed[id] : 0;
            if (now - lastDone < 7200000) continue; // 2 hours in ms

            const card = document.createElement('div');
            card.className = "bg-white p-4 rounded shadow flex justify-between items-center task-card";
            card.innerHTML = `
                <div>
                    <p class="font-bold text-blue-600">${task.url.substring(0, 30)}...</p>
                    <p class="text-xs text-gray-500">${task.definition}</p>
                    <p class="text-sm font-bold text-green-600">Reward: ₱${task.reward}</p>
                </div>
                <button onclick="startTask('${id}')" class="bg-blue-500 text-white px-4 py-2 rounded">Visit</button>
            `;
            list.appendChild(card);
        }
    });
};

window.startTask = async (id) => {
    triggerAds();
    const snapshot = await get(ref(db, `tasks/${id}`));
    currentTask = { ...snapshot.val(), id };
    
    document.getElementById('task-frame').src = currentTask.url;
    document.getElementById('task-reward-def').innerText = currentTask.definition;
    document.getElementById('task-overlay').style.display = "flex";
    
    timer = 30;
    isPaused = true; // Start paused, requires click
    document.getElementById('interaction-status').innerText = "CLICK WEBSITE TO START";
    document.getElementById('click-shield').style.display = "block";
    
    runTimer();
};

function runTimer() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        if (!isPaused) {
            timer--;
            document.getElementById('timer-display').innerText = `Wait: ${timer}s`;
            
            // Auto-pause every 5 seconds
            if (timer > 0 && timer % 5 === 0) {
                pauseTimer();
            }

            if (timer <= 0) {
                completeTask();
            }
        }
    }, 1000);
}

function pauseTimer() {
    isPaused = true;
    document.getElementById('interaction-status').innerText = "CLICK WEBSITE TO RESUME";
    document.getElementById('click-shield').style.display = "block";
}

window.resumeTimer = () => {
    isPaused = false;
    document.getElementById('interaction-status').innerText = "TIMER RUNNING...";
    document.getElementById('click-shield').style.display = "none";
};

async function completeTask() {
    clearInterval(timerInterval);
    document.getElementById('task-overlay').style.display = "none";
    
    const reward = currentTask.reward;
    const userRef = ref(db, 'users/' + currentUser.uid);
    
    // Update User Balance and Cooldown
    currentUser.balance += reward;
    if(!currentUser.completed) currentUser.completed = {};
    currentUser.completed[currentTask.id] = Date.now();
    
    await update(userRef, {
        balance: currentUser.balance,
        completed: currentUser.completed
    });

    // Referral 20%
    if (currentUser.referredBy) {
        const refRef = ref(db, 'users/' + currentUser.referredBy);
        const refSnap = await get(refRef);
        if (refSnap.exists()) {
            const refData = refSnap.val();
            update(refRef, {
                balance: (refData.balance || 0) + (reward * 0.2),
                refEarned: (refData.refEarned || 0) + (reward * 0.2)
            });
        }
    }

    // Update Global Admin Stats
    const statsRef = ref(db, 'stats');
    const statsSnap = await get(statsRef);
    const stats = statsSnap.val() || { totalTasks: 0 };
    update(statsRef, { totalTasks: stats.totalTasks + 1 });

    alert(`Task Finished! Credited ₱${reward}`);
    updateUI();
    showSection('home');
}

// ADMIN LOGIC
window.checkAdmin = () => {
    const pass = document.getElementById('admin-pass').value;
    if (pass === "Propetas12") {
        document.getElementById('admin-auth').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        loadAdminData();
    } else {
        alert("Wrong Password");
    }
};

async function loadAdminData() {
    const statsSnap = await get(ref(db, 'stats'));
    const stats = statsSnap.val() || { totalPaid: 0, totalTasks: 0 };
    document.getElementById('adm-total-paid').innerText = `₱${stats.totalPaid}`;
    document.getElementById('adm-total-tasks').innerText = stats.totalTasks;

    // Load Withdrawals
    onValue(ref(db, 'withdrawals'), (snap) => {
        const div = document.getElementById('admin-withdrawals');
        div.innerHTML = "<h3 class='font-bold mb-2 text-sm'>Pending Withdrawals</h3>";
        const data = snap.val();
        for (let id in data) {
            if (data[id].status === 'pending') {
                const item = document.createElement('div');
                item.className = "p-2 border-b text-xs flex justify-between";
                item.innerHTML = `
                    <span>${data[id].method}: ₱${data[id].amount} (${data[id].wallet})</span>
                    <button onclick="approveWithdrawal('${id}', ${data[id].amount})" class="bg-green-500 text-white px-1 rounded">Approve</button>
                `;
                div.appendChild(item);
            }
        }
    });
}

window.adminPostTask = async () => {
    const url = document.getElementById('adm-url').value;
    const def = document.getElementById('adm-def').value;
    const newTaskRef = push(ref(db, 'tasks'));
    await set(newTaskRef, {
        url,
        definition: def,
        owner: 'admin',
        capacity: 100000,
        clicks: 0,
        reward: 0.021,
        type: 'system'
    });
    alert("Admin Task Posted!");
};

window.approveWithdrawal = async (id, amount) => {
    await update(ref(db, `withdrawals/${id}`), { status: 'approved' });
    const statsRef = ref(db, 'stats');
    const statsSnap = await get(statsRef);
    const totalPaid = (statsSnap.val()?.totalPaid || 0) + amount;
    await update(statsRef, { totalPaid });
    alert("Approved!");
};

// WITHDRAWAL LOGIC
window.requestWithdrawal = async () => {
    const amount = parseFloat(document.getElementById('wd-amount').value);
    if (currentUser.balance < amount || amount <= 0) return alert("Insufficient balance");

    const wdRef = push(ref(db, 'withdrawals'));
    await set(wdRef, {
        uid: currentUser.uid,
        amount,
        method: document.getElementById('wd-method').value,
        wallet: document.getElementById('wd-wallet').value,
        status: 'pending',
        timestamp: Date.now()
    });

    currentUser.balance -= amount;
    await update(ref(db, 'users/' + currentUser.uid), { balance: currentUser.balance });
    alert("Withdrawal Requested!");
    updateUI();
};

// REFERRAL LOGIC
window.applyReferral = async () => {
    const code = document.getElementById('input-ref').value.trim().toUpperCase();
    if (currentUser.referredBy) return alert("Already referred!");
    
    const usersSnap = await get(ref(db, 'users'));
    const users = usersSnap.val();
    let referrerUid = null;

    for (let uid in users) {
        if (users[uid].referralCode === code && uid !== currentUser.uid) {
            referrerUid = uid;
            break;
        }
    }

    if (referrerUid) {
        await update(ref(db, 'users/' + currentUser.uid), { referredBy: referrerUid });
        const refRef = ref(db, 'users/' + referrerUid);
        const refSnap = await get(refRef);
        const refCount = (refSnap.val().refCount || 0) + 1;
        await update(refRef, { refCount });
        alert("Referral Applied!");
        initUser();
    } else {
        alert("Invalid Code");
    }
};
