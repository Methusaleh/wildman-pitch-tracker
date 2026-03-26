function updateTimeOptions(type) {
  const container = document.getElementById("filter-sub-option");
  const dateInput = document.getElementById("filter-date");

  // Reset views
  container.style.display = "none";
  dateInput.style.display = "none";

  if (!subSelect || !dateInput) return;

  subSelect.style.display = "none";
  dateInput.style.display = "none";

  if (type === "all") {
    applyFilters(); // Instant update
  } else if (type === "month") {
    subSelect.style.display = "block";
    const months = [
      ...new Set(
        rawStatsData.games.map((g) => {
          const d = new Date(g.played_at);
          return d.toLocaleString("default", {
            month: "long",
            year: "numeric",
          });
        }),
      ),
    ];
    subSelect.innerHTML =
      `<option value="">SELECT MONTH...</option>` +
      months.map((m) => `<option value="${m}">${m}</option>`).join("");
  } else if (type === "week") {
    container.style.display = "block";
    // Logic to group games by 'Week of [Date]'
    container.innerHTML = `<option value="">Select Week...</option>`;
    // ... (populate week logic)
  } else if (type === "single") {
    dateInput.style.display = "block";
  }
}

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

  // NEW: Grab value from the checked radio button
  const radioMatch = document.querySelector('input[name="timespan"]:checked');
  const span = radioMatch ? radioMatch.value : "all";

  const selectedDate = document.getElementById("filter-date").value;
  const selectedSub = document.getElementById("filter-sub-option").value;

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
      if (selectedSub) {
        // Match specific month selected from dropdown (e.g., "March 2026")
        const gameMonth = gameDate.toLocaleString("default", {
          month: "long",
          year: "numeric",
        });
        matchTime = gameMonth === selectedSub;
      } else {
        // Default: This current month
        matchTime =
          gameDate.getMonth() === now.getMonth() &&
          gameDate.getFullYear() === now.getFullYear();
      }
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
  // Ensure we have a clean slate
  display.innerHTML = "";

  // 1. CALCULATE ANALYTICS
  // We only want to calculate stats for the games currently in our filtered list
  const filteredGameIds = games.map((g) => g.id);
  const activePitches = pitches.filter((p) =>
    filteredGameIds.includes(p.game_id),
  );

  const totalP = activePitches.length;
  const strikes = activePitches.filter(
    (p) => p.result && (p.result.includes("Strike") || p.result === "Foul"),
  ).length;
  const sPct = totalP > 0 ? ((strikes / totalP) * 100).toFixed(1) : 0;
  const maxV =
    activePitches.length > 0
      ? Math.max(...activePitches.map((p) => p.velocity || 0))
      : 0;

  // 2. RENDER HERO SECTION (The Big Dashboard)
  let html = `
        <div class="stats-hero-container" style="padding: 10px;">
            <div class="hero-main-stats" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
                <div class="stat-card hero-card"><label>STRIKE %</label><span style="font-size: 2.5rem; color: var(--strike);">${sPct}%</span></div>
                <div class="stat-card hero-card"><label>MAX VELO</label><span style="font-size: 2.5rem; color: var(--accent);">${maxV} <small style="font-size: 1rem;">MPH</small></span></div>
                <div class="stat-card"><label>TOTAL PITCHES</label><span>${totalP}</span></div>
                <div class="stat-card"><label>SESSIONS</label><span>${games.length}</span></div>
            </div>
            
            <h3 style="font-size: 0.75rem; color: #555; letter-spacing: 1px; margin-bottom: 12px; border-bottom: 1px solid #222; padding-bottom: 5px;">RECENT SESSIONS (MAX 3)</h3>
            <div class="mini-games-list">
    `;

  // 3. RENDER RECENT GAMES (Limited to top 3)
  const recentGames = games.slice(0, 3);

  if (recentGames.length === 0) {
    html += `<p style="color:#444; text-align:center; font-style:italic;">No games match these filters.</p>`;
  }

  recentGames.forEach((game) => {
    const gamePitches = pitches.filter((p) => p.game_id === game.id);
    const date = new Date(game.played_at).toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
    });

    // Calculate K's for this specific game
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

    const reportText = generateConciseReport(
      game,
      gamePitches,
      strikeouts,
      date,
    );
    const safeReport = btoa(unescape(encodeURIComponent(reportText)));

    html += `
            <div class="mini-game-row" 
                 onclick="viewSingleGameStats('${game.id}')"
                 style="display:flex; justify-content:space-between; align-items:center; background:#111; padding:12px; margin-bottom:8px; border-radius:10px; border: 1px solid #222; cursor: pointer;">
                <div class="game-meta">
                    <h4 style="margin:0; font-size:0.85rem; color:#eee;">${game.away_team} @ ${game.home_team}</h4>
                    <p style="margin:0; font-size:0.65rem; color:#666; font-weight:bold;">${date} • ${strikeouts} K • ${gamePitches.length} PITCHES</p>
                </div>
                <button onclick="event.stopPropagation(); copyReport('${safeReport}')" 
                        style="background: #222; color: #fff; border: 1px solid #444; padding: 6px 12px; border-radius: 6px; font-size: 0.6rem; font-weight: 800;">
                    REPORT
                </button>
            </div>
        `;
  });

  html += `</div></div>`;
  display.innerHTML = html;
}

/**
 * Helper to jump into a single game's analytics when clicked
 */
function viewSingleGameStats(gameId) {
  const game = rawStatsData.games.find((g) => g.id == gameId);
  if (game) {
    // We pass a single game in an array, and all pitches.
    // processAndRenderStats will handle the internal filtering.
    processAndRenderStats([game], rawStatsData.pitches);

    // Visual feedback that we are looking at a specific game
    const display = document.getElementById("stats-display");
    const backBtn = document.createElement("button");
    backBtn.innerText = "← BACK TO ALL";
    backBtn.style =
      "background:none; border:none; color:var(--accent); font-size:0.7rem; font-weight:bold; margin-bottom:10px; cursor:pointer;";
    backBtn.onclick = () => applyFilters(); // Reset to current filters
    display.prepend(backBtn);
  }
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
