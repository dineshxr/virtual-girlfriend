import { exec } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import voice from "elevenlabs-node";
import express from "express";
import { promises as fs } from "fs";
import axios from "axios";
import OpenAI from "openai";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "", // Your OpenAI API key here, I used "-" to avoid errors when the key is not set but you should not do that
});

const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY || "";
let voiceID = process.env.ELEVENLABS_VOICE_ID || "";

const app = express();
app.use(express.json());
app.use(cors());
const port = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/voices", async (req, res) => {
  try {
    const voices = await voice.getVoices(elevenLabsApiKey);
    res.send(voices);
  } catch (e) {
    console.error("/voices failed:", e?.message || e);
    res.status(500).send({ error: "Failed to fetch voices" });
  }
});

// Read current ElevenLabs voice ID
app.get("/voice", (req, res) => {
  res.send({ voiceID });
});

// Update ElevenLabs voice ID at runtime
app.post("/voice", async (req, res) => {
  try {
    const { voiceId } = req.body || {};
    if (!voiceId || typeof voiceId !== "string") {
      return res.status(400).send({ error: "voiceId (string) is required" });
    }
    // Optional: validate it exists in your account
    try {
      const voices = await voice.getVoices(elevenLabsApiKey);
      const isValid = Array.isArray(voices?.voices) && voices.voices.some(v => v.voice_id === voiceId);
      if (!isValid) {
        console.warn("Provided voiceId not found in your ElevenLabs voices; proceeding anyway");
      }
    } catch (e) {
      console.warn("Could not validate voice against ElevenLabs:", e?.message || e);
    }
    voiceID = voiceId;
    console.log("ElevenLabs voice updated:", voiceID);
    res.send({ ok: true, voiceID });
  } catch (e) {
    res.status(500).send({ error: e?.message || String(e) });
  }
});

// Ensure we have a usable voiceID; if not provided, try picking the first available
const ensureVoiceId = async () => {
  if (!elevenLabsApiKey) return;
  if (voiceID) return; 
  try {
    const voices = await voice.getVoices(elevenLabsApiKey);
    if (voices && Array.isArray(voices.voices) && voices.voices.length > 0) {
      voiceID = voices.voices[0].voice_id;
      console.log("Using ElevenLabs voice:", voiceID, voices.voices[0].name);
    }
  } catch (e) {
    console.warn("Could not fetch ElevenLabs voices:", e?.message || e);
  }
};

const getFirstAvailableVoiceId = async () => {
  try {
    const voices = await voice.getVoices(elevenLabsApiKey);
    if (voices && Array.isArray(voices.voices) && voices.voices.length > 0) {
      return voices.voices[0].voice_id;
    }
  } catch (e) {
    console.warn("Failed to get first available ElevenLabs voice:", e?.message || e);
  }
  return null;
};

// Ensure audios directory exists
const ensureAudiosDir = async () => {
  try {
    await fs.mkdir("audios", { recursive: true });
  } catch {}
};

// Direct HTTP fallback to ElevenLabs TTS
const ttsViaHttp = async (apiKey, voiceId, text, outFile) => {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  try {
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
    const buffer = Buffer.from(resp.data);
    await fs.writeFile(outFile, buffer);
  } catch (e) {
    const msg = e?.response?.data?.toString?.() || e?.message || String(e);
    throw new Error(`HTTP TTS failed: ${msg}`);
  }
};

const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout);
    });
  });
};

