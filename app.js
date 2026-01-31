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
tg.expand(); // 🔥 IMPORTANT: fixes click issues

let UID = null;

/* ───── SHOW TELEGRAM USER IMMEDIATELY ───── */
const tgUser = tg.initDataUnsafe?.user;

if (!tgUser) {
  alert("Please open inside Telegram");
  tg.close();
}

// Display instantly (no waiting)
document.getElementById("tgUser").innerText =
  "@" + (tgUser.username || "NoUsername");

/* ───── VERIFY USER (BACKGROUND) ───── */
fetch("/verifyUser", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ initData: tg.initData })
})
.then(r => r.json())
.then(d => {
  UID = d.uid;

  // Enable buttons ONLY after verification
  document.getElementById("watchBtn").disabled = false;
  document.getElementById("withdrawBtn").disabled = false;

  // Real-time balance
  db.collection("users").doc(UID)
    .onSnapshot(doc => {
      if (doc.exists) {
        document.getElementById("balance").innerText =
          doc.data().balance.toFixed(5);
      }
    });
})
.catch(() => {
  alert("Verification failed");
  tg.close();
});

/* ───── WATCH AD ───── */
function watchAd() {
  if (!UID) return;

  show_10276123().then(() => {
    fetch("/rewardAd", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: UID })
    });
  }).catch(() => {
    alert("Ad not available");
  });
}

/* ───── REQUEST WITHDRAW ───── */
function requestWithdraw() {
  if (!UID) return;

  fetch("/requestWithdraw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid: UID })
  }).then(() => {
    alert("Withdrawal request sent");
  });
}
