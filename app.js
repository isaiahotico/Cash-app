
// Firebase Configuration (Replace with your actual values)
const firebaseConfig = {
    apiKey: "AIzaSyBwpa8mA83JAv2A2Dj0rh5VHwodyv5N3dg",
    authDomain: "freegcash-ads.firebaseapp.com",
    projectId: "freegcash-ads",
    storageBucket: "freegcash-ads.appspot.com",
    messagingSenderId: "608086825364",
    appId: "1:608086825364:web:3a8e628d231b52c6171781",
    measurementId: "G-Z64B87ELGP"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth(); // For Firebase Authentication

// Global variables
const AD_REWARD_AMOUNT = 0.0065;
const POPUP_REWARD_AMOUNT = 0.0012; // Not directly used for now, but kept for future if you want a separate button
const MIN_WITHDRAWAL_AMOUNT = 0.02;
const REFERRAL_BONUS_PERCENTAGE = 0.08; // 8%
const ADMIN_PASSWORD = "Propetas12"; // Admin password

const AD_COOLDOWN_TIME = 30 * 1000; // 30 seconds
const IN_APP_INTERSTITIAL_COOLDOWN_TIME = 3 * 60 * 1000; // 3 minutes

let userId = localStorage.getItem('paperhouse_user_id'); // Persistent user ID
let userRef; // Firestore reference for the current user's document

let lastAdWatchTime = 0;
let lastInAppInterstitialTime = 0;

// Monetag Zone IDs
const MONETAG_ZONES = [
    'show_10276123', // Original
    'show_10337795', // Monetag #2
    'show_10337853'  // Monetag #3
];

// Psychological tips (50 tips)
const PSYCH_TIPS = [
    "Set clear financial goals. Knowing what you're saving for makes it easier to resist impulse spending.",
    "Track your spending. Awareness is the first step to financial control.",
    "Automate your savings. Set up automatic transfers to a savings account.",
    "Live below your means. Spend less than you earn to build wealth.",
    "Avoid debt, especially high-interest debt. It's a wealth killer.",
    "Invest in yourself. Education and skills can increase your earning potential.",
    "Diversify your income. Don't rely on a single source of money.",
    "Practice delayed gratification. Resisting immediate pleasure for long-term gain.",
    "Review your finances regularly. Stay on top of your progress.",
    "Find a financial mentor. Learn from someone who has achieved financial success.",
    "Celebrate small wins. Acknowledge your progress to stay motivated.",
    "Visualize your financial future. See yourself achieving your goals.",
    "Understand the power of compound interest. Start investing early.",
    "Be patient. Building wealth takes time and consistency.",
    "Don't compare your financial journey to others. Everyone's path is different.",
    "Learn to say 'no' to unnecessary expenses.",
    "Create a budget and stick to it. It's your financial roadmap.",
    "Build an emergency fund. Protect yourself from unexpected expenses.",
    "Negotiate for better deals. Don't be afraid to ask.",
    "Surround yourself with financially responsible people.",
    "Educate yourself about personal finance. Knowledge is power.",
    "Don't chase fads. Stick to proven financial strategies.",
    "Understand your relationship with money. Address any emotional spending triggers.",
    "Set boundaries with friends and family regarding money.",
    "Give back. Philanthropy can provide a sense of purpose and abundance.",
    "Stay positive. A positive mindset can overcome financial challenges.",
    "Focus on value, not just price. Sometimes paying more for quality saves money in the long run.",
    "Review subscriptions and cancel unused ones.",
    "Cook at home more often. Eating out is a major expense.",
    "Find free entertainment options.",
    "Repair instead of replacing. Extend the life of your belongings.",
    "Sell unused items. Declutter and earn extra cash.",
    "Shop with a list to avoid impulse buys.",
    "Use cash for discretionary spending to feel the transaction.",
    "Question every purchase: 'Do I need this, or do I just want it?'",
    "Learn a new skill that can save you money (e.g., basic car maintenance).",
    "Consider passive income streams.",
    "Understand taxes and deductions.",
    "Get adequate insurance to protect your assets.",
    "Don't put all your eggs in one basket (investment diversification).",
    "Seek professional financial advice when needed.",
    "Avoid get-rich-quick schemes.",
    "Be mindful of lifestyle creep as your income increases.",
    "Teach financial literacy to your children.",
    "Practice gratitude for what you have.",
    "Understand the difference between assets and liabilities.",
    "Regularly check your credit score.",
    "Set realistic expectations for your financial growth.",
    "Remember that financial freedom is a journey, not a destination.",
    "Your net worth is not your self-worth."
];


// --- Utility Functions ---
function generateReferralCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function showMessage(elementId, message, isError = false) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.color = isError ? 'red' : 'green';
        setTimeout(() => {
            element.textContent = '';
            element.style.color = '';
        }, 5000);
    }
}

