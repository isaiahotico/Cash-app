
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
let lastMsgTime = 0;

// Initialize
auth();

function auth() {
    const user = tg.initDataUnsafe?.user || { id: "dev_test", first_name: "Developer", username: "dev_user" };
    document.getElementById('live-username').innerText = `@${user.username || user.first_name}`;
    
    // Using a simplified login for TWA
    firebase.auth().signInAnonymously().then(res => {
        currentUser = res.user;
        syncUser(user);
    });
}

function syncUser(tgUser) {
    const userRef = db.ref('users/' + tgUser.id);
    userRef.on('value', snap => {
        if (!snap.exists()) {
            userRef.set({
                name: tgUser.first_name,
                username: tgUser.username || "anon",
                balance: 0,
                totalEarned: 0,
                weeklyEarned: 0,
                adsWatched: 0,
                refCount: 0,
                refCode: "PH-" + tgUser.id,
                lastAd1: 0,
                lastChatAd: 0,
                lastEntryAd: 0,
                stats: { daily: 0, weekly: 0, total: 0 }
            });
        } else {
            userData = snap.val();
            updateUI();
        }
    });
    
    // Global Startup Ad (3 min cooldown)
    handleStartupAd();
    loadChat();
    loadLeaderboard();
}

function updateUI() {
    document.getElementById('top-balance').innerText = `₱${userData.balance.toFixed(2)}`;
    document.getElementById('total-earned').innerText = `₱${userData.totalEarned.toFixed(2)}`;
    document.getElementById('weekly-stat').innerText = `₱${(userData.weeklyEarned || 0).toFixed(2)}`;
    
    // Profile Sync
    document.getElementById('p-username').innerText = userData.name;
    document.getElementById('p-tg-id').innerText = `@${userData.username}`;
    document.getElementById('stat-total').innerText = userData.stats.total;
    document.getElementById('stat-weekly').innerText = userData.stats.weekly;
    document.getElementById('stat-daily').innerText = userData.stats.daily;
    document.getElementById('p-ref-count').innerText = userData.refCount;
    document.getElementById('p-ref-code').innerText = userData.refCode;
    document.getElementById('p-avatar').innerText = userData.name[0];
}

// THEME CHANGER
const colors = ['#0f172a', '#6d28d9', '#15803d', '#1d4ed8', '#b91c1c', '#a21caf', '#854d0e', '#115e59', '#78350f', '#000000'];
function changeTheme() {
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    document.body.style.setProperty('--main-bg', randomColor);
    document.body.style.background = randomColor;
    // Add brick pattern via CSS class
    document.body.classList.toggle('brick-bg');
}

// AD LOGIC
async function watchAd(type) {
    // Standard Monetag Logic... (from previous version)
    // Placeholder for actual call
    show_10337795().then(() => rewardUser(0.02, 'Standard Ad'));
}

async function handleStartupAd() {
    const now = Date.now();
    if (now - (userData?.lastEntryAd || 0) > 180000) {
        show_10337795({ type: 'inApp' });
        db.ref('users/' + tg.initDataUnsafe.user.id).update({ lastEntryAd: now });
    }
}

// REWARD ANIMATIONS (5 STYLES)
function showRewardAnim(amt) {
    const container = document.getElementById('reward-container');
    const el = document.createElement('div');
    el.className = 'reward-popup font-bold text-2xl text-yellow-400 pointer-events-none';
    el.innerText = `+₱${amt}`;
    container.appendChild(el);

    const styles = [
        () => gsap.to(el, { y: -200, opacity: 0, duration: 2, scale: 2 }),
        () => gsap.fromTo(el, { rotation: -45 }, { rotation: 45, y: -150, opacity: 0, duration: 1.5 }),
        () => gsap.to(el, { scale: 4, filter: 'blur(10px)', opacity: 0, duration: 1 }),
        () => gsap.to(el, { x: 100, y: -100, opacity: 0, duration: 1.5, ease: "bounce" }),
        () => gsap.to(el, { bezier: [{x:0, y:0}, {x:50, y:-50}, {x:-50, y:-100}, {x:0, y:-200}], opacity: 0, duration: 2 })
    ];

    styles[Math.floor(Math.random() * styles.length)]();
    setTimeout(() => el.remove(), 2000);
}