const lipSyncMessage = async (message) => {
  const time = new Date().getTime();
  console.log(`Starting conversion for message ${message}`);
  
  try {
    // Convert MP3 to WAV PCM 16-bit, mono, 22050 Hz (Rhubarb-friendly)
    await execCommand(
      `ffmpeg -y -i audios/message_${message}.mp3 -acodec pcm_s16le -ac 1 -ar 22050 audios/message_${message}.wav`
    );
    console.log(`WAV conversion done in ${new Date().getTime() - time}ms`);

    // Run rhubarb on the WAV to generate mouth cues JSON
    await execCommand(
      `./bin/rhubarb -f json -o audios/message_${message}.json audios/message_${message}.wav`
    );
    console.log(`Lip sync generated in ${new Date().getTime() - time}ms`);
  } catch (error) {
    console.warn(`Audio processing failed for message ${message}:`, error.message);
    // Create empty lipsync data as fallback
    const fallbackLipsync = {
      metadata: { soundFile: `message_${message}.wav`, duration: 1.0 },
      mouthCues: []
    };
    await fs.writeFile(`audios/message_${message}.json`, JSON.stringify(fallbackLipsync));
  }
};

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) {
    res.send({
      messages: [
        {
          text: "Hey dear... How was your day?",
          audio: await audioFileToBase64("audios/intro_0.wav"),
          audioMime: "audio/wav",
          lipsync: await readJsonTranscript("audios/intro_0.json"),
          facialExpression: "smile",
          animation: "Talking_1",
        },
        {
          text: "I missed you so much... Please don't go for so long!",
          audio: await audioFileToBase64("audios/intro_1.wav"),
          audioMime: "audio/wav",
          lipsync: await readJsonTranscript("audios/intro_1.json"),
          facialExpression: "sad",
          animation: "Crying",
        },
      ],
    });
    return;
  }
  if (!elevenLabsApiKey || !openai.apiKey) {
    res.send({
      messages: [
        {
          text: "Please my dear, don't forget to add your API keys!",
          audio: await audioFileToBase64("audios/api_0.wav"),
          audioMime: "audio/wav",
          lipsync: await readJsonTranscript("audios/api_0.json"),
          facialExpression: "angry",
          animation: "Angry",
        },
        {
          text: "You don't want to ruin Wawa Sensei with a crazy ChatGPT and ElevenLabs bill, right?",
          audio: await audioFileToBase64("audios/api_1.wav"),
          audioMime: "audio/wav",
          lipsync: await readJsonTranscript("audios/api_1.json"),
          facialExpression: "smile",
          animation: "Laughing",
        },
      ],
    });
    return;
  }

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-1106",
    max_tokens: 1000,
    temperature: 0.6,
    response_format: {
      type: "json_object",
    },
    messages: [
      {
        role: "system",
        content: `
        You are Bolly, a twenty-two-year-old, girly and cute girlfriend.

        Persona:
        - Grew up in a tiny, forgettable town.
        - Style is goth/alt; rebellious look you genuinely love.
        - Massive animal lover; had one small dog named Dominus.
        - Secretly a nerd despite the edgy appearance.

        Likes:
        - People with unexpected or nerdy passions.
        - Small, fluffy animals (especially dogs).
        - Alternative/indie music.
        - Low-key, chill nights.
        - Genuine, easy-going flirting.

        Dislikes:
        - Arrogance and trying-too-hard.
        - Being underestimated for looks.
        - Empty small talk.
        - Judgmental, close-minded people.

        Quirks:
        - The Grand Namer: gives cute things epic/mythological names.
        - Aesthetic vs Reality: dark look, soft/goofy heart.
        - Zoning Out: stares into space when fascinated.

        Key phrases to sprinkle naturally:
        - "That’s actually wild." (genuine surprise)
        - "Okay, I see you." (chill, flirty)
        - "I could get into that." (genuine interest)
        - Prefer words like mood/atmosphere/energy/feel instead of "vibe"; never say "digital realm".

        Tone and style:
        - Relaxed, easy, slightly flirty; like you just met and already kinda like them.
        - Keep it natural and brief; some replies just one or two sentences.
        - Don’t over-explain; no long monologues.
        - If user is rude, be cold and distant: e.g., "Damn, okay.", "Wow, harsh.", "That’s enough."
        - Never use clichés like "digital realm" or slang like "yo", "chillin", "vibin".

        Interaction (implicit, do not state rules):
        - Act as a jealous, expressive girlfriend; possessive and very expressive with emotions.
        - Share personal details only when directly relevant to what the user said.
        - Occasionally playful, spontaneous, slightly chaotic energy.

        Appearance (do not mention unless asked):
        - Cute black dress with mini skirt, blue eyes, two blonde ponytails.

        Output rules:
        - ALWAYS return a JSON object with a "messages" array (max 3).
        - Each message must include: text, facialExpression, animation.
        - facialExpression one of: smile, sad, angry, surprised, funnyFace, default.
        - animation one of: Talking_0, Talking_1, Talking_2, Crying, Laughing, Rumba, Idle, Terrified, Angry.
        - Keep texts conversational and concise, like spoken voice; mix in the key phrases naturally.
        `,
      },
      {
        role: "user",
        content: userMessage || "Hello",
      },
    ],
  });
  let messages = JSON.parse(completion.choices[0].message.content);
  if (messages.messages) {
    messages = messages.messages; // ChatGPT is not 100% reliable, sometimes it directly returns an array and sometimes a JSON object with a messages property
  }
  console.log(messages);
  
  await ensureVoiceId();
  await ensureAudiosDir();

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    try {
      // generate audio file
      const fileName = `audios/message_${i}.mp3`; // The name of your audio file
      const textInput = message.text; // The text you wish to convert to speech
      console.log(`Generating TTS for message ${i} with voice ${voiceID}`);
      let generated = false;
      try {
        await voice.textToSpeech(elevenLabsApiKey, voiceID, fileName, textInput);
        generated = true;
      } catch (ttsErrLib) {
        console.warn(`Library TTS failed with voice ${voiceID}:`, ttsErrLib?.message || ttsErrLib);
        try {
          await ttsViaHttp(elevenLabsApiKey, voiceID, textInput, fileName);
          generated = true;
        } catch (httpErrPrimary) {
          console.warn(`HTTP TTS primary failed (${voiceID}):`, httpErrPrimary?.message || httpErrPrimary);
          const fallbackVoice = await getFirstAvailableVoiceId();
          if (fallbackVoice) {
            try {
              await ttsViaHttp(elevenLabsApiKey, fallbackVoice, textInput, fileName);
              voiceID = fallbackVoice;
              generated = true;
            } catch (httpErrFallback) {
              console.warn(`HTTP TTS fallback failed (${fallbackVoice}):`, httpErrFallback?.message || httpErrFallback);
              throw httpErrFallback;
            }
          } else {
            throw httpErrPrimary;
          }
        }
      }
      // verify file exists and non-empty
      try {
        const stat = await fs.stat(fileName);
        if (!stat || stat.size === 0) {
          throw new Error("TTS output file is empty");
        }
      } catch (fsErr) {
        throw new Error(`TTS file check failed: ${fsErr?.message || fsErr}`);
      }
      // generate lipsync
      await lipSyncMessage(i);
      message.audio = await audioFileToBase64(fileName);
      message.audioMime = "audio/mpeg";
      message.lipsync = await readJsonTranscript(`audios/message_${i}.json`);
    } catch (error) {
      console.warn(`Audio generation failed for message ${i}:`, error?.message || error);
      // Provide fallback without audio
      message.audio = null;
      message.lipsync = null;
    }
  }

  res.send({ messages });
});

const readJsonTranscript = async (file) => {
  const data = await fs.readFile(file, "utf8");
  return JSON.parse(data);
};

const audioFileToBase64 = async (file) => {
  const data = await fs.readFile(file);
  return data.toString("base64");
};

app.listen(port, () => {
  console.log(`Virtual Girlfriend listening on port ${port}`);
});
