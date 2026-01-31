/* ───── FIREBASE CONFIG ───── */
firebase.initializeApp({
  apiKey: "AIzaSyBXYAc9-UAB0DzqYsFKAHR_OsRD2UhVLjs",
  authDomain: "project-ads-app-telegram.firebaseapp.com",
  projectId: "project-ads-app-telegram"
});
const db = firebase.firestore();

/* ───── TELEGRAM INIT ───── */
const tg = window.Telegram.WebApp;
tg.ready();

let UID = null;
let ADMIN_MODE = false;

/* ───── VERIFY TELEGRAM USER ───── */
fetch("/verifyUser", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ initData: tg.initData })
})
.then(r => r.json())
.then(d => {
  UID = d.uid;
  document.getElementById("tgUser").innerText = "@" + d.username;

  // Real-time balance
  db.collection("users").doc(UID)
    .onSnapshot(doc => {
      if (doc.exists) {
        document.getElementById("balance").innerText =
          doc.data().balance.toFixed(5);
      }
    });
});

/* ───── WATCH AD ───── */
function watchAd() {
  show_10276123().then(() => {
    fetch("/rewardAd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: UID })
    });
  }).catch(() => alert("Ad not available"));
}

/* ───── REQUEST WITHDRAW ───── */
function requestWithdraw() {
  fetch("/requestWithdraw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid: UID })
  }).then(() => alert("Withdrawal requested"));
}

/* ───── ADMIN DASHBOARD ───── */
function toggleAdmin() {
  if (!ADMIN_MODE) {
    const pass = prompt("Admin password");
    if (pass !== "Propetas6") return alert("Wrong password");
    ADMIN_MODE = true;
    document.getElementById("adminPanel").classList.remove("hidden");
    loadWithdrawals();
  } else {
    document.getElementById("adminPanel").classList.add("hidden");
    ADMIN_MODE = false;
  }
}

function loadWithdrawals() {
  db.collection("withdrawals")
    .where("status", "==", "pending")
    .onSnapshot(snap => {
      const box = document.getElementById("withdrawals");
      box.innerHTML = "";

      snap.forEach(doc => {
        const d = doc.data();
        box.innerHTML += `
          <div class="item">
            <b>${d.uid}</b><br>
            Amount: ${d.amount} USDT<br>
            <button onclick="approve('${doc.id}')">Approve</button>
          </div>`;
      });
    });
}

function approve(id) {
  fetch("/adminWithdraw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      password: "Propetas6"
    })
  });
}
