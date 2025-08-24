export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ voiceID: process.env.ELEVENLABS_VOICE_ID || "" });
  }
  if (req.method === "POST") {
    // Serverless note: cannot persist runtime changes; configure ELEVENLABS_VOICE_ID in Vercel env.
    return res.status(400).json({ error: "Runtime voice change is not supported on serverless. Set ELEVENLABS_VOICE_ID in project environment variables." });
  }
  return res.status(405).json({ error: "Method not allowed" });
}
