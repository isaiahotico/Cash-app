
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, increment } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-database.js";

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

// --- USER INITIALIZATION ---
let username = tg?.initDataUnsafe?.user?.username ? "@" + tg.initDataUnsafe.user.username : "@UnknownUser";
if (username === "@UnknownUser") {
    const saved = localStorage.getItem('paperhouse_user');
    if (saved) username = saved;
    else {
        let n = prompt("Enter Telegram Username:");
        username = n ? (n.startsWith('@') ? n : '@' + n) : "@guest_" + Math.floor(Math.random()*1000);
        localStorage.setItem('paperhouse_user', username);
    }
}
document.getElementById('tg-username').innerText = username;

const userKey = username.replace(/[^a-zA-Z0-9]/g, "");
const userRef = ref(db, `users/${userKey}`);

// Sync User Data
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
    if (!d) return;
    document.getElementById('user-balance').innerText = d.balance.toFixed(2);
    document.getElementById('inv-count').innerText = d.inviteCount || 0;
    document.getElementById('total-earned').innerText = (d.totalEarned || 0).toFixed(2);
    document.getElementById('ref-code-display').innerText = d.refCode;
});

// --- NAVIGATION ---
window.switchTab = (id) => {
    document.querySelectorAll('main > div').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('tab-active'));
    document.getElementById(`view-${id}`).classList.remove('hidden');
    document.getElementById(`t-${id}`).classList.add('tab-active');
    if (id === 'post') updatePostInfo();
};

// --- POSTING SYSTEM ---
window.updatePostInfo = async () => {
    const type = document.getElementById('p-type').value;
    const countSnap = await get(ref(db, `post_counts/${userKey}/${type}`));
    const count = countSnap.val() || 0;
    const statusEl = document.getElementById('p-status');
    
    if (count < 5) {
        statusEl.innerText = `FREE SLOT: You have ${5 - count} free campaigns left for this category.`;
        statusEl.className = "bg-green-500/10 p-3 rounded-lg text-green-400 text-xs font-bold border border-green-500/20";
    } else {
        statusEl.innerText = `PAID SLOT: Cost is ₱1.00 (120 clicks).`;
        statusEl.className = "bg-yellow-500/10 p-3 rounded-lg text-yellow-400 text-xs font-bold border border-yellow-500/20";
    }
};

window.handlePost = async () => {
    const type = document.getElementById('p-type').value;
    const url = document.getElementById('p-url').value;
    if (!url.startsWith('http')) return Swal.fire("Error", "Invalid URL", "error");

    const countSnap = await get(ref(db, `post_counts/${userKey}/${type}`));
    const count = countSnap.val() || 0;
    
    let clicks = 100;
    let timer = 45;
    let reward = 0.01;

    if (type === 'yt_sub') { reward = 0.03; clicks = 50; }
    if (type === 'playstore') { timer = 40; }

    if (count >= 5) {
        const uSnap = await get(userRef);
        if (uSnap.val().balance < 1) return Swal.fire("Insufficient Balance", "You need ₱1.00", "warning");
        await update(userRef, { balance: increment(-1) });
        clicks = (type === 'yt_sub') ? 65 : 120;
    }

    const taskRef = push(ref(db, `tasks/${type}`));
    await set(taskRef, { url, clicks, timer, reward, owner: userKey });
    await update(ref(db, `post_counts/${userKey}/${type}`), increment(1));

    Swal.fire("Success!", "Your link is now live in the task list!", "success");
    document.getElementById('p-url').value = "";
    switchTab('earn');
};

// --- EARNING & TIMER LOGIC ---
let activeT = null;
let timerInt = null;
let remaining = 0;
let adStep = parseInt(localStorage.getItem('ads_triggered') || "0");