function rewardUser(amt, type) {
    const updates = {};
    const path = 'users/' + tg.initDataUnsafe.user.id + '/';
    updates[path + 'balance'] = userData.balance + amt;
    updates[path + 'totalEarned'] = userData.totalEarned + amt;
    updates[path + 'weeklyEarned'] = (userData.weeklyEarned || 0) + amt;
    updates[path + 'stats/total'] = (userData.stats.total || 0) + 1;
    updates[path + 'stats/weekly'] = (userData.stats.weekly || 0) + 1;
    updates[path + 'stats/daily'] = (userData.stats.daily || 0) + 1;

    db.ref().update(updates);
    showRewardAnim(amt);
    tg.HapticFeedback.notificationOccurred('success');
}

// CHAT SYSTEM (With Ad Reward & 4m Cooldown)
async function sendChatMessage() {
    const now = Date.now();
    const cooldown = 4 * 60000;
    
    if (now - (userData.lastChatAd || 0) < cooldown) {
        alert("Chat reward cooldown active!");
        return;
    }

    const text = document.getElementById('chat-input').value;
    if (!text) return;

    // Trigger 3 Combined Ads (Sequential)
    tg.MainButton.setText("SHOWING ADS...").show();
    try {
        await show_10337795('pop');
        await show_10337795();
        await show_10337795({ type: 'inApp' });
        
        db.ref('chat').push({
            uid: tg.initDataUnsafe.user.id,
            name: userData.name,
            username: userData.username,
            text: text,
            timestamp: now
        });

        rewardUser(0.02, 'Chat Reward');
        db.ref('users/' + tg.initDataUnsafe.user.id).update({ lastChatAd: now });
        document.getElementById('chat-input').value = "";
    } catch (e) {
        alert("Ad interrupted. No reward.");
    }
    tg.MainButton.hide();
}

function loadChat() {
    db.ref('chat').limitToLast(50).on('value', snap => {
        const box = document.getElementById('chat-messages');
        box.innerHTML = `<button onclick="loadMoreMessages()" class="w-full text-xs text-cyan-400 py-2">Load Previous Messages...</button>`;
        snap.forEach(child => {
            const m = child.val();
            const isMe = m.uid == tg.initDataUnsafe.user.id;
            box.innerHTML += `
                <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
                    <span class="text-[9px] text-gray-500" onclick="viewUserProfile('${m.uid}')">@${m.username}</span>
                    <div class="${isMe ? 'bg-cyan-600' : 'bg-white/10'} px-3 py-2 rounded-2xl max-w-[80%]">
                        ${m.text}
                    </div>
                </div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

// LEADERBOARD (Reset logic usually handled by a Cloud Function, here we sort weekly)
function loadLeaderboard() {
    db.ref('users').orderByChild('weeklyEarned').limitToLast(100).on('value', snap => {
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = "";
        let arr = [];
        snap.forEach(d => { arr.push(d.val()); });
        arr.reverse().forEach((u, i) => {
            list.innerHTML += `
                <div class="p-4 flex justify-between items-center bg-white/5 mb-1" onclick="viewUserProfile('${u.refCode.split('-')[1]}')">
                    <div class="flex items-center gap-3">
                        <span class="text-xs font-bold text-cyan-500">#${i+1}</span>
                        <div>
                            <p class="text-sm font-bold">${u.name}</p>
                            <p class="text-[9px] opacity-50">@${u.username}</p>
                        </div>
                    </div>
                    <p class="text-sm font-bold text-green-400">₱${(u.weeklyEarned || 0).toFixed(2)}</p>
                </div>`;
        });
    });
}

function viewUserProfile(uid) {
    db.ref('users/' + uid).once('value', snap => {
        const d = snap.val();
        if(!d) return;
        // Update Profile Tab with this user's info
        document.getElementById('p-username').innerText = d.name;
        document.getElementById('p-tg-id').innerText = `@${d.username}`;
        document.getElementById('stat-total').innerText = d.stats.total;
        document.getElementById('p-ref-count').innerText = d.refCount;
        switchTab('profile');
    });
}

function switchTab(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    event.currentTarget.classList.add('active');
}
