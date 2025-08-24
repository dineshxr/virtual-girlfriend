import axios from "axios";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });
const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY || "";
const ELEVEN_VOICE = process.env.ELEVENLABS_VOICE_ID || "";

const ttsViaHttp = async (apiKey, voiceId, text) => {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const resp = await axios.post(
    url,
    { text },
    {
      headers: {
        "xi-api-key": apiKey,
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
      },
      responseType: "arraybuffer",
      timeout: 30000,
    }
  );
  return Buffer.from(resp.data);
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const userMessage = req.body?.message;

  if (!userMessage) {
    return res.status(200).json({
      messages: [
        {
          text: "Hey... what are you thinking about?",
          audio: null,
          audioMime: "audio/mpeg",
          lipsync: { metadata: { duration: 1 }, mouthCues: [] },
          facialExpression: "smile",
          animation: "Talking_1",
        },
      ],
    });
  }

  if (!ELEVEN_KEY || !openai.apiKey || !ELEVEN_VOICE) {
    return res.status(200).json({
      messages: [
        {
          text: "I need my keys set before I can speak.",
          audio: null,
          audioMime: "audio/mpeg",
          lipsync: { metadata: { duration: 1 }, mouthCues: [] },
          facialExpression: "sad",
          animation: "Talking_0",
        },
      ],
    });
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-1106",
    max_tokens: 700,
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `
        You are Bolly, a twenty-two-year-old, girly and cute girlfriend.
        Persona and style as previously defined.
        Output rules:
        - ALWAYS return a JSON object with a "messages" array (max 3).
        - Each message must include: text, facialExpression, animation.
        - facialExpression one of: smile, sad, angry, surprised, funnyFace, default.
        - animation one of: Talking_0, Talking_1, Talking_2, Crying, Laughing, Rumba, Idle, Terrified, Angry.
        - Keep texts conversational and concise.
        `,
      },
      { role: "user", content: userMessage || "Hello" },
    ],
  });

  let messages = JSON.parse(completion.choices[0].message.content);
  if (messages.messages) messages = messages.messages;

  const out = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    try {
      const buf = await ttsViaHttp(ELEVEN_KEY, ELEVEN_VOICE, msg.text);
      const b64 = buf.toString("base64");
      out.push({
        text: msg.text,
        facialExpression: msg.facialExpression || "smile",
        animation: msg.animation || "Talking_1",
        audio: b64,
        audioMime: "audio/mpeg",
        lipsync: { metadata: { duration: 1 }, mouthCues: [] },
      });
    } catch (e) {
      out.push({
        text: msg.text,
        facialExpression: msg.facialExpression || "smile",
        animation: msg.animation || "Talking_1",
        audio: null,
        audioMime: "audio/mpeg",
        lipsync: { metadata: { duration: 1 }, mouthCues: [] },
      });
    }
  }

  return res.status(200).json({ messages: out });
}
