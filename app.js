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
  console.log("Switching to pitch type:", type); // Add this to debug!
  gameState.currentPitchType = type;

  document
    .querySelectorAll(".type-chip")
    .forEach((chip) => chip.classList.remove("active"));
  const btn = document.getElementById(`type-${type}`);
  if (btn) btn.classList.add("active");

  saveToLocal(); // Ensure this is saved immediately
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
  // 1. Gatekeeper: Ensure pitcher is selected
  if (gameState.pitcherName === "Select Pitcher") {
    openPitcherPicker();
    return;
  }

  // 2. Gatekeeper: Ensure zone was tapped (except for HBP)
  if (!gameState.lastTap && result !== "HBP") {
    return alert("Tap the zone first!");
  }

  // 3. Handle In-Play Overlay
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
  const speedInput = document.getElementById("pitch-speed");
  const speedValue = parseInt(speedInput.value) || 0;

  const newPitch = {
    x: gameState.lastTap?.x || 50,
    y: gameState.lastTap?.y || 50,
    type: gameState.currentPitchType || "FB",
    pitchType: gameState.currentPitchType || "FB",
    speed: speedValue,
    velocity: speedValue,
    result: result,
    direction: direction,
    countBefore: gameState.balls + "-" + gameState.strikes,
    timestamp: Date.now(),
    game_id: gameState.gameId, // Use game_id to match stats.js filters
  };

  gameState.sessionPitches.push(newPitch);
  gameState.activeAtBatPitches.push(newPitch);

  const currentPing = document.querySelector(".temp-ping");
  if (currentPing) {
    currentPing.classList.remove("temp-ping");
    currentPing.style.backgroundColor = getPitchColor(result);
    currentPing.style.animation = "none";
  }

  WildmanEngine.updateCount(result);
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

  // 1. Remove the last recorded pitch from both arrays
  gameState.sessionPitches.pop();
  gameState.activeAtBatPitches.pop(); // CRITICAL: Remove from current batter view too

  // 2. Wipe the visual pings
  clearZoneUI();

  // 3. Let the engine reset the math (balls, strikes, total)
  WildmanEngine.reprocessHistory();

  // 4. REDRAW the pings that are left in activeAtBatPitches
  (gameState.activeAtBatPitches || []).forEach((p) => {
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

  // 1. Create the Live Game Object
  const isLive = gameState.sessionPitches.length > 0;
  let liveGame = null;

  if (isLive) {
    liveGame = {
      id: gameState.gameId,
      pitcher_name: gameState.pitcherName,
      away_team: gameState.awayTeam,
      home_team: gameState.homeTeam,
      played_at: new Date().toISOString(),
      pitcher_team: gameState.pitcherTeam,
      final_score_home: gameState.homeScore,
      final_score_away: gameState.awayScore,
    };

    // Render local data immediately so he's not waiting
    processAndRenderStats([liveGame], gameState.sessionPitches);

    // Prevent duplicate "Live" badges
    if (!document.getElementById("live-session-badge")) {
      const liveBadge = document.createElement("div");
      liveBadge.id = "live-session-badge";
      liveBadge.innerHTML = `<span style="background:var(--ball); color:white; padding:4px 8px; border-radius:4px; font-size:0.6rem; font-weight:900; margin-left:20px;">LIVE SESSION</span>`;
      document.querySelector(".modal-header").appendChild(liveBadge);
    }
  } else {
    display.innerHTML =
      "<p style='text-align:center; width:100%;'>Syncing Cloud...</p>";
    // Remove badge if no live game
    const oldBadge = document.getElementById("live-session-badge");
    if (oldBadge) oldBadge.remove();
  }

  // 2. Fetch Cloud Data and MERGE
  try {
    const cloudData = await WildmanAPI.fetchStats();
    if (cloudData) {
      // THE CRITICAL MERGE:
      // We put the live game at the front of the list so it shows up in filters
      rawStatsData.games = isLive
        ? [liveGame, ...cloudData.games]
        : cloudData.games;
      rawStatsData.pitches = isLive
        ? [...gameState.sessionPitches, ...cloudData.pitches]
        : cloudData.pitches;

      populateFilterDropdowns();

      // If no live game, show the default history view
      if (!isLive) {
        applyFilters();
      }
    }
  } catch (err) {
    console.warn("Cloud sync failed. Operating in local-only mode.");
    if (isLive) {
      rawStatsData.games = [liveGame];
      rawStatsData.pitches = [...gameState.sessionPitches];
      populateFilterDropdowns();
    } else {
      display.innerHTML =
        "<p style='text-align:center; color:red;'>Offline: No Cloud Data Available</p>";
    }
  }
}

async function endGame() {
  if (!confirm("Save game to Wildman Database?")) return;

  // 1. Stop the clock if it's still running
  if (gameState.timerActive) toggleTimer();

  // 2. Map the data EXACTLY for your Neon DB columns
  const mappedPitches = gameState.sessionPitches.map((p) => ({
    game_id: gameState.gameId,
    pitch_type: p.type || "FB",
    velocity: parseInt(p.speed || p.velocity || 0),
    result: p.result,
    location_x: parseFloat(p.x),
    location_y: parseFloat(p.y),
    hit_direction: p.direction || null,
    timestamp: new Date(p.timestamp).toISOString(),
    count_before: p.countBefore || "0-0",
  }));

  const payload = {
    gameData: {
      pitcherName: gameState.pitcherName,
      pitcherTeam: gameState.pitcherTeam,
      homeTeam: gameState.homeTeam,
      awayTeam: gameState.awayTeam,
      final_score_home: gameState.homeScore,
      final_score_away: gameState.awayScore,
      game_duration_seconds: gameState.timerSeconds,
    },
    pitches: mappedPitches,
  };

  // 3. The "Smart" Save Logic
  try {
    // If browser reports offline immediately, don't even try the fetch
    if (!navigator.onLine) {
      throw new Error("Offline Mode");
    }

    const result = await WildmanAPI.saveGame(payload);

    if (result?.success) {
      alert("⚾ Saved to Neon Cloud!");
      cleanupAfterSave();
    } else {
      // If the server is up but returned an error (like a DB timeout)
      throw new Error(result?.error || "Server Error");
    }
  } catch (err) {
    // 4. OFFLINE FALLBACK
    console.warn("Save failed or offline. Queueing for sync:", err.message);

    saveToSyncQueue(payload);

    alert(
      "📡 No Internet or Sync Error!\n\nGame saved locally on this iPad. It will upload automatically once you're back on Wi-Fi.",
    );

    cleanupAfterSave();
  }
}

function saveToSyncQueue(payload) {
  let queue = JSON.parse(localStorage.getItem("wildman_sync_queue") || "[]");
  queue.push(payload);
  localStorage.setItem("wildman_sync_queue", JSON.stringify(queue));
}

function cleanupAfterSave() {
  localStorage.removeItem("currentPitchTrackerGame");
  location.reload();
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

  // Ensure this matches the key stats.js looks for (p.game_id)
  gameState.gameId = "game-" + Date.now();

  document.getElementById("setup-screen").style.display = "none";
  document.getElementById("app").style.display = "flex";

  saveToLocal();
  drawScoreboard();
}
