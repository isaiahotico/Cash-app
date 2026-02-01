
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, serverTimestamp, query, orderByChild, limitToLast, equalTo } 
    from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781",
    measurementId: "G-Z64B87ELGP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const tg = window.Telegram.WebApp;
tg.expand();

// Telegram User Data
const userId = tg.initDataUnsafe?.user?.id || "test_user_123";
const telegramUsername = tg.initDataUnsafe?.user?.username || tg.initDataUnsafe?.user?.first_name || "Guest";
document.getElementById('telegramUsername').innerText = telegramUsername;

let userBalance = 0;
const REWARD_PER_AD = 0.0065;
const REWARD_PER_BONUS_AD = 0.0012;
const AD_COOLDOWN_SECONDS = 30; // 30 seconds
const BONUS_AD_COOLDOWN_MINUTES = 10; // 10 minutes
const IN_APP_INTERSTITIAL_COOLDOWN_MINUTES = 3; // 3 minutes

// Monetag Rewarded Ad Zones
const MONETAG_REWARDED_ADS = [
    show_10276123, // Original
    show_10337795, // New #2
    show_10337853  // New #3
];

// Psychological Tips
const PSYCH_TIPS = [
    "Small gains add up! Consistency is key to reaching your goals.",
    "Every ad watched brings you closer to your next withdrawal. Keep going!",
    "Think of each click as a step towards financial freedom.",
    "Patience pays off. Your rewards are accumulating!",
    "Even tiny amounts can grow into something significant over time.",
    "Stay focused on your goal. Every reward counts!",
    "The more you engage, the more you earn. It's that simple!",
    "Don't underestimate the power of consistent micro-earnings.",
    "Your effort today builds your balance for tomorrow.",
    "Celebrate every small success – it fuels your motivation!",
    "A penny saved is a penny earned, and a penny earned is a penny closer!",
    "Make earning a habit, and watch your balance grow.",
    "The best way to predict your financial future is to create it, one ad at a time.",
    "Success is the sum of small efforts repeated day in and day out.",
    "You're building something here, one click at a time.",
    "Every reward is a step, not just a destination.",
    "Keep your eyes on the prize, even the smallest ones.",
    "Your financial journey starts with a single click.",
    "The secret to getting ahead is getting started, and keeping at it.",
    "Believe in the power of small, consistent actions.",
    "You're not just watching ads, you're investing your time wisely.",
    "The path to wealth is paved with many small, deliberate steps.",
    "Don't wait for big opportunities. Create them with small actions.",
    "Your future self will thank you for your consistency today.",
    "Every earned cent is a testament to your dedication.",
    "It's not about how fast you go, but that you keep moving.",
    "Turn your spare moments into earning moments.",
    "The habit of earning is more valuable than any single large sum.",
    "Small acts, when multiplied by millions of people, can transform the world.",
    "Your financial growth is a marathon, not a sprint.",
    "The most successful people are those who are consistent.",
    "Don't despise humble beginnings; they often lead to great things.",
    "Each reward is a brick in your financial foundation.",
    "You're cultivating a mindset of abundance, one ad at a time.",
    "The journey of a thousand miles begins with a single step... or click!",
    "Your persistence is your superpower in earning.",
    "Stay positive and keep clicking. Good things are coming!",
    "The best investment you can make is in yourself, and your earning habits.",
    "You're building momentum with every successful ad view.",
    "Embrace the process; the rewards will follow.",
    "Think of your balance as a garden you're tending.",
    "Every small win reinforces your ability to achieve more.",
    "Your dedication is directly proportional to your earnings.",
    "One ad today, more balance tomorrow.",
    "Your actions today determine your financial reality tomorrow.",
    "Stay motivated! Your next reward is just a click away.",
    "You're on the right track. Keep up the great work!"
];

function showPsychTip() {
    const tip = PSYCH_TIPS[Math.floor(Math.random() * PSYCH_TIPS.length)];
    alert("💡 Earning Tip:\n" + tip);
}


// --- Cooldown Logic ---
function setCooldown(key, durationSeconds) {
    const expiry = Date.now() + (durationSeconds * 1000);
    localStorage.setItem(key, expiry);
    return expiry;
}

function getCooldown(key) {
    return parseInt(localStorage.getItem(key) || "0");
}

