
// Firebase Configuration (REPLACE WITH YOUR ACTUAL CONFIG)
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// --- DOM Elements ---
const authSection = document.getElementById('auth-section');
const appContent = document.getElementById('app-content');
const userInfo = document.getElementById('user-info');
const userNameElem = document.getElementById('userName');
const userEmailElem = document.getElementById('userEmail');
const userTelegramUsernameElem = document.getElementById('userTelegramUsername');
const signInWithGoogleBtn = document.getElementById('signInWithGoogle');
const signOutBtn = document.getElementById('signOut');
const setTelegramUsernameBtn = document.getElementById('setTelegramUsernameBtn');
const telegramUsernameModal = document.getElementById('telegramUsernameModal');
const telegramUsernameInput = document.getElementById('telegramUsernameInput');
const saveTelegramUsernameBtn = document.getElementById('saveTelegramUsername');
const cancelTelegramUsernameBtn = document.getElementById('cancelTelegramUsername');
const telegramErrorElem = document.getElementById('telegramError');

const userBalanceElem = document.getElementById('userBalance');
const watchAdBtn = document.getElementById('watchAdBtn');
const adCooldownMessage = document.getElementById('adCooldownMessage');
const showRandomPopupAdBtn = document.getElementById('showRandomPopupAdBtn');
const popupAdCooldownMessage = document.getElementById('popupAdCooldownMessage');
const psychologicalTipsContainer = document.getElementById('psychologicalTips');

const userReferralCodeElem = document.getElementById('userReferralCode');
const referralCodeInput = document.getElementById('referralCodeInput');
const applyReferralCodeBtn = document.getElementById('applyReferralCodeBtn');
const referralErrorElem = document.getElementById('referralError');
const referralSuccessElem = document.getElementById('referralSuccess');

const withdrawalHistoryTableBody = document.querySelector('#withdrawalHistory tbody');

// --- Constants ---
const REWARD_AD_AMOUNT = 0.0065; // PHP
const REWARD_POPUP_AMOUNT = 0.0012; // PHP
const REWARD_AD_COOLDOWN_MS = 30 * 1000; // 30 seconds
const REWARD_POPUP_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes
const REFERRAL_BONUS_PERCENTAGE = 0.08; // 8%

// Monetag SDK functions (these are globally available after the script tags)
// show_10337795() and show_10337853()

// --- Global Variables ---
let currentUser = null;
let lastAdWatchTime = 0;
let lastPopupAdTime = 0;

// --- Psychological Tips (50 tips) ---
const psychologicalTips = [
    "Set clear, achievable goals to maintain motivation.",
    "Practice positive self-talk to boost confidence.",
    "Learn from failures; they are stepping stones to success.",
    "Avoid comparing yourself to others; focus on your own progress.",
    "Celebrate small wins to keep momentum going.",
    "Visualize your success to reinforce your goals.",
    "Break down large tasks into smaller, manageable steps.",
    "Stay persistent; success often comes after many attempts.",
    "Network with like-minded individuals for support and inspiration.",
    "Educate yourself continuously to stay ahead.",
    "Manage your time effectively to maximize productivity.",
    "Prioritize tasks based on importance and urgency.",
    "Delegate when possible to free up your time.",
    "Take regular breaks to avoid burnout.",
    "Maintain a healthy work-life balance.",
    "Develop a strong work ethic.",
    "Be adaptable to change and new opportunities.",
    "Cultivate a growth mindset.",
    "Seek feedback and use it for improvement.",
    "Don't be afraid to ask for help.",
    "Practice gratitude to improve your outlook.",
    "Stay organized to reduce stress.",
    "Automate repetitive tasks.",
    "Invest in yourself through learning and development.",
    "Understand your target audience deeply.",
    "Build a strong personal brand.",
    "Master the art of negotiation.",
    "Learn to say no to distractions.",
    "Focus on providing value to others.",
    "Be patient; success rarely happens overnight.",
    "Develop strong communication skills.",
    "Listen actively to understand better.",
    "Practice empathy in your interactions.",
    "Be decisive when necessary.",
    "Learn from your mistakes, but don't dwell on them.",
    "Maintain a positive attitude, even in challenges.",
    "Surround yourself with positive influences.",
    "Set boundaries to protect your time and energy.",
    "Review your progress regularly.",
    "Stay disciplined in your routines.",
    "Understand the power of compounding in finance.",
    "Diversify your income streams.",
    "Save and invest consistently.",
    "Avoid impulsive spending.",
    "Create a budget and stick to it.",
    "Understand market trends.",
    "Learn about different investment vehicles.",
    "Protect your assets.",
    "Seek financial advice from experts.",
    "Continuously look for opportunities to increase your value."
];