function getRandomMonetagZoneFunction() {
    const randomZone = MONETAG_ZONES[Math.floor(Math.random() * MONETAG_ZONES.length)];
    // Dynamically get the function from the window object
    return window[randomZone];
}

// --- User Management ---
async function initializeUser() {
    // 1. Authenticate anonymously with Firebase Auth
    try {
        let authResult = await auth.signInAnonymously();
        userId = authResult.user.uid;
        console.log("Firebase Auth UID:", userId);
    } catch (error) {
        console.error("Error signing in anonymously:", error);
        alert("Failed to initialize user. Please try again.");
        return;
    }

    // 2. Check for existing user data in Firestore
    userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        // New user: Create a new document
        const referralCode = generateReferralCode();
        await userRef.set({
            balance: 0,
            totalEarned: 0,
            referralCode: referralCode,
            referredBy: null,
            totalReferredEarnings: 0,
            telegramUsername: '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        console.log("New user initialized in Firestore:", userId);
    } else {
        console.log("Existing user loaded from Firestore:", userId);
    }

    // Update UI with user ID
    document.getElementById('profile-user-id').textContent = userId;

    // Start listening to real-time data
    listenToUserData();
    listenToWithdrawalHistory();
    listenToChatMessages();
    listenToLeaderboard();
}

function listenToUserData() {
    if (userRef) {
        userRef.onSnapshot((doc) => {
            const userData = doc.data();
            if (userData) {
                document.getElementById('user-balance').textContent = userData.balance.toFixed(2);
                document.getElementById('withdraw-balance').textContent = userData.balance.toFixed(2);
                document.getElementById('user-referral-code').textContent = userData.referralCode;
                document.getElementById('my-referral-code').textContent = userData.referralCode;
                document.getElementById('total-referred-earnings').textContent = userData.totalReferredEarnings.toFixed(2);
                document.getElementById('telegram-username-display').textContent = userData.telegramUsername || 'Not Set';
                document.getElementById('current-telegram-username').textContent = userData.telegramUsername || 'Not Set';
                document.getElementById('telegram-username-input').value = userData.telegramUsername || '';
            }
        }, (error) => {
            console.error("Error listening to user data:", error);
        });
    }
}

// --- Ad Functionality ---
document.getElementById('watch-ad-button').addEventListener('click', () => {
    const now = Date.now();
    if (now - lastAdWatchTime < AD_COOLDOWN_TIME) {
        const remainingTime = Math.ceil((AD_COOLDOWN_TIME - (now - lastAdWatchTime)) / 1000);
        showMessage('ad-status-message', `Please wait ${remainingTime} seconds before watching another ad.`, true);
        return;
    }

    const watchAdButton = document.getElementById('watch-ad-button');
    watchAdButton.disabled = true;
    watchAdButton.textContent = "Loading Ad...";
    showMessage('ad-status-message', 'Loading ad...');

    const showMonetagAd = getRandomMonetagZoneFunction();

    if (typeof showMonetagAd === 'function') {
        showMonetagAd().then(() => {
            console.log('Rewarded Ad watched successfully!');
            rewardUser(AD_REWARD_AMOUNT);
            lastAdWatchTime = now;
            showMessage('ad-status-message', `You earned ${AD_REWARD_AMOUNT.toFixed(4)} PHP!`);
        }).catch(e => {
            console.error('Rewarded Ad failed or was closed:', e);
            showMessage('ad-status-message', 'Ad could not be loaded or was closed. Please try again.', true);
        }).finally(() => {
            watchAdButton.disabled = false;
            watchAdButton.textContent = "Watch Rewarded Ad (0.0065 PHP)";
        });
    } else {
        console.error("Monetag SDK function not found. Is the SDK loaded correctly?");
        showMessage('ad-status-message', 'Ad system not ready. Please try refreshing.', true);
        watchAdButton.disabled = false;
        watchAdButton.textContent = "Watch Rewarded Ad (0.0065 PHP)";
    }
});

async function rewardUser(amount) {
    if (!userId) {
        console.error("User not initialized, cannot reward.");
        return;
    }

    // Use a transaction for atomic updates
    try {
        await db.runTransaction(async (transaction) => {
            const userDoc = await transaction.get(userRef);
            if (!userDoc.exists) {
                throw "User does not exist!";
            }

            const userData = userDoc.data();
            const newBalance = userData.balance + amount;
            const newTotalEarned = userData.totalEarned + amount;

            transaction.update(userRef, {
                balance: newBalance,
                totalEarned: newTotalEarned
            });

            // Check for referrer and give referral bonus
            if (userData.referredBy) {
                const referrerRef = db.collection('users').doc(userData.referredBy);
                const referrerDoc = await transaction.get(referrerRef);

                if (referrerDoc.exists) {
                    const referrerData = referrerDoc.data();
                    const referralBonus = amount * REFERRAL_BONUS_PERCENTAGE;
                    const newReferrerBalance = referrerData.balance + referralBonus;
                    const newTotalReferredEarnings = referrerData.totalReferredEarnings + referralBonus;

                    transaction.update(referrerRef, {
                        balance: newReferrerBalance,
                        totalReferredEarnings: newTotalReferredEarnings
                    });
                    console.log(`Referral bonus of ${referralBonus.toFixed(4)} given to ${userData.referredBy}`);
                }
            }
        });
        console.log(`User ${userId} rewarded ${amount.toFixed(4)} PHP.`);
        showPsychologicalTip();
    } catch (error) {
        console.error("Transaction failed: ", error);
        showMessage('ads-section', 'Error rewarding user. Please contact support.', true);
    }
}

function showPsychologicalTip() {
    const randomTip = PSYCH_TIPS[Math.floor(Math.random() * PSYCH_TIPS.length)];
    alert("Psychological Tip for Earning:\n\n" + randomTip);
}

// --- In-App Interstitial Ads on App Open ---
function showRandomInAppInterstitial() {
    const now = Date.now();
    if (now - lastInAppInterstitialTime < IN_APP_INTERSTITIAL_COOLDOWN_TIME) {
        console.log("In-app interstitial on cooldown.");
        return;
    }

    const showMonetagInApp = getRandomMonetagZoneFunction();

    if (typeof showMonetagInApp === 'function') {
        showMonetagInApp({
            type: 'inApp',
            inAppSettings: {
                frequency: 1, // Show 1 ad
                capping: 0.05, // within 0.05 hours (3 minutes)
                interval: 0, // no interval needed for single ad
                timeout: 5, // 5-second delay before first one is shown.
                everyPage: false // Session saved across pages
            }
        });
        lastInAppInterstitialTime = now;
        console.log("Showing random in-app interstitial ad.");
    } else {
        console.warn("Monetag In-App Interstitial function not found.");
    }
}

// --- Telegram Username ---
document.getElementById('save-telegram-username-button').addEventListener('click', async () => {
    const telegramUsernameInput = document.getElementById('telegram-username-input').value.trim();
    if (!telegramUsernameInput) {
        showMessage('telegram-username-message', 'Please enter a Telegram username.', true);
        return;
    }
    if (!telegramUsernameInput.startsWith('@')) {
        showMessage('telegram-username-message', 'Telegram username should start with "@".', true);
        return;
    }

    try {
        await userRef.update({ telegramUsername: telegramUsernameInput });
        showMessage('telegram-username-message', 'Telegram username saved successfully!', false);
    } catch (error) {
        console.error("Error saving Telegram username:", error);
        showMessage('telegram-username-message', 'Failed to save Telegram username.', true);
    }
});


// --- Referral System ---
document.getElementById('claim-referral-bonus-button').addEventListener('click', async () => {
    const referralCodeInput = document.getElementById('referral-input').value.trim().toUpperCase();
    if (referralCodeInput.length !== 6) {
        showMessage('referral-status-message', 'Referral code must be 6 characters long.', true);
        return;
    }

    const userDoc = await userRef.get();
    const userData = userDoc.data();

    if (userData.referredBy) {
        showMessage('referral-status-message', 'You have already used a referral code.', true);
        return;
    }

    if (userData.referralCode === referralCodeInput) {
        showMessage('referral-status-message', 'You cannot refer yourself.', true);
        return;
    }

    // Find the referrer
    const referrerQuery = await db.collection('users').where('referralCode', '==', referralCodeInput).limit(1).get();

    if (!referrerQuery.empty) {
        const referrerDoc = referrerQuery.docs[0];
        const referrerId = referrerDoc.id;

        // Update current user's referredBy field
        await userRef.update({ referredBy: referrerId });
        showMessage('referral-status-message', 'Referral code applied successfully! You are now linked.', false);
        document.getElementById('referral-input').value = '';
    } else {
        showMessage('referral-status-message', 'Invalid referral code.', true);
    }
});

// --- Withdrawal System ---
document.getElementById('submit-withdraw-button').addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('withdraw-amount').value);
    const gcashNumber = document.getElementById('gcash-number').value.trim();

    if (isNaN(amount) || amount < MIN_WITHDRAWAL_AMOUNT) {
        showMessage('withdraw-status-message', `Minimum withdrawal is ${MIN_WITHDRAWAL_AMOUNT.toFixed(2)} PHP.`, true);
        return;
    }
    if (!gcashNumber || !/^(09|\+639)\d{9}$/.test(gcashNumber)) { // Basic GCash number validation
        showMessage('withdraw-status-message', 'Please enter a valid GCash number (e.g., 09xxxxxxxxx).', true);
        return;
    }

    const userDoc = await userRef.get();
    const userData = userDoc.data();
    if (userData.balance < amount) {
        showMessage('withdraw-status-message', 'Insufficient balance.', true);
        return;
    }

    // Deduct balance immediately (optimistic update)
    await userRef.update({
        balance: firebase.firestore.FieldValue.increment(-amount)
    });

    // Create withdrawal request
    await db.collection('withdrawalRequests').add({
        userId: userId,
        amount: amount,
        gcashNumber: gcashNumber,
        status: 'pending',
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        telegramUsername: userData.telegramUsername || 'Not Set' // Store Telegram username with request
    });

    showMessage('withdraw-status-message', 'Withdrawal request submitted successfully! Please wait for approval.', false);
    document.getElementById('withdraw-amount').value = '';
    document.getElementById('gcash-number').value = '';
});

