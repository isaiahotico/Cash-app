
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, query, where, getDocs, increment, arrayUnion, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

let currentUser = null;
let timerInterval = null;
let timeLeft = 15;
let currentTaskId = null;
const ADMIN_PASS = "Propetas12";

const PAPERHOUSE = {
    async register() {
        const username = document.getElementById('reg-username').value.trim().toLowerCase();
        const refCodeInput = document.getElementById('reg-referral').value.trim().toUpperCase();
        
        if (!username) return alert("Username required");

        const userRef = doc(db, "users", username);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            const myCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            currentUser = {
                username, balance: 0, totalEarned: 0,
                referralCode: myCode, invites: 0,
                invitedBy: refCodeInput || null,
                freeLinksUsed: 0, completedTasks: [],
                lastDailyReset: new Date().toDateString()
            };

            if (refCodeInput) {
                const q = query(collection(db, "users"), where("referralCode", "==", refCodeInput));
                const qSnap = await getDocs(q);
                if (!qSnap.empty && qSnap.docs[0].data().invites < 20) {
                    await updateDoc(doc(db, "users", qSnap.docs[0].id), { invites: increment(1) });
                }
            }
            await setDoc(userRef, currentUser);
        } else {
            currentUser = userSnap.data();
            // Daily Reset Logic
            if (currentUser.lastDailyReset !== new Date().toDateString()) {
                await updateDoc(userRef, { completedTasks: [], lastDailyReset: new Date().toDateString() });
                currentUser.completedTasks = [];
            }
        }

        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        this.updateUI();
        this.loadTasks();
    },

    updateUI() {
        document.getElementById('stat-balance').innerText = currentUser.balance.toFixed(2);
        document.getElementById('stat-earned').innerText = currentUser.totalEarned.toFixed(2);
        document.getElementById('stat-invites').innerText = `${currentUser.invites}/20`;
        document.getElementById('stat-code').innerText = currentUser.referralCode;
    },

    showTab(tabId) {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById(`tab-${tabId}`).classList.remove('hidden');
        if(tabId === 'tasks') this.loadTasks();
        if(tabId === 'profile') this.loadMyLinks();
    },

    async addTask(type) {
        const url = document.getElementById('fb-link').value.trim();
        const desc = document.getElementById('fb-desc').value.trim();

        if(!url || !url.includes('facebook.com')) return alert("Enter a valid Facebook link");
        
        if (type === 'free' && currentUser.freeLinksUsed >= 5) return alert("You used your 5 free links!");
        if (type === 'paid' && currentUser.balance < 1) return alert("₱1 required for paid links");

        const taskData = {
            owner: currentUser.username,
            url, desc, type,
            clicksLeft: 100,
            status: 'active',
            timestamp: Date.now()
        };

        try {
            await addDoc(collection(db, "tasks"), taskData);
            if (type === 'free') {
                await updateDoc(doc(db, "users", currentUser.username), { freeLinksUsed: increment(1) });
            } else {
                await updateDoc(doc(db, "users", currentUser.username), { balance: increment(-1) });
            }
            alert("Task Posted! It is now live in the tasks section.");
            document.getElementById('fb-link').value = "";
            document.getElementById('fb-desc').value = "";
            this.loadTasks();
        } catch (e) { alert("Error adding task."); }
    },

    async loadTasks() {
        const q = query(collection(db, "tasks"), where("clicksLeft", ">", 0));
        const snap = await getDocs(q);
        const container = document.getElementById('task-list');
        container.innerHTML = '';

        snap.forEach(taskDoc => {
            const task = taskDoc.data();
            if (currentUser.completedTasks.includes(taskDoc.id)) return;

            const card = document.createElement('div');
            card.className = 'glass p-5 rounded-2xl flex justify-between items-center border-l-4 border-lime-500';
            card.innerHTML = `
                <div class="flex-1 pr-4">
                    <p class="font-bold text-lime-300 text-sm">${task.desc || 'Follow Facebook Page'}</p>
                    <p class="text-[10px] text-gray-400 mt-1">Reward: ₱0.02 | Clicks Left: ${task.clicksLeft}</p>
                </div>
                <button onclick="app.startTask('${taskDoc.id}', '${task.url}')" class="bg-lime-500 text-black px-5 py-2 rounded-xl font-black text-xs">GO</button>
            `;
            container.appendChild(card);
        });
    },

    startTask(taskId, url) {
        this.triggerAds();
        currentTaskId = taskId;
        timeLeft = 15;
        document.getElementById('timer-display').innerText = timeLeft;
        document.getElementById('timer-overlay').classList.remove('hidden');
        window.open(url, '_blank');
        this.runTimer();
    },

    runTimer() {
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (document.hidden) {
                document.getElementById('timer-status').innerText = "PAUSED: Come back to this tab!";
                document.getElementById('resume-btn').classList.remove('hidden');
                return;
            }
            document.getElementById('timer-status').innerText = "Task in progress...";
            document.getElementById('resume-btn').classList.add('hidden');
            timeLeft--;
            document.getElementById('timer-display').innerText = timeLeft;
            if (timeLeft <= 0) this.completeTask();
        }, 1000);
    },

    async completeTask() {
        clearInterval(timerInterval);
        document.getElementById('timer-overlay').classList.add('hidden');
        
        const reward = 0.02;
        const refBonus = reward * 0.20;

        await updateDoc(doc(db, "users", currentUser.username), {
            balance: increment(reward),
            totalEarned: increment(reward),
            completedTasks: arrayUnion(currentTaskId)
        });

        if (currentUser.invitedBy) {
            const q = query(collection(db, "users"), where("referralCode", "==", currentUser.invitedBy));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
                await updateDoc(doc(db, "users", qSnap.docs[0].id), { balance: increment(refBonus) });
            }
        }

        await updateDoc(doc(db, "tasks", currentTaskId), { clicksLeft: increment(-1) });
        alert("Success! ₱0.02 rewarded.");
        location.reload();
    },

    async submitDeposit() {
        const amount = parseFloat(document.getElementById('dep-amount').value);
        const receipt = document.getElementById('dep-receipt').value.trim();
        if(!amount || !receipt) return alert("Fill all details");
        
        await addDoc(collection(db, "deposits"), {
            user: currentUser.username,
            amount, receipt, timestamp: Date.now()
        });
        alert("Payment submitted. Admin will verify it.");
    },

    adminLogin() {
        const pass = document.getElementById('admin-pass').value;
        if(pass === ADMIN_PASS) {
            document.getElementById('admin-login').classList.add('hidden');
            document.getElementById('admin-panel').classList.remove('hidden');
            this.loadAdminDeposits();
        } else { alert("Wrong password"); }
    },

    async loadAdminDeposits() {
        const snap = await getDocs(collection(db, "deposits"));
        const container = document.getElementById('admin-deposit-list');
        container.innerHTML = '';
        snap.forEach(dDoc => {
            const d = dDoc.data();
            container.innerHTML += `
                <div class="glass p-4 rounded-xl flex justify-between items-center">
                    <div>
                        <p class="font-bold">${d.user} - ₱${d.amount}</p>
                        <p class="text-xs text-gray-400">ID: ${d.receipt}</p>
                    </div>
                    <button onclick="app.approveDeposit('${dDoc.id}', '${d.user}', ${d.amount})" class="bg-green-600 px-3 py-1 rounded text-xs">Approve</button>
                </div>
            `;
        });
    },

    async approveDeposit(docId, username, amount) {
        await updateDoc(doc(db, "users", username), { balance: increment(amount) });
        await deleteDoc(doc(db, "deposits", docId));
        alert("User credited successfully!");
        this.loadAdminDeposits();
    },

    async loadMyLinks() {
        const q = query(collection(db, "tasks"), where("owner", "==", currentUser.username));
        const snap = await getDocs(q);
        const container = document.getElementById('my-links-list');
        container.innerHTML = '';
        snap.forEach(d => {
            const t = d.data();
            container.innerHTML += `
                <div class="glass p-4 rounded-xl">
                    <p class="text-xs truncate text-blue-400">${t.url}</p>
                    <p class="font-bold text-lime-400">Remaining Clicks: ${t.clicksLeft}</p>
                </div>
            `;
        });
    },

    triggerAds() {
        try {
            if (Math.random() > 0.5) { if (window.show_10555663) window.show_10555663(); } 
            else { if (window.Adsgram) window.Adsgram.init({ blockId: "24438" }).show().catch(e => {}); }
        } catch (e) {}
    }
};

window.app = PAPERHOUSE;
