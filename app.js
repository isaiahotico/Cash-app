
// app.js
// Prototype Retro Pixel Racer + Firestore integration (demo).
// IMPORTANT: Replace firebaseConfig with your project's config.
// For production: implement secure admin flow and server-side payouts.

(async function () {
  // ====== CONFIG - Replace with your Firebase config ======
  const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    // ... other fields
  };
  // =======================================================
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  // Sign in anonymously for prototype
  let firebaseUser = null;
  await auth.signInAnonymously().catch(e => console.error('Auth error:', e));
  firebaseUser = auth.currentUser;


// --- Popunder Settings ---
const POPUNDER_COOLDOWN_HOURS = 24; // How long before the popunder can show again for the same user (in hours)
const POPUNDER_INITIAL_DELAY_SECONDS = 5; // Delay before the popunder attempts to show (in seconds)
const POPUNDER_CARD_DISPLAY_DURATION_SECONDS = 30; // How long the card stays visible if not closed manually

// --- Ad Scripts to be Loaded ---
const POPUNDER_AD_SCRIPT_URL = "https://pl27853087.effectivegatecpm.com/fa/f9/df/faf9df00762374e3ad9510afe003e978.js";
const BANNER_AD_INVOKE_SCRIPT_URL = "https://www.highperformanceformat.com/fe70943384c0314737bd62c05e3d520a/invoke.js";

// --- DOM Elements ---
const popunderCard = document.getElementById('popunderCard');
const closePopunderCardBtn = document.getElementById('closePopunderCard');
const cooldownMessage = document.getElementById('cooldownMessage');
const adSlot1 = document.getElementById('adSlot1');

// --- Helper Functions ---

/**
 * Generates a unique user ID. For a more robust solution, consider Firebase Authentication.
 * For simplicity, this uses a combination of localStorage and a simple UUID.
 */
function getOrCreateUserId() {
    let userId = localStorage.getItem('popunderUserId');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substr(2, 9) + Date.now();
        localStorage.setItem('popunderUserId', userId);
    }
    return userId;
}

/**
 * Checks if the popunder is currently on cooldown for the user.
 * @param {string} userId - The unique ID of the user.
 * @returns {Promise<boolean>} True if on cooldown, false otherwise.
 */
async function isOnCooldown(userId) {
    try {
        const docRef = db.collection('popunderCooldowns').doc(userId);
        const doc = await docRef.get();

        if (doc.exists) {
            const lastShown = doc.data().lastShown.toDate();
            const cooldownEndTime = new Date(lastShown.getTime() + POPUNDER_COOLDOWN_HOURS * 60 * 60 * 1000);
            const now = new Date();

            if (now < cooldownEndTime) {
                const timeLeftMs = cooldownEndTime.getTime() - now.getTime();
                const hoursLeft = Math.ceil(timeLeftMs / (1000 * 60 * 60));
                cooldownMessage.textContent = `Popunder will reappear in approximately ${hoursLeft} hour(s).`;
                return true; // Still on cooldown
            }
        }
        return false; // Not on cooldown or no record
    } catch (error) {
        console.error("Error checking cooldown:", error);
        return false;
    }
}

/**
 * Records the current time as the last time the popunder was shown for the user.
 * @param {string} userId - The unique ID of the user.
 */
async function recordPopunderShown(userId) {
    try {
        await db.collection('popunderCooldowns').doc(userId).set({
            lastShown: firebase.firestore.FieldValue.serverTimestamp(),
            userAgent: navigator.userAgent,
            timestamp: new Date() // For local debugging if serverTimestamp is delayed
        }, { merge: true });
        console.log("Popunder shown recorded for user:", userId);
    } catch (error) {
        console.error("Error recording popunder shown:", error);
    }
}

/**
 * Dynamically loads a JavaScript file.
 * @param {string} url - The URL of the script to load.
 * @param {HTMLElement} parentElement - The element to append the script to (e.g., document.head or a specific div).
 */
function loadScript(url, parentElement = document.head) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = url;
        script.onload = resolve;
        script.onerror = reject;
        parentElement.appendChild(script);
    });
}

/**
 * Inserts the 'atOptions' object and then loads the 'invoke.js' script.
 * This is specific to the ad network's implementation.
 */
function loadBannerAd() {
    // Define atOptions globally for the invoke.js script
    window.atOptions = {
        'key' : 'fe70943384c0314737bd62c05e3d520a',
        'format' : 'iframe',
        'height' : 300,
        'width' : 160,
        'params' : {}
    };

    // Load the invoke.js script into adSlot1
    loadScript(BANNER_AD_INVOKE_SCRIPT_URL, adSlot1)
        .then(() => console.log("Banner ad script loaded."))
        .catch(error => console.error("Error loading banner ad script:", error));
}

