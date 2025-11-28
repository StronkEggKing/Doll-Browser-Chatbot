const express = require("express");
const fetch = require("node-fetch");
const dotenv = require("dotenv");
const path = require("path");
const open = require("open");
const fs = require("fs");

dotenv.config();
console.log("OpenRouter Key:", process.env.OPENROUTERKEY ? "✅ Loaded" : "❌ Missing");
console.log("ElevenLabs Key:", process.env.ELEVENLABS_KEY ? "✅ Loaded" : "❌ Missing");

const app = express();
app.use(express.json());

const publicPath = path.join(process.cwd(), "public");

if (!fs.existsSync(publicPath)) {
  console.error("Public folder not found! Place 'public' next to the EXE.");
  process.exit(1);
}

app.use(express.static(publicPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

const ELEVENLABS_VOICE_ID = "8k7LObsCxcazVeJmn4Lu";

app.post("/speak", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).send("No text provided");

    if (!process.env.ELEVENLABS_KEY) {
      return res.status(500).send("ElevenLabs API key missing");
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": process.env.ELEVENLABS_KEY
        },
        body: JSON.stringify({
          text,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("TTS error:", response.status, errText);
      return res.status(response.status).send(errText);
    }

    const audioBuffer = await response.arrayBuffer();
    res.set("Content-Type", "audio/mpeg");
    res.send(Buffer.from(audioBuffer));
  } catch (err) {
    console.error("TTS server error:", err);
    res.status(500).send("TTS Internal Server Error");
  }
});

app.post("/chat", async (req, res) => {
  const { messages } = req.body;

  if (!process.env.OPENROUTERKEY) {
    console.error("Missing OpenRouter API key!");
    return res.status(500).send("OpenRouter API key missing");
  }

  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENROUTERKEY}`
        },
        body: JSON.stringify({ model: "openai/gpt-4o-mini", messages })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Chat API error:", response.status, errText);
      return res.status(response.status).send(errText);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error("Chat server error:", err);
    res.status(500).send("Server error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  open(`http://localhost:${PORT}`);
});