
const firebaseConfig = {
  apiKey: "AIzaSyB6Z3M4CAQ2R6RfKHOrbETfE8Xe5QYU0nM",
  authDomain: "cash-project-e6b2d.firebaseapp.com",
  databaseURL: "https://cash-project-e6b2d-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "cash-project-e6b2d",
  storageBucket: "cash-project-e6b2d.firebasestorage.app",
  messagingSenderId: "1093594776093",
  appId: "1:1093594776093:web:127d0c279e813c294c7cf4"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const tg = window.Telegram.WebApp;
tg.expand();

let uData = null;
let userId = null;

// INITIALIZE APP
firebase.auth().signInAnonymously().then(() => {
    const user = tg.initDataUnsafe?.user || { id: "8888", first_name: "Developer", username: "dev_pro" };
    userId = user.id;
    document.getElementById('top-username').innerText = user.first_name.toUpperCase();
    document.getElementById('user-pfp').innerText = user.first_name[0];
    
    syncUser(user);
    setupPresence();
    handleEntryAd();
});

function syncUser(user) {
    const userRef = db.ref('users/' + userId);
    userRef.on('value', snap => {
        if (!snap.exists()) {
            userRef.set({
                name: user.first_name,
                username: user.username || "anon",
                balance: 0,
                totalEarned: 0,
                weeklyEarned: 0,
                lastAd1: 0,
                lastChatAd: 0,
                lastEntryAd: 0,
                adsWatched: 0,
                weeklyAds: 0,
                isOnline: true
            });
        } else {
            uData = snap.val();
            updateGlobalUI();
        }
    });
    
    loadChat();
    loadLeaderboard();
    setInterval(updateTimers, 1000);
}

// REAL-TIME UI UPDATES
function updateGlobalUI() {
    document.getElementById('balance-display').innerText = `₱${uData.balance.toFixed(2)}`;
    document.getElementById('overall-earned').innerText = `₱${uData.totalEarned.toFixed(2)}`;
    
    // Profile
    document.getElementById('p-full-name').innerText = uData.name;
    document.getElementById('p-handle').innerText = "@" + uData.username;
    document.getElementById('p-total-ads').innerText = uData.adsWatched;
    document.getElementById('p-weekly-ads').innerText = uData.weeklyAds;
    document.getElementById('p-initial').innerText = uData.name[0];
}

// THEME & STYLE
const themes = ['#0f172a', '#b91c1c', '#15803d', '#1d4ed8', '#701a75', '#854d0e', '#0369a1', '#be185d', '#000', '#431407'];
function changeTheme() {
    const color = themes[Math.floor(Math.random() * themes.length)];
    document.body.style.background = color;
    document.body.classList.toggle('bricks');
}

// ONLINE PRESENCE
function setupPresence() {
    const onlineRef = db.ref('users/' + userId + '/isOnline');
    const countRef = db.ref('presence/count');
    
    db.ref('.info/connected').on('value', snap => {
        if (snap.val() === true) {
            onlineRef.onDisconnect().set(false);
            onlineRef.set(true);
            countRef.transaction(c => (c || 0) + 1);
            countRef.onDisconnect().transaction(c => (c || 0) - 1);
        }
    });
    
    countRef.on('value', snap => {
        document.getElementById('online-count').innerText = `${snap.val() || 0} Online`;
    });
}

// ADS LOGIC
async function handleEntryAd() {
    const now = Date.now();
    if (now - (uData?.lastEntryAd || 0) > 180000) {
        show_10337795({ type: 'inApp' });
        db.ref('users/' + userId).update({ lastEntryAd: now });
    }
}

async function triggerAdTask(id) {
    const now = Date.now();
    if (now - (uData[`lastAd${id}`] || 0) < 300000) return;

    show_10337795().then(() => {
        giveReward(0.02);
        db.ref('users/' + userId).update({ [`lastAd${id}`]: now });
    });
}

function giveReward(amt) {
    db.ref('users/' + userId).transaction(u => {
        if (u) {
            u.balance += amt;
            u.totalEarned += amt;
            u.weeklyEarned = (u.weeklyEarned || 0) + amt;
            u.adsWatched = (u.adsWatched || 0) + 1;
            u.weeklyAds = (u.weeklyAds || 0) + 1;
        }
        return u;
    });
    popAnim(amt);
}

// WORLD CLASS CHAT
async function sendWorldChat() {
    const msg = document.getElementById('chat-msg').value;
    const now = Date.now();
    if (!msg || now - (uData.lastChatAd || 0) < 240000) return;

    tg.MainButton.setText("WATCHING ADS...").show();
    try {
        await show_10337795('pop');
        await show_10337795();
        await show_10337795({ type: 'inApp' });

        db.ref('chat').push({
            uid: userId,
            name: uData.name,
            username: uData.username,
            text: msg,
            timestamp: now
        });

        giveReward(0.02);
        db.ref('users/' + userId).update({ lastChatAd: now });
        document.getElementById('chat-msg').value = "";
    } catch (e) { alert("Ad interrupted!"); }
    tg.MainButton.hide();
}

function loadChat() {
    db.ref('chat').limitToLast(50).on('value', snap => {
        const box = document.getElementById('chat-display');
        box.innerHTML = "";
        snap.forEach(msg => {
            const m = msg.val();
            const isMe = m.uid == userId;
            box.innerHTML += `
                <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                    <span class="text-[9px] opacity-40 mb-1" onclick="viewUser('${m.uid}')">@${m.username}</span>
                    <div class="${isMe ? 'bg-cyan-600' : 'bg-white/10'} p-3 rounded-2xl rounded-${isMe?'tr':'tl'}-none max-w-[85%]">
                        ${m.text}
                    </div>
                </div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

// LEADERBOARD
function loadLeaderboard() {
    db.ref('users').orderByChild('weeklyEarned').limitToLast(100).on('value', snap => {
        const list = document.getElementById('leader-list');
        list.innerHTML = "";
        let users = [];
        snap.forEach(s => users.push(s.val()));
        users.reverse().forEach((u, i) => {
            list.innerHTML += `
                <div class="p-4 flex justify-between items-center" onclick="viewUser('${u.uid}')">
                    <div class="flex items-center gap-3">
                        <span class="text-xs font-black text-cyan-500 italic">#${i+1}</span>
                        <div>
                            <p class="text-sm font-bold">${u.name}</p>
                            <p class="text-[9px] opacity-40">@${u.username}</p>
                        </div>
                    </div>
                    <p class="text-sm font-black text-green-400">₱${(u.weeklyEarned || 0).toFixed(2)}</p>
                </div>`;
        });
    });
}

// WITHDRAWAL SYSTEM
function requestWithdrawal() {
    const num = document.getElementById('gcash-num').value;
    const amt = parseFloat(document.getElementById('gcash-amt').value);

    if (amt < 1 || uData.balance < amt) return alert("Invalid amount or balance!");

    db.ref('withdrawals').push({
        uid: userId,
        name: uData.name,
        number: num,
        amount: amt,
        status: 'pending',
        timestamp: Date.now()
    });

    db.ref('users/' + userId + '/balance').transaction(b => b - amt);
    alert("Withdrawal submitted for review!");
}

// ADMIN PANEL
function openAdmin() {
    const pass = prompt("Enter Terminal Password:");
    if (pass === "Propetas12") {
        switchTab('admin');
        loadAdminData();
    }
}

function loadAdminData() {
    db.ref('withdrawals').orderByChild('status').equalTo('pending').on('value', snap => {
        const box = document.getElementById('admin-withdrawals');
        box.innerHTML = "";
        snap.forEach(w => {
            const data = w.val();
            box.innerHTML += `
                <div class="bg-white/5 p-4 rounded-xl border border-white/10">
                    <p class="text-xs font-bold">${data.name} - ${data.number}</p>
                    <p class="text-lg font-black text-green-400">₱${data.amount}</p>
                    <div class="flex gap-2 mt-2">
                        <button onclick="updateWithdraw('${w.key}', 'approved')" class="flex-1 bg-green-600 py-2 rounded font-bold text-xs">APPROVE</button>
                        <button onclick="updateWithdraw('${w.key}', 'rejected')" class="flex-1 bg-red-600 py-2 rounded font-bold text-xs">REJECT</button>
                    </div>
                </div>`;
        });
    });
}

function updateWithdraw(key, status) {
    db.ref('withdrawals/' + key).update({ status: status });
    if(status === 'rejected') {
        db.ref('withdrawals/' + key).once('value', s => {
            db.ref('users/' + s.val().uid + '/balance').transaction(b => b + s.val().amount);
        });
    }
}

// ANIMATIONS
function popAnim(amt) {
    const el = document.createElement('div');
    el.className = 'reward-popup text-yellow-400 text-3xl';
    el.innerText = `+₱${amt}`;
    el.style.left = Math.random() * 70 + 15 + "%";
    el.style.top = "60%";
    document.getElementById('fx-layer').appendChild(el);
    
    const animations = [
        () => gsap.to(el, { y: -300, opacity: 0, scale: 2, duration: 1.5 }),
        () => gsap.to(el, { x: 100, y: -200, rotation: 360, opacity: 0, duration: 1 }),
        () => gsap.to(el, { scale: 5, filter: "blur(20px)", opacity: 0, duration: 1 }),
        () => gsap.to(el, { y: -100, x: -100, ease: "bounce", opacity: 0, duration: 2 }),
        () => gsap.to(el, { y: -400, opacity: 0, fontSize: "80px", duration: 1 })
    ];
    animations[Math.floor(Math.random() * animations.length)]();
    setTimeout(() => el.remove(), 2000);
}

// UTILS
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tab).classList.add('active');
    event.currentTarget?.classList.add('active');
}

function updateTimers() {
    if(!uData) return;
    const now = Date.now();
    const elapsedChat = now - (uData.lastChatAd || 0);
    if(elapsedChat < 240000) {
        document.querySelector('#chat p').innerText = `Cooldown: ${Math.ceil((240000 - elapsedChat)/1000)}s`;
    } else {
        document.querySelector('#chat p').innerText = `Send message + 3 Ads = ₱0.02 Reward`;
    }
}