function listenToWithdrawalHistory() {
    const withdrawalHistoryList = document.getElementById('withdrawal-history-list');
    db.collection('withdrawalRequests')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .onSnapshot((snapshot) => {
        withdrawalHistoryList.innerHTML = '';
        if (snapshot.empty) {
            withdrawalHistoryList.innerHTML = '<li>No withdrawal history yet.</li>';
            return;
        }
        snapshot.forEach(doc => {
            const request = doc.data();
            const li = document.createElement('li');
            const date = request.timestamp ? new Date(request.timestamp.toDate()).toLocaleString() : 'N/A';
            li.innerHTML = `
                <span>Amount: ${request.amount.toFixed(2)} PHP</span>
                <span>GCash: ${request.gcashNumber}</span>
                <span>Status: <strong>${request.status}</strong></span>
                <span>Date: ${date}</span>
                ${request.adminNote ? `<span>Admin Note: ${request.adminNote}</span>` : ''}
            `;
            withdrawalHistoryList.appendChild(li);
        });
    }, (error) => {
        console.error("Error listening to withdrawal history:", error);
    });
}

// --- Leaderboard ---
function listenToLeaderboard() {
    const leaderboardList = document.getElementById('leaderboard-list');
    db.collection('users')
      .orderBy('totalEarned', 'desc')
      .limit(10)
      .onSnapshot((snapshot) => {
        leaderboardList.innerHTML = '';
        if (snapshot.empty) {
            leaderboardList.innerHTML = '<li>No users on the leaderboard yet.</li>';
            return;
        }
        snapshot.forEach((doc, index) => {
            const userData = doc.data();
            const li = document.createElement('li');
            li.innerHTML = `
                <span>#${index + 1}</span>
                <span>User: ${userData.telegramUsername || doc.id.substring(0, 8) + '...'}</span>
                <span>Earned: ${userData.totalEarned.toFixed(2)} PHP</span>
            `;
            leaderboardList.appendChild(li);
        });
    }, (error) => {
        console.error("Error listening to leaderboard:", error);
    });
}

