
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

// --- USER MANAGEMENT ---
let username = tg?.initDataUnsafe?.user?.username ? "@" + tg.initDataUnsafe.user.username : "@User_" + Math.random().toString(36).substr(2, 5);
document.getElementById('tg-username').innerText = username;
const userKey = username.replace(/[^a-zA-Z0-9]/g, "");
const userRef = ref(db, `users/${userKey}`);

get(userRef).then(snap => {
    if (!snap.exists()) {
        set(userRef, { 
            balance: 0, totalEarned: 0, inviteCount: 0, 
            refCode: Math.random().toString(36).substr(2, 12).toUpperCase(),
            invitedBy: "", completed: {} 
        });
    }
});

onValue(userRef, (snap) => {
    const d = snap.val();
    if (d) {
        document.getElementById('user-balance').innerText = d.balance.toFixed(2);
        document.getElementById('st-earned').innerText = "₱" + d.totalEarned.toFixed(2);
        document.getElementById('st-invites').innerText = d.inviteCount;
        document.getElementById('ref-display').innerText = d.refCode;
    }
});

// --- NAVIGATION ---
window.switchTab = (id) => {
    document.querySelectorAll('main > div, #view-donate').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('nav button').forEach(el => el.classList.remove('tab-active'));
    document.getElementById(`view-${id}`).classList.remove('hidden');
    const tab = document.getElementById(`t-${id}`);
    if(tab) tab.classList.add('tab-active');
    if(id === 'post') updatePostInfo();
};

// --- POSTING SYSTEM ---
window.updatePostInfo = async () => {
    const type = document.getElementById('p-type').value;
    const count = (await get(ref(db, `counts/${userKey}/${type}`))).val() || 0;
    const pStatus = document.getElementById('p-status');
    pStatus.innerText = count < 5 ? `FREE SLOT: ${5 - count} campaign(s) remaining` : `PAID SLOT: Cost is ₱1.00`;
};

window.handlePost = async () => {
    const type = document.getElementById('p-type').value;
    const url = document.getElementById('p-url').value;
    if (!url.startsWith('http')) return Swal.fire("Invalid Link", "Please paste a full URL", "error");

    const count = (await get(ref(db, `counts/${userKey}/${type}`))).val() || 0;
    let reward = (type === 'yt_sub') ? 0.03 : 0.01;
    let clicks = (type === 'yt_sub') ? 50 : 100;
    let timer = (type === 'playstore') ? 40 : 45;

    if (count >= 5) {
        const u = (await get(userRef)).val();
        if (u.balance < 1) return Swal.fire("Low Funds", "You need ₱1.00", "warning");
        await update(userRef, { balance: increment(-1) });
        clicks = (type === 'yt_sub') ? 65 : 120;
    }

    await push(ref(db, `tasks/${type}`), { url, clicks, reward, timer, owner: userKey });
    await update(ref(db, `counts/${userKey}/${type}`), increment(1));
    Swal.fire("Success", "Your campaign is now live!", "success");
    switchTab('earn');
};

// --- TASK TIMER & PLAYER ---
let activeTask = null;
let timerInt = null;
let remaining = 0;

function getYTID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

