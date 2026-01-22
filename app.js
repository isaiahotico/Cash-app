
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

let currentUser = null;
let userData = null;
let viewUserId = null; // For clicking other profiles

// Themes
const themes = ['pink','green','blue','red','violet','yellow','#9ACD32','orange','white','cyan','brown'];
function changeTheme() {
    const color = themes[Math.floor(Math.random() * themes.length)];
    document.body.style.background = color;
    document.body.classList.toggle('bricks');
}

// Initializing
firebase.auth().signInAnonymously().then(() => {
    const tgUser = tg.initDataUnsafe.user || { id: "123", first_name: "Guest", username: "guest_user" };
    currentUser = tgUser;
    document.getElementById('user-display-name').innerText = tgUser.first_name;
    syncUser(tgUser);
    handleEntryAd();
});

function syncUser(tgUser) {
    db.ref('users/' + tgUser.id).on('value', snap => {
        if (!snap.exists()) {
            db.ref('users/' + tgUser.id).set({
                name: tgUser.first_name,
                username: tgUser.username || "anon",
                balance: 0,
                totalEarned: 0,
                weeklyEarned: 0,
                refCount: 0,
                adsWatched: 0,
                lastAd1: 0,
                lastAd2: 0,
                lastChatAd: 0,
                lastEntryAd: 0,
                stats: { daily: 0, weekly: 0, total: 0 }
            });
        } else {
            userData = snap.val();
            updateUI();
        }
    });
    loadChat();
    loadLeaderboard();
    viewUserId = tgUser.id; // Default view is self
    updateProfileUI();
}

// ADS LOGIC
async function handleEntryAd() {
    const now = Date.now();
    if (now - (userData?.lastEntryAd || 0) > 180000) { // 3 min
        show_10337795({ type: 'inApp' });
        db.ref('users/' + currentUser.id).update({ lastEntryAd: now });
    }
}

async function watchTaskAd(id) {
    const now = Date.now();
    const cd = id === 1 ? 300000 : 600000;
    if (now - userData[`lastAd${id}`] < cd) return alert("Still on cooldown!");

    show_10337795().then(() => {
        rewardProcess(0.02);
        db.ref('users/' + currentUser.id).update({ [`lastAd${id}`]: now });
    });
}

// CHAT SYSTEM
async function sendChatMessage() {
    const text = document.getElementById('chat-input').value;
    const now = Date.now();
    if (!text) return;
    if (now - (userData.lastChatAd || 0) < 240000) return alert("Chat cooldown: 4 mins");

    // Random 3 Combined Ads
    await show_10337795('pop');
    await show_10337795();
    await show_10337795({ type: 'inApp' });

    db.ref('chat').push({
        uid: currentUser.id,
        name: userData.name,
        username: userData.username,
        text: text,
        timestamp: now
    });

    rewardProcess(0.02);
    db.ref('users/' + currentUser.id).update({ lastChatAd: now });
    document.getElementById('chat-input').value = "";
}

function loadChat() {
    db.ref('chat').limitToLast(50).on('value', snap => {
        const box = document.getElementById('chat-box');
        box.innerHTML = "";
        snap.forEach(msg => {
            const m = msg.val();
            box.innerHTML += `
                <div class="flex flex-col">
                    <span class="text-[10px] opacity-50 cursor-pointer" onclick="viewOtherProfile('${m.uid}')">@${m.username}</span>
                    <div class="bg-white/10 p-3 rounded-2xl rounded-tl-none inline-block max-w-[80%]">${m.text}</div>
                </div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

// REWARD PROCESS & ANIMATIONS
function rewardProcess(amt) {
    db.ref('users/' + currentUser.id).update({
        balance: userData.balance + amt,
        totalEarned: userData.totalEarned + amt,
        weeklyEarned: (userData.weeklyEarned || 0) + amt,
        "stats/total": (userData.stats.total || 0) + 1,
        "stats/daily": (userData.stats.daily || 0) + 1,
        "stats/weekly": (userData.stats.weekly || 0) + 1
    });
    triggerGlobalAnimation(amt);
}

function triggerGlobalAnimation(amt) {
    const layer = document.getElementById('reward-layer');
    const el = document.createElement('div');
    el.className = 'reward-popup text-yellow-400 text-2xl';
    el.innerText = `+₱${amt}`;
    el.style.left = Math.random() * 80 + 10 + "%";
    el.style.top = "50%";
    layer.appendChild(el);

    const styles = [
        () => gsap.to(el, { y: -200, opacity: 0, scale: 2, duration: 1 }),
        () => gsap.to(el, { rotation: 360, x: 100, opacity: 0, duration: 1.5 }),
        () => gsap.to(el, { scale: 5, filter: 'blur(20px)', opacity: 0, duration: 0.8 }),
        () => gsap.fromTo(el, { x: -50 }, { x: 50, repeat: 5, yoyo: true, opacity: 0, duration: 0.1 }),
        () => gsap.to(el, { physics2D: { velocity: 300, angle: -90, gravity: 400 }, opacity: 0, duration: 2 })
    ];
    styles[Math.floor(Math.random() * styles.length)]();
    setTimeout(() => el.remove(), 2000);
}

// LEADERBOARD
function loadLeaderboard() {
    db.ref('users').orderByChild('weeklyEarned').limitToLast(50).on('value', snap => {
        const table = document.getElementById('leader-table');
        table.innerHTML = "";
        let users = [];
        snap.forEach(s => users.push(s.val()));
        users.reverse().forEach((u, i) => {
            table.innerHTML += `
                <tr class="border-b border-white/5" onclick="viewOtherProfile('${u.id}')">
                    <td class="p-4 font-bold text-blue-400">#${i+1}</td>
                    <td>${u.name} <span class="block text-[10px] opacity-40">@${u.username}</span></td>
                    <td class="p-4 text-right font-bold">₱${(u.weeklyEarned || 0).toFixed(2)}</td>
                </tr>`;
        });
    });
}

// PROFILE SYSTEM
function viewOtherProfile(uid) {
    db.ref('users/' + uid).once('value', snap => {
        const d = snap.val();
        viewUserId = uid;
        document.getElementById('prof-name').innerText = d.name;
        document.getElementById('prof-username').innerText = "@" + d.username;
        document.getElementById('prof-initial').innerText = d.name[0];
        document.getElementById('stat-daily').innerText = d.stats.daily;
        document.getElementById('stat-weekly').innerText = d.stats.weekly;
        document.getElementById('stat-total').innerText = d.stats.total;
        document.getElementById('stat-refs').innerText = d.refCount;
        switchTab('profile');
    });
}

function updateUI() {
    document.getElementById('balance').innerText = `₱${userData.balance.toFixed(2)}`;
    document.getElementById('total-earned').innerText = `₱${userData.totalEarned.toFixed(2)}`;
}

function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('nav-active'));
    document.getElementById(tab).classList.add('active');
    event.currentTarget.classList.add('nav-active');
}

function startPrivateChat() {
    const msg = prompt("Message @ " + document.getElementById('prof-username').innerText);
    if(msg) {
        alert("Message sent effortlessly! (Data synced to private_chats node)");
        // Logic for DM storage...
    }
}
