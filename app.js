import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDMGU5X7BBp-C6tIl34Uuu5N9MXAVFTn7c",
    authDomain: "paper-house-inc.firebaseapp.com",
    projectId: "paper-house-inc",
    storageBucket: "paper-house-inc.firebasestorage.app",
    messagingSenderId: "658389836376",
    appId: "1:658389836376:web:2ab1e2743c593f4ca8e02d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

let currentUser = null;
const REWARD_AMOUNT = 0.50; // Amount in Peso per ad

// Elements
const balanceDisplay = document.getElementById('userBalance');
const btnWatchAd = document.getElementById('btnWatchAd');
const btnInApp = document.getElementById('btnInApp');
const statusMsg = document.getElementById('statusMsg');

// 1. Sign in User Anonymously
signInAnonymously(auth).catch((error) => {
    console.error("Auth Error", error);
    statusMsg.innerText = "Error signing in. Check connection.";
});

// 2. Listen for Auth State
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        setupUserData(user.uid);
    }
});

// 3. Setup or Sync User Data from Firestore
function setupUserData(uid) {
    const userRef = doc(db, "users", uid);

    // Initial check/creation
    getDoc(userRef).then((docSnap) => {
        if (!docSnap.exists()) {
            setDoc(userRef, { balance: 0.00, adsWatched: 0 });
        }
    });

    // Real-time listener for balance updates
    onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
            balanceDisplay.innerText = doc.data().balance.toFixed(2);
        }
    });
}

// 4. Function to Reward User in Database
async function giveReward() {
    if (!currentUser) return;
    const userRef = doc(db, "users", currentUser.uid);
    try {
        await updateDoc(userRef, {
            balance: increment(REWARD_AMOUNT),
            adsWatched: increment(1)
        });
        statusMsg.innerText = "Success! ₱0.50 added to your balance.";
        setTimeout(() => { statusMsg.innerText = ""; }, 3000);
    } catch (e) {
        console.error("Reward Error", e);
    }
}

// 5. Monetag Ad Triggers
btnWatchAd.onclick = () => {
    statusMsg.innerText = "Loading Ad...";
    
    // Rewarded Popup Format
    show_10276123('pop').then(() => {
        // This executes when the user watches or closes the ad successfully
        giveReward();
    }).catch(e => {
        statusMsg.innerText = "Ad failed to load. Try again later.";
        console.error("Ad Error:", e);
    });
};

btnInApp.onclick = () => {
    // In-App Interstitial Format (Auto-managed frequency)
    show_10276123({
        type: 'inApp',
        inAppSettings: {
            frequency: 2,
            capping: 0.1,
            interval: 30,
            timeout: 5,
            everyPage: false
        }
    });
};
