let inningPressTimer;
let isLongPress = false;

function startInningTimer() {
  isLongPress = false;
  // Hold for 600ms to go backward
  inningPressTimer = setTimeout(() => {
    isLongPress = true;
    adjustInning(-1);
  }, 600);
}

function stopInningTimer() {
  if (inningPressTimer) {
    clearTimeout(inningPressTimer);
    // Only go forward if it wasn't a long press
    if (!isLongPress) {
      adjustInning(1);
    }
    inningPressTimer = null; // Reset for next tap
  }
}

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

function placePing(x, y) {
  document.querySelectorAll(".temp-ping").forEach((p) => p.remove());
  const ping = document.createElement("div");
  ping.className = "ping temp-ping";
  ping.style.left = x + "%";
  ping.style.top = y + "%";
  // Grab the element directly to avoid "strikeZone is undefined" errors
  document.getElementById("strike-zone").appendChild(ping);
}

function clearZoneUI() {
  // 1. Physically remove dots from the screen
  document.querySelectorAll(".ping").forEach((p) => p.remove());
}

function setPitcher(p) {
  gameState.pitcherName = `${p.first} ${p.last}`;
  gameState.pitcherHand = p.hand;
  drawScoreboard();
  saveToLocal();
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

function closeStats() {
  document.getElementById("stats-modal").style.display = "none";
  const badge = document.getElementById("live-session-badge");
  if (badge) badge.remove();
}

function closePitcherModal() {
  document.getElementById("pitcher-modal").style.display = "none";
}

function saveNewPitcher() {
  const first = document.getElementById("new-p-first").value;
  const last = document.getElementById("new-p-last").value;

  // NEW: Find which hand button is currently active
  const handBtn = document.querySelector(".btn-hand.active");
  const hand = handBtn
    ? handBtn.innerText.includes("RIGHT")
      ? "R"
      : "L"
    : "R";

  if (!first || !last) return alert("Enter full name");

  const roster = getRoster();
  const newP = {
    id: Date.now(),
    first: first,
    last: last,
    hand: hand,
  };

  roster.push(newP);
  localStorage.setItem("wildmanRoster", JSON.stringify(roster));

  // Update the game state and close
  setPitcher(newP);
  closePitcherModal();

  // Clear inputs for next time
  document.getElementById("new-p-first").value = "";
  document.getElementById("new-p-last").value = "";
}

function selectHand(h) {
  // Toggle the active classes visually
  document.getElementById("btn-right").classList.toggle("active", h === "R");
  document.getElementById("btn-left").classList.toggle("active", h === "L");
}

function openPitcherPicker() {
  const modal = document.getElementById("pitcher-picker-modal");
  const container = document.getElementById("pitcher-list-container");

  if (!modal || !container) return;

  // Show the modal
  modal.style.display = "flex";

  // Get the current roster from storage
  const roster = JSON.parse(localStorage.getItem("wildmanRoster")) || [];

  if (roster.length === 0) {
    container.innerHTML = `<p style="color: #444; text-align: center; padding: 20px;">No pitchers found. Add one below!</p>`;
    return;
  }

  // Build the list of names
  container.innerHTML = roster
    .map(
      (p) => `
    <div onclick="selectPitcherFromMenu(${p.id})" 
         style="padding: 15px; background: #111; border: 1px solid #222; border-radius: 12px; margin-bottom: 10px; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
      <span style="font-weight: bold; color: #fff;">${p.first} ${p.last}</span>
      <span style="color: var(--accent); font-size: 0.7rem; font-weight: 900;">${p.hand === "R" ? "RIGHTY" : "LEFTY"}</span>
    </div>
  `,
    )
    .join("");
}

function switchPitcher() {
  clearZoneUI();
  // Open the new selection overlay instead of the old prompt
  openPitcherPicker();
}

function selectPitcherFromMenu(id) {
  const roster = JSON.parse(localStorage.getItem("wildmanRoster")) || [];
  const p = roster.find((pitcher) => pitcher.id === id);
  if (p) {
    setPitcher(p);
    closePitcherPicker();
  }
}

function closePitcherPicker() {
  document.getElementById("pitcher-picker-modal").style.display = "none";
}

function openNewPitcherForm() {
  closePitcherPicker(); // Close the selection list
  document.getElementById("pitcher-modal").style.display = "flex"; // Open the 'Add New' form
}
