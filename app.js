
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, increment, remove } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-database.js";

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
const tg = window.Telegram?.WebApp;

// --- USER SESSION ---
let username = tg?.initDataUnsafe?.user?.username ? "@" + tg.initDataUnsafe.user.username : "@User_" + Math.floor(1000 + Math.random() * 9000);
document.getElementById('tg-username').innerText = username;

const userKey = username.replace(/[^a-zA-Z0-9]/g, "");
const userRef = ref(db, `users/${userKey}`);
let isAdmin = false;

// Initialize User
get(userRef).then(snap => {
    if (!snap.exists()) {
        set(userRef, { balance: 0, totalEarned: 0, inviteCount: 0, refCode: Math.random().toString(36).substr(2, 12).toUpperCase(), invitedBy: "", completed: {} });
    }
});

onValue(userRef, (snap) => {
    const d = snap.val();
    if (d) {
        document.getElementById('user-balance').innerText = d.balance.toFixed(2);
        document.getElementById('ref-code-display').innerText = d.refCode;
    }
});

// --- TABS ---
window.switchTab = (id) => {
    document.querySelectorAll('main > div, #view-donate').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('tab-active'));
    document.getElementById(id === 'donate' ? 'view-donate' : `view-${id}`).classList.remove('hidden');
    if(id !== 'donate') document.getElementById(`t-${id}`).classList.add('tab-active');
    if (id === 'post') updatePostInfo();
};

// --- POSTING ---
window.updatePostInfo = async () => {
    const type = document.getElementById('p-type').value;
    const countSnap = await get(ref(db, `counts/${userKey}/${type}`));
    const count = countSnap.val() || 0;
    const info = document.getElementById('p-status');
    info.innerText = count < 5 ? `FREE SLOT: ${5 - count} remaining` : `PAID SLOT: ₱1.00 per campaign`;
};

window.handlePost = async () => {
    const type = document.getElementById('p-type').value;
    const url = document.getElementById('p-url').value;
    if (!url.startsWith('http')) return Swal.fire("Error", "Enter valid URL", "error");

    const countSnap = await get(ref(db, `counts/${userKey}/${type}`));
    const count = countSnap.val() || 0;
    
    let reward = (type === 'yt_sub') ? 0.03 : 0.01;
    let clicks = (type === 'yt_sub') ? 50 : 100;
    let timer = (type === 'playstore') ? 40 : 45;

    if (count >= 5) {
        const u = (await get(userRef)).val();
        if (u.balance < 1) return Swal.fire("Low Balance", "Need ₱1.00", "warning");
        await update(userRef, { balance: increment(-1) });
        clicks = (type === 'yt_sub') ? 65 : 120;
    }

    await push(ref(db, `tasks/${type}`), { url, clicks, reward, timer, owner: userKey });
    await update(ref(db, `counts/${userKey}/${type}`), increment(1));
    Swal.fire("Success", "Link added to task list!", "success");
    switchTab('earn');
};

// --- TASK TIMER LOGIC ---
let activeTask = null;
let timerObj = null;
let timeLeft = 0;

window.openTask = (type, id, url, reward, time) => {
    activeTask = { type, id, url, reward, time };
    timeLeft = time;
    
    document.getElementById('task-modal').classList.remove('hidden');
    document.getElementById('claim-redirect-btn').classList.add('hidden');
    document.getElementById('task-status-text').innerText = "Verifying presence...";
    document.getElementById('timer-text').innerText = timeLeft;
    
    startCounter();
};

function startCounter() {
    if (timerObj) clearInterval(timerObj);
    const ring = document.getElementById('timer-ring');
    const total = activeTask.time;
    
    timerObj = setInterval(() => {
        timeLeft--;
        document.getElementById('timer-text').innerText = timeLeft;
        
        // Ring progress
        const offset = 364.4 - (364.4 * (timeLeft / total));
        ring.style.strokeDashoffset = offset;

        if (timeLeft <= 0) {
            clearInterval(timerObj);
            document.getElementById('task-status-text').innerText = "Ready to Claim!";
            document.getElementById('claim-redirect-btn').classList.remove('hidden');
            document.getElementById('timer-text').innerText = "✓";
        }
    }, 1000);
}

window.closeTask = () => {
    clearInterval(timerObj);
    document.getElementById('task-modal').classList.add('hidden');
    activeTask = null;
};