/**
 * Displays the popunder card on the page and loads ads.
 */
function showPopunderCard() {
    popunderCard.style.display = 'block';
    cooldownMessage.textContent = ''; // Clear any previous cooldown message

    // Load the banner ad into the card
    loadBannerAd();

    // Automatically hide the card after a duration if not closed manually
    setTimeout(() => {
        hidePopunderCard();
    }, POPUNDER_CARD_DISPLAY_DURATION_SECONDS * 1000);
}

/**
 * Hides the popunder card from the page.
 */
function hidePopunderCard() {
    popunderCard.style.display = 'none';
}

// --- Main Popunder Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const userId = getOrCreateUserId();

    // Event listener for closing the card
    closePopunderCardBtn.addEventListener('click', () => {
        hidePopunderCard();
    });

    // Initial delay before checking and potentially showing the popunder
    setTimeout(async () => {
        const onCooldown = await isOnCooldown(userId);

        if (!onCooldown) {
            // 1. Load the popunder script
            loadScript(POPUNDER_AD_SCRIPT_URL, document.body) // Load into body or head
                .then(() => {
                    console.log("Popunder script loaded. It should attempt to open a new window.");
                })
                .catch(error => {
                    console.error("Error loading popunder script:", error);
                });

            // 2. Show the card with banner ads
            showPopunderCard();

            // 3. Record that the popunder event (both window and card) was triggered
            recordPopunderShown(userId);

        } else {
            console.log("Popunder is on cooldown for this user.");
            // Optionally, if you want to display the cooldown message even when the card is hidden:
            // popunderCard.style.display = 'block';
            // setTimeout(() => { popunderCard.style.display = 'none'; }, 5000);
        }
    }, POPUNDER_INITIAL_DELAY_SECONDS * 1000);
});


