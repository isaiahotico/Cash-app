
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, get, increment } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
const tg = window.Telegram.WebApp;
tg.expand();

// Configuration
const CONFIG = {
    yt_watch:   { label: "YT Watch", reward: 0.01, time: 30, free: 100, paid: 550, cost: 5, field: 'u_yt_w' },
    yt_sub:     { label: "YT Subscribe", reward: 0.03, time: 30, free: 50,  paid: 260,  cost: 5, field: 'u_yt_s' },
    yt_like:    { label: "YT Like", reward: 0.01, time: 30, free: 100, paid: 550, cost: 5, field: 'u_yt_l' },
    yt_comment: { label: "YT Comment", reward: 0.01, time: 30, free: 100, paid: 550, cost: 5, field: 'u_yt_c' },
    fb_follow:  { label: "FB Follow", reward: 0.01, time: 30, free: 100, paid: 550, cost: 5, field: 'u_fb_f' },
    fb_like:    { label: "FB Like Post", reward: 0.01, time: 20, free: 100, paid: 550, cost: 5, field: 'u_fb_l' },
    fb_comment: { label: "FB Comment", reward: 0.01, time: 30, free: 100, paid: 550, cost: 5, field: 'u_fb_c' },
    web_visit:  { label: "Visit Website", reward: 0.01, time: 15, free: 100, paid: 550, cost: 5, field: 'u_web' },
    playstore:  { label: "Playstore Visit", reward: 0.015, time: 20, free: 100, paid: 550, cost: 5, field: 'u_ps' },
    admin_any:  { label: "Admin Link", reward: 0.03, time: 20, free: 10000, paid: 10000, cost: 0, field: 'admin' }
};

const user = tg.initDataUnsafe?.user || { id: "dev_user", username: "DevUser" };
let currentCat = 'yt_watch';
let userData = {};
let player = null;
let timerInt = null;

// Initialization
const userRef = ref(db, 'users/' + user.id);
onValue(userRef, (s) => {
    userData = s.val() || { balance: 0, completed: {}, username: user.username };
    if (!s.exists()) set(userRef, userData);
    document.getElementById('userBalance').innerText = (userData.balance || 0).toFixed(2);
    document.getElementById('tgName').innerText = `@${user.username}`;
    updateApp();
});

// Navigation
document.getElementById('navTasks').onclick = () => {
    document.getElementById('taskView').classList.remove('hidden');
    document.getElementById('profileView').classList.add('hidden');
    document.getElementById('navTasks').classList.add('active-tab');
    document.getElementById('navProfile').classList.remove('active-tab');
};
document.getElementById('navProfile').onclick = () => {
    document.getElementById('taskView').classList.add('hidden');
    document.getElementById('profileView').classList.remove('hidden');
    document.getElementById('navProfile').classList.add('active-tab');
    document.getElementById('navTasks').classList.remove('active-tab');
    renderProfile();
};

window.switchCat = (cat) => {
    currentCat = cat;
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('cat-active'));
    event.target.classList.add('cat-active');
    updateApp();
};

window.adminLogin = () => {
    if(prompt("Admin Password:") === "Propetas12") switchCat('admin_any');
};

function updateApp() {
    const c = CONFIG[currentCat];
    const used = userData[c.field] || 0;
    document.getElementById('catTitle').innerText = c.label;
    document.getElementById('limitText').innerText = `${Math.max(0, 5-used)} FREE SLOTS LEFT`;
    renderQueue();
}

// Renderers
function renderQueue() {
    const list = document.getElementById('queueList');
    onValue(ref(db, `queue/${currentCat}`), (snap) => {
        list.innerHTML = "";
        snap.forEach(child => {
            const item = child.val();
            if (userData.completed?.[child.key]) return;
            if (item.rem <= 0) return;

            const div = document.createElement('div');
            div.className = "bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between";
            div.innerHTML = `
                <div>
                    <p class="text-[10px] text-blue-400 font-bold">@${item.owner}</p>
                    <p class="text-xs font-bold text-slate-300">${item.rem} clicks left</p>
                </div>
                <button onclick="startAction('${child.key}', '${item.url || item.vid}')" class="bg-red-600 text-[10px] font-black px-6 py-2 rounded-xl">OPEN</button>
            `;
            list.appendChild(div);
        });
    });
}

