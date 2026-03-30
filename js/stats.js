function updateTimeOptions(type) {
  const subSelect = document.getElementById("filter-sub-option");
  const dateInput = document.getElementById("filter-date");
  if (!subSelect) return;

  subSelect.style.display = "none";
  if (dateInput) dateInput.style.display = "none";

  if (type === "all") {
    applyFilters();
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
  } else if (type === "week" || type === "single") {
    subSelect.style.display = "block";

    // Group by Sunday
    const weeks = [
      ...new Set(
        rawStatsData.games.map((g) => {
          const d = new Date(g.played_at);
          const sun = new Date(d);
          sun.setDate(d.getDate() - d.getDay()); // Roll back to Sunday
          return sun.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        }),
      ),
    ].sort((a, b) => new Date(b) - new Date(a)); // Newest weeks first

    const label = type === "week" ? "SELECT WEEK..." : "PICK WEEK FIRST...";
    subSelect.innerHTML =
      `<option value="">${label}</option>` +
      weeks.map((w) => `<option value="${w}">Week of ${w}</option>`).join("");
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
  const radioMatch = document.querySelector('input[name="timespan"]:checked');
  const span = radioMatch ? radioMatch.value : "all";
  const selectedSub = document.getElementById("filter-sub-option").value;

  let filteredGames = rawStatsData.games.filter((game) => {
    const gameDate = new Date(game.played_at);
    const matchP = selectedP === "all" || game.pitcher_name === selectedP;
    const matchT =
      selectedT === "all" ||
      game.pitcher_team === selectedT ||
      game.home_team === selectedT ||
      game.away_team === selectedT;

    let matchTime = true;

    if (span === "month" && selectedSub) {
      const gameMonth = gameDate.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
      matchTime = gameMonth === selectedSub;
    } else if ((span === "week" || span === "single") && selectedSub) {
      const sun = new Date(gameDate);
      sun.setDate(gameDate.getDate() - gameDate.getDay());
      const weekStr = sun.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      matchTime = weekStr === selectedSub;
    }

    return matchP && matchT && matchTime;
  });

  // SPECIAL: If searching for a "Single Game" and we have a week selected
  if (span === "single" && selectedSub) {
    showGamePicker(filteredGames);
  } else {
    // Remove game picker if not in "single" mode
    const picker = document.getElementById("specific-game-picker");
    if (picker) picker.style.display = "none";
    processAndRenderStats(filteredGames, rawStatsData.pitches);
  }
}

function processAndRenderStats(games, pitches) {
  const display = document.getElementById("stats-display");
  if (!display) return;

  // Ensure we have a clean slate
  display.innerHTML = "";

  // 1. CALCULATE ANALYTICS
  // Filter pitches to only those belonging to the games currently in the filtered list
  const filteredGameIds = games.map((g) => g.id);
  const activePitches = pitches.filter((p) =>
    filteredGameIds.includes(p.game_id),
  );

  const totalP = activePitches.length;
  const strikes = activePitches.filter(
    (p) =>
      p.result &&
      (p.result.includes("Strike") ||
        p.result === "Foul" ||
        p.result === "In-Play"),
  ).length;

  const sPct = totalP > 0 ? ((strikes / totalP) * 100).toFixed(1) : 0;
  const maxV =
    activePitches.length > 0
      ? Math.max(...activePitches.map((p) => p.velocity || 0))
      : 0;

  // 2. FIRST PITCH STRIKE (FPS) LOGIC
  const firstPitches = activePitches.filter((p) => {
    if (!p.countBefore) return false;
    // Strip all spaces so "0-0", "0 - 0", etc. all match "0-0"
    return p.countBefore.replace(/\s+/g, "") === "0-0";
  });

  const totalAtBats = firstPitches.length;
  const fpsStrikes = firstPitches.filter(
    (p) =>
      p.result.includes("Strike") ||
      p.result === "Foul" ||
      p.result === "In-Play",
  ).length;

  const fpsPct =
    totalAtBats > 0 ? ((fpsStrikes / totalAtBats) * 100).toFixed(1) : 0;

  // 3. PITCH TENDENCIES LOGIC
  const tendencies = calculateTendencies(activePitches);

  // 4. RENDER HERO SECTION & TENDENCY TABLE
  let html = `
    <div class="stats-hero-container" style="padding: 10px;">
        <div class="hero-main-stats" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
            <div class="stat-card hero-card"><label>STRIKE %</label><span style="font-size: 2.5rem; color: var(--strike);">${sPct}%</span></div>
            <div class="stat-card hero-card"><label>1ST PITCH STR%</label><span style="font-size: 2.5rem; color: #ffeb3b;">${fpsPct}%</span></div>
            <div class="stat-card"><label>MAX VELO</label><span style="color: var(--accent); font-weight: 800;">${maxV} MPH</span></div>
            <div class="stat-card"><label>TOTAL PITCHES</label><span>${totalP}</span></div>
        </div>

        <div class="tendency-container" style="margin-bottom: 25px;">
            <h3 style="font-size: 0.75rem; color: #555; letter-spacing: 1px; margin-bottom: 10px; border-bottom: 1px solid #222; padding-bottom: 5px;">PITCH TENDENCIES</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; background: #111; border-radius: 10px; overflow: hidden;">
                <thead>
                    <tr style="background: #1a1a1a; color: #888; text-align: left;">
                        <th style="padding: 10px;">TYPE</th>
                        <th style="padding: 10px;">QTY</th>
                        <th style="padding: 10px;">AVG</th>
                        <th style="padding: 10px;">MAX</th>
                        <th style="padding: 10px;">STRIKE%</th>
                    </tr>
                </thead>
                <tbody>
                    ${tendencies
                      .map(
                        (t) => `
                        <tr style="border-bottom: 1px solid #222;">
                            <td style="padding: 12px; font-weight: bold; color: var(--accent);">${t.label}</td>
                            <td style="padding: 12px;">${t.count}</td>
                            <td style="padding: 12px;">${t.avgV}</td>
                            <td style="padding: 12px;">${t.maxV}</td>
                            <td style="padding: 12px; color: var(--strike); font-weight: bold;">${t.sPct}%</td>
                        </tr>
                    `,
                      )
                      .join("")}
                </tbody>
            </table>
        </div>

        <h3 style="font-size: 0.75rem; color: #555; letter-spacing: 1px; margin-bottom: 12px; border-bottom: 1px solid #222; padding-bottom: 5px;">RECENT SESSIONS (MAX 3)</h3>
        <div class="mini-games-list">
  `;

  // 5. RENDER RECENT GAMES
  const recentGames = games.slice(0, 3);

  if (recentGames.length === 0) {
    html += `<p style="color:#444; text-align:center; font-style:italic; padding: 20px;">No games match these filters.</p>`;
  } else {
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
        if (
          p.result === "Ball" ||
          p.result === "In-Play" ||
          p.result === "HBP"
        ) {
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
  }

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

function showGamePicker(gamesInWeek) {
  let picker = document.getElementById("specific-game-picker");

  // Create it if it doesn't exist yet
  if (!picker) {
    picker = document.createElement("select");
    picker.id = "specific-game-picker";
    // Append it to the container
    document.getElementById("dynamic-time-container").appendChild(picker);
  }

  picker.style.display = "block";

  // Wire up the change event
  picker.onchange = (e) => {
    const gameId = e.target.value;
    if (gameId) {
      const single = gamesInWeek.filter((g) => g.id == gameId);
      processAndRenderStats(single, rawStatsData.pitches);
    }
  };

  // Fill with game scores
  picker.innerHTML =
    `<option value="">SELECT SPECIFIC GAME...</option>` +
    gamesInWeek
      .map((g) => {
        const d = new Date(g.played_at).toLocaleDateString("en-US", {
          month: "numeric",
          day: "numeric",
        });
        return `<option value="${g.id}">${d}: ${g.away_team} (${g.final_score_away}) @ ${g.home_team} (${g.final_score_home})</option>`;
      })
      .join("");
}

function calculateTendencies(pitches) {
  const types = ["FB", "BR", "CH"];
  const labels = { FB: "Fastball", BR: "Breaking", CH: "Changeup" };

  // LOG: Let's see what the app is actually saving
  if (pitches.length > 0) console.log("Sample Pitch Object:", pitches[0]);

  return types
    .map((type) => {
      const typePitches = pitches.filter((p) => {
        // Look for .type or .currentPitchType and make it uppercase
        const val = (p.type || p.currentPitchType || "")
          .toString()
          .toUpperCase();
        return val.includes(type);
      });

      if (typePitches.length === 0) return null;

      const strikes = typePitches.filter(
        (p) =>
          p.result.includes("Strike") ||
          p.result === "Foul" ||
          p.result === "In-Play",
      ).length;

      // Support .speed or .velocity
      const vels = typePitches
        .map((p) => p.speed || p.velocity || 0)
        .filter((v) => v > 0);
      const avgV =
        vels.length > 0
          ? (vels.reduce((a, b) => a + b, 0) / vels.length).toFixed(1)
          : "-";
      const maxV = vels.length > 0 ? Math.max(...vels) : "-";
      const sPct = ((strikes / typePitches.length) * 100).toFixed(1);

      return {
        label: labels[type],
        count: typePitches.length,
        avgV,
        maxV,
        sPct,
      };
    })
    .filter((t) => t !== null);
}
