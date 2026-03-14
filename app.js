
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, addDoc, query, where, getDocs, increment, arrayUnion } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// State Management
let currentUser = null;
let timerInterval = null;
let timeLeft = 15;
let currentTaskId = null;
let activeTaskWindow = null;

const PAPERHOUSE = {
    async register() {
        const username = document.getElementById('reg-username').value.trim();
        const refCodeInput = document.getElementById('reg-referral').value.trim();
        
        if (!username) return alert("Enter username");

        const userRef = doc(db, "users", username);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            const myCode = Math.random().toString(36).substring(2, 8).toUpperCase();
            const newUser = {
                username,
                balance: 0,
                totalEarned: 0,
                referralCode: myCode,
                invites: 0,
                invitedBy: refCodeInput || null,
                freeLinksUsed: 0,
                completedTasks: [],
                lastDailyReset: new Date().toDateString()
            };
            
            // Handle Referral logic
            if (refCodeInput) {
                const q = query(collection(db, "users"), where("referralCode", "==", refCodeInput));
                const qSnap = await getDocs(q);
                if (!qSnap.empty && qSnap.docs[0].data().invites < 20) {
                    await updateDoc(doc(db, "users", qSnap.docs[0].id), {
                        invites: increment(1)
                    });
                }
            }

            await setDoc(userRef, newUser);
            currentUser = newUser;
        } else {
            currentUser = userSnap.data();
        }

        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        this.updateUI();
        this.loadTasks();
        this.triggerAds();
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
        if(tabId === 'profile') this.loadMyLinks();
    },

    async addTask(type) {
        const url = document.getElementById('fb-link').value;
        const desc = document.getElementById('fb-desc').value;

        if(!url.includes('facebook.com')) return alert("Invalid FB Link");

        if (type === 'free' && currentUser.freeLinksUsed >= 5) return alert("Free limit reached");
        if (type === 'paid' && currentUser.balance < 1) return alert("Insufficient Balance (₱1 required)");

        const taskData = {
            owner: currentUser.username,
            url,
            desc,
            type,
            clicksLeft: 100,
            status: 'active',
            createdAt: Date.now()
        };

        await addDoc(collection(db, "tasks"), taskData);
        
        if (type === 'free') {
            await updateDoc(doc(db, "users", currentUser.username), { freeLinksUsed: increment(1) });
        } else {
            await updateDoc(doc(db, "users", currentUser.username), { balance: increment(-1) });
        }
        
        alert("Task Created Successfully!");
        location.reload();
    },

    async loadTasks() {
        const q = query(collection(db, "tasks"), where("clicksLeft", ">", 0));
        const snap = await getDocs(q);
        const container = document.getElementById('task-list');
        container.innerHTML = '';

        snap.forEach(taskDoc => {
            const task = taskDoc.data();
            // Daily reappear logic: If task completed today, hide it.
            if (currentUser.completedTasks.includes(taskDoc.id)) return;

            const card = document.createElement('div');
            card.className = 'glass p-4 rounded-xl flex justify-between items-center';
            card.innerHTML = `
                <div>
                    <p class="font-bold text-lime-300">${task.desc || 'Facebook Task'}</p>
                    <p class="text-xs text-gray-400">Reward: ₱0.02 | Remaining: ${task.clicksLeft}</p>
                </div>
                <button onclick="app.startTask('${taskDoc.id}', '${task.url}')" class="bg-lime-500 text-black px-4 py-2 rounded-lg font-bold">Follow</button>
            `;
            container.appendChild(card);
        });
    },

    startTask(taskId, url) {
        this.triggerAds();
        currentTaskId = taskId;
        timeLeft = 15;
        document.getElementById('timer-overlay').classList.remove('hidden');
        activeTaskWindow = window.open(url, '_blank');
        
        this.runTimer();
    },

    runTimer() {
        clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (document.hidden) {
                document.getElementById('timer-status').innerText = "PAUSED: Return to app to continue";
                document.getElementById('resume-btn').classList.remove('hidden');
                return;
            }

            document.getElementById('timer-status').innerText = "Stay here until finished...";
            document.getElementById('resume-btn').classList.add('hidden');
            timeLeft--;
            document.getElementById('timer-display').innerText = timeLeft;

            if (timeLeft <= 0) {
                this.completeTask();
            }
        }, 1000);
    },

    async completeTask() {
        clearInterval(timerInterval);
        document.getElementById('timer-overlay').classList.add('hidden');
        
        const reward = 0.02;
        const refBonus = reward * 0.20;

        // Credit user
        await updateDoc(doc(db, "users", currentUser.username), {
            balance: increment(reward),
            totalEarned: increment(reward),
            completedTasks: arrayUnion(currentTaskId)
        });

        // Credit inviter
        if (currentUser.invitedBy) {
            const q = query(collection(db, "users"), where("referralCode", "==", currentUser.invitedBy));
            const qSnap = await getDocs(q);
            if (!qSnap.empty) {
                await updateDoc(doc(db, "users", qSnap.docs[0].id), {
                    balance: increment(refBonus)
                });
            }
        }

        // Update task
        await updateDoc(doc(db, "tasks", currentTaskId), {
            clicksLeft: increment(-1)
        });

        alert("Task Complete! ₱0.02 added.");
        location.reload();
    },

    async loadMyLinks() {
        const q = query(collection(db, "tasks"), where("owner", "==", currentUser.username));
        const snap = await getDocs(q);
        const container = document.getElementById('my-links-list');
        container.innerHTML = '';
        snap.forEach(doc => {
            const t = doc.data();
            container.innerHTML += `<div class="glass p-3 rounded text-sm">${t.url} <br> <span class="text-lime-400">Clicks Left: ${t.clicksLeft}</span></div>`;
        });
    },

    async submitDeposit() {
        const amount = document.getElementById('dep-amount').value;
        const receipt = document.getElementById('dep-receipt').value;
        if(!amount || !receipt) return alert("Fill all fields");
        
        await addDoc(collection(db, "deposits"), {
            user: currentUser.username,
            amount, receipt, status: 'pending', date: Date.now()
        });
        alert("Deposit submitted for manual approval.");
    },

    triggerAds() {
        // Randomly show one of the two ad providers
        try {
            if (Math.random() > 0.5) {
                if (window.show_10555663) window.show_10555663();
            } else {
                if (window.Adsgram) {
                    window.Adsgram.init({ blockId: "24438" }).show().catch(e => console.log(e));
                }
            }
        } catch (e) { console.error("Ad blocked or failed"); }
    }
};

window.app = PAPERHOUSE;
