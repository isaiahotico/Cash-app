
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

let currentUser = null;
let watchTimer = null;
let player = null;

// Initialize User
const userId = localStorage.getItem('fg_uid') || 'u' + Date.now();
localStorage.setItem('fg_uid', userId);

// DOM Elements
const videoList = document.getElementById('video-list');
const balanceEl = document.getElementById('balance');
const usernameEl = document.getElementById('display-username');

// --- AUTH LOGIC ---
function initApp() {
    onValue(ref(db, `users/${userId}`), (snapshot) => {
        const data = snapshot.val();
        if (data) {
            currentUser = data;
            document.getElementById('auth-box').classList.add('hidden-section');
            updateUI();
        } else {
            document.getElementById('auth-box').classList.remove('hidden-section');
        }
    });
    loadVideos();
}

window.register = async () => {
    const tg = document.getElementById('tg-input').value.trim();
    if (!tg.startsWith('@')) return alert("Enter valid Telegram handle starting with @");
    
    const refCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newUser = {
        username: tg,
        balance: 0,
        totalInvites: 0,
        totalRefEarned: 0,
        referralCode: refCode,
        linksPosted: 0,
        invitedBy: null
    };
    await set(ref(db, `users/${userId}`), newUser);
};

function updateUI() {
    balanceEl.innerText = currentUser.balance.toFixed(4);
    usernameEl.innerText = currentUser.username;
    document.getElementById('my-ref-code').innerText = currentUser.referralCode;
    document.getElementById('total-invites').innerText = currentUser.totalInvites || 0;
    document.getElementById('total-ref-earned').innerText = (currentUser.totalRefEarned || 0).toFixed(4);
    
    const postBtn = document.getElementById('post-btn');
    if (currentUser.linksPosted < 5) {
        postBtn.innerText = `Post Free (${5 - currentUser.linksPosted} left)`;
        postBtn.className = "w-full bg-green-500 text-white py-2 rounded text-sm font-bold";
    } else {
        postBtn.innerText = "Post Link (5.00 PHP)";
        postBtn.className = "w-full bg-blue-600 text-white py-2 rounded text-sm font-bold";
    }
}

// --- REFERRAL SYSTEM ---
window.submitReferral = async () => {
    const code = document.getElementById('input-ref-code').value.trim().toUpperCase();
    if (currentUser.invitedBy) return alert("You already used a referral code!");
    if (code === currentUser.referralCode) return alert("Cannot use own code!");

    const usersRef = ref(db, 'users');
    get(usersRef).then(async (snapshot) => {
        const users = snapshot.val();
        let inviterId = null;
        for (let id in users) {
            if (users[id].referralCode === code) { inviterId = id; break; }
        }

        if (inviterId) {
            await update(ref(db, `users/${userId}`), { invitedBy: inviterId });
            await update(ref(db, `users/${inviterId}`), { totalInvites: increment(1) });
            alert("Referral confirmed! You are now connected.");
        } else {
            alert("Invalid Code");
        }
    });
};

// --- VIDEO LOGIC ---
function loadVideos() {
    onValue(ref(db, 'queue'), (snapshot) => {
        videoList.innerHTML = '';
        const ads = snapshot.val();
        if (!ads) {
            videoList.innerHTML = '<p class="text-center text-gray-400">No ads available. Post yours!</p>';
            return;
        }
        Object.keys(ads).forEach(key => {
            const ad = ads[key];
            const div = document.createElement('div');
            div.className = "bg-white p-3 rounded-lg shadow-sm flex justify-between items-center border border-gray-200";
            div.innerHTML = `
                <div>
                    <p class="text-xs font-bold text-gray-500">By ${ad.ownerName}</p>
                    <p class="text-[10px] text-gray-400">${ad.viewsLeft} views remaining</p>
                </div>
                <button onclick="watchVideo('${key}', '${ad.url}')" class="bg-blue-100 text-blue-600 px-4 py-1 rounded-full text-xs font-bold hover:bg-blue-600 hover:text-white transition">
                    Watch
                </button>
            `;
            videoList.appendChild(div);
        });
    });
}

window.watchVideo = (adId, url) => {
    const vidId = url.split('v=')[1]?.split('&')[0] || url.split('/').pop();
    document.getElementById('video-overlay').style.display = 'flex';
    let timeLeft = 30;
    
    // Initialize YT Player
    if (player) player.destroy();
    player = new YT.Player('yt-player', {
        height: '100%',
        width: '100%',
        videoId: vidId,
        playerVars: { 'autoplay': 1, 'controls': 0, 'disablekb': 1 },
        events: {
            'onStateChange': (event) => {
                if (event.data == YT.PlayerState.PLAYING && !watchTimer) {
                    watchTimer = setInterval(() => {
                        timeLeft--;
                        document.getElementById('timer').innerText = timeLeft;
                        if (timeLeft <= 0) {
                            clearInterval(watchTimer);
                            watchTimer = null;
                            rewardUser(adId, url);
                        }
                    }, 1000);
                }
            }
        }
    });
};

async function rewardUser(adId, originalUrl) {
    // Reward Logic
    const reward = 0.01;
    const refBonus = reward * 0.20;

    // Update User Balance
    await update(ref(db, `users/${userId}`), { balance: increment(reward) });

    // Referral Commission
    if (currentUser.invitedBy) {
        await update(ref(db, `users/${currentUser.invitedBy}`), { 
            balance: increment(refBonus),
            totalRefEarned: increment(refBonus)
        });
    }

    // Update Ad View Count
    const adRef = ref(db, `queue/${adId}`);
    const adSnap = await get(adRef);
    if (adSnap.exists()) {
        const newViews = adSnap.val().viewsLeft - 1;
        if (newViews <= 0) {
            await set(adRef, null);
        } else {
            await update(adRef, { viewsLeft: newViews });
        }
    }

    alert("Success! 0.01 PHP added to your balance.");
    closePlayer();
    // Redirect to YouTube as requested
    window.open(originalUrl, '_blank');
}

window.closePlayer = () => {
    clearInterval(watchTimer);
    watchTimer = null;
    document.getElementById('video-overlay').style.display = 'none';
    if (player) player.stopVideo();
};

// --- POSTING LOGIC ---
window.postLink = async () => {
    const url = document.getElementById('yt-url').value.trim();
    if (!url.includes('youtube.com') && !url.includes('youtu.be')) return alert("Invalid YT link");

    let views = 100;
    let cost = 0;

    if (currentUser.linksPosted >= 5) {
        cost = 5;
        views = 550;
        if (currentUser.balance < cost) return alert("Insufficient balance! Need 5.00 PHP");
        await update(ref(db, `users/${userId}`), { balance: increment(-cost) });
    }

    const newAd = {
        url: url,
        owner: userId,
        ownerName: currentUser.username,
        viewsLeft: views,
        timestamp: Date.now()
    };

    await push(ref(db, 'queue'), newAd);
    await update(ref(db, `users/${userId}`), { linksPosted: increment(1) });
    
    document.getElementById('yt-url').value = '';
    alert("Video added to queue!");
};

// Start
initApp();
