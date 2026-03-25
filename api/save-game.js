import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  // 1. Log the Method for debugging
  console.log("Request Method:", req.method);

  if (req.method !== "POST") {
    return res.status(200).json({
      message: "Wildman API is online. Send a POST request to save data.",
    });
  }

  // 2. Safety check for the body
  if (!req.body || !req.body.gameData) {
    console.error("Missing body or gameData");
    return res.status(400).json({ error: "No game data received." });
  }

  const sql = neon(process.env.DATABASE_URL);
  const { gameData, pitches } = req.body;

  try {
    console.log(
      "Attempting database insert for pitcher:",
      gameData.pitcherName,
    );

    // 3. The Database Transaction
    const gameResult = await sql`
            INSERT INTO games (pitcher_name, home_team, away_team, final_score_home, final_score_away, game_duration_seconds)
            VALUES (${gameData.pitcherName || "Unknown"}, ${gameData.homeTeam || ""}, ${gameData.awayTeam || ""}, ${gameData.homeScore || 0}, ${gameData.awayScore || 0}, ${gameData.timerSeconds || 0})
            RETURNING id;
        `;

    const gameId = gameResult[0].id;

    if (pitches && pitches.length > 0) {
      console.log(`Saving ${pitches.length} pitches...`);
      for (const p of pitches) {
        await sql`
                    INSERT INTO pitches (game_id, pitch_type, velocity, result, location_x, location_y, hit_direction)
                    VALUES (${gameId}, ${p.type}, ${p.speed}, ${p.result}, ${p.x}, ${p.y}, ${p.direction});
                `;
      }
    }

    return res.status(200).json({ success: true, gameId: gameId });
  } catch (error) {
    console.error("DB_CRASH:", error.message);
    return res.status(500).json({ error: error.message });
  }
}