function renderProfile() {
    const list = document.getElementById('myLinksList');
    list.innerHTML = `<p class="text-slate-500 text-xs text-center py-10">Loading your links...</p>`;
    
    // Scan all categories for user's links
    let html = "";
    const cats = Object.keys(CONFIG);
    let found = 0;

    cats.forEach(cKey => {
        get(ref(db, `queue/${cKey}`)).then(snap => {
            snap.forEach(child => {
                const item = child.val();
                if (item.ownerId === user.id) {
                    found++;
                    const div = `
                        <div class="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
                            <div class="flex justify-between mb-2">
                                <span class="text-[10px] font-bold bg-slate-800 px-2 py-0.5 rounded uppercase text-slate-400">${CONFIG[cKey].label}</span>
                                <span class="text-[10px] font-black text-green-500">${item.rem} REMAINING</span>
                            </div>
                            <p class="text-xs text-slate-500 truncate">${item.url || item.vid}</p>
                        </div>`;
                    if(found === 1) list.innerHTML = "";
                    list.innerHTML += div;
                }
            });
        });
    });
}

// Logic
window.startAction = (key, target) => {
    const c = CONFIG[currentCat];
    let time = c.time;
    const modal = document.getElementById('actionModal');
    const timerText = document.getElementById('timer');
    
    modal.classList.remove('hidden');
    document.getElementById('actionType').innerText = c.label;
    document.getElementById('rewardValue').innerText = `Earn ₱${c.reward}`;
    timerText.innerText = time;

    const isYT = currentCat.startsWith('yt');
    if (isYT) {
        document.getElementById('ytContainer').classList.remove('hidden');
        document.getElementById('otherContainer').classList.add('hidden');
        if (!player) {
            player = new YT.Player('player', {
                videoId: target, height: '100%', width: '100%',
                playerVars: { autoplay: 1, controls: 0 },
                events: { onStateChange: (e) => { if(e.data === 1) startTimer(); else stopTimer(); }}
            });
        } else { player.loadVideoById(target); }
    } else {
        document.getElementById('ytContainer').classList.add('hidden');
        document.getElementById('otherContainer').classList.remove('hidden');
        startTimer();
    }

    function startTimer() {
        if (timerInt) return;
        timerInt = setInterval(() => {
            time--;
            timerText.innerText = time;
            if (time <= 0) finalize(key, target);
        }, 1000);
    }
    function stopTimer() { clearInterval(timerInt); timerInt = null; }
};

async function finalize(key, target) {
    clearInterval(timerInt); timerInt = null;
    const c = CONFIG[currentCat];

    // 1. Reward
    await update(userRef, { 
        balance: increment(c.reward),
        [`completed/${key}`]: true,
        total_clicks: increment(1)
    });

    // 2. Decrement Queue
    const refL = ref(db, `queue/${currentCat}/${key}`);
    const snap = await get(refL);
    if (snap.exists()) {
        const r = snap.val().rem - 1;
        if (r <= 0) await set(refL, null);
        else await update(refL, { rem: r });
    }

    // 3. Ads Every 10 clicks
    const total = (userData.total_clicks || 0) + 1;
    if (total % 10 === 0) {
        if (window.Adsgram) window.Adsgram.init({ blockId: "24438" }).show().catch(() => {
            if(window.show_10555663) window.show_10555663();
        });
    }

    // 4. Redirect & Close
    const link = currentCat.startsWith('yt') ? `https://youtube.com/watch?v=${target}` : target;
    tg.openLink(link);
    document.getElementById('actionModal').classList.add('hidden');
}

// Add Link
document.getElementById('addBtn').onclick = async () => {
    const val = document.getElementById('urlInput').value;
    if (!val) return;
    
    const c = CONFIG[currentCat];
    const used = userData[c.field] || 0;
    let cost = (used < 5) ? 0 : c.cost;
    let limit = (used < 5) ? c.free : c.paid;

    if (userData.balance < cost) return alert("Insufficient Balance,Earn 5 Pesos to Get the link!");

    const data = {
        owner: user.username,
        ownerId: user.id,
        rem: limit,
        ts: Date.now()
    };

    if (currentCat.startsWith('yt')) {
        const vid = val.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^& \n<]+)/)?.[1];
        if(!vid) return alert("Invalid YT link");
        data.vid = vid;
    } else { data.url = val; }

    await push(ref(db, `queue/${currentCat}`), data);
    await update(userRef, {
        balance: increment(-cost),
        [c.field]: increment(cost === 0 ? 1 : 0)
    });
    
    document.getElementById('urlInput').value = "";
    alert("Promotion Added Successfully!");
};
