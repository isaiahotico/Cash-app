
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
const REWARD = 0.0102;
const COOLDOWN = 45;

let user = null;
let uid = localStorage.getItem('ph_uid');
let cd = {};

const app = {
    init: async () => {
        if (!uid) {
            uid = 'U' + Math.floor(Math.random() * 900000);
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
        if (name.length < 3 || gcash.length < 10) return alert("Fill all fields");
        user = { uid, username: name, gcash, balance: 0, totalAds: 0 };
        await set(ref(db, `users/${uid}`), user);
        app.launch();
    },

    launch: () => {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        app.sync();
        app.presence();
        app.nav('home');
    },

    sync: () => {
        onValue(ref(db, `users/${uid}`), s => {
            user = s.val();
            document.getElementById('user-display').innerText = user.username;
            document.getElementById('balance-display').innerText = `₱${user.balance.toFixed(4)}`;
            document.getElementById('big-balance').innerText = `₱${user.balance.toFixed(4)}`;
        });
    },

    playAd: async (type) => {
        if (cd[type] > 0) return alert(`Wait ${cd[type]}s`);

        if (type === 'popup') {
            // Randomly pick 1 zone for the Pop-up button
            const zone = ZONES[Math.floor(Math.random() * ZONES.length)];
            try { if (window[zone]) await window[zone](); } catch (e) {}
        } else {
            // Row Ads for Prem/Turbo (Sequence of 3)
            for (const zone of ZONES) {
                try { if (window[zone]) await window[zone](); } catch (e) {}
            }
        }

        // Grant Universal Reward
        const newBal = (user.balance || 0) + REWARD;
        await update(ref(db, `users/${uid}`), { balance: parseFloat(newBal.toFixed(4)), totalAds: (user.totalAds || 0) + 1 });
        app.startCD(type);
    },

    startCD: (type) => {
        cd[type] = COOLDOWN;
        const short = type.substring(0, 4);
        const btn = document.getElementById(`btn-${short}`);
        const lbl = document.getElementById(`timer-${short}`);
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
        document.getElementById(`sec-${id}`).classList.remove('hidden');
        if (id === 'chat') app.loadChat();
        if (id === 'topics') app.loadTopics();
        if (id === 'online') app.loadOnline();
        if (id === 'history') app.loadHistory();
        if (id === 'admin') app.loadAdmin();
    },

    postTopic: async () => {
        const title = document.getElementById('topic-title').value;
        const desc = document.getElementById('topic-desc').value;
        if (!title || !desc) return;
        await push(ref(db, 'topics'), { title, desc, author: user.username, timestamp: serverTimestamp() });
        app.modal('modal-topic', false);
    },

    loadTopics: () => {
        onValue(query(ref(db, 'topics'), limitToLast(20)), s => {
            const list = document.getElementById('topics-list');
            list.innerHTML = "";
            s.forEach(c => {
                const t = c.val();
                const div = document.createElement('div');
                div.className = "glass p-5 rounded-2xl active:bg-slate-800 transition";
                div.innerHTML = `<h4 class="font-bold text-yellow-500">${t.title}</h4><p class="text-[10px] text-slate-500">By ${t.author}</p>`;
                div.onclick = () => app.viewTopic(t);
                list.prepend(div);
            });
        });
    },

    viewTopic: (t) => {
        app.nav('topic-detail');
        document.getElementById('topic-content-detail').innerHTML = `
            <h2 class="text-2xl font-black text-yellow-500 mb-2">${t.title}</h2>
            <p class="text-xs text-slate-400 mb-4 italic">Posted by ${t.author}</p>
            <p class="text-sm leading-relaxed">${t.desc}</p>
        `;
    },

    loadOnline: () => {
        onValue(ref(db, 'presence'), s => {
            const list = document.getElementById('online-list');
            list.innerHTML = "";
            s.forEach(c => {
                list.innerHTML += `<div class="glass p-3 rounded-xl text-center text-xs font-bold text-green-400">${c.val().username}</div>`;
            });
            document.getElementById('online-count').innerText = s.size + ' Online';
        });
    },

    presence: () => {
        const pRef = ref(db, `presence/${uid}`);
        set(pRef, { username: user.username });
        onDisconnect(pRef).remove();
    },

    sendMessage: async () => {
        const input = document.getElementById('chat-input');
        if (!input.value.trim()) return;
        await push(ref(db, 'messages'), { u: user.username, t: input.value, time: serverTimestamp(), uid });
        input.value = "";
    },

    loadChat: () => {
        onValue(query(ref(db, 'messages'), limitToLast(30)), s => {
            const box = document.getElementById('chat-box');
            box.innerHTML = "";
            s.forEach(c => {
                const m = c.val();
                const isMe = m.uid === uid;
                box.innerHTML += `<div class="flex ${isMe ? 'justify-end' : 'justify-start'}"><div class="chat-bubble ${isMe ? 'my-chat' : ''}"><p class="text-[9px] font-bold text-yellow-500">${m.u}</p><p class="text-sm">${m.t}</p></div></div>`;
            });
            box.scrollTop = box.scrollHeight;
        });
    },

    requestWithdraw: async () => {
        if (user.balance < 1) return alert("Min ₱1.00");
        const amt = user.balance;
        await push(ref(db, 'withdrawals'), { uid, username: user.username, gcash: user.gcash, amount: amt, status: 'pending', timestamp: serverTimestamp() });
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
                    list.innerHTML += `<div class="glass p-4 rounded-xl flex justify-between"><div><p class="font-bold">₱${w.amount.toFixed(2)}</p></div><div class="text-[10px] font-bold ${w.status === 'paid' ? 'text-green-500' : 'text-yellow-500'} uppercase">${w.status}</div></div>`;
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
                    list.innerHTML += `<div class="glass p-4 rounded-xl flex justify-between items-center"><p class="text-xs font-bold">${w.username} - ₱${w.amount}</p><button onclick="app.approve('${c.key}')" class="bg-green-600 px-3 py-1 rounded text-[10px]">PAY</button></div>`;
                }
            });
        });
    },

    approve: (k) => update(ref(db, `withdrawals/${k}`), { status: 'paid' }),
    modal: (id, show) => document.getElementById(id).style.display = show ? 'flex' : 'none'
};

window.app = app;
app.init();
