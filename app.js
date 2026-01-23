
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, query, where, orderBy, limit, onSnapshot, updateDoc, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Telegram Init
const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();
const user = tg.initDataUnsafe.user;
const uid = user ? (user.username || `tg_${user.id}`) : "Guest_" + Math.floor(Math.random()*1000);
document.getElementById("userIdDisplay").innerText = uid;

const userRef = doc(db, "users", uid);
let currentBalance = 0;

// Real-time Balance & Total Earned
onSnapshot(userRef, (snap) => {
    if (snap.exists()) {
        currentBalance = snap.data().balance || 0;
        document.getElementById("balanceDisplay").innerText = currentBalance.toFixed(3);
    } else {
        setDoc(userRef, { balance: 0, totalEarned: 0, user: uid }, { merge: true });
    }
});

// Real-time Chat
const chatQ = query(collection(db, "chat_messages"), orderBy("timestamp", "desc"), limit(40));
onSnapshot(chatQ, (snap) => {
    const chatContainer = document.getElementById("chat-container");
    const threeDaysAgo = Date.now() - (3 * 24 * 60 * 60 * 1000);
    chatContainer.innerHTML = snap.docs
        .filter(d => d.data().timestamp?.toMillis() > threeDaysAgo)
        .reverse()
        .map(d => `<div class="msg ${d.data().user === uid ? 'me' : ''}"><b>${d.data().user}:</b><br>${d.data().text}</div>`)
        .join("");
    chatContainer.scrollTop = chatContainer.scrollHeight;
});

// Leaderboard (Top 10)
const leaderboardQ = query(collection(db, "users"), orderBy("totalEarned", "desc"), limit(10));
onSnapshot(leaderboardQ, (snap) => {
    document.querySelector("#leaderboardTable tbody").innerHTML = snap.docs.map((d, i) => `
        <tr>
            <td class="${i === 0 ? 'rank-gold' : ''}">#${i + 1}</td>
            <td>${d.data().user}</td>
            <td>₱${(d.data().totalEarned || 0).toFixed(3)}</td>
        </tr>
    `).join("");
});

// Ads Logic
async function triggerAds() {
    try {
        await show_10337853();
        await show_10337795();
        await show_10276123();
        return true;
    } catch (e) {
        alert("Ads not finished. Watch all 3 to earn.");
        return false;
    }
}

// Send Message
window.sendMessage = async () => {
    const input = document.getElementById("msgInput");
    const text = input.value.trim();
    if (!text) return;

    const cooldown = localStorage.getItem("lastMsg") || 0;
    if (Date.now() - cooldown < 180000) return alert("Wait 3 minutes cooldown.");

    const success = await triggerAds();
    if (success) {
        await addDoc(collection(db, "chat_messages"), { user: uid, text, timestamp: serverTimestamp() });
        await updateDoc(userRef, { 
            balance: increment(0.015),
            totalEarned: increment(0.015)
        });
        localStorage.setItem("lastMsg", Date.now());
        input.value = "";
    }
};

// Withdrawal Logic
window.requestWithdraw = async () => {
    const name = document.getElementById("gcName").value;
    const num = document.getElementById("gcNum").value;
    const amt = parseFloat(document.getElementById("withdrawAmt").value);

    if (amt < 0.015) return alert("Minimum withdrawal is ₱0.015");
    if (amt > currentBalance) return alert("Insufficient balance");

    await updateDoc(userRef, { balance: increment(-amt) });
    await addDoc(collection(db, "withdrawals"), {
        user: uid, gcashName: name, gcashNumber: num, amount: amt, status: "pending", timestamp: serverTimestamp()
    });
    alert("GCash request sent!");
};

// User's History
const historyQ = query(collection(db, "withdrawals"), where("user", "==", uid), orderBy("timestamp", "desc"), limit(5));
onSnapshot(historyQ, (snap) => {
    document.querySelector("#myWithdrawals tbody").innerHTML = snap.docs.map(d => `
        <tr><td>₱${d.data().amount.toFixed(3)}</td><td>${d.data().status}</td><td>${d.data().reason || '-'}</td></tr>
    `).join("");
});

// Admin Panel Logic
window.toggleOwner = () => {
    const p = document.getElementById("owner-panel");
    p.style.display = (p.style.display === "block") ? "none" : "block";
};

window.loginAdmin = () => {
    if (document.getElementById("adminPass").value === "Propetas6") {
        document.getElementById("adminAuth").style.display = "none";
        document.getElementById("adminContent").style.display = "block";
        loadAdminTable();
    } else {
        alert("Invalid Access");
    }
};

function loadAdminTable() {
    const adminQ = query(collection(db, "withdrawals"), where("status", "==", "pending"), limit(50));
    onSnapshot(adminQ, (snap) => {
        document.getElementById("adminWithdrawalTable").innerHTML = snap.docs.map(d => `
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
    await updateDoc(doc(db, "withdrawals", id), { status: "approved", reason: "Sent to GCash" });
};

window.reject = async (id) => {
    const reason = prompt("Rejection reason?");
    const snap = await getDoc(doc(db, "withdrawals", id));
    const data = snap.data();
    await updateDoc(doc(db, "users", data.user), { balance: increment(data.amount) }); // Refund
    await updateDoc(doc(db, "withdrawals", id), { status: "rejected", reason });
};

// Auto Refresh Native Ads every 30s
setInterval(() => {
    console.log("Refreshing ads space...");
    const container = document.getElementById("native-ad-container");
    container.style.opacity = "0.5";
    setTimeout(() => container.style.opacity = "1", 500);
}, 30000);

// Clock
setInterval(() => document.getElementById("clock").innerText = new Date().toLocaleString(), 1000);
