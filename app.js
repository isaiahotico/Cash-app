
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

// --- User Profile Logic ---
let currentUser = localStorage.getItem('tg_username');
if (!currentUser) {
    currentUser = prompt("Enter your Telegram Username (e.g. @juan_delacruz):");
    if (!currentUser) currentUser = "@user" + Math.floor(Math.random() * 1000);
    localStorage.setItem('tg_username', currentUser);
}
document.getElementById('display-username').innerText = currentUser;

// Initialize User in DB
const userRef = ref(db, 'users/' + currentUser.replace('@', ''));
get(userRef).then(snapshot => {
    if (!snapshot.exists()) {
        set(userRef, { balance: 0.0, completed: {} });
    }
});

// Update Balance Realtime
onValue(userRef, (snapshot) => {
    const data = snapshot.val();
    if (data) document.getElementById('user-balance').innerText = (data.balance || 0).toFixed(2);
});

// --- Tabs Navigation ---
window.switchTab = (tab) => {
    document.getElementById('section-earn').classList.toggle('hidden', tab !== 'earn');
    document.getElementById('section-promote').classList.toggle('hidden', tab !== 'promote');
    document.getElementById('tab-earn').classList.toggle('active-tab', tab === 'earn');
    document.getElementById('tab-promote').classList.toggle('active-tab', tab === 'promote');
    if(tab === 'promote') checkLinkLimits();
};

// --- Promotion Logic ---
async function checkLinkLimits() {
    const type = document.getElementById('promo-type').value;
    const snap = await get(ref(db, `user_posts/${currentUser.replace('@', '')}/${type}`));
    const count = snap.val() || 0;
    
    const info = document.getElementById('promo-cost-info');
    if (count < 5) {
        info.innerText = `You have ${5 - count} FREE links remaining for this category.`;
        info.className = "text-sm text-green-400 font-bold italic";
    } else {
        info.innerText = `Limit reached. Cost: ₱1.00 for 120 clicks.`;
        info.className = "text-sm text-red-400 font-bold italic";
    }
}
document.getElementById('promo-type').addEventListener('change', checkLinkLimits);

window.submitLink = async () => {
    const type = document.getElementById('promo-type').value;
    const url = document.getElementById('promo-url').value;
    if (!url.includes('http')) return alert("Valid URL required");

    const userPath = `user_posts/${currentUser.replace('@', '')}/${type}`;
    const snap = await get(ref(db, userPath));
    const count = snap.val() || 0;

    let clicks = 100;
    if (count >= 5) {
        const userSnap = await get(userRef);
        if (userSnap.val().balance < 1) return alert("Insufficient balance! You need ₱1.00");
        update(userRef, { balance: increment(-1.0) });
        clicks = 120;
        // Adjusted limits based on type for paid links
        if(type === 'yt_sub') clicks = 65;
    } else {
        if(type === 'yt_sub') clicks = 50; // Free subs limit
    }

    const newTaskRef = push(ref(db, `tasks/${type}`));
    set(newTaskRef, {
        url: url,
        clicks_left: clicks,
        owner: currentUser,
        reward: type === 'yt_sub' ? 0.03 : 0.01
    });

    update(ref(db, userPath), increment(1));
    alert("Link posted successfully!");
    document.getElementById('promo-url').value = "";
    switchTab('earn');
};

// --- Earning Logic ---
function renderTasks() {
    onValue(ref(db, 'tasks'), async (snapshot) => {
        const userSnap = await get(ref(db, `users/${currentUser.replace('@', '')}/completed`));
        const completed = userSnap.val() || {};
        const categories = ['yt_watch', 'yt_sub', 'fb_follow', 'web_visit'];
        
        categories.forEach(cat => {
            const container = document.getElementById(`list-${cat.replace('_', '-')}`);
            container.innerHTML = "";
            const tasks = snapshot.child(cat).val();
            
            for (let id in tasks) {
                if (completed[id] || tasks[id].clicks_left <= 0) continue;

                const card = document.createElement('div');
                card.className = "bg-gray-800 p-4 rounded border border-gray-700 flex justify-between items-center";
                card.innerHTML = `
                    <div class="truncate mr-2">
                        <p class="text-xs text-gray-400">${tasks[id].url}</p>
                        <p class="text-xs italic text-yellow-600">${tasks[id].clicks_left} views left</p>
                    </div>
                    <button onclick="startTask('${cat}', '${id}', '${tasks[id].url}', ${tasks[id].reward})" 
                        class="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded font-bold text-sm whitespace-nowrap">
                        OPEN
                    </button>
                `;
                container.appendChild(card);
            }
        });
    });
}

window.startTask = (type, taskId, url, reward) => {
    // Open Link
    window.open(url, '_blank');

    // Show Timer
    const modal = document.getElementById('timer-modal');
    const circle = document.getElementById('timer-circle');
    const claimBtn = document.getElementById('claim-btn');
    const instruct = document.getElementById('timer-instruction');
    
    modal.classList.remove('hidden');
    claimBtn.classList.add('hidden');
    instruct.innerText = (type === 'web_visit') ? "Click the website link then return here for the timer!" : "Keep the tab open for 45 seconds";
    
    let seconds = 45;
    circle.innerText = seconds;

    const interval = setInterval(() => {
        seconds--;
        circle.innerText = seconds;
        if (seconds <= 0) {
            clearInterval(interval);
            claimBtn.classList.remove('hidden');
            circle.innerText = "✓";
            
            claimBtn.onclick = () => {
                completeTask(type, taskId, reward);
                modal.classList.add('hidden');
            };
        }
    }, 1000);
};

async function completeTask(type, taskId, reward) {
    // Add Balance
    await update(userRef, { balance: increment(reward) });
    // Mark as completed for user
    await set(ref(db, `users/${currentUser.replace('@', '')}/completed/${taskId}`), true);
    // Deduct click from task
    await update(ref(db, `tasks/${type}/${taskId}`), { clicks_left: increment(-1) });
    
    alert(`Reward Claimed: ₱${reward}`);
}

renderTasks();
