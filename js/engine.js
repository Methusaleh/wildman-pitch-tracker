/**
 * WILDMAN ENGINE MODULE
 * Handles the logic of the game (Count, Outs, Innings, Undo)
 */
const WildmanEngine = {
  // Process a pitch result and update the game state
  updateCount(result) {
    gameState.totalPitches++;

    if (result === "Ball") {
      gameState.balls++;
      if (gameState.balls === 4) {
        this.resetAtBat();
      }
    } else if (result.includes("Strike")) {
      gameState.strikes++;
      if (gameState.strikes === 3) {
        gameState.outs++;
        this.resetAtBat();
      }
    } else if (result === "Foul") {
      if (gameState.strikes < 2) gameState.strikes++;
    } else if (result === "In-Play" || result === "HBP") {
      this.resetAtBat();
    }

    // Three outs reset the out counter
    if (gameState.outs === 3) {
      gameState.outs = 0;
    }

    // Global UI updates remain in app.js or ui.js for now
    if (typeof drawScoreboard === "function") drawScoreboard();
  },

  // Resets the count for a new batter
  resetAtBat() {
    gameState.balls = 0;
    gameState.strikes = 0;

    // Tells the UI to wipe the pings from the strike zone
    if (typeof clearZoneUI === "function") {
      clearZoneUI();
    }
  },

  // Re-calculates the entire game state from the pitch history
  // Used primarily for the 'Undo' feature
  reprocessHistory() {
    const history = [...gameState.sessionPitches];

    // 1. Reset counters
    gameState.balls = 0;
    gameState.strikes = 0;
    gameState.totalPitches = 0;
    gameState.outs = 0; // Optional: depending on if you want Undo to fix outs

    // 2. Clear the actual active array
    gameState.sessionPitches = [];

    // 3. Re-simulate every pitch
    history.forEach((p) => {
      // Re-add to the array
      gameState.sessionPitches.push(p);
      // Let the engine re-calculate the count based on the result
      this.updateCount(p.result);
    });
  },
};

async function checkSyncQueue() {
  const queue = JSON.parse(localStorage.getItem("wildman_sync_queue") || "[]");
  if (queue.length === 0 || !navigator.onLine) return;

  console.log(`📡 Syncing ${queue.length} pending games...`);

  for (let i = 0; i < queue.length; i++) {
    try {
      const result = await WildmanAPI.saveGame(queue[i]);
      if (result && result.success) {
        queue.splice(i, 1);
        i--;
        // Update the storage immediately so if the tab closes, the saved one is gone
        localStorage.setItem("wildman_sync_queue", JSON.stringify(queue));
      }
    } catch (e) {
      console.error("Sync failed for a specific game, skipping for now...");
    }
  }

  localStorage.setItem("wildman_sync_queue", JSON.stringify(queue));
  if (queue.length === 0) console.log("✅ All games synced!");
}

// Run check every time the app starts and every 5 minutes
window.addEventListener("load", checkSyncQueue);
setInterval(checkSyncQueue, 5 * 60 * 1000);