// --- Chat Room ---
document.getElementById('send-chat-button').addEventListener('click', sendChatMessage);
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendChatMessage();
    }
});

async function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    const message = chatInput.value.trim();
    if (message === '') return;

    const userDoc = await userRef.get();
    const userData = userDoc.data();
    const username = userData.telegramUsername || userData.referralCode || userId.substring(0, 8); // Use Telegram username first

    await db.collection('chatMessages').add({
        userId: userId,
        username: username,
        message: message,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
        chatInput.value = '';
    }).catch(error => {
        console.error("Error sending chat message:", error);
        showMessage('chat-section', 'Failed to send message.', true);
    });
}

function listenToChatMessages() {
    const chatMessagesDiv = document.getElementById('chat-messages');
    db.collection('chatMessages')
      .orderBy('timestamp', 'asc')
      .limitToLast(50)
      .onSnapshot((snapshot) => {
        chatMessagesDiv.innerHTML = ''; // Clear existing messages
        snapshot.forEach(doc => {
            const messageData = doc.data();
            const p = document.createElement('p');
            p.classList.add('chat-message');
            const date = messageData.timestamp ? new Date(messageData.timestamp.toDate()).toLocaleTimeString() : 'N/A';
            p.innerHTML = `<strong>${messageData.username}</strong> (${date}): ${messageData.message}`;
            chatMessagesDiv.appendChild(p);
        });
        chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight; // Scroll to bottom
    }, (error) => {
        console.error("Error listening to chat messages:", error);
    });
}

