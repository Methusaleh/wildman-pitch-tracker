let gameState = {
  pitcherName: "Select Pitcher",
  pitcherHand: "R",
  homeTeam: "",
  awayTeam: "",
  location: "",
  balls: 0,
  strikes: 0,
  outs: 0,
  inning: 1,
  totalPitches: 0,
  homeScore: 0,
  awayScore: 0,
  timerSeconds: 0,
  timerActive: false,
  sessionPitches: [], // ONLY ONE OF THESE
  activeAtBatPitches: [],
};

let selectedHand = "R";
let timerInterval;

window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    document.getElementById("splash-screen").style.opacity = "0";
    setTimeout(() => {
      document.getElementById("splash-screen").style.display = "none";
      if (!localStorage.getItem("currentPitchTrackerGame")) showHomeScreen();
    }, 500);
  }, 2500);
});

// --- TIMER LOGIC ---
function toggleTimer() {
  const btn = document.getElementById("timer-toggle-btn");
  if (gameState.timerActive) {
    clearInterval(timerInterval);
    gameState.timerActive = false;
    btn.innerText = "START";
  } else {
    gameState.timerActive = true;
    btn.innerText = "PAUSE";
    timerInterval = setInterval(() => {
      gameState.timerSeconds++;
      updateTimerDisplay();
      // Save every second so a refresh doesn't lose time
      saveToLocal();
    }, 1000);
  }
  saveToLocal();
}