const renderList = (cat, containerId) => {
    onValue(ref(db, `tasks/${cat}`), async (snap) => {
        const container = document.getElementById(containerId);
        container.innerHTML = ""; // Clear only this specific list
        const tasks = snap.val();
        const uSnap = await get(ref(db, `users/${userKey}/completed`));
        const done = uSnap.val() || {};

        for (let id in tasks) {
            if (done[id] || tasks[id].clicks <= 0) continue;
            const t = tasks[id];
            const card = document.createElement('div');
            card.className = "bg-slate-800 border border-slate-700 p-4 rounded-2xl flex justify-between items-center shadow-lg";
            card.innerHTML = `
                <div class="truncate mr-4">
                    <p class="text-[10px] text-slate-500 font-mono truncate w-32">${t.url}</p>
                    <p class="text-sm font-bold text-slate-200">Earn ₱${t.reward.toFixed(2)}</p>
                </div>
                <button onclick="openTask('${cat}', '${id}', '${t.url}', ${t.reward}, ${t.timer})" class="bg-blue-600 px-6 py-2 rounded-xl text-xs font-black uppercase">Start</button>
            `;
            container.appendChild(card);
        }
    });
};

window.openTask = (type, id, url, reward, time) => {
    adStep++;
    localStorage.setItem('ads_triggered', adStep);
    if (adStep % 2 === 0) {
        Swal.fire({ title: "Sponsored Ad", text: "Loading reward sponsor...", timer: 2000, showConfirmButton: false });
    }

    activeT = { type, id, url, reward, totalTime: time };
    remaining = time;
    
    document.getElementById('timer-modal').classList.remove('hidden');
    document.getElementById('claim-btn').classList.add('hidden');
    document.getElementById('reward-amt').innerText = reward.toFixed(2);
    
    window.open(url, '_blank');
    startTimer();
};

function startTimer() {
    if (timerInt) clearInterval(timerInt);
    timerInt = setInterval(() => {
        remaining--;
        document.getElementById('timer-num').innerText = remaining;
        
        // Progress ring logic
        const offset = 502 - (502 * (remaining / activeT.totalTime));
        document.getElementById('timer-progress').style.strokeDashoffset = offset;

        if (remaining <= 0) {
            clearInterval(timerInt);
            document.getElementById('claim-btn').classList.remove('hidden');
            document.getElementById('timer-num').innerText = "✓";
        }
    }, 1000);
}

// AUTO PAUSE & REDIRECT LOGIC
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === 'visible' && remaining > 0 && activeT) {
        window.open(activeT.url, '_blank'); // Auto redirect
        startTimer(); // Auto resume
    } else {
        clearInterval(timerInt); // Auto pause
    }
});

document.getElementById('claim-btn').onclick = async () => {
    const { type, id, reward } = activeT;
    await update(userRef, { 
        balance: increment(reward),
        totalEarned: increment(reward)
    });
    
    // Referral Commission (20%)
    const uData = (await get(userRef)).val();
    if (uData.invitedBy) {
        update(ref(db, `users/${uData.invitedBy}`), { balance: increment(reward * 0.2) });
    }

    await set(ref(db, `users/${userKey}/completed/${id}`), true);
    await update(ref(db, `tasks/${type}/${id}`), { clicks: increment(-1) });

    document.getElementById('timer-modal').classList.add('hidden');
    activeT = null;
    Swal.fire("Reward Claimed!", `₱${reward} added to balance`, "success");
};

// --- REFERRALS ---
window.redeemRef = async () => {
    const code = document.getElementById('ref-input').value.trim().toUpperCase();
    const uSnap = await get(userRef);
    if (uSnap.val().invitedBy) return Swal.fire("Error", "You were already referred", "error");

    const usersSnap = await get(ref(db, 'users'));
    const users = usersSnap.val();
    let parent = null;
    for (let k in users) {
        if (users[k].refCode === code && k !== userKey) { parent = k; break; }
    }

    if (parent) {
        await update(userRef, { invitedBy: parent });
        await update(ref(db, `users/${parent}`), { inviteCount: increment(1) });
        Swal.fire("Success", "Referral link bound!", "success");
    } else {
        Swal.fire("Failed", "Invalid Code", "error");
    }
};

// --- ADMIN ---
window.loginAdmin = () => {
    if (document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-gate').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
    }
};
window.postAdminLink = () => {
    const url = document.getElementById('admin-url').value;
    push(ref(db, `tasks/admin_links`), { url, clicks: 10000, timer: 40, reward: 0.03, owner: 'ADMIN' });
    Swal.fire("Global Blast!", "Admin link posted with 10,000 clicks", "info");
};

// Initial Render
['yt_watch', 'yt_sub', 'fb_follow', 'web_visit', 'playstore', 'admin_links'].forEach(c => renderList(c, `list-${c}`));