// --- Admin Dashboard ---
document.getElementById('admin-login-button').addEventListener('click', () => {
    const password = document.getElementById('admin-password').value;
    if (password === ADMIN_PASSWORD) {
        document.getElementById('admin-login').style.display = 'none';
        document.getElementById('admin-dashboard-content').style.display = 'block';
        document.getElementById('admin-nav-button').style.display = 'block'; // Show admin nav button
        listenToWithdrawalRequests();
        showMessage('admin-login-status', 'Admin login successful!', false);
    } else {
        showMessage('admin-login-status', 'Incorrect admin password.', true);
    }
});

function listenToWithdrawalRequests() {
    const withdrawalRequestsList = document.getElementById('withdrawal-requests-list');
    db.collection('withdrawalRequests')
      .where('status', '==', 'pending')
      .orderBy('timestamp', 'asc')
      .onSnapshot(async (snapshot) => {
        withdrawalRequestsList.innerHTML = '';
        if (snapshot.empty) {
            withdrawalRequestsList.innerHTML = '<li>No pending withdrawal requests.</li>';
            return;
        }

        snapshot.forEach(async (doc) => {
            const request = doc.data();
            const requestId = doc.id;

            const li = document.createElement('li');
            li.classList.add('admin-request-item');
            const date = request.timestamp ? new Date(request.timestamp.toDate()).toLocaleString() : 'N/A';
            li.innerHTML = `
                <p><strong>User ID:</strong> ${request.userId.substring(0, 8)}...</p>
                <p><strong>Telegram:</strong> ${request.telegramUsername || 'Not Set'}</p>
                <p><strong>Amount:</strong> ${request.amount.toFixed(2)} PHP</p>
                <p><strong>GCash:</strong> ${request.gcashNumber}</p>
                <p><strong>Date:</strong> ${date}</p>
                <div>
                    <button class="approve-btn" data-id="${requestId}">Approve</button>
                    <button class="reject-btn" data-id="${requestId}">Reject</button>
                </div>
            `;
            withdrawalRequestsList.appendChild(li);
        });

        // Add event listeners for approve/reject buttons
        withdrawalRequestsList.querySelectorAll('.approve-btn').forEach(button => {
            button.onclick = (e) => handleWithdrawalAction(e.target.dataset.id, 'approved');
        });
        withdrawalRequestsList.querySelectorAll('.reject-btn').forEach(button => {
            button.onclick = (e) => handleWithdrawalAction(e.target.dataset.id, 'rejected');
        });
    }, (error) => {
        console.error("Error listening to withdrawal requests:", error);
    });
}