function getRandomTips(count = 5) {
    const shuffled = [...psychologicalTips].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

function displayPsychologicalTips() {
    const tips = getRandomTips(5); // Display 5 random tips
    psychologicalTipsContainer.innerHTML = '<h3>Psychological Tips for Earning:</h3><ul>' +
        tips.map(tip => `<li>${tip}</li>`).join('') +
        '</ul>';
    psychologicalTipsContainer.style.display = 'block';
    setTimeout(() => {
        psychologicalTipsContainer.style.display = 'none';
    }, 15000); // Hide after 15 seconds
}


// --- Utility Functions ---
function formatCurrency(amount) {
    return amount.toFixed(4) + ' PHP'; // Display 4 decimal places for precision
}

function generateReferralCode() {
    const chars = '0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function updateCooldownMessages() {
    const now = Date.now();

    // Ad Cooldown
    const nextAdAvailableTime = lastAdWatchTime + REWARD_AD_COOLDOWN_MS;
    if (now < nextAdAvailableTime) {
        const remainingSeconds = Math.ceil((nextAdAvailableTime - now) / 1000);
        adCooldownMessage.textContent = `Next ad in ${remainingSeconds} seconds.`;
        watchAdBtn.disabled = true;
    } else {
        adCooldownMessage.textContent = '';
        watchAdBtn.disabled = false;
    }

    // Popup Ad Cooldown
    const nextPopupAvailableTime = lastPopupAdTime + REWARD_POPUP_COOLDOWN_MS;
    if (now < nextPopupAvailableTime) {
        const remainingMinutes = Math.ceil((nextPopupAvailableTime - now) / (60 * 1000));
        popupAdCooldownMessage.textContent = `Next popup ad in ${remainingMinutes} minutes.`;
        showRandomPopupAdBtn.disabled = true;
    } else {
        popupAdCooldownMessage.textContent = '';
        showRandomPopupAdBtn.disabled = false;
    }
}

setInterval(updateCooldownMessages, 1000); // Update cooldown messages every second

// --- Firebase Authentication ---
auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    if (user) {
        authSection.style.display = 'none';
        appContent.style.display = 'block';
        userInfo.style.display = 'block';
        userNameElem.textContent = user.displayName || 'User';
        userEmailElem.textContent = user.email;

        // Fetch or create user document in Firestore
        const userRef = db.collection('users').doc(user.uid);
        const doc = await userRef.get();

        if (!doc.exists) {
            // New user, create document
            const newReferralCode = generateReferralCode();
            await userRef.set({
                email: user.email,
                displayName: user.displayName,
                balance: 0,
                referralCode: newReferralCode,
                referredBy: null,
                telegramUsername: null,
                lastAdWatch: 0,
                lastPopupAd: 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            userBalanceElem.textContent = formatCurrency(0);
            userReferralCodeElem.textContent = newReferralCode;
            userTelegramUsernameElem.textContent = 'Not set';
        } else {
            // Existing user, update UI
            const userData = doc.data();
            userBalanceElem.textContent = formatCurrency(userData.balance || 0);
            userReferralCodeElem.textContent = userData.referralCode || 'N/A';
            userTelegramUsernameElem.textContent = userData.telegramUsername || 'Not set';
            lastAdWatchTime = userData.lastAdWatch || 0;
            lastPopupAdTime = userData.lastPopupAd || 0;
        }

        // Listen for real-time updates to user data
        userRef.onSnapshot((snapshot) => {
            if (snapshot.exists) {
                const userData = snapshot.data();
                userBalanceElem.textContent = formatCurrency(userData.balance || 0);
                userTelegramUsernameElem.textContent = userData.telegramUsername || 'Not set';
                userReferralCodeElem.textContent = userData.referralCode || 'N/A';
                lastAdWatchTime = userData.lastAdWatch || 0;
                lastPopupAdTime = userData.lastPopupAd || 0;
                updateCooldownMessages(); // Update immediately on data change
            }
        });

        loadWithdrawalHistory(user.uid);

    } else {
        authSection.style.display = 'block';
        appContent.style.display = 'none';
        userInfo.style.display = 'none';
        userBalanceElem.textContent = formatCurrency(0);
        userReferralCodeElem.textContent = 'Loading...';
        withdrawalHistoryTableBody.innerHTML = '';
        lastAdWatchTime = 0;
        lastPopupAdTime = 0;
        updateCooldownMessages();
    }
});

signInWithGoogleBtn.addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider)
        .catch((error) => {
            console.error("Google Sign-In Error:", error);
            alert("Error signing in with Google: " + error.message);
        });
});

