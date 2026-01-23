
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, query, where, orderBy, limit, onSnapshot, updateDoc, serverTimestamp, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Telegram Setup
const tg = window.Telegram.WebApp;
tg.ready();
const user = tg.initDataUnsafe.user;
const myUid = user ? (user.username || `id_${user.id}`) : "Guest_" + Math.random().toString(36).substr(2, 5);
document.getElementById("nameLabel").innerText = "👤 " + myUid;

const myRef = doc(db, "users", myUid);
let myBal = 0;

// Balance Listener
onSnapshot(myRef, (snap) => {
    if (snap.exists()) {
        myBal = snap.data().balance || 0;
        document.getElementById("balLabel").innerText = myBal.toFixed(3);
    } else {
        setDoc(myRef, { balance: 0, totalEarned: 0, user: myUid }, { merge: true });
    }
});

// Chat Sync (Real-time Firestore)
const chatQ = query(collection(db, "chat_messages"), orderBy("timestamp", "desc"), limit(40));
onSnapshot(chatQ, (snap) => {
    const box = document.getElementById("chat-box");
    box.innerHTML = snap.docs
        .reverse()
        .map(d => `<div class="msg ${d.data().user === myUid ? 'me' : ''}"><b>${d.data().user}</b><br>${d.data().text}</div>`)
        .join("");
    box.scrollTop = box.scrollHeight;
});

// MULTI-AD TRIGGER (Popunder + Multiple Native)
window.loadPremiumAds = () => {
    // 1. Popunder
    const pop = document.createElement('script');
    pop.dataset.zone = '10049581';
    pop.src = 'https://al5sm.com/tag.min.js';
    document.body.appendChild(pop);

    // 2. Native Slot 1
    const n1 = document.createElement('script');
    n1.dataset.zone = '10109465';
    n1.src = 'https://groleegni.net/vignette.min.js';
    document.getElementById("slot1").innerHTML = "";
    document.getElementById("slot1").appendChild(n1);

    // 3. Backup Native Slot 2 (Loads a second instance for more revenue)
    const n2 = document.createElement('script');
    n2.dataset.zone = '10109465'; 
    n2.src = 'https://groleegni.net/vignette.min.js';
    document.getElementById("slot2").innerHTML = "";
    document.getElementById("slot2").appendChild(n2);
    
    alert("Premium Ads Loaded! Please interact with them to support the community.");
};

// Send Message Flow
window.processMessage = async () => {
    const inp = document.getElementById("msgText");
    const val = inp.value.trim();
    if (!val) return;

    const cooldown = localStorage.getItem("lastMsgTime") || 0;
    if (Date.now() - cooldown < 180000) return alert("Please wait 3 minutes (Cooldown).");

    // Rewarded Interstitials
    try {
        await show_10337853();
        await show_10337795();
        await show_10276123();

        await addDoc(collection(db, "chat_messages"), { user: myUid, text: val, timestamp: serverTimestamp() });
        await updateDoc(myRef, { balance: increment(0.015), totalEarned: increment(0.015) });
        
        localStorage.setItem("lastMsgTime", Date.now());
        inp.value = "";
    } catch (e) {
        alert("Ads interrupted. No reward given.");
    }
};

// Leaderboard Sync
onSnapshot(query(collection(db, "users"), orderBy("totalEarned", "desc"), limit(10)), (snap) => {
    document.querySelector("#rankTable tbody").innerHTML = snap.docs.map((d, i) => `
        <tr><td>#${i + 1}</td><td>${d.data().user}</td><td>₱${(d.data().totalEarned || 0).toFixed(3)}</td></tr>
    `).join("");
});

// Withdrawal Logic
window.sendWithdrawal = async () => {
    const name = document.getElementById("gcName").value;
    const num = document.getElementById("gcNum").value;
    const amt = parseFloat(document.getElementById("gcAmt").value);

    if (amt < 0.015 || isNaN(amt)) return alert("Minimum withdrawal is 0.015 PHP");
    if (amt > myBal) return alert("Insufficient Balance");

    await updateDoc(myRef, { balance: increment(-amt) });
    await addDoc(collection(db, "withdrawals"), {
        user: myUid, gcashName: name, gcashNumber: num, amount: amt, status: "pending", timestamp: serverTimestamp()
    });
    alert("Withdrawal submitted to owner for approval.");
};

// History Listener
onSnapshot(query(collection(db, "withdrawals"), where("user", "==", myUid), orderBy("timestamp", "desc"), limit(5)), (snap) => {
    document.querySelector("#historyTable tbody").innerHTML = snap.docs.map(d => `
        <tr><td>₱${d.data().amount.toFixed(3)}</td><td>${d.data().status}</td><td>${d.data().note || '-'}</td></tr>
    `).join("");
});

// OWNER DASHBOARD LOGIC
window.openDashboard = () => document.getElementById("owner-ui").style.display = "block";
window.closeDashboard = () => document.getElementById("owner-ui").style.display = "none";

window.verifyAdmin = () => {
    if (document.getElementById("passInput").value === "Propetas6") {
        document.getElementById("adminAuth").style.display = "none";
        document.getElementById("adminArea").style.display = "block";
        loadAdminData();
    } else {
        alert("Access Denied");
    }
};

function loadAdminData() {
    onSnapshot(query(collection(db, "withdrawals"), where("status", "==", "pending")), (snap) => {
        document.getElementById("requestTable").innerHTML = snap.docs.map(d => `
            <tr>
                <td>${d.data().user}</td>
                <td>${d.data().gcashNumber}</td>
                <td>₱${d.data().amount}</td>
                <td>
                    <button onclick="updateReq('${d.id}', 'approved')" style="background:green;color:white">Approve</button>
                    <button onclick="updateReq('${d.id}', 'rejected')" style="background:red;color:white">Reject</button>
                </td>
            </tr>
        `).join("");
    });
}

window.updateReq = async (id, stat) => {
    const note = (stat === 'approved') ? "Sent to GCash" : prompt("Enter rejection reason:");
    if (stat === 'rejected') {
        const snap = await getDoc(doc(db, "withdrawals", id));
        await updateDoc(doc(db, "users", snap.data().user), { balance: increment(snap.data().amount) });
    }
    await updateDoc(doc(db, "withdrawals", id), { status: stat, note: note });
};

setInterval(() => document.getElementById("liveClock").innerText = new Date().toLocaleString(), 1000);