async function handleWithdrawalAction(requestId, status) {
    const requestRef = db.collection('withdrawalRequests').doc(requestId);

    try {
        await db.runTransaction(async (transaction) => {
            const requestDoc = await transaction.get(requestRef);
            if (!requestDoc.exists) {
                throw "Request does not exist!";
            }
            const requestData = requestDoc.data();

            if (requestData.status !== 'pending') {
                throw "This request is no longer pending.";
            }

            transaction.update(requestRef, {
                status: status,
                processedAt: firebase.firestore.FieldValue.serverTimestamp(),
                adminNote: `Request ${status} by admin.`
            });

            if (status === 'rejected') {
                // Refund the user's balance if rejected
                const userToRefundRef = db.collection('users').doc(requestData.userId);
                transaction.update(userToRefundRef, {
                    balance: firebase.firestore.FieldValue.increment(requestData.amount)
                });
            }
        });
        alert(`Withdrawal request ${requestId} ${status} successfully.`);
    } catch (error) {
        console.error("Error handling withdrawal action:", error);
        alert(`Failed to ${status} withdrawal request: ${error.message}`);
    }
}


// --- Navigation ---
document.querySelectorAll('.nav-button').forEach(button => {
    button.addEventListener('click', (e) => {
        // Remove active class from all buttons
        document.querySelectorAll('.nav-button').forEach(btn => btn.classList.remove('active'));
        // Add active class to the clicked button
        e.target.classList.add('active');

        // Hide all content sections
        document.querySelectorAll('.content-section').forEach(section => section.style.display = 'none');

        // Show the target section
        const targetId = e.target.dataset.target;
        document.getElementById(targetId).style.display = 'block';

        // Special handling for admin section to ensure content is shown/hidden based on login
        if (targetId === 'admin-section') {
            if (document.getElementById('admin-dashboard-content').style.display === 'block') {
                document.getElementById('admin-login').style.display = 'none';
            } else {
                document.getElementById('admin-login').style.display = 'block';
                document.getElementById('admin-dashboard-content').style.display = 'none';
            }
        }
    });
});


// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', () => {
    initializeUser().then(() => {
        showRandomInAppInterstitial(); // Show ad after user is initialized
    });
});