function updateCooldownDisplay(key, elementId, buttonId, durationSeconds, callback) {
    const timerElement = document.getElementById(elementId);
    const button = document.getElementById(buttonId);

    if (!timerElement || !button) return; // Ensure elements exist

    const interval = setInterval(() => {
        const expiry = getCooldown(key);
        const remaining = expiry - Date.now();

        if (remaining > 0) {
            button.disabled = true;
            const minutes = Math.floor((remaining / 1000 / 60) % 60);
            const seconds = Math.floor((remaining / 1000) % 60);
            timerElement.innerText = `Cooldown: ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            button.disabled = false;
            timerElement.innerText = "";
            clearInterval(interval);
            if (callback) callback(); // Optional callback when cooldown ends
        }
    }, 1000);
}

// --- Initialize User and Listeners ---
async function initUser() {
    const userRef = ref(db, 'users/' + userId);
    const snapshot = await get(userRef);
    
    if (!snapshot.exists()) {
        // Check for double account (same Telegram ID)
        // This is a basic check. More robust checks would involve server-side logic (e.g., IP, device fingerprint)
        // but these have privacy implications and potential for false positives.
        // For now, we ensure a unique entry per Telegram userId.
        
        const referralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        await set(userRef, {
            username: telegramUsername, // Use Telegram username
            balance: 0,
            referralCode: referralCode,
            referralsCount: 0,
            usedReferral: false,
            createdAt: serverTimestamp()
        });
    }
    
    onValue(userRef, (snap) => {
        const data = snap.val();
        userBalance = data.balance || 0;
        document.getElementById('userBalance').innerText = `₱${userBalance.toFixed(4)}`; // Display more decimals for small amounts
        document.getElementById('myReferralCode').innerText = data.referralCode; // Immediately display referral code
    });

    // Start cooldown timers
    updateCooldownDisplay('adCooldown', 'adCooldownTimer', 'watchAdBtn', AD_COOLDOWN_SECONDS);
    updateCooldownDisplay('bonusAdCooldown', 'bonusAdCooldownTimer', 'bonusAdBtn', BONUS_AD_COOLDOWN_MINUTES * 60);

    // Show in-app interstitial on app open
    showInAppInterstitialOnOpen();
}

// --- Monetag Ad Logic ---
window.watchAd = function() {
    if (getCooldown('adCooldown') > Date.now()) {
        alert("Please wait for the cooldown to finish.");
        return;
    }

    const randomAdFunction = MONETAG_REWARDED_ADS[Math.floor(Math.random() * MONETAG_REWARDED_ADS.length)];

    if (typeof randomAdFunction === 'function') {
        randomAdFunction().then(() => {
            const newBalance = userBalance + REWARD_PER_AD;
            update(ref(db, 'users/' + userId), { balance: newBalance });
            setCooldown('adCooldown', AD_COOLDOWN_SECONDS);
            updateCooldownDisplay('adCooldown', 'adCooldownTimer', 'watchAdBtn', AD_COOLDOWN_SECONDS);
            alert(`Congrats! You earned ₱${REWARD_PER_AD.toFixed(4)}`);
            showPsychTip();
        }).catch(e => {
            console.error("Ad error:", e);
            alert('Ad failed to load or was closed prematurely. Try again.');
        });
    } else {
        alert('Ad SDK not ready or function not found.');
    }
};

window.showRandomRewardedPopup = function() {
    if (getCooldown('bonusAdCooldown') > Date.now()) {
        alert("Please wait for the bonus ad cooldown to finish.");
        return;
    }

    const randomAdFunction = MONETAG_REWARDED_ADS[Math.floor(Math.random() * MONETAG_REWARDED_ADS.length)];

    if (typeof randomAdFunction === 'function') {
        randomAdFunction('pop').then(() => { // 'pop' for rewarded popup
            const newBalance = userBalance + REWARD_PER_BONUS_AD;
            update(ref(db, 'users/' + userId), { balance: newBalance });
            setCooldown('bonusAdCooldown', BONUS_AD_COOLDOWN_MINUTES * 60);
            updateCooldownDisplay('bonusAdCooldown', 'bonusAdCooldownTimer', 'bonusAdBtn', BONUS_AD_COOLDOWN_MINUTES * 60);
            alert(`Bonus! You earned ₱${REWARD_PER_BONUS_AD.toFixed(4)}`);
            showPsychTip();
        }).catch(e => {
            console.error("Popup Ad error:", e);
            alert('Bonus Ad failed to load or was closed prematurely. Try again.');
        });
    } else {
        alert('Ad SDK not ready or function not found.');
    }
};

// In-App Interstitial on App Open
function showInAppInterstitialOnOpen() {
    if (getCooldown('inAppInterstitialCooldown') > Date.now()) {
        // console.log("In-App Interstitial is on cooldown.");
        return;
    }

    const randomAdFunction = MONETAG_REWARDED_ADS[Math.floor(Math.random() * MONETAG_REWARDED_ADS.length)];
    if (typeof randomAdFunction === 'function') {
        randomAdFunction({
            type: 'inApp',
            inAppSettings: {
                frequency: 1, // Show once
                capping: 0.1,
                interval: 30,
                timeout: 5,
                everyPage: false
            }
        });
        setCooldown('inAppInterstitialCooldown', IN_APP_INTERSTITIAL_COOLDOWN_MINUTES * 60);
    } else {
        console.warn('Monetag In-App Interstitial SDK not ready.');
    }
}

// --- Tabs Navigation ---
window.showTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    if(tabId === 'leaderboard') loadLeaderboard();
    if(tabId === 'chat') loadChat();
    if(tabId === 'earn') loadWithdrawalHistory(); // Load history when on earn tab
};

// --- Leaderboard Logic ---
function loadLeaderboard() {
    const usersRef = query(ref(db, 'users'), orderByChild('balance'), limitToLast(10));
    onValue(usersRef, (snap) => {
        const list = document.getElementById('leaderboardList');
        list.innerHTML = "";
        const users = [];
        snap.forEach(child => { users.push({ id: child.key, ...child.val() }); });
        users.sort((a, b) => b.balance - a.balance).forEach((u, i) => { // Ensure correct sorting
            list.innerHTML += `<div class="flex justify-between p-3 bg-white rounded-lg shadow-sm border-l-4 ${u.id === userId ? 'border-sky-700' : 'border-sky-400'}">
                <span>${i+1}. ${u.username} ${u.id === userId ? '(You)' : ''}</span>
                <span class="font-bold text-sky-600">₱${u.balance.toFixed(4)}</span>
            </div>`;
        });
    });
}

// --- Chat Logic ---
window.sendMessage = function() {
    const text = document.getElementById('chatInput').value.trim();
    if(!text) return;
    push(ref(db, 'chats'), {
        user: telegramUsername,
        text: text,
        time: serverTimestamp()
    });
    document.getElementById('chatInput').value = "";
};

function loadChat() {
    const chatRef = query(ref(db, 'chats'), orderByChild('time'), limitToLast(20));
    onValue(chatRef, (snap) => {
        const container = document.getElementById('chatMessages');
        container.innerHTML = "";
        snap.forEach(msg => {
            const d = msg.val();
            const messageTime = d.time ? new Date(d.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';
            container.innerHTML += `<div class="p-2 bg-sky-50 rounded shadow-sm text-sm">
                <b class="text-sky-700">${d.user}:</b> ${d.text} <span class="text-gray-400 text-xs float-right">${messageTime}</span>
            </div>`;
        });
        container.scrollTop = container.scrollHeight;
    });
}

// --- Withdrawal Logic ---
window.requestWithdrawal = async function() {
    const gcash = document.getElementById('gcashNumber').value.trim();
    if(gcash.length < 10 || !/^\d+$/.test(gcash)) return alert("Please enter a valid GCash number (e.g., 09xxxxxxxxx).");
    if(userBalance < 0.02) return alert("Minimum withdrawal is ₱0.02");

    // Prevent multiple pending withdrawal requests
    const pendingWithdrawalsSnap = await get(query(ref(db, 'withdrawals'), orderByChild('userId'), equalTo(userId)));
    let hasPending = false;
    pendingWithdrawalsSnap.forEach(wd => {
        if(wd.val().status === 'pending') hasPending = true;
    });
    if(hasPending) return alert("You already have a pending withdrawal request.");

    const wdRef = push(ref(db, 'withdrawals'));
    await set(wdRef, {
        userId, 
        userName: telegramUsername, 
        gcash, 
        amount: parseFloat(userBalance.toFixed(4)), // Store exact amount
        status: 'pending',
        timestamp: serverTimestamp()
    });
    await update(ref(db, 'users/' + userId), { balance: 0 }); // Reset balance after request
    alert("Withdrawal Requested! Please wait for admin approval.");
};

function loadWithdrawalHistory() {
    const historyRef = query(ref(db, 'withdrawals'), orderByChild('userId'), equalTo(userId));
    onValue(historyRef, (snap) => {
        const container = document.getElementById('withdrawalHistory');
        container.innerHTML = "";
        if (!snap.exists()) {
            container.innerHTML = "<p class='text-gray-400'>No withdrawals yet.</p>";
            return;
        }

        const withdrawals = [];
        snap.forEach(wd => withdrawals.push({ id: wd.key, ...wd.val() }));
        withdrawals.sort((a, b) => b.timestamp - a.timestamp); // Sort by newest first

        withdrawals.forEach(wd => {
            const date = wd.timestamp ? new Date(wd.timestamp).toLocaleString() : 'N/A';
            let statusColor = 'text-gray-600';
            if (wd.status === 'pending') statusColor = 'text-yellow-600';
            else if (wd.status === 'paid') statusColor = 'text-green-600';
            else if (wd.status === 'rejected') statusColor = 'text-red-600';

            container.innerHTML += `<div class="p-2 bg-gray-50 rounded shadow-sm flex justify-between items-center">
                <div>
                    <p class="font-semibold">₱${wd.amount.toFixed(2)} to ${wd.gcash}</p>
                    <p class="text-xs text-gray-500">${date}</p>
                </div>
                <span class="text-sm font-bold ${statusColor}">${wd.status.toUpperCase()}</span>
            </div>`;
        });
    });
}


// --- Admin Logic ---
window.checkAdmin = function() {
    const pass = document.getElementById('adminPass').value;
    if(pass === "Propetas12") {
        document.getElementById('adminLoginPanel').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        loadAdminData();
    } else {
        alert("Wrong Password");
    }
};

function loadAdminData() {
    // Listen for all withdrawals, ordered by status (pending first)
    onValue(query(ref(db, 'withdrawals'), orderByChild('status')), (snap) => {
        const container = document.getElementById('adminWithdrawals');
        container.innerHTML = "";
        if (!snap.exists()) {
            container.innerHTML = "<p class='text-gray-400'>No withdrawal requests.</p>";
            return;
        }

        const allWithdrawals = [];
        snap.forEach(wd => allWithdrawals.push({ id: wd.key, ...wd.val() }));

        // Sort to show pending first, then others by timestamp
        allWithdrawals.sort((a, b) => {
            if (a.status === 'pending' && b.status !== 'pending') return -1;
            if (a.status !== 'pending' && b.status === 'pending') return 1;
            return b.timestamp - a.timestamp; // Newest first for non-pending
        });

        allWithdrawals.forEach(wd => {
            const data = wd;
            const wdId = wd.id;
            const date = data.timestamp ? new Date(data.timestamp).toLocaleString() : 'N/A';
            
            let actionButtons = '';
            if (data.status === 'pending') {
                actionButtons = `
                    <button onclick="updateWithdrawalStatus('${wdId}', 'paid')" class="bg-green-500 text-white px-2 py-1 rounded ml-2 text-xs">Mark Paid</button>
                    <button onclick="updateWithdrawalStatus('${wdId}', 'rejected')" class="bg-red-500 text-white px-2 py-1 rounded ml-1 text-xs">Reject</button>
                `;
            } else {
                actionButtons = `<span class="text-sm font-bold ${data.status === 'paid' ? 'text-green-600' : 'text-red-600'}">${data.status.toUpperCase()}</span>`;
            }

            container.innerHTML += `<div class="border-b p-2 text-xs flex justify-between items-center">
                <div>
                    <p><b>${data.userName}</b> (ID: ${data.userId})</p>
                    <p>${data.gcash} | ₱${data.amount.toFixed(4)}</p>
                    <p class="text-gray-500">${date}</p>
                </div>
                <div>${actionButtons}</div>
            </div>`;
        });
    });
}

window.updateWithdrawalStatus = async function(wdId, newStatus) {
    if (confirm(`Are you sure you want to mark this withdrawal as ${newStatus}?`)) {
        await update(ref(db, 'withdrawals/' + wdId), { status: newStatus });
        alert(`Withdrawal marked as ${newStatus}!`);
    }
};

// --- Referral Logic ---
window.copyReferralCode = function() {
    const code = document.getElementById('myReferralCode').innerText;
    navigator.clipboard.writeText(code).then(() => {
        alert("Referral code copied to clipboard!");
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        alert("Failed to copy code. Please copy manually.");
    });
};

window.claimReferral = async function() {
    const code = document.getElementById('inputReferral').value.trim();
    if (!code) return alert("Please enter a referral code.");

    const userSnap = await get(ref(db, 'users/' + userId));
    if(userSnap.val().usedReferral) return alert("You have already claimed a referral bonus.");

    // Prevent self-referral
    if (userSnap.val().referralCode === code) return alert("You cannot refer yourself.");

    // Find the referrer
    const usersRef = ref(db, 'users');
    const snapshot = await get(query(usersRef, orderByChild('referralCode'), equalTo(code)));
    
    let referrerId = null;
    snapshot.forEach(child => {
        if (child.val().referralCode === code) {
            referrerId = child.key;
        }
    });

    if(referrerId) {
        // Reward referrer 0.01
        const referrerRef = ref(db, 'users/' + referrerId);
        const referrerSnap = await get(referrerRef);
        const referrerData = referrerSnap.val();

        await update(referrerRef, { 
            balance: (referrerData.balance || 0) + 0.01,
            referralsCount: (referrerData.referralsCount || 0) + 1
        });
        
        // Mark current user as having used a referral
        await update(ref(db, 'users/' + userId), { usedReferral: true });

        alert(`Referral bonus claimed! ${referrerData.username} earned ₱0.01.`);
        document.getElementById('inputReferral').value = ''; // Clear input
    } else {
        alert("Invalid or non-existent referral code.");
    }
};

// Start the app
initUser();
