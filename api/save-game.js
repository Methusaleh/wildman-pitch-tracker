import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const sql = neon(process.env.DATABASE_URL);
  const { gameData, pitches } = req.body;

  try {
    // 1. Insert the Game Header
    const gameResult = await sql`
            INSERT INTO games (pitcher_name, home_team, away_team, final_score_home, final_score_away, game_duration_seconds)
            VALUES (${gameData.pitcherName}, ${gameData.homeTeam}, ${gameData.awayTeam}, ${gameData.homeScore}, ${gameData.awayScore}, ${gameData.timerSeconds})
            RETURNING id;
        `;

    const gameId = gameResult[0].id;

    // 2. Insert all Pitches
    if (pitches && pitches.length > 0) {
      for (const p of pitches) {
        await sql`
                    INSERT INTO pitches (game_id, pitch_type, velocity, result, location_x, location_y, hit_direction)
                    VALUES (${gameId}, ${p.type}, ${p.speed}, ${p.result}, ${p.x}, ${p.y}, ${p.direction});
                `;
      }
    }

    return res.status(200).json({ success: true, gameId });
  } catch (error) {
    console.error("Database Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
