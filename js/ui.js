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

  // 2. Wipe the "Active" memory so the next load starts fresh
  gameState.activeAtBatPitches = [];
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
}

function closePitcherModal() {
  document.getElementById("pitcher-modal").style.display = "none";
}