window.openTask = (type, id, url, reward, time) => {
    activeTask = { type, id, url, reward, time };
    remaining = time;
    
    document.getElementById('task-modal').classList.remove('hidden');
    document.getElementById('claim-btn').classList.add('hidden');
    document.getElementById('timer-text').innerText = remaining;
    
    const ytId = getYTID(url);
    const container = document.getElementById('yt-player-container');
    if (ytId) {
        container.innerHTML = `<iframe class="yt-frame" src="https://www.youtube.com/embed/${ytId}?autoplay=1&mute=1" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    } else {
        container.innerHTML = `<div class="bg-slate-800 p-8 rounded-2xl mb-4 text-center text-xs text-gray-500">External Content: Open the link and return here.</div>`;
        window.open(url, '_blank');
    }

    startTimer();
};

function startTimer() {
    if (timerInt) clearInterval(timerInt);
    const ring = document.getElementById('timer-ring');
    const total = activeTask.time;

    timerInt = setInterval(() => {
        remaining--;
        document.getElementById('timer-text').innerText = remaining;
        ring.style.strokeDashoffset = 263.8 - (263.8 * (remaining / total));

        if (remaining <= 0) {
            clearInterval(timerInt);
            document.getElementById('claim-btn').classList.remove('hidden');
            document.getElementById('task-msg').innerText = "Task Complete!";
            document.getElementById('timer-text').innerText = "✓";
        }
    }, 1000);
}

window.closeTask = () => {
    clearInterval(timerInt);
    document.getElementById('task-modal').classList.add('hidden');
    document.getElementById('yt-player-container').innerHTML = "";
    activeTask = null;
};

document.getElementById('claim-btn').onclick = async () => {
    const { type, id, reward, url } = activeTask;
    await update(userRef, { balance: increment(reward), totalEarned: increment(reward) });
    
    // Referral Bonus
    const u = (await get(userRef)).val();
    if (u.invitedBy) {
        update(ref(db, `users/${u.invitedBy}`), { balance: increment(reward * 0.2) });
    }

    await set(ref(db, `users/${userKey}/completed/${id}`), true);
    await update(ref(db, `tasks/${type}/${id}`), { clicks: increment(-1) });
    
    closeTask();
    Swal.fire({ title: "Credited!", text: `₱${reward} added. Redirecting...`, icon: "success", timer: 1500 });
    setTimeout(() => { window.location.href = url; }, 1600);
};

// --- ADMIN SYSTEM ---
window.loginAdmin = () => {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
        loadAdminManagement();
    }
};

window.postAdminLink = () => {
    const url = document.getElementById('admin-url').value;
    if (!url) return;
    push(ref(db, `tasks/admin_links`), { url, clicks: 10000, reward: 0.03, timer: 40, owner: "ADMIN" });
    Swal.fire("Global Broadcast", "Link live with 10k clicks!", "info");
};

function loadAdminManagement() {
    onValue(ref(db, 'tasks'), (snap) => {
        const list = document.getElementById('admin-link-list');
        list.innerHTML = "";
        const data = snap.val();
        for (let cat in data) {
            for (let id in data[cat]) {
                const t = data[cat][id];
                const div = document.createElement('div');
                div.className = "bg-slate-900 p-3 rounded-xl flex justify-between items-center text-[10px]";
                div.innerHTML = `<span class="truncate w-40">${t.url}</span><button onclick="delLink('${cat}','${id}')" class="text-red-500 font-bold">DELETE</button>`;
                list.appendChild(div);
            }
        }
    });
}

window.delLink = (cat, id) => {
    Swal.fire({ title: "Delete?", text: "Link will be removed from system", icon: "warning", showCancelButton: true }).then(r => {
        if(r.isConfirmed) remove(ref(db, `tasks/${cat}/${id}`));
    });
};

// --- LIST RENDERING ---
const categories = ['yt_watch', 'yt_sub', 'fb_follow', 'web_visit', 'playstore', 'admin_links'];
categories.forEach(cat => {
    onValue(ref(db, `tasks/${cat}`), async (snap) => {
        const container = document.getElementById(`list-${cat}`);
        if (!container) return;
        container.innerHTML = "";
        const tasks = snap.val();
        const done = (await get(ref(db, `users/${userKey}/completed`))).val() || {};

        for (let id in tasks) {
            if (done[id] || tasks[id].clicks <= 0) continue;
            const t = tasks[id];
            const el = document.createElement('div');
            el.className = "glass-card p-4 rounded-2xl flex justify-between items-center border-l-4 border-yellow-500";
            el.innerHTML = `
                <div class="truncate mr-4">
                    <p class="text-[9px] text-gray-500 truncate w-32 font-mono">${t.url}</p>
                    <p class="text-xs font-black text-white">REWARD: ₱${t.reward.toFixed(2)}</p>
                </div>
                <button onclick="openTask('${cat}','${id}','${t.url}',${t.reward},${t.timer})" class="bg-yellow-500 text-black px-5 py-2 rounded-xl text-[10px] font-black uppercase">Open</button>
            `;
            container.appendChild(el);
        }
    });
});
