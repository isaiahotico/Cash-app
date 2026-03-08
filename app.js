
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

// --- User Core ---
let tgUser = "User_" + Math.random().toString(36).substr(2, 5);
// Try to get Telegram Username from WebApp
if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe.user) {
    tgUser = "@" + window.Telegram.WebApp.initDataUnsafe.user.username;
} else {
    // Fallback/Demo: Auto-prompt once
    if (!localStorage.getItem('tg_username')) {
        let name = prompt("Enter Telegram Username (@name):");
        if(name) localStorage.setItem('tg_username', name);
    }
    tgUser = localStorage.getItem('tg_username') || tgUser;
}
document.getElementById('top-tg-user').innerText = tgUser;

const userKey = tgUser.replace(/[^a-zA-Z0-9]/g, "");
const userRef = ref(db, `users/${userKey}`);

// --- Referral Code Generator ---
function genRef(length = 12) {
    return Math.random().toString(36).substr(2, length).toUpperCase();
}

// Initialize Profile
get(userRef).then(snap => {
    if (!snap.exists()) {
        set(userRef, {
            balance: 0,
            totalEarned: 0,
            inviteCount: 0,
            refCode: genRef(),
            invitedBy: "",
            completed: {}
        });
    }
});

// Realtime UI Updates
onValue(userRef, (snap) => {
    const data = snap.val();
    if(data) {
        document.getElementById('user-balance').innerText = data.balance.toFixed(2);
        document.getElementById('total-earned').innerText = (data.totalEarned || 0).toFixed(2);
        document.getElementById('invite-count').innerText = data.inviteCount || 0;
        document.getElementById('my-ref-code').innerText = data.refCode;
    }
});

// --- Tab Logic ---
window.switchTab = (id) => {
    document.querySelectorAll('main > section').forEach(s => s.classList.add('hidden'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active-tab'));
    document.getElementById(`section-${id}`).classList.remove('hidden');
    document.getElementById(`tab-${id}`).classList.add('active-tab');
    if(id === 'promote') updatePromoInfo();
};

// --- Promotion Logic ---
async function updatePromoInfo() {
    const type = document.getElementById('promo-type').value;
    const snap = await get(ref(db, `counts/${userKey}/${type}`));
    const count = snap.val() || 0;
    const info = document.getElementById('promo-info');
    if(count < 5) {
        info.innerText = `FREE LINKS: ${5 - count} remaining (100-50 Clicks)`;
    } else {
        info.innerText = `COST: ₱1.00 (120 Clicks)`;
    }
}
document.getElementById('promo-type').addEventListener('change', updatePromoInfo);

window.submitLink = async () => {
    const type = document.getElementById('promo-type').value;
    const url = document.getElementById('promo-url').value;
    if(!url.includes('http')) return alert("Invalid URL");

    const snap = await get(ref(db, `counts/${userKey}/${type}`));
    const count = snap.val() || 0;
    let reward = 0.01;
    let clicks = 100;
    let timer = 45;

    if(type === 'yt_sub') { reward = 0.03; clicks = 50; }
    if(type === 'playstore') { timer = 40; }

    if(count >= 5) {
        const uSnap = await get(userRef);
        if(uSnap.val().balance < 1) return alert("Insufficient Balance (Need ₱1)");
        update(userRef, { balance: increment(-1) });
        clicks = (type === 'yt_sub') ? 65 : 120;
    }

    const newTask = push(ref(db, `tasks/${type}`));
    set(newTask, { url, clicks, reward, timer, owner: userKey });
    update(ref(db, `counts/${userKey}/${type}`), increment(1));
    alert("Posted Successfully!");
    switchTab('earn');
};

// --- Earning / Timer Logic ---
let activeTask = null;
let timerInterval = null;
let timeLeft = 0;
let adCounter = parseInt(localStorage.getItem('ad_counter') || "0");

window.startTask = (type, id, url, reward, time) => {
    // Ad logic: Every 2 clicks
    adCounter++;
    localStorage.setItem('ad_counter', adCounter);
    if(adCounter % 2 === 0) {
        if(window.AdController) window.AdController.show(); // Adsgram/Libtl Placeholder
        alert("Loading Sponsor Ad...");
    }

    activeTask = { type, id, url, reward };
    timeLeft = time;
    
    document.getElementById('timer-overlay').classList.remove('hidden');
    document.getElementById('claim-reward-btn').classList.add('hidden');
    document.getElementById('countdown-circle').innerText = timeLeft;
    
    window.open(url, '_blank');
    resumeTimer();
};

function resumeTimer() {
    if(timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        timeLeft--;
        document.getElementById('countdown-circle').innerText = timeLeft;
        if(timeLeft <= 0) {
            clearInterval(timerInterval);
            document.getElementById('claim-reward-btn').classList.remove('hidden');
            document.getElementById('timer-status').innerText = "DONE!";
        }
    }, 1000);
}

// Pause/Redirect Logic
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === 'visible' && timeLeft > 0 && activeTask) {
        // Returned to tab but timer not done
        window.open(activeTask.url, '_blank');
        resumeTimer();
    } else {
        clearInterval(timerInterval);
    }
});