function updateTimerDisplay() {
  const h = Math.floor(gameState.timerSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((gameState.timerSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (gameState.timerSeconds % 60).toString().padStart(2, "0");
  const el = document.getElementById("timer-display");
  if (el) el.innerText = `${h}:${m}:${s}`;
}

function resetTimer() {
  clearInterval(timerInterval);
  gameState.timerSeconds = 0;
  gameState.timerActive = false;
  const btn = document.getElementById("timer-toggle-btn");
  if (btn) btn.innerText = "START";
  updateTimerDisplay();
}

// --- CORE FUNCTIONS ---
function showHomeScreen() {
  document.getElementById("setup-screen").style.display = "none";
  document.getElementById("home-screen").style.display = "flex";
}

function showSetupScreen() {
  document.getElementById("home-screen").style.display = "none";
  document.getElementById("setup-screen").style.display = "flex";
  updateTeamDatalist();
}

function updateVeloDisplay(val) {
  document.getElementById("velo-number").innerText = val;
}

function stepVelo(amount) {
  const slider = document.getElementById("pitch-speed");
  let newVal = parseInt(slider.value) + amount;
  if (newVal >= 40 && newVal <= 105) {
    slider.value = newVal;
    updateVeloDisplay(newVal);
  }
}

function setPitchType(type) {
  gameState.currentPitchType = type;
  document
    .querySelectorAll(".type-chip")
    .forEach((chip) => chip.classList.remove("active"));
  document.getElementById(`type-${type}`).classList.add("active");
}

function showStrikeSplit() {
  document.getElementById("btn-strike-main").style.display = "none";
  document.getElementById("strike-split").style.display = "flex";
}

function resetStrikeButtons() {
  document.getElementById("btn-strike-main").style.display = "block";
  document.getElementById("strike-split").style.display = "none";
}

const strikeZone = document.getElementById("strike-zone");
strikeZone.addEventListener("click", (e) => {
  const rect = strikeZone.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
    placePing(x, y);
    gameState.lastTap = { x: x.toFixed(2), y: y.toFixed(2) };
  }
});

function placePing(x, y) {
  document.querySelectorAll(".temp-ping").forEach((p) => p.remove());
  const ping = document.createElement("div");
  ping.className = "ping temp-ping";
  ping.style.left = x + "%";
  ping.style.top = y + "%";
  strikeZone.appendChild(ping);
}

function recordPitch(result) {
  if (!gameState.lastTap && result !== "HBP")
    return alert("Tap the zone first!");
  if (result === "In-Play") {
    document.getElementById("hit-overlay").style.display = "flex";
    return;
  }
  finishRecording(result);
}

function submitHit(direction) {
  document.getElementById("hit-overlay").style.display = "none";
  finishRecording("In-Play", direction);
}

function getPitchColor(result) {
  if (result.includes("Strike")) return "#4caf50";
  if (result === "Ball" || result === "HBP") return "#f44336";
  if (result === "Foul") return "#9c27b0";
  if (result === "In-Play") return "#2196f3";
  return "#ffffff";
}

function finishRecording(result, direction = null) {
  const speed = document.getElementById("pitch-speed").value;

  // Safety: Ensure these arrays exist before we try to "push" to them
  if (!gameState.sessionPitches) gameState.sessionPitches = [];
  if (!gameState.activeAtBatPitches) gameState.activeAtBatPitches = [];

  const newPitch = {
    x: gameState.lastTap?.x || 50,
    y: gameState.lastTap?.y || 50,
    type: gameState.currentPitchType,
    speed: parseInt(speed),
    result,
    direction,
    timestamp: Date.now(),
  };

  gameState.sessionPitches.push(newPitch);
  gameState.activeAtBatPitches.push(newPitch);

  const currentPing = document.querySelector(".temp-ping");
  if (currentPing) {
    currentPing.classList.remove("temp-ping");
    currentPing.style.backgroundColor = getPitchColor(result);
    currentPing.style.animation = "none";
  }

  updateCount(result);
  resetStrikeButtons();
  saveToLocal(); // This saves the new array to the iPad's memory
  gameState.lastTap = null;
}

function updateCount(result) {
  gameState.totalPitches++;
  if (result === "Ball") {
    gameState.balls++;
    if (gameState.balls === 4) {
      clearZoneUI();
      resetAtBat();
    }
  } else if (result.includes("Strike")) {
    gameState.strikes++;
    if (gameState.strikes === 3) {
      gameState.outs++;
      clearZoneUI();
      resetAtBat();
    }
  } else if (result === "Foul") {
    if (gameState.strikes < 2) gameState.strikes++;
  } else if (result === "In-Play" || result === "HBP") {
    clearZoneUI();
    resetAtBat();
  }
  if (gameState.outs === 3) {
    gameState.outs = 0;
  }
  drawScoreboard();
}

function undoLastPitch() {
  if (gameState.sessionPitches.length === 0) return;

  // 1. Remove the last recorded pitch
  gameState.sessionPitches.pop();

  // 2. Wipe the visual pings from the zone
  clearZoneUI();

  // 3. Reset the "In-Game" counters
  gameState.balls = 0;
  gameState.strikes = 0;
  gameState.totalPitches = 0;
  // Note: We don't reset Outs/Innings/Score because those are often manual,
  // but we will recalculate them if your logic was automatic.

  // 4. Re-process the entire history to get the count back
  const historyToReplay = [...gameState.sessionPitches];
  gameState.sessionPitches = []; // Clear temporarily to re-fill via finishRecording logic

  // We loop through the old pitches and "re-record" them
  historyToReplay.forEach((p) => {
    // Redraw the ping
    const ping = document.createElement("div");
    ping.className = "ping";
    ping.style.left = p.x + "%";
    ping.style.top = p.y + "%";
    ping.style.backgroundColor = getPitchColor(p.result);
    document.getElementById("strike-zone").appendChild(ping);

    // Re-calculate the count (this mimics the finishRecording logic)
    gameState.sessionPitches.push(p);
    updateCount(p.result);
  });

  drawScoreboard();
  saveToLocal();
  resetStrikeButtons(); // Ensure the "Look/Swing" menu closes if it was open
}

function resetAtBat() {
  gameState.balls = 0;
  gameState.strikes = 0;
}
function clearZoneUI() {
  // 1. Physically remove dots from the screen
  document.querySelectorAll(".ping").forEach((p) => p.remove());

  // 2. Wipe the "Active" memory so the next load starts fresh
  gameState.activeAtBatPitches = [];
}

function adjustOuts(amt) {
  gameState.outs += amt;
  if (gameState.outs > 3) gameState.outs = 0;
  drawScoreboard();
  saveToLocal();
}

function adjustInning(amt) {
  gameState.inning += amt;
  if (gameState.inning < 1) gameState.inning = 1;
  drawScoreboard();
  saveToLocal();
}

function adjustScore(team, amt) {
  if (team === "home") {
    gameState.homeScore = Math.max(0, gameState.homeScore + amt);
  } else {
    gameState.awayScore = Math.max(0, gameState.awayScore + amt);
  }
  if (gameState.homeScore > 30) gameState.homeScore = 0;
  if (gameState.awayScore > 30) gameState.awayScore = 0;
  drawScoreboard();
  saveToLocal();
}

function drawScoreboard() {
  document.getElementById("main-count").innerText =
    `${gameState.balls} - ${gameState.strikes}`;
  document.getElementById("pitch-total").innerText = gameState.totalPitches;
  document.getElementById("display-inning").innerText = gameState.inning;
  document.getElementById("display-outs").innerText = gameState.outs;
  document.getElementById("current-pitcher").innerText = gameState.pitcherName;
  document.getElementById("score-home").innerText = gameState.homeScore;
  document.getElementById("score-away").innerText = gameState.awayScore;
  document.getElementById("label-home").innerText = (
    gameState.homeTeam || "HOME"
  ).toUpperCase();
  document.getElementById("label-away").innerText = (
    gameState.awayTeam || "AWAY"
  ).toUpperCase();
}

function getRoster() {
  return JSON.parse(localStorage.getItem("wildmanRoster")) || [];
}
function selectHand(h) {
  selectedHand = h;
  document.getElementById("btn-right").classList.toggle("active", h === "R");
  document.getElementById("btn-left").classList.toggle("active", h === "L");
}
function promptPitcherName() {
  const roster = getRoster();
  if (roster.length === 0) {
    document.getElementById("pitcher-modal").style.display = "flex";
    return;
  }
  let menu =
    "Select Pitcher:\n" +
    roster.map((p, i) => `${i + 1}. ${p.first} ${p.last}`).join("\n") +
    "\n\nType 'NEW' for a new pitcher.";
  const choice = prompt(menu);
  if (choice?.toUpperCase() === "NEW")
    document.getElementById("pitcher-modal").style.display = "flex";
  else {
    const idx = parseInt(choice) - 1;
    if (roster[idx]) setPitcher(roster[idx]);
  }
}
function saveNewPitcher() {
  const first = document.getElementById("new-p-first").value,
    last = document.getElementById("new-p-last").value;
  if (!first || !last) return alert("Enter full name");
  const roster = getRoster(),
    newP = { id: Date.now(), first, last, hand: selectedHand };
  roster.push(newP);
  localStorage.setItem("wildmanRoster", JSON.stringify(roster));
  setPitcher(newP);
  closePitcherModal();
}
function setPitcher(p) {
  gameState.pitcherName = `${p.first} ${p.last}`;
  gameState.pitcherHand = p.hand;
  drawScoreboard();
  saveToLocal();
}
function closePitcherModal() {
  document.getElementById("pitcher-modal").style.display = "none";
}
function saveToLocal() {
  localStorage.setItem("currentPitchTrackerGame", JSON.stringify(gameState));
}

function loadGame() {
  const saved = localStorage.getItem("currentPitchTrackerGame");
  if (saved) {
    gameState = JSON.parse(saved);
    gameState.timerActive = false;
    const timerBtn = document.getElementById("timer-toggle-btn");
    if (timerBtn) timerBtn.innerText = "START";
    drawScoreboard();
    updateTimerDisplay();
    setPitchType(gameState.currentPitchType || "FB");
    updateVeloDisplay(document.getElementById("pitch-speed").value);

    // 3. ONLY draw the pitches belonging to the current batter
    // We use the new 'activeAtBatPitches' array we created in Step 2
    (gameState.activeAtBatPitches || []).forEach((p) => {
      const ping = document.createElement("div");
      ping.className = "ping";
      ping.style.left = p.x + "%";
      ping.style.top = p.y + "%";
      ping.style.backgroundColor = getPitchColor(p.result);
      document.getElementById("strike-zone").appendChild(ping);
    });
  }
}
function openStats() {
  document.getElementById("stats-modal").style.display = "flex";
  renderStatsDisplay();
}
function closeStats() {
  document.getElementById("stats-modal").style.display = "none";
}
function renderStatsDisplay() {
  const total = gameState.sessionPitches.length,
    strikes = gameState.sessionPitches.filter(
      (p) => p.result.includes("Strike") || p.result === "Foul",
    ).length;
  const pct = total > 0 ? ((strikes / total) * 100).toFixed(1) : 0;
  document.getElementById("stats-display").innerHTML =
    `<div class="stat-card"><label>Total</label><span>${total}</span></div><div class="stat-card"><label>Strike %</label><span>${pct}%</span></div>`;
}
async function endGame() {
  if (!confirm("Save this game to the Wildman Database?")) return;

  // 1. Stop the timer and prep data
  if (gameState.timerActive) toggleTimer();

  const payload = {
    gameData: {
      pitcherName: gameState.pitcherName,
      homeTeam: gameState.homeTeam,
      awayTeam: gameState.awayTeam,
      homeScore: gameState.homeScore,
      awayScore: gameState.awayScore,
      timerSeconds: gameState.timerSeconds,
    },
    pitches: gameState.sessionPitches,
  };

  try {
    console.log("Sending data to Vercel...");

    // 2. We MUST use await here to pause the reload
    const response = await fetch("/api/save-game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      alert("⚾ Game saved to Neon Database!");
      // 3. ONLY clear data after we know it is safe in the cloud
      localStorage.removeItem("currentPitchTrackerGame");
      location.reload();
    } else {
      console.error("Database Error:", result.error);
      alert("Cloud Save Failed: " + (result.error || "Unknown Error"));
    }
  } catch (err) {
    console.error("Network Error:", err);
    alert("Connection Error. Game was NOT saved to the cloud.");
  }
}
function updateTeamDatalist() {
  const h = JSON.parse(localStorage.getItem("pitchTrackerHistory")) || [],
    teams = new Set();
  h.forEach((g) => {
    if (g.homeTeam) teams.add(g.homeTeam);
    if (g.awayTeam) teams.add(g.awayTeam);
  });
  document.getElementById("team-history").innerHTML = Array.from(teams)
    .map((t) => `<option value="${t}">`)
    .join("");
}
function checkLocationMemory(home) {
  const h = JSON.parse(localStorage.getItem("pitchTrackerHistory")) || [],
    last = h
      .slice()
      .reverse()
      .find((g) => g.homeTeam === home);
  if (last?.location)
    document.getElementById("location-input").value = last.location;
}
function confirmSetup() {
  const h = document.getElementById("home-team-input").value,
    a = document.getElementById("away-team-input").value;
  if (!h || !a) return alert("Enter names");
  gameState.homeTeam = h;
  gameState.awayTeam = a;
  gameState.location = document.getElementById("location-input").value;
  document.getElementById("setup-screen").style.display = "none";
  saveToLocal();
  drawScoreboard();
  if (!gameState.timerActive) toggleTimer(); // Auto-start timer on setup
}
loadGame();
