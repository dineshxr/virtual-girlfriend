import axios from "axios";

const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY || "";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  try {
    const resp = await axios.get("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": ELEVEN_KEY },
      timeout: 20000,
    });
    res.status(200).json(resp.data);
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
}
