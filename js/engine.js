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

    // Reset all counters to zero
    gameState.balls = 0;
    gameState.strikes = 0;
    gameState.totalPitches = 0;
    // Outs/Innings are usually manual, but we keep history as the source of truth

    // Temporarily clear session pitches so updateCount can re-fill it
    gameState.sessionPitches = [];

    history.forEach((p) => {
      gameState.sessionPitches.push(p);
      this.updateCount(p.result);
    });
  },
};
