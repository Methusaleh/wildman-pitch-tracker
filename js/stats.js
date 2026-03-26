function populateFilterDropdowns() {
  const pSelect = document.getElementById("filter-pitcher");
  const tSelect = document.getElementById("filter-team");

  // Use "Sets" to get unique values only
  const pitchers = [...new Set(rawStatsData.games.map((g) => g.pitcher_name))];
  const teams = [
    ...new Set(
      rawStatsData.games.map(
        (g) => g.pitcher_team || g.home_team || g.away_team,
      ),
    ),
  ];

  pSelect.innerHTML =
    `<option value="all">All Pitchers</option>` +
    pitchers.map((p) => `<option value="${p}">${p}</option>`).join("");

  tSelect.innerHTML =
    `<option value="all">All Teams</option>` +
    teams.map((t) => `<option value="${t}">${t}</option>`).join("");
}

function applyFilters() {
  const selectedP = document.getElementById("filter-pitcher").value;
  const selectedT = document.getElementById("filter-team").value;
  const span = document.getElementById("filter-timespan").value;
  const selectedDate = document.getElementById("filter-date").value; // "YYYY-MM-DD"

  const now = new Date();

  let filteredGames = rawStatsData.games.filter((game) => {
    const gameDate = new Date(game.played_at);

    // 1. Basic Filters
    const matchP = selectedP === "all" || game.pitcher_name === selectedP;
    const matchT =
      selectedT === "all" ||
      game.pitcher_team === selectedT ||
      game.home_team === selectedT ||
      game.away_team === selectedT;

    // 2. Advanced Time Logic
    let matchTime = true;

    if (span === "month") {
      matchTime =
        gameDate.getMonth() === now.getMonth() &&
        gameDate.getFullYear() === now.getFullYear();
    } else if (span === "week") {
      const sunday = new Date();
      sunday.setDate(now.getDate() - now.getDay());
      sunday.setHours(0, 0, 0, 0);
      matchTime = gameDate >= sunday;
    } else if (span === "single" && selectedDate) {
      // Compare YYYY-MM-DD strings for a perfect match
      const offsetDate = new Date(
        gameDate.getTime() - gameDate.getTimezoneOffset() * 60000,
      )
        .toISOString()
        .split("T")[0];
      matchTime = offsetDate === selectedDate;
    }

    return matchP && matchT && matchTime;
  });

  processAndRenderStats(filteredGames, rawStatsData.pitches);
}

function processAndRenderStats(games, pitches) {
  const display = document.getElementById("stats-display");

  display.innerHTML = "";

  // 1. Calculate Season Totals
  const totalP = pitches.length;
  const strikes = pitches.filter(
    (p) => p.result && (p.result.includes("Strike") || p.result === "Foul"),
  ).length;
  const sPct = totalP > 0 ? ((strikes / totalP) * 100).toFixed(1) : 0;
  const maxV =
    pitches.length > 0 ? Math.max(...pitches.map((p) => p.velocity || 0)) : 0;

  // 2. Build the HTML (Using your existing stat-card classes)
  let html = `
    <div class="stats-summary-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 20px;">
       <div class="stat-card"><label>Total Pitches</label><span>${totalP}</span></div>
       <div class="stat-card"><label>Season Max</label><span>${maxV} <small>MPH</small></span></div>
       <div class="stat-card"><label>Strike %</label><span>${sPct}%</span></div>
       <div class="stat-card"><label>Total Games</label><span>${games.length}</span></div>
    </div>
    <h3 style="font-size: 0.8rem; color: #666; margin-bottom: 10px; text-transform: uppercase;">Recent Games</h3>
  `;

  // 3. Add the individual game rows
  // Replace the loop at the bottom of processAndRenderStats with this:
  games.forEach((game) => {
    const gamePitches = pitches.filter((p) => p.game_id === game.id);
    const date = new Date(game.played_at).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
    });

    // 1. Calculate K's for this specific game
    let strikeouts = 0;
    let sCount = 0;
    gamePitches.forEach((p) => {
      if (p.result === "Ball" || p.result === "In-Play" || p.result === "HBP") {
        sCount = 0;
      } else if (p.result.includes("Strike") || p.result === "Foul") {
        if (sCount === 2 && p.result !== "Foul") {
          strikeouts++;
          sCount = 0;
        } else if (p.result !== "Foul" || sCount < 2) sCount++;
      }
    });

    // 2. Prepare the report and encode it for the button
    const reportText = generateConciseReport(
      game,
      gamePitches,
      strikeouts,
      date,
    );
    const safeReport = btoa(unescape(encodeURIComponent(reportText))); // Safety for emojis

    html += `
      <div class="game-row" style="display:flex; justify-content:space-between; align-items:center; background:#1a1a1a; padding:10px; margin-bottom:5px; border-radius:8px;">
        <div class="game-info">
          <h4 style="margin:0; font-size:0.9rem;">${game.away_team} @ ${game.home_team}</h4>
          <p style="margin:0; font-size:0.7rem; color:#555;">${date} • ${game.pitcher_name} • ${strikeouts}K</p>
        </div>
        <button onclick="copyReport('${safeReport}')" style="background:#333; color:var(--strike); border:none; padding:5px 10px; border-radius:4px; font-size:0.7rem; font-weight:bold;">REPORT</button>
      </div>
    `;
  });

  html += `</div>`;
  display.innerHTML = html;
}

function toggleDateInput(value) {
  const dateInput = document.getElementById("filter-date");
  // If user picks "single", show the calendar. Otherwise, hide it.
  if (value === "single") {
    dateInput.style.display = "block";
  } else {
    dateInput.style.display = "none";
    applyFilters(); // Re-run stats immediately for Week/Month/All
  }
}

function generateConciseReport(game, pitches, kCount, date) {
  const total = pitches.length;
  const strikes = pitches.filter(
    (p) => p.result.includes("Strike") || p.result === "Foul",
  ).length;
  const sPct = total > 0 ? Math.round((strikes / total) * 100) : 0;
  const maxV =
    pitches.length > 0 ? Math.max(...pitches.map((p) => p.velocity)) : 0;

  // Inning calculation (approximated from game total duration or max inning logged)
  // For now we use the final score as requested
  return `📊 WILDMAN REPORT: ${date}
Game: ${game.away_team} @ ${game.home_team} (${game.final_score_away}-${game.final_score_home})
Pitcher: ${game.pitcher_name}
Line: ${kCount} K
Velo: Max ${maxV} MPH
Strikes: ${sPct}% (${strikes}/${total})`;
}

function copyReport(encodedReport) {
  const report = atob(encodedReport);
  navigator.clipboard.writeText(report).then(() => {
    alert("Scout Report copied to clipboard! Ready to text.");
  });
}
