
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, get, update, push, onValue, query, orderByChild, limitToLast, serverTimestamp, onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    databaseURL: "https://freegcash-ads-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.firebasestorage.app",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781"
};

const fb = initializeApp(firebaseConfig);
const db = getDatabase(fb);

let user = null;
let uid = localStorage.getItem('ph_uid_v4');
const REWARD = 0.0105;
const COOLDOWN = 45;
const ZONES = ['show_10276123', 'show_10337795', 'show_10337853'];

const app = {
    init: async () => {
        if (!uid) {
            document.getElementById('login-screen').classList.remove('hidden');
        } else {
            const snap = await get(ref(db, `users/${uid}`));
            if (snap.exists()) {
                user = snap.val();
                app.launch();
            } else {
                document.getElementById('login-screen').classList.remove('hidden');
            }
        }
    },

    register: async () => {
        const name = document.getElementById('reg-name').value.trim();
        const gcash = document.getElementById('reg-gcash').value.trim();
        if (name.length < 3 || gcash.length < 10) return alert("Fill correctly");

        uid = 'U' + Math.floor(Math.random() * 9000000);
        user = {
            uid, username: name, gcash: gcash, balance: 0,
            dailyAds: 0, weeklyAds: 0, totalAds: 0,
            dailyDate: new Date().toDateString(),
            weeklyId: app.getWeekId(),
            lastLBClaim: ""
        };
        await set(ref(db, `users/${uid}`), user);
        localStorage.setItem('ph_uid_v4', uid);
        app.launch();
    },

    launch: () => {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        app.sync();
        app.startPresence();
        app.nav('home');
    },

    getWeekId: () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 1);
        const week = Math.ceil((((now - start) / 86400000) + start.getDay() + 1) / 7);
        return `${now.getFullYear()}-W${week}`;
    },

    sync: () => {
        onValue(ref(db, `users/${uid}`), s => {
            user = s.val();
            document.getElementById('u-balance').innerText = `₱${user.balance.toFixed(4)}`;
            document.getElementById('big-balance').innerText = `₱${user.balance.toFixed(2)}`;
            document.getElementById('prof-name').innerText = user.username;
            document.getElementById('prof-code').innerText = user.gcash;
            
            // Stats
            document.getElementById('stat-d').innerText = user.dailyDate === new Date().toDateString() ? user.dailyAds : 0;
            document.getElementById('stat-w').innerText = user.weeklyId === app.getWeekId() ? user.weeklyAds : 0;
            document.getElementById('stat-o').innerText = user.totalAds;
            document.getElementById('lb-my-weekly').innerText = `${user.weeklyId === app.getWeekId() ? user.weeklyAds : 0} / 10,000`;
        });

        // Global Stats
        onValue(ref(db, 'global_stats'), s => {
            const gs = s.val() || {};
            const today = new Date().toDateString();
            const week = app.getWeekId();
            document.getElementById('gstat-d').innerText = `₱${(gs[today] || 0).toFixed(2)}`;
            document.getElementById('gstat-w').innerText = `₱${(gs[week] || 0).toFixed(2)}`;
            document.getElementById('gstat-o').innerText = `₱${(gs.total || 0).toFixed(2)}`;
        });
    },

    // AD ENGINE
    playPremium: async () => {
        if (app.isOnCD('premium')) return;

        // Sequence Using Requested Callback Syntax
        try {
            await show_10276123('pop');
            await show_10337795('pop');
            await show_10337853('pop');
            app.grantReward('premium');
        } catch (e) {
            alert("Ad failed to load. Try again.");
        }
    },

    playTurbo: async () => {
        if (app.isOnCD('turbo')) return;

        for (const zone of ZONES) {
            try { if (window[zone]) await window[zone](); } catch (e) {}
        }
        app.grantReward('turbo');
    },

    grantReward: async (type) => {
        const today = new Date().toDateString();
        const week = app.getWeekId();

        const updates = {};
        updates[`users/${uid}/balance`] = (user.balance || 0) + REWARD;
        updates[`users/${uid}/totalAds`] = (user.totalAds || 0) + 1;
        
        // Reset counters if date/week changed
        if (user.dailyDate !== today) {
            updates[`users/${uid}/dailyAds`] = 1;
            updates[`users/${uid}/dailyDate`] = today;
        } else {
            updates[`users/${uid}/dailyAds`] = (user.dailyAds || 0) + 1;
        }

        if (user.weeklyId !== week) {
            updates[`users/${uid}/weeklyAds`] = 1;
            updates[`users/${uid}/weeklyId`] = week;
        } else {
            updates[`users/${uid}/weeklyAds`] = (user.weeklyAds || 0) + 1;
        }

        // Update Global Stats
        const gsSnap = await get(ref(db, 'global_stats'));
        const gs = gsSnap.val() || {};
        updates['global_stats/total'] = (gs.total || 0) + REWARD;
        updates[`global_stats/${today}`] = (gs[today] || 0) + REWARD;
        updates[`global_stats/${week}`] = (gs[week] || 0) + REWARD;

        await update(ref(db), updates);
        app.startCD(type);
    },

    // COOLDOWN LOGIC
    cd: { premium: 0, turbo: 0 },
    isOnCD: (t) => {
        if (app.cd[t] > 0) { alert(`Wait ${app.cd[t]}s`); return true; }
        return false;
    },
    startCD: (t) => {
        app.cd[t] = COOLDOWN;
        const box = document.getElementById(`box-${t}`);
        const timer = document.getElementById(`cd-${t}`);
        const val = timer.querySelector('.cd-val');
        box.classList.add('hidden-cd');
        timer.classList.remove('hidden-cd');

        const itv = setInterval(() => {
            app.cd[t]--;
            val.innerText = app.cd[t] + 's';
            if (app.cd[t] <= 0) {
                clearInterval(itv);
                box.classList.remove('hidden-cd');
                timer.classList.add('hidden-cd');
            }
        }, 1000);
    },

    // PRESENCE
    startPresence: () => {
        const pRef = ref(db, `presence/${uid}`);
        set(pRef, { username: user.username, last_online: serverTimestamp() });
        onDisconnect(pRef).remove();

        setInterval(() => {
            update(pRef, { last_online: serverTimestamp() });
        }, 60000);

        onValue(ref(db, 'presence'), s => {
            const now = Date.now();
            const list = document.getElementById('online-list');
            list.innerHTML = "";
            let count = 0;
            s.forEach(c => {
                const p = c.val();
                if (now - p.last_online < 300000) { // 5 mins
                    count++;
                    list.innerHTML += `<div class="glass p-3 rounded-xl text-xs font-bold text-center border border-green-500/20">${p.username}</div>`;
                }
            });
            document.getElementById('online-indicator').innerText = count + ' Online';
        });
    },

    // LEADERBOARD
    loadLB: () => {
        const q = query(ref(db, 'users'), orderByChild('weeklyAds'), limitToLast(20));
        onValue(q, s => {
            const list = document.getElementById('lb-list');
            list.innerHTML = "";
            let items = [];
            s.forEach(c => { items.push(c.val()); });
            items.reverse().forEach((u, i) => {
                list.innerHTML += `
                    <div class="glass p-4 rounded-xl flex justify-between items-center">
                        <span class="text-xs font-bold">#${i+1} ${u.username}</span>
                        <span class="text-yellow-500 font-black text-xs">${u.weeklyAds || 0} ADS</span>
                    </div>`;
            });
        });
    },

    claimLB: async () => {
        const week = app.getWeekId();
        if (user.weeklyAds < 10000) return alert("You need 10,000 weekly ads!");
        if (user.lastLBClaim === week) return alert("Already claimed for this week!");

        await update(ref(db, `users/${uid}`), {
            balance: user.balance + 25,
            lastLBClaim: week
        });
        alert("₱25.00 Added to your balance!");
    },

    // WITHDRAW & HISTORY
    withdraw: async () => {
        if (user.balance < 1) return alert("Minimum ₱1.00");
        const amt = user.balance;
        const now = new Date();
        const details = {
            uid,
            name: user.username,
            gcash: user.gcash,
            amount: amt,
            status: 'pending',
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString(),
            timestamp: serverTimestamp()
        };
        await push(ref(db, 'withdrawals'), details);
        await update(ref(db, `users/${uid}`), { balance: 0 });
        alert("Withdrawal Requested Successfully!");
    },

    loadHistory: () => {
        onValue(ref(db, 'withdrawals'), s => {
            const list = document.getElementById('hist-list');
            list.innerHTML = "";
            s.forEach(c => {
                const w = c.val();
                const isMe = w.uid === uid;
                list.innerHTML += `
                    <div class="glass p-4 rounded-2xl ${isMe ? 'border-l-4 border-yellow-500' : ''}">
                        <div class="flex justify-between items-start mb-2">
                            <h4 class="font-black text-lg">₱${w.amount.toFixed(2)}</h4>
                            <span class="text-[9px] font-black uppercase px-2 py-1 rounded ${w.status==='paid'?'bg-green-500 text-black':'bg-yellow-500 text-black'}">${w.status}</span>
                        </div>
                        <p class="text-[10px] text-slate-400 font-bold uppercase">${w.name} | ${w.gcash}</p>
                        <p class="text-[9px] text-slate-600 mt-1">${w.date} at ${w.time}</p>
                    </div>`;
            });
        });
    },

    nav: (id) => {
        document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('nav-active'));
        document.getElementById(`sec-${id}`).classList.remove('hidden');
        if (id === 'leaderboard') app.loadLB();
        if (id === 'history') app.loadHistory();
    }
};

window.app = app;
app.init();
