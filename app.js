
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
