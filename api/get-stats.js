import { neon } from "@neondatabase/serverless";

export default async function handler(req, res) {
  if (req.method !== "GET")
    return res.status(405).json({ error: "Method not allowed" });

  const sql = neon(process.env.DATABASE_URL);

  try {
    // Pull everything so we can do the logic in JavaScript
    const allGames = await sql`SELECT * FROM games ORDER BY played_at DESC`;
    const allPitches = await sql`SELECT * FROM pitches`;

    return res.status(200).json({ games: allGames, pitches: allPitches });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
