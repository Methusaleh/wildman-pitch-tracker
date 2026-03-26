const WildmanAPI = {
  async saveGame(payload) {
    try {
      const response = await fetch("/api/save-game.js", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.indexOf("application/json") !== -1) {
        return await response.json();
      } else {
        const textError = await response.text();
        return {
          success: false,
          error: "Server sent text: " + textError.substring(0, 50),
        };
      }
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  async fetchStats() {
    const response = await fetch("/api/get-stats.js");
    if (!response.ok) throw new Error("Cloud sync failed");
    return await response.json();
  },
};
