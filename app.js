/**
 * WILDMAN PITCH TRACKER - CONTROLLER
 * Focus: Global State, Initialization, and Primary Event Routing
 */

let gameState = {
  pitcherName: "Select Pitcher",
  pitcherHand: "R",
  pitcherTeam: "", // Added to ensure DB save works
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
  sessionPitches: [],
  activeAtBatPitches: [],
  currentPitchType: "FB",
  lastTap: null,
};

let rawStatsData = { games: [], pitches: [] };
let selectedHand = "R";
let timerInterval;

// --- INITIALIZATION ---
window.addEventListener("DOMContentLoaded", () => {
  loadGame();
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
    btn.style.background = "#222";
  } else {
    gameState.timerActive = true;
    btn.innerText = "PAUSE";
    btn.style.background = "#f44336";
    timerInterval = setInterval(() => {
      gameState.timerSeconds++;
      updateTimerDisplay();
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

// --- PITCH RECORDING ---
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

// Click listener for the Strike Zone
document.getElementById("strike-zone").addEventListener("click", (e) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 100;
  const y = ((e.clientY - rect.top) / rect.height) * 100;
  if (x >= 0 && x <= 100 && y >= 0 && y <= 100) {
    placePing(x, y); // In ui.js
    gameState.lastTap = { x: x.toFixed(2), y: y.toFixed(2) };
  }
});

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

function finishRecording(result, direction = null) {
  const speed = document.getElementById("pitch-speed").value;
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

  WildmanEngine.updateCount(result); // In engine.js
  resetStrikeButtons();
  saveToLocal();
  gameState.lastTap = null;
}

function getPitchColor(result) {
  if (result.includes("Strike")) return "#4caf50";
  if (result === "Ball" || result === "HBP") return "#f44336";
  if (result === "Foul") return "#9c27b0";
  if (result === "In-Play") return "#2196f3";
  return "#ffffff";
}

function undoLastPitch() {
  if (gameState.sessionPitches.length === 0) return;
  gameState.sessionPitches.pop();

  clearZoneUI(); // In ui.js
  WildmanEngine.reprocessHistory(); // In engine.js

  // Re-draw pings for current batter
  gameState.activeAtBatPitches.forEach((p) => {
    const ping = document.createElement("div");
    ping.className = "ping";
    ping.style.left = p.x + "%";
    ping.style.top = p.y + "%";
    ping.style.backgroundColor = getPitchColor(p.result);
    document.getElementById("strike-zone").appendChild(ping);
  });

  saveToLocal();
  resetStrikeButtons();
}

// --- GAME ACTIONS ---
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
  drawScoreboard();
  saveToLocal();
}

function switchPitcher() {
  // Swapping pitchers usually implies a new session/stamina tracking
  // We keep history but clear the current batter's view
  clearZoneUI();
  promptPitcherName();
}

// --- PERSISTENCE ---
function saveToLocal() {
  localStorage.setItem("currentPitchTrackerGame", JSON.stringify(gameState));
}

function loadGame() {
  const saved = localStorage.getItem("currentPitchTrackerGame");
  if (saved) {
    gameState = JSON.parse(saved);
    document.getElementById("app").style.display = "flex";
    gameState.timerActive = false;
    drawScoreboard();
    updateTimerDisplay();
    setPitchType(gameState.currentPitchType || "FB");

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

function getRoster() {
  return JSON.parse(localStorage.getItem("wildmanRoster")) || [];
}

// --- SCREEN FLOW ---
async function openStats() {
  const modal = document.getElementById("stats-modal");
  const display = document.getElementById("stats-display");
  modal.style.display = "flex";
  display.innerHTML =
    "<p style='text-align:center; width:100%;'>Syncing Cloud...</p>";

  try {
    rawStatsData = await WildmanAPI.fetchStats(); // In api.js
    if (rawStatsData.games?.length > 0) {
      populateFilterDropdowns(); // In stats.js
      applyFilters(); // In stats.js
    } else {
      display.innerHTML = "<p style='text-align:center;'>No data found.</p>";
    }
  } catch (err) {
    display.innerHTML =
      "<p style='text-align:center; color:red;'>Sync Error</p>";
  }
}

async function endGame() {
  if (!confirm("Save game to Wildman Database?")) return;
  if (gameState.timerActive) toggleTimer();

  const payload = {
    gameData: {
      pitcherName: gameState.pitcherName,
      pitcherTeam: gameState.pitcherTeam,
      homeTeam: gameState.homeTeam,
      awayTeam: gameState.awayTeam,
      homeScore: gameState.homeScore,
      awayScore: gameState.awayScore,
      timerSeconds: gameState.timerSeconds,
    },
    pitches: gameState.sessionPitches,
  };

  const result = await WildmanAPI.saveGame(payload);
  if (result?.success) {
    alert("⚾ Saved to Neon!");
    localStorage.removeItem("currentPitchTrackerGame");
    location.reload();
  } else {
    alert("Error: " + (result.error || "Check logs"));
  }
}

function confirmSetup() {
  const h = document.getElementById("home-team-input").value;
  const a = document.getElementById("away-team-input").value;
  const pt = document.getElementById("pitcher-team-input").value;

  if (!h || !a || !pt) return alert("Fill all fields");

  gameState.homeTeam = h;
  gameState.awayTeam = a;
  gameState.pitcherTeam = pt;
  gameState.location = document.getElementById("location-input").value;

  document.getElementById("setup-screen").style.display = "none";
  document.getElementById("app").style.display = "flex";

  saveToLocal();
  drawScoreboard();
}