signOutBtn.addEventListener('click', () => {
    auth.signOut()
        .then(() => {
            alert("Signed out successfully!");
        })
        .catch((error) => {
            console.error("Sign Out Error:", error);
            alert("Error signing out: " + error.message);
        });
});

// --- Telegram Username Management ---
setTelegramUsernameBtn.addEventListener('click', () => {
    telegramUsernameInput.value = userTelegramUsernameElem.textContent === 'Not set' ? '' : userTelegramUsernameElem.textContent;
    telegramUsernameModal.style.display = 'flex';
    telegramErrorElem.textContent = '';
});

cancelTelegramUsernameBtn.addEventListener('click', () => {
    telegramUsernameModal.style.display = 'none';
});

saveTelegramUsernameBtn.addEventListener('click', async () => {
    const username = telegramUsernameInput.value.trim();
    if (!username) {
        telegramErrorElem.textContent = 'Telegram username cannot be empty.';
        return;
    }
    if (!username.startsWith('@')) {
        telegramErrorElem.textContent = 'Telegram username must start with "@".';
        return;
    }

    if (currentUser) {
        try {
            await db.collection('users').doc(currentUser.uid).update({
                telegramUsername: username
            });
            userTelegramUsernameElem.textContent = username;
            telegramUsernameModal.style.display = 'none';
            alert('Telegram username updated successfully!');
        } catch (error) {
            console.error('Error updating Telegram username:', error);
            telegramErrorElem.textContent = 'Failed to update username. Please try again.';
        }
    }
});


// --- Monetag Ad Integration ---

