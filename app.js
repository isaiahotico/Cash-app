
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, query, where, orderBy, limit, onSnapshot, updateDoc, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Telegram Logic
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();
const user = tg.initDataUnsafe.user;
const username = user ? (user.username || `user_${user.id}`) : "Guest_" + Math.floor(Math.random()*999);
document.getElementById("userDisplay").innerText = "👤 " + username;

const userRef = doc(db, "users", username);
let myBalance = 0;

// Balance Listener
onSnapshot(userRef, (snap) => {
    if (snap.exists()) {
        myBalance = snap.data().balance || 0;
        document.getElementById("balDisplay").innerText = myBalance.toFixed(3);
    } else {
        setDoc(userRef, { balance: 0, totalEarned: 0, user: username }, { merge: true });
    }
});

// Load Global Chat
const chatQ = query(collection(db, "chat_messages"), orderBy("timestamp", "desc"), limit(50));
onSnapshot(chatQ, (snap) => {
    const win = document.getElementById("chat-window");
    const cutoff = Date.now() - (3 * 24 * 60 * 60 * 1000);
    win.innerHTML = snap.docs
        .filter(d => d.data().timestamp?.toMillis() > cutoff)
        .reverse()
        .map(d => `<div class="msg ${d.data().user === username ? 'me' : ''}"><b>${d.data().user}:</b><br>${d.data().text}</div>`)
        .join("");
    win.scrollTop = win.scrollHeight;
});

// Manual Ad Trigger (Popunder + Native)
window.triggerManualAds = () => {
    // 1. Trigger Popunder
    const popScript = document.createElement('script');
    popScript.dataset.zone = '10049581';
    popScript.src = 'https://al5sm.com/tag.min.js';
    document.body.appendChild(popScript);

    // 2. Trigger Native Ads
    const nativeContainer = document.getElementById("native-container");
    nativeContainer.innerHTML = '<small style="color:yellow">Native Ads Loaded!</small>';
    const natScript = document.createElement('script');
    natScript.dataset.zone = '10109465';
    natScript.src = 'https://groleegni.net/vignette.min.js';
    nativeContainer.appendChild(natScript);
    
    alert("Ads activated! Please click the ads to support us.");
};

// Interstitial Ads
async function runInterstitial() {
    try {
        await show_10337853();
        await show_10337795();
        await show_10276123();
        return true;
    } catch (e) {
        alert("Please complete all 3 ads to send message and earn.");
        return false;
    }
}

// Send Chat
window.sendMessage = async () => {
    const input = document.getElementById("chatInput");
    const text = input.value.trim();
    if (!text) return;

    const last = localStorage.getItem("lastMsg") || 0;
    if (Date.now() - last < 180000) return alert("Cooldown: 3 minutes.");

    const adStatus = await runInterstitial();
    if (adStatus) {
        await addDoc(collection(db, "chat_messages"), { user: username, text, timestamp: serverTimestamp() });
        await updateDoc(userRef, { balance: increment(0.015), totalEarned: increment(0.015) });
        localStorage.setItem("lastMsg", Date.now());
        input.value = "";
    }
};

// Leaderboard
onSnapshot(query(collection(db, "users"), orderBy("totalEarned", "desc"), limit(10)), (snap) => {
    document.querySelector("#leaderTable tbody").innerHTML = snap.docs.map((d, i) => `
        <tr><td>#${i + 1}</td><td>${d.data().user}</td><td>₱${(d.data().totalEarned || 0).toFixed(3)}</td></tr>
    `).join("");
});

// Withdrawal
window.requestWithdraw = async () => {
    const name = document.getElementById("gcashName").value;
    const num = document.getElementById("gcashNum").value;
    const amt = parseFloat(document.getElementById("withdrawAmt").value);

    if (amt < 0.015) return alert("Min 0.015 PHP");
    if (amt > myBalance) return alert("Insufficient balance");

    await updateDoc(userRef, { balance: increment(-amt) });
    await addDoc(collection(db, "withdrawals"), {
        user: username, gcashName: name, gcashNumber: num, amount: amt, status: "pending", timestamp: serverTimestamp()
    });
    alert("Request submitted!");
};

// History
onSnapshot(query(collection(db, "withdrawals"), where("user", "==", username), orderBy("timestamp", "desc"), limit(5)), (snap) => {
    document.querySelector("#myHistory tbody").innerHTML = snap.docs.map(d => `
        <tr><td>₱${d.data().amount.toFixed(3)}</td><td>${d.data().status}</td><td>${d.data().note || '-'}</td></tr>
    `).join("");
});

// Admin Dashboard
window.toggleOwner = () => {
    const p = document.getElementById("owner-panel");
    p.style.display = (p.style.display === "block") ? "none" : "block";
};

window.loginAdmin = () => {
    if (document.getElementById("adminPass").value === "Propetas6") {
        document.getElementById("adminLogin").style.display = "none";
        document.getElementById("adminContent").style.display = "block";
        loadAdmin();
    } else {
        alert("Wrong Password");
    }
};

function loadAdmin() {
    onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "pending")), (snap) => {
        document.getElementById("adminTable").innerHTML = snap.docs.map(d => `
            <tr>
                <td>${d.data().user}</td>
                <td>${d.data().gcashNumber}</td>
                <td>₱${d.data().amount}</td>
                <td>
                    <button onclick="approve('${d.id}')" style="background:green;color:white">Approve</button>
                    <button onclick="reject('${d.id}')" style="background:red;color:white">Reject</button>
                </td>
            </tr>
        `).join("");
    });
}

window.approve = async (id) => {
    await updateDoc(doc(db, "withdrawals", id), { status: "approved", note: "Sent via GCash" });
};

window.reject = async (id) => {
    const snap = await getDoc(doc(db, "withdrawals", id));
    const data = snap.data();
    await updateDoc(doc(db, "users", data.user), { balance: increment(data.amount) }); // Refund
    await updateDoc(doc(db, "withdrawals", id), { status: "rejected", note: "Rejected by owner" });
};

setInterval(() => document.getElementById("timeClock").innerText = new Date().toLocaleString(), 1000);
