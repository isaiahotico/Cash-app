
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

const ZONES = ['show_10276123', 'show_10337795', 'show_10337853'];
const REWARDS = { regular: 0.015, premium: 0.035, turbo: 0.055 };
const COOLDOWNS = { regular: 60, premium: 300 };

let user = null;
let uid = localStorage.getItem('ph_uid');
let cd = { regular: 0, premium: 0 };

const app = {
    init: async () => {
        if (!uid) {
            uid = 'U' + Math.floor(Math.random() * 9000000);
            localStorage.setItem('ph_uid', uid);
        }

        const snap = await get(ref(db, `users/${uid}`));
        if (snap.exists()) {
            user = snap.val();
            app.launch();
        } else {
            document.getElementById('login-screen').classList.remove('hidden');
        }
    },

    register: async () => {
        const name = document.getElementById('reg-name').value.trim();
        const gcash = document.getElementById('reg-gcash').value.trim();
        if (name.length < 3 || gcash.length < 10) return alert("Fill correctly");

        const refId = new URLSearchParams(window.location.search).get('ref');
        user = {
            uid, username: name, gcash, balance: 0, totalAds: 0,
            refEarned: 0, referredBy: refId || null, turboCount: 0,
            lastTurboDate: new Date().toDateString()
        };
        await set(ref(db, `users/${uid}`), user);
        app.launch();
    },

    launch: () => {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        app.sync();
        app.nav('home');
        app.presence();
    },

    sync: () => {
        onValue(ref(db, `users/${uid}`), s => {
            user = s.val();
            document.getElementById('user-display').innerText = user.username;
            document.getElementById('balance-display').innerText = `₱${user.balance.toFixed(2)}`;
            document.getElementById('big-balance').innerText = `₱${user.balance.toFixed(2)}`;
            document.getElementById('prof-name').innerText = user.username;
            document.getElementById('prof-gcash').innerText = user.gcash;
            document.getElementById('prof-total-ads').innerText = user.totalAds;
            document.getElementById('prof-ref-earned').innerText = `₱${(user.refEarned || 0).toFixed(2)}`;
            document.getElementById('ref-link').value = `${window.location.origin}?ref=${uid}`;
            
            const today = new Date().toDateString();
            document.getElementById('turbo-count').innerText = (user.lastTurboDate === today ? user.turboCount : 0) + '/3';
        });
    },

    playSequence: async (type) => {
        if (cd[type] > 0) return alert(`Wait ${cd[type]}s`);
        
        if (type === 'turbo') {
            const today = new Date().toDateString();
            const count = user.lastTurboDate === today ? user.turboCount : 0;
            if (count >= 3) return alert("Turbo Limit Reached for today!");
        }

        // ROW ADS LOGIC: Show all 3 Monetag zones in sequence
        for (const zone of ZONES) {
            try {
                if (window[zone]) await window[zone]();
            } catch (e) { console.warn("Ad skip", e); }
        }

        // Grant Reward
        const amt = REWARDS[type];
        const newBal = (user.balance || 0) + amt;
        const updates = { 
            balance: parseFloat(newBal.toFixed(4)),
            totalAds: (user.totalAds || 0) + 1
        };

        if (type === 'turbo') {
            const today = new Date().toDateString();
            updates.turboCount = (user.lastTurboDate === today ? user.turboCount : 0) + 1;
            updates.lastTurboDate = today;
        }

        await update(ref(db, `users/${uid}`), updates);

        // Referral Commission (8%)
        if (user.referredBy) {
            const upRef = ref(db, `users/${user.referredBy}`);
            const upSnap = await get(upRef);
            if (upSnap.exists()) {
                const upData = upSnap.val();
                await update(upRef, { 
                    balance: (upData.balance || 0) + (amt * 0.08),
                    refEarned: (upData.refEarned || 0) + (amt * 0.08)
                });
            }
        }

        if (COOLDOWNS[type]) app.startCD(type);
    },

    startCD: (type) => {
        cd[type] = COOLDOWNS[type];
        const btn = document.getElementById(`btn-${type.substring(0,4)}`);
        const lbl = document.getElementById(`timer-${type.substring(0,4)}`);
        btn.classList.add('cooldown-active');
        lbl.classList.remove('hidden');

        const timer = setInterval(() => {
            cd[type]--;
            lbl.innerText = cd[type] + 's';
            if (cd[type] <= 0) {
                clearInterval(timer);
                btn.classList.remove('cooldown-active');
                lbl.classList.add('hidden');
            }
        }, 1000);
    },

    nav: (id) => {
        document.querySelectorAll('main section').forEach(s => s.classList.add('hidden'));
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('nav-active'));
        document.getElementById(`sec-${id}`).classList.remove('hidden');
        if (id === 'chat') app.loadChat();
        if (id === 'topics') app.loadTopics();
        if (id === 'leaderboard') app.loadLB();
        if (id === 'history') app.loadHistory();
        if (id === 'admin') app.loadAdmin();
    },

    sendMessage: async () => {
        const input = document.getElementById('chat-input');
        if (!input.value.trim()) return;
        await push(ref(db, 'messages'), {
            u: user.username, t: input.value, time: serverTimestamp(), uid
        });
        input.value = "";
    },

    loadChat: () => {
        onValue(query(ref(db, 'messages'), limitToLast(30)), s => {
            const box = document.getElementById('chat-box');
            box.innerHTML = "";
            s.forEach(c => {
                const m = c.val();
                const isMe = m.uid === uid;
                box.innerHTML += `
                    <div class="flex ${isMe ? 'justify-end' : 'justify-start'}">
                        <div class="chat-bubble ${isMe ? 'my-chat' : ''}">
                            <p class="text-[9px] font-bold text-yellow-500">${m.u}</p>
                            <p class="text-sm">${m.t}</p>
                        </div>
                    </div>`;
            });
            box.scrollTop = box.scrollHeight;
        });
    },

    loadLB: () => {
        onValue(query(ref(db, 'users'), orderByChild('balance'), limitToLast(15)), s => {
            const list = document.getElementById('lb-list');
            list.innerHTML = "";
            let users = [];
            s.forEach(c => users.push(c.val()));
            users.reverse().forEach((u, i) => {
                list.innerHTML += `
                    <div class="glass p-4 rounded-2xl flex justify-between">
                        <span>#${i+1} ${u.username}</span>
                        <span class="text-green-500 font-bold">₱${u.balance.toFixed(2)}</span>
                    </div>`;
            });
        });
    },

    postTopic: async () => {
        const title = document.getElementById('topic-title').value;
        const desc = document.getElementById('topic-desc').value;
        if (!title || !desc) return;
        await push(ref(db, 'topics'), {
            title, desc, author: user.username, timestamp: serverTimestamp()
        });
        app.modal('modal-topic', false);
    },

    loadTopics: () => {
        onValue(query(ref(db, 'topics'), limitToLast(20)), s => {
            const list = document.getElementById('topics-list');
            list.innerHTML = "";
            s.forEach(c => {
                const t = c.val();
                list.innerHTML += `
                    <div class="glass p-5 rounded-3xl">
                        <h4 class="font-bold text-yellow-500">${t.title}</h4>
                        <p class="text-sm text-slate-300 mt-1">${t.desc}</p>
                        <p class="text-[10px] text-slate-500 mt-3">Post by ${t.author}</p>
                    </div>`;
            });
        });
    },

    presence: () => {
        const pRef = ref(db, `presence/${uid}`);
        set(pRef, { status: 'online', username: user.username });
        onDisconnect(pRef).remove();
        onValue(ref(db, 'presence'), s => {
            document.getElementById('online-count').innerText = s.size + ' Online';
        });
    },

    requestWithdraw: async () => {
        if (user.balance < 1) return alert("Min ₱1.00");
        const amt = user.balance;
        await push(ref(db, 'withdrawals'), {
            uid, username: user.username, gcash: user.gcash,
            amount: amt, status: 'pending', timestamp: serverTimestamp()
        });
        await update(ref(db, `users/${uid}`), { balance: 0 });
        alert("Requested!");
    },

    loadHistory: () => {
        onValue(ref(db, 'withdrawals'), s => {
            const list = document.getElementById('hist-list');
            list.innerHTML = "";
            s.forEach(c => {
                const w = c.val();
                if (w.uid === uid) {
                    list.innerHTML += `
                        <div class="glass p-4 rounded-2xl flex justify-between">
                            <div><p class="font-bold">₱${w.amount.toFixed(2)}</p></div>
                            <div class="text-[10px] font-bold ${w.status==='paid'?'text-green-500':'text-yellow-500'} uppercase">${w.status}</div>
                        </div>`;
                }
            });
        });
    },

    loadAdmin: () => {
        const pw = prompt("Pass:");
        if (pw !== "Propetas12") return app.nav('home');
        onValue(ref(db, 'withdrawals'), s => {
            const list = document.getElementById('admin-list');
            list.innerHTML = "";
            s.forEach(c => {
                const w = c.val();
                if (w.status === 'pending') {
                    list.innerHTML += `
                        <div class="glass p-4 rounded-xl">
                            <p class="text-xs">${w.username} - ${w.gcash}</p>
                            <p class="text-lg font-bold">₱${w.amount}</p>
                            <button onclick="app.approve('${c.key}')" class="bg-green-600 px-4 py-1 rounded-lg text-xs mt-2">APPROVE</button>
                        </div>`;
                }
            });
        });
    },

    approve: (k) => update(ref(db, `withdrawals/${k}`), { status: 'paid' }),
    modal: (id, show) => document.getElementById(id).style.display = show ? 'flex' : 'none',
    copyRef: () => {
        document.getElementById('ref-link').select();
        document.execCommand('copy');
        alert("Link Copied!");
    }
};

window.app = app;
app.init();