// Function to handle rewarding the user
async function rewardUser(amount, adType, referrerId = null) {
    if (!currentUser) {
        alert("You must be logged in to earn rewards.");
        return;
    }

    const userRef = db.collection('users').doc(currentUser.uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        console.error("User document not found.");
        return;
    }

    const userData = userDoc.data();
    let finalRewardAmount = amount;

    // Use a transaction to ensure atomicity
    try {
        await db.runTransaction(async (transaction) => {
            const currentBalance = (await transaction.get(userRef)).data().balance || 0;
            const newBalance = currentBalance + finalRewardAmount;

            transaction.update(userRef, {
                balance: newBalance,
                lastAdWatch: adType === 'rewardedAd' ? Date.now() : userData.lastAdWatch,
                lastPopupAd: adType === 'rewardedPopup' ? Date.now() : userData.lastPopupAd,
            });

            // If user has a referrer, reward the referrer
            if (userData.referredBy) {
                const referrerRef = db.collection('users').doc(userData.referredBy);
                const referrerDoc = await transaction.get(referrerRef);

                if (referrerDoc.exists) {
                    const referrerBonus = amount * REFERRAL_BONUS_PERCENTAGE;
                    const currentReferrerBalance = referrerDoc.data().balance || 0;
                    transaction.update(referrerRef, {
                        balance: currentReferrerBalance + referrerBonus
                    });
                    console.log(`Referrer ${userData.referredBy} rewarded with ${referrerBonus.toFixed(4)}`);

                    // Log referral bonus transaction (optional)
                    db.collection('transactions').add({
                        userId: userData.referredBy,
                        type: 'referral_bonus',
                        amount: referrerBonus,
                        fromUser: currentUser.uid,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }
            }

            // Log the reward transaction
            db.collection('transactions').add({
                userId: currentUser.uid,
                type: adType,
                amount: finalRewardAmount,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            userBalanceElem.textContent = formatCurrency(newBalance);
            alert(`You earned ${formatCurrency(finalRewardAmount)}!`);
            displayPsychologicalTips(); // Show tips after reward
        });
    } catch (error) {
        console.error("Transaction failed: ", error);
        alert("Failed to process reward. Please try again.");
    }
}


// Rewarded Interstitial Ad (Monetag #2)
watchAdBtn.addEventListener('click', async () => {
    if (!currentUser) {
        alert("Please sign in to watch ads.");
        return;
    }
    if (Date.now() < lastAdWatchTime + REWARD_AD_COOLDOWN_MS) {
        alert("Please wait for the cooldown to finish.");
        return;
    }

    watchAdBtn.disabled = true;
    adCooldownMessage.textContent = 'Loading ad...';

    try {
        // Use the first Monetag zone for rewarded interstitial
        await show_10337795();
        await rewardUser(REWARD_AD_AMOUNT, 'rewardedAd');
        lastAdWatchTime = Date.now(); // Update locally for immediate cooldown
    } catch (e) {
        console.error("Rewarded Ad Error:", e);
        alert("Ad failed or was not completed. No reward given.");
    } finally {
        watchAdBtn.disabled = false;
        updateCooldownMessages();
    }
});

// Rewarded Popup Ad (Monetag #3)
showRandomPopupAdBtn.addEventListener('click', async () => {
    if (!currentUser) {
        alert("Please sign in to watch ads.");
        return;
    }
    if (Date.now() < lastPopupAdTime + REWARD_POPUP_COOLDOWN_MS) {
        alert("Please wait for the cooldown to finish.");
        return;
    }

    showRandomPopupAdBtn.disabled = true;
    popupAdCooldownMessage.textContent = 'Loading popup ad...';

    try {
        // Use the second Monetag zone for rewarded popup
        await show_10337853('pop');
        await rewardUser(REWARD_POPUP_AMOUNT, 'rewardedPopup');
        lastPopupAdTime = Date.now(); // Update locally for immediate cooldown
    } catch (e) {
        console.error("Rewarded Popup Ad Error:", e);
        alert("Popup ad failed or was not completed. No reward given.");
    } finally {
        showRandomPopupAdBtn.disabled = false;
        updateCooldownMessages();
    }
});


// --- Referral System ---
applyReferralCodeBtn.addEventListener('click', async () => {
    if (!currentUser) {
        alert("Please sign in to apply a referral code.");
        return;
    }

    const code = referralCodeInput.value.trim();
    if (!code) {
        referralErrorElem.textContent = "Please enter a referral code.";
        return;
    }

    referralErrorElem.textContent = '';
    referralSuccessElem.textContent = '';
    applyReferralCodeBtn.disabled = true;

    try {
        const userRef = db.collection('users').doc(currentUser.uid);
        const userDoc = await userRef.get();
        const userData = userDoc.data();

        if (userData.referredBy) {
            referralErrorElem.textContent = "You have already been referred by someone.";
            return;
        }
        if (userData.referralCode === code) {
            referralErrorElem.textContent = "You cannot refer yourself.";
            return;
        }

        const referrerQuery = await db.collection('users').where('referralCode', '==', code).limit(1).get();

        if (referrerQuery.empty) {
            referralErrorElem.textContent = "Invalid referral code.";
            return;
        }

        const referrerDoc = referrerQuery.docs[0];
        const referrerId = referrerDoc.id;

        await userRef.update({
            referredBy: referrerId,
            referredAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        referralSuccessElem.textContent = `Referral code "${code}" applied successfully!`;
        referralCodeInput.value = '';

    } catch (error) {
        console.error("Error applying referral code:", error);
        referralErrorElem.textContent = "An error occurred while applying the referral code.";
    } finally {
        applyReferralCodeBtn.disabled = false;
    }
});


// --- Withdrawal History ---
async function loadWithdrawalHistory(userId) {
    if (!userId) {
        withdrawalHistoryTableBody.innerHTML = '<tr><td colspan="4">Please sign in to view history.</td></tr>';
        return;
    }

    withdrawalHistoryTableBody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';

    try {
        // For this example, we'll simulate withdrawals. In a real app, you'd have a withdrawal request process.
        // For now, let's just show some dummy data or transaction history that could represent withdrawals.
        // A proper withdrawal system would involve a separate 'withdrawals' collection.

        // Let's display the transaction history for now.
        const transactionsSnapshot = await db.collection('transactions')
            .where('userId', '==', userId)
            .orderBy('timestamp', 'desc')
            .limit(10) // Show last 10 transactions
            .get();

        if (transactionsSnapshot.empty) {
            withdrawalHistoryTableBody.innerHTML = '<tr><td colspan="4">No transaction history found.</td></tr>';
            return;
        }

        let historyHtml = '';
        transactionsSnapshot.forEach(doc => {
            const data = doc.data();
            const date = data.timestamp ? new Date(data.timestamp.toDate()).toLocaleString() : 'N/A';
            const status = data.type.includes('rewarded') ? 'Completed' : 'Pending/N/A'; // Simplified status
            const transactionId = doc.id; // Firestore document ID as transaction ID

            historyHtml += `
                <tr>
                    <td>${formatCurrency(data.amount)}</td>
                    <td>${date}</td>
                    <td>${status} (${data.type})</td>
                    <td>${transactionId}</td>
                </tr>
            `;
        });
        withdrawalHistoryTableBody.innerHTML = historyHtml;

    } catch (error) {
        console.error("Error loading withdrawal history:", error);
        withdrawalHistoryTableBody.innerHTML = '<tr><td colspan="4">Error loading history.</td></tr>';
    }
}

// Initial update of cooldown messages
updateCooldownMessages();