// --- Pop-under with Cooldown Script ---
(function() {
    const COOLDOWN_MINUTES = 60; // Set cooldown period in minutes (e.g., 60 minutes = 1 hour)
    const lastPopUnderKey = 'lastPopUnderTime';

    function showPopUnder() {
        const lastPopUnderTime = localStorage.getItem(lastPopUnderKey);
        const currentTime = new Date().getTime();

        if (lastPopUnderTime) {
            const timeElapsed = (currentTime - parseInt(lastPopUnderTime)) / (1000 * 60); // Convert ms to minutes
            if (timeElapsed < COOLDOWN_MINUTES) {
                console.log(Pop-under cooldown active. Next allowed in ${Math.round(COOLDOWN_MINUTES - timeElapsed)} minutes.);
                return; // Do not show pop-under if cooldown is active
            }
        }

        // URL for the pop-under. This could be an ad landing page, another page on your site, etc.
        // For this example, we'll use a blank page, but you should replace it with your desired URL.
        const popUnderUrl = 'about:blank'; // REPLACE THIS WITH YOUR ACTUAL POP-UNDER URL IF NEEDED

        // Open the pop-under window
        // The features string for window.open might need adjustment based on desired behavior
        // and browser compatibility. Minimal dimensions are often used for pop-unders.
        const newWindow = window.open(popUnderUrl, '_blank', 'toolbar=no,scrollbars=no,resizable=no,top=0,left=0,width=1,height=1');

        if (newWindow) {
            // Attempt to move the new window behind the current one
            newWindow.blur();
            window.focus();
            // Disconnects the new window from the current one for security
            try {
                newWindow.opener = null; 
            } catch (e) {
                console.warn("Could not set newWindow.opener to null:", e);
            }
            
            // Store the current time to enforce cooldown
            localStorage.setItem(lastPopUnderKey, currentTime.toString());
            console.log('Pop-under shown. Cooldown initiated.');
        } else {
            console.log('Pop-under blocked by browser or user settings.');
        }
    }

    // Trigger the pop-under when the page loads
    // Using DOMContentLoaded ensures the HTML is parsed before trying to open a window.
    document.addEventListener('DOMContentLoaded', () => {
        showPopUnder();
        fetchFirestoreData(); // Also fetch Firestore data when the DOM is ready
    });
})();
  // Telegram WebApp detection (works only inside Telegram)
  let tgUser = {
    id: null,
    username: null,
    first_name: null,
    last_name: null
  };
  try {
    if (window.Telegram && window.Telegram.WebApp) {
      const t = window.Telegram.WebApp.initDataUnsafe?.user || window.Telegram.WebApp.initData?.user;
      if (t) {
        tgUser.id = t.id;
        tgUser.username = t.username || null;
        tgUser.first_name = t.first_name || null;
        tgUser.last_name = t.last_name || null;
      }
    }
  } catch (e) {
    console.warn('Telegram API not available', e);
  }

  // If no Telegram user, allow manual username input (prompt once)
  if (!tgUser.username && !tgUser.first_name) {
    const manual = prompt("Enter display name (for demo):") || `anon${Math.floor(Math.random()*1000)}`;
    tgUser.username = manual;
  } else if (!tgUser.username) {
    tgUser.username = `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim();
  }

  const displayName = tgUser.username || `anon_${firebaseUser.uid.slice(0,6)}`;
  document.getElementById('username').innerText = displayName;

  // Create/ensure user doc in Firestore
  const userKey = tgUser.id ? `tg_${tgUser.id}` : `anon_${firebaseUser.uid}`;
  const userDocRef = db.collection('users').doc(userKey);
  await userDocRef.set({
    displayName,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
    firebaseUid: firebaseUser.uid,
    tgId: tgUser.id || null
  }, { merge: true });

  // ====== Game setup ======
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const lanes = 6;
  const laneW = canvas.width / lanes;
  const car = {
    lane: Math.floor(lanes/2),
    w: laneW * 0.6,
    h: 32,
    y: canvas.height - 120
  };
  const obstacles = [];
  let running = false;
  let speed = 140; // pixels per second (base)
  let spawnTimer = 0;
  let spawnInterval = 700; // ms
  let lastTs = 0;
  let dodged = 0;
  let score = 0;

  function resetGame() {
    obstacles.length = 0;
    running = false;
    speed = 140;
    spawnTimer = 0;
    spawnInterval = 700;
    lastTs = 0;
    dodged = 0;
    score = 0;
    updateUI();
    draw();
  }

  function startGame() {
    obstacles.length = 0;
    running = true;
    speed = 140;
    spawnTimer = 0;
    spawnInterval = 700;
    lastTs = performance.now();
    requestAnimationFrame(loop);
  }

  function gameOver() {
    running = false;
    // Save score to Firestore
    userDocRef.set({
      bestScore: firebase.firestore.FieldValue.increment(score),
      lastScore: score,
      lastPlayed: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    alert('Game Over! Score: ' + score + ' Dodged: ' + dodged);
  }

  function loop(ts) {
    if (!running) return;
    const dt = Math.max(1, ts - lastTs);
    lastTs = ts;
    // speed increases gradually
    speed += (dt/10000) * 20;
    spawnTimer += dt;
    if (spawnTimer > spawnInterval) {
      spawnTimer = 0;
      // spawn 1-2 obstacles, ensure at least one safe lane
      const count = Math.random() < 0.12 ? 2 : 1;
      const lanesArr = [...Array(lanes).keys()];
      shuffle(lanesArr);
      for (let i=0;i<count;i++){
        const l = lanesArr[i];
        obstacles.push({ lane: l, y: -40, w: laneW*0.7, h: 28, passed: false });
      }
    }
    // move obstacles
    for (let ob of obstacles) {
      ob.y += speed * (dt/1000);
      // check collision
      if (!ob.passed && ob.y + ob.h >= car.y && ob.y <= car.y + car.h) {
        if (ob.lane === car.lane) {
          // collision
          running = false;
          draw();
          gameOver();
          return;
        }
      }
      if (!ob.passed && ob.y > canvas.height) {
        ob.passed = true;
        dodged++;
        score += 10;
        // update balance UI
        updateUI();
        // occasionally decrease spawnInterval for difficulty
        if (dodged % 20 === 0 && spawnInterval > 300) spawnInterval -= 40;
      }
    }
    // remove offscreen obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      if (obstacles[i].y > canvas.height + 100) obstacles.splice(i,1);
    }
    draw();
    requestAnimationFrame(loop);
  }

  function draw() {
    // background
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // lanes
    for (let i=0;i<lanes;i++){
      ctx.fillStyle = (i%2===0) ? '#121212' : '#151515';
      ctx.fillRect(i*laneW, 0, laneW, canvas.height);
      // lane separators
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(i*laneW + laneW - 2, 0);
      ctx.lineTo(i*laneW + laneW - 2, canvas.height);
      ctx.stroke();
    }
    // obstacles
    for (let ob of obstacles) {
      const x = ob.lane * laneW + (laneW - ob.w)/2;
      ctx.fillStyle = '#ff6b6b';
      ctx.fillRect(x, ob.y, ob.w, ob.h);
      ctx.fillStyle = '#7b1f1f';
      ctx.fillRect(x+2, ob.y+2, ob.w-4, ob.h-4);
    }
    // car
    const carX = car.lane * laneW + (laneW - car.w)/2;
    ctx.fillStyle = '#00d1b2';
    roundRect(ctx, carX, car.y, car.w, car.h, 6, true, false);
    // display text
    ctx.fillStyle = '#fff';
    ctx.font = '14px monospace';
    ctx.fillText(`Score: ${score}`, 8, 20);
    ctx.fillText(`Dodged: ${dodged}`, 8, 38);
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke) {
    if (typeof r === 'undefined') r = 5;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if (fill) ctx.fill();
    if (stroke) ctx.stroke();
  }

  // simple shuffle
  function shuffle(a) {
    for (let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i], a[j]] = [a[j], a[i]];
    }
  }

  // controls
  document.getElementById('leftBtn').addEventListener('click', ()=> {
    if (!running) return;
    if (car.lane > 0) car.lane--;
    draw();
  });
  document.getElementById('rightBtn').addEventListener('click', ()=> {
    if (!running) return;
    if (car.lane < lanes-1) car.lane++;
    draw();
  });
  document.getElementById('startBtn').addEventListener('click', ()=> {
    startGame();
  });

  // update UI fields
  function updateUI() {
    document.getElementById('dodged').innerText = dodged;
    document.getElementById('score').innerText = score;
    const pesos = Math.floor(dodged / 1000);
    document.getElementById('balance').innerText = pesos;
  }
  updateUI();
  draw();

  // Withdraw button -> creates a withdrawal request in Firestore
  document.getElementById('withdrawBtn').addEventListener('click', async () => {
    const pesos = Math.floor(dodged / 1000);
    if (pesos <= 0) {
      alert('No balance to withdraw yet. Need at least 1000 dodged barriers = 1 peso.');
      return;
    }
    const gcash = prompt('Enter your GCash number for payout (demo):');
    if (!gcash) return;
    const req = {
      userKey,
      displayName,
      pesos,
      gcash,
      status: 'pending',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const docRef = await db.collection('withdrawals').add(req);
    alert('Withdrawal request created (id=' + docRef.id + '). Admin will review.');
    // Optional: set user's dodged to remainder after withdrawal
    // For demo, we keep dodged as-is. You may want to subtract pesos*1000.
  });

  // ========== Admin panel (client-side password - demo only) ==========
  const ADMIN_PASSWORD = "Propetas12"; // demo: DO NOT USE IN PRODUCTION
  const adminBtn = document.getElementById('adminBtn');
  const adminPanel = document.getElementById('adminPanel');
  const adminLogin = document.getElementById('adminLogin');
  const adminLogout = document.getElementById('adminLogout');
  const adminPasswordInput = document.getElementById('adminPassword');
  let adminLogged = false;

  adminBtn.addEventListener('click', ()=> {
    adminPanel.style.display = adminPanel.style.display === 'none' ? 'block' : 'none';
  });

  adminLogin.addEventListener('click', async () => {
    if (adminPasswordInput.value === ADMIN_PASSWORD) {
      adminLogged = true;
      alert('Admin demo login success');
      loadWithdrawals();
    } else {
      alert('Wrong admin password (demo).');
    }
  });
  adminLogout.addEventListener('click', ()=> {
    adminLogged = false;
    document.getElementById('withdrawList').innerHTML = '';
  });

  async function loadWithdrawals() {
    if (!adminLogged) return alert('Not admin (demo).');
    const q = await db.collection('withdrawals').orderBy('createdAt', 'desc').limit(200).get();
    const container = document.getElementById('withdrawList');
    container.innerHTML = '';
    q.forEach(doc=>{
      const d = doc.data();
      const id = doc.id;
      const row = document.createElement('div');
      row.style.borderBottom = '1px solid #222';
      row.style.padding = '8px 0';
      row.innerHTML = `
        <div><strong>${d.displayName}</strong> — ${d.pesos} PHP — <span style="color:#999">${d.status}</span></div>
        <div class="small">GCash: ${d.gcash || '—'} • id: ${id}</div>
      `;
      const btnApprove = document.createElement('button');
      btnApprove.className = 'btn';
      btnApprove.innerText = 'Approve';
      btnApprove.onclick = async () => {
        await db.collection('withdrawals').doc(id).update({ status: 'approved', processedAt: firebase.firestore.FieldValue.serverTimestamp(), admin: displayName });
        alert('Marked approved (demo). Remember: actually pay via your payment system.');
        loadWithdrawals();
      };
      const btnReject = document.createElement('button');
      btnReject.className = 'btn secondary';
      btnReject.style.marginLeft = '8px';
      btnReject.innerText = 'Reject';
      btnReject.onclick = async () => {
        const reason = prompt('Reason (optional):','');
        await db.collection('withdrawals').doc(id).update({ status: 'rejected', reason, processedAt: firebase.firestore.FieldValue.serverTimestamp(), admin: displayName });
        loadWithdrawals();
      };
      row.appendChild(btnApprove);
      row.appendChild(btnReject);
      container.appendChild(row);
    });
  }

  // keep user lastSeen updated periodically
  setInterval(()=> {
    userDocRef.set({ lastSeen: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
  }, 60_000);

})();