document.getElementById('claim-reward-btn').onclick = async () => {
    if(!activeTask) return;
    
    // Reward user
    await update(userRef, { 
        balance: increment(activeTask.reward),
        totalEarned: increment(activeTask.reward)
    });
    
    // Referral Bonus (20%)
    const uSnap = await get(userRef);
    const invitedBy = uSnap.val().invitedBy;
    if(invitedBy) {
        update(ref(db, `users/${invitedBy}`), {
            balance: increment(activeTask.reward * 0.20)
        });
    }

    // Mark completed & deduct click
    set(ref(db, `users/${userKey}/completed/${activeTask.id}`), true);
    update(ref(db, `tasks/${activeTask.type}/${activeTask.id}`), { clicks: increment(-1) });

    document.getElementById('timer-overlay').classList.add('hidden');
    activeTask = null;
    alert("Reward Credited!");
};

// --- Render Lists ---
function initLists() {
    const cats = ['yt_watch', 'yt_sub', 'fb_follow', 'web_visit', 'playstore', 'admin_link'];
    onValue(ref(db, 'tasks'), async (snapshot) => {
        const uSnap = await get(ref(db, `users/${userKey}/completed`));
        const done = uSnap.val() || {};
        
        cats.forEach(cat => {
            const container = document.getElementById(`list-${cat}`);
            if(!container) return;
            container.innerHTML = "";
            const tasks = snapshot.child(cat).val();
            
            for(let id in tasks) {
                if(done[id] || tasks[id].clicks <= 0) continue;
                const t = tasks[id];
                const div = document.createElement('div');
                div.className = "bg-slate-800 p-3 rounded flex justify-between items-center border-l-4 border-yellow-500";
                div.innerHTML = `
                    <div class="overflow-hidden">
                        <p class="text-[10px] text-gray-400 truncate w-40">${t.url}</p>
                        <p class="text-[10px] text-yellow-500 font-bold">${t.clicks} clicks left</p>
                    </div>
                    <button onclick="startTask('${cat}','${id}','${t.url}',${t.reward},${t.timer})" class="bg-yellow-500 text-black text-xs font-black px-4 py-2 rounded">OPEN</button>
                `;
                container.appendChild(div);
            }
        });
    });
}

// --- Referral System ---
window.applyReferral = async () => {
    const code = document.getElementById('input-ref').value.trim().toUpperCase();
    const uSnap = await get(userRef);
    if(uSnap.val().invitedBy) return alert("Already referred!");

    const usersSnap = await get(ref(db, 'users'));
    const allUsers = usersSnap.val();
    let ownerKey = null;

    for(let k in allUsers) {
        if(allUsers[k].refCode === code && k !== userKey) {
            ownerKey = k;
            break;
        }
    }

    if(ownerKey) {
        update(userRef, { invitedBy: ownerKey });
        update(ref(db, `users/${ownerKey}`), { inviteCount: increment(1) });
        alert("Referral Applied! You are now supporting your friend.");
    } else {
        alert("Invalid Code!");
    }
};

// --- Admin Panel ---
window.checkAdmin = () => {
    if(document.getElementById('admin-pass').value === "Propetas12") {
        document.getElementById('admin-login').classList.add('hidden');
        document.getElementById('admin-panel').classList.remove('hidden');
    }
};

window.submitAdminLink = () => {
    const url = document.getElementById('admin-url').value;
    const newTask = push(ref(db, `tasks/admin_link`));
    set(newTask, { url, clicks: 10000, reward: 0.03, timer: 40, owner: 'admin' });
    alert("Admin Link Broadcasted!");
};

initLists();