document.getElementById('claim-redirect-btn').onclick = async () => {
    if (!activeTask) return;
    const { type, id, reward, url } = activeTask;

    // Credit User
    await update(userRef, { balance: increment(reward), totalEarned: increment(reward) });
    
    // Credit Referrer (20%)
    const u = (await get(userRef)).val();
    if (u.invitedBy) {
        update(ref(db, `users/${u.invitedBy}`), { balance: increment(reward * 0.2) });
    }

    // Update Task
    await set(ref(db, `users/${userKey}/completed/${id}`), true);
    await update(ref(db, `tasks/${type}/${id}`), { clicks: increment(-1) });

    // Final Redirect
    window.location.href = url;
};

// --- ADMIN MANAGEMENT ---
window.loginAdmin = () => {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        isAdmin = true;
        document.getElementById('admin-gate').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        renderAdminManage();
    }
};

window.postAdminLink = () => {
    const url = document.getElementById('admin-url').value;
    push(ref(db, `tasks/admin_links`), { url, clicks: 10000, reward: 0.03, timer: 40, owner: "ADMIN" });
    Swal.fire("Posted", "Admin 10k Link Active", "info");
};

function renderAdminManage() {
    onValue(ref(db, 'tasks'), (snap) => {
        const list = document.getElementById('admin-manage-list');
        list.innerHTML = "";
        const categories = snap.val();
        for (let cat in categories) {
            for (let id in categories[cat]) {
                const t = categories[cat][id];
                const div = document.createElement('div');
                div.className = "bg-gray-800 p-2 text-[10px] flex justify-between items-center rounded";
                div.innerHTML = `
                    <span class="truncate w-40">${t.url}</span>
                    <button onclick="deleteLink('${cat}','${id}')" class="text-red-500 font-bold uppercase">Delete</button>
                `;
                list.appendChild(div);
            }
        }
    });
}

window.deleteLink = (cat, id) => {
    Swal.fire({ title: 'Delete?', text: "Remove this link from system?", icon: 'warning', showCancelButton: true }).then(res => {
        if(res.isConfirmed) remove(ref(db, `tasks/${cat}/${id}`));
    });
};

// --- RENDER EARN LISTS ---
const cats = ['yt_watch', 'yt_sub', 'fb_follow', 'web_visit', 'playstore', 'admin_links'];
cats.forEach(c => {
    onValue(ref(db, `tasks/${c}`), async (snap) => {
        const container = document.getElementById(`list-${c}`);
        if(!container) return;
        container.innerHTML = "";
        const tasks = snap.val();
        const done = (await get(ref(db, `users/${userKey}/completed`))).val() || {};

        for (let id in tasks) {
            if (done[id] || tasks[id].clicks <= 0) continue;
            const t = tasks[id];
            const el = document.createElement('div');
            el.className = "bg-gray-900 border border-gray-800 p-3 rounded-xl flex justify-between items-center";
            el.innerHTML = `
                <div>
                    <p class="text-[9px] text-gray-500 truncate w-32">${t.url}</p>
                    <p class="text-xs font-bold text-yellow-500">Reward: ₱${t.reward.toFixed(2)}</p>
                </div>
                <button onclick="openTask('${c}','${id}','${t.url}',${t.reward},${t.timer})" class="bg-gray-800 px-4 py-2 rounded-lg text-[10px] font-bold uppercase border border-gray-700">Open</button>
            `;
            container.appendChild(el);
        }
    });
});

// --- REFERRAL REDEEM ---
window.redeemRef = async () => {
    const code = document.getElementById('ref-input').value.trim().toUpperCase();
    const u = (await get(userRef)).val();
    if (u.invitedBy) return Swal.fire("Error", "Already referred", "error");

    const usersSnap = await get(ref(db, 'users'));
    const allUsers = usersSnap.val();
    let parentKey = null;

    for (let k in allUsers) {
        if (allUsers[k].refCode === code && k !== userKey) { parentKey = k; break; }
    }

    if (parentKey) {
        await update(userRef, { invitedBy: parentKey });
        await update(ref(db, `users/${parentKey}`), { inviteCount: increment(1) });
        Swal.fire("Accepted", "You are now a referral", "success");
    } else {
        Swal.fire("Invalid", "Code not found", "error");
    }
};
