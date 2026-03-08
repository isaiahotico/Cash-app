
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, push, onValue, update, get, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// State Management
let currentUser = null;
const REWARD_AMOUNT = 0.01;
const PAID_COST = 5.00;

// Initialize Session
window.onload = () => {
    const savedUser = localStorage.getItem('ph_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        document.getElementById('auth-overlay').classList.add('hidden');
        initDashboard();
    }
};

window.login = async () => {
    const username = document.getElementById('tg-username').value.trim();
    if (!username.startsWith('@') || username.length < 4) {
        alert("Please enter a valid Telegram username (e.g., @PaperHouse)");
        return;
    }

    const userRef = ref(db, 'users/' + username.replace('@', ''));
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
        currentUser = snapshot.val();
    } else {
        currentUser = {
            username: username,
            balance: 0.00,
            linksPosted: 0,
            joinedAt: Date.now()
        };
        await set(userRef, currentUser);
    }
    
    localStorage.setItem('ph_user', JSON.stringify(currentUser));
    document.getElementById('auth-overlay').classList.add('hidden');
    initDashboard();
};

function initDashboard() {
    document.getElementById('display-username').innerText = currentUser.username;
    
    // Listen for Balance Updates
    onValue(ref(db, `users/${currentUser.username.replace('@', '')}/balance`), (snap) => {
        const bal = snap.val() || 0;
        document.getElementById('display-balance').innerText = bal.toFixed(2);
    });

    // Listen for Links Queue
    onValue(ref(db, 'links'), (snapshot) => {
        const container = document.getElementById('links-container');
        container.innerHTML = '';
        const data = snapshot.val();
        
        if (!data) {
            container.innerHTML = '<p class="col-span-full text-center text-slate-500 py-10">No links available. Post one!</p>';
            return;
        }

        Object.keys(data).forEach(key => {
            const link = data[key];
            const card = document.createElement('div');
            card.className = "bg-slate-800 border border-slate-700 p-5 rounded-xl card-hover flex flex-col justify-between";
            
            const icon = link.type === 'youtube' ? 'fa-youtube text-red-500' : 
                         link.type === 'facebook' ? 'fa-facebook text-blue-500' : 'fa-globe text-emerald-500';

            card.innerHTML = `
                <div>
                    <div class="flex justify-between items-start mb-3">
                        <i class="fa-brands ${icon} text-2xl"></i>
                        <span class="text-[10px] bg-slate-700 px-2 py-1 rounded uppercase font-bold text-slate-400">${link.type}</span>
                    </div>
                    <p class="text-sm font-medium truncate text-slate-300 mb-1">${link.url}</p>
                    <p class="text-xs text-slate-500 italic">Posted by ${link.owner}</p>
                </div>
                <div class="mt-4 flex items-center justify-between">
                    <span class="text-xs font-mono text-blue-400">${link.viewsLeft} views left</span>
                    <button onclick="window.watchLink('${key}', '${link.url}')" class="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 px-4 rounded-lg transition">
                        Watch & Earn
                    </button>
                </div>
            `;
            container.appendChild(card);
        });
    });
}

window.addLink = async () => {
    const url = document.getElementById('link-url').value;
    const type = document.getElementById('link-type').value;
    const userCleaner = currentUser.username.replace('@', '');

    if (!url.includes('http')) return alert("Enter valid URL");

    // Logic: First 5 YouTube are free, rest ₱5
    let isFree = (type === 'youtube' && currentUser.linksPosted < 5);
    
    if (!isFree) {
        if (currentUser.balance < PAID_COST) {
            alert(`Insufficient balance! You need ₱${PAID_COST} to post ${type} links.`);
            return;
        }
        // Deduct balance
        const newBal = currentUser.balance - PAID_COST;
        await update(ref(db, `users/${userCleaner}`), { balance: newBal });
    }

    const newLink = {
        url: url,
        type: type,
        owner: currentUser.username,
        viewsLeft: isFree ? 100 : 550,
        createdAt: Date.now()
    };

    const linksRef = ref(db, 'links');
    await push(linksRef, newLink);
    
    // Update user post count
    await update(ref(db, `users/${userCleaner}`), { 
        linksPosted: (currentUser.linksPosted || 0) + 1 
    });

    alert(isFree ? "Free YouTube Link Added!" : "Paid Link Added successfully!");
    document.getElementById('link-url').value = '';
};

window.watchLink = (id, url) => {
    const overlay = document.getElementById('timer-overlay');
    const timerText = document.getElementById('countdown-number');
    const taskUrl = document.getElementById('current-task-url');
    
    overlay.classList.remove('hidden');
    taskUrl.innerText = url;
    
    // Open link in new window
    window.open(url, '_blank');

    let seconds = 45;
    const interval = setInterval(async () => {
        seconds--;
        timerText.innerText = seconds;

        if (seconds <= 0) {
            clearInterval(interval);
            overlay.classList.add('hidden');
            await processReward(id);
        }
    }, 1000);
};

async function processReward(linkId) {
    const userCleaner = currentUser.username.replace('@', '');
    const linkRef = ref(db, `links/${linkId}`);
    
    const snap = await get(linkRef);
    if (!snap.exists()) return;

    const linkData = snap.val();
    const newViews = linkData.viewsLeft - 1;

    // 1. Reward User
    const userRef = ref(db, `users/${userCleaner}`);
    const userSnap = await get(userRef);
    const currentBal = userSnap.val().balance || 0;
    
    await update(userRef, { balance: currentBal + REWARD_AMOUNT });

    // 2. Update/Remove Link
    if (newViews <= 0) {
        await remove(linkRef);
    } else {
        await update(linkRef, { viewsLeft: newViews });
    }

    alert(`Success! ₱0.01 added to your balance.`);
}
