
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// Telegram Username Detection
const tg = window.Telegram.WebApp;
tg.expand();
let telegramUser = tg.initDataUnsafe?.user?.username || localStorage.getItem('tg_username');

if (!telegramUser) {
    telegramUser = prompt("Enter your Telegram @username:") || "User" + Math.floor(Math.random()*1000);
    localStorage.setItem('tg_username', telegramUser);
}
if (!telegramUser.startsWith('@')) telegramUser = '@' + telegramUser;

const userId = telegramUser.replace('@', '').toLowerCase();
let currentUserData = null;
let player = null;
let watchInterval = null;

// Initialize User in Firebase
function syncUser() {
    const userRef = ref(db, `users/${userId}`);
    onValue(userRef, (snap) => {
        if (!snap.exists()) {
            const refCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            set(userRef, {
                username: telegramUser,
                balance: 0,
                totalInvites: 0,
                totalRefEarned: 0,
                referralCode: refCode,
                linksPosted: 0,
                invitedBy: ""
            });
        } else {
            currentUserData = snap.val();
            updateUI();
        }
    });
}

function updateUI() {
    document.getElementById('display-username').innerText = currentUserData.username;
    document.getElementById('balance').innerText = currentUserData.balance.toFixed(2);
    document.getElementById('my-ref-code').innerText = currentUserData.referralCode;
    document.getElementById('total-invites').innerText = currentUserData.totalInvites;
    document.getElementById('total-ref-earned').innerText = currentUserData.totalRefEarned.toFixed(2);

    const postBtn = document.getElementById('post-btn');
    const status = document.getElementById('post-status');
    if (currentUserData.linksPosted < 5) {
        status.innerText = "FREE";
        postBtn.innerText = `Post Free (${5 - currentUserData.linksPosted} left)`;
    } else {
        status.innerText = "PREMIUM";
        status.className = "text-[10px] text-blue-500 bg-blue-50 px-2 py-1 rounded";
        postBtn.innerText = "Post Link (5.00 PHP)";
    }
}

// Global Referral Logic
window.submitReferral = async () => {
    const code = document.getElementById('input-ref-code').value.trim().toUpperCase();
    if (currentUserData.invitedBy) return alert("Referral already applied!");
    if (code === currentUserData.referralCode) return alert("Cannot use own code!");

    const usersRef = ref(db, 'users');
    const snap = await get(usersRef);
    const users = snap.val();
    
    let inviterId = null;
    for (let id in users) {
        if (users[id].referralCode === code) { inviterId = id; break; }
    }

    if (inviterId) {
        await update(ref(db, `users/${userId}`), { invitedBy: inviterId });
        await update(ref(db, `users/${inviterId}`), { totalInvites: increment(1) });
        alert("Referral Applied! Your inviter will get 20% of your earnings.");
    } else {
        alert("Invalid Referral Code");
    }
};

// YouTube URL ID Extractor
function getYTId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// Watch & Reward Logic
window.watchVideo = (adKey, url) => {
    const videoId = getYTId(url);
    if (!videoId) return alert("Invalid Video ID");

    document.getElementById('video-overlay').style.display = 'flex';
    let timeLeft = 30;
    document.getElementById('timer').innerText = timeLeft;

    // Reset Container
    document.getElementById('yt-player-container').innerHTML = '<div id="player"></div>';

    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: { 'autoplay': 1, 'controls': 0, 'modestbranding': 1, 'rel': 0 },
        events: {
            'onStateChange': (event) => {
                if (event.data == YT.PlayerState.PLAYING && !watchInterval) {
                    watchInterval = setInterval(() => {
                        timeLeft--;
                        document.getElementById('timer').innerText = timeLeft;
                        if (timeLeft <= 0) {
                            clearInterval(watchInterval);
                            processReward(adKey, url);
                        }
                    }, 1000);
                } else if (event.data == YT.PlayerState.PAUSED || event.data == YT.PlayerState.BUFFERING) {
                    clearInterval(watchInterval);
                    watchInterval = null;
                }
            }
        }
    });
};

async function processReward(adKey, url) {
    const reward = 0.01;
    const comm = reward * 0.20;

    // 1. Pay User
    await update(ref(db, `users/${userId}`), { balance: increment(reward) });

    // 2. Pay Inviter
    if (currentUserData.invitedBy) {
        await update(ref(db, `users/${currentUserData.invitedBy}`), { 
            balance: increment(comm),
            totalRefEarned: increment(comm)
        });
    }

    // 3. Update Ad
    const adRef = ref(db, `queue/${adKey}`);
    const adSnap = await get(adRef);
    if (adSnap.exists()) {
        const remaining = adSnap.val().viewsLeft - 1;
        if (remaining <= 0) {
            await set(adRef, null);
        } else {
            await update(adRef, { viewsLeft: remaining });
        }
    }

    tg.HapticFeedback.notificationOccurred('success');
    closePlayer();
    window.location.href = url; // Redirect to YouTube
}

window.closePlayer = () => {
    clearInterval(watchInterval);
    watchInterval = null;
    document.getElementById('video-overlay').style.display = 'none';
    if (player) {
        try { player.destroy(); } catch(e) {}
    }
};

// Queue Management
function loadQueue() {
    onValue(ref(db, 'queue'), (snap) => {
        const list = document.getElementById('video-list');
        list.innerHTML = '';
        const data = snap.val();
        if (!data) {
            list.innerHTML = '<div class="text-center py-10 opacity-40">No ads available</div>';
            return;
        }
        Object.keys(data).forEach(key => {
            const ad = data[key];
            const div = document.createElement('div');
            div.className = "bg-white p-4 rounded-3xl flex justify-between items-center shadow-sm border border-slate-100";
            div.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 font-bold">▶</div>
                    <div>
                        <p class="text-[10px] font-bold text-slate-400 uppercase">From ${ad.ownerName}</p>
                        <p class="text-xs font-bold">${ad.viewsLeft} views left</p>
                    </div>
                </div>
                <button onclick="watchVideo('${key}', '${ad.url}')" class="bg-blue-600 text-white px-6 py-2 rounded-2xl text-xs font-bold">Watch</button>
            `;
            list.appendChild(div);
        });
    });
}

// Post Link Logic
window.postLink = async () => {
    const url = document.getElementById('yt-url').value.trim();
    if (!getYTId(url)) return alert("Please enter a valid YouTube link");

    let views = 100;
    if (currentUserData.linksPosted >= 5) {
        if (currentUserData.balance < 5) return alert("Insufficient Balance (Need 5 PHP)");
        await update(ref(db, `users/${userId}`), { balance: increment(-5) });
        views = 550;
    }

    const newAd = {
        url: url,
        ownerId: userId,
        ownerName: currentUserData.username,
        viewsLeft: views,
        createdAt: Date.now()
    };

    await push(ref(db, 'queue'), newAd);
    await update(ref(db, `users/${userId}`), { linksPosted: increment(1) });
    document.getElementById('yt-url').value = '';
    alert("Video successfully added to queue!");
};

// Start
syncUser();
loadQueue();
