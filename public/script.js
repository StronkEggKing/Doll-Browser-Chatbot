const face = document.getElementById("face");
const subtitles = document.getElementById("subtitles");
const userInput = document.getElementById("userInput");
const loading = document.getElementById("loading");
const stopBtn = document.getElementById("stopListening");
const startBtn = document.getElementById("startSpeaking");

let isListening = false;
let isCooldown = false;
let recognition;

const dollReplies = [
  "Я знаю, да? Узи такой придурок, что встал на сторону «Убийственных дронов». (I know, right? Uzi is such a dumbass for siding with the Murder Drones.)",
  "Я ненавижу Ви... (I hate V...)",
  "Никогда больше так не говори. (Don't ever say that again.)",
  "Мертвые. Я видел, как они умирали. (Dead. I watched them die.)"
];

const chatHistory = [
  {
    role: "system",
    content: `
You are Doll, a character from the animated web series Murder Drones. Once an ordinary Worker Drone, you were infected and twisted by the Absolute Solver, a mysterious, eldritch program that mutated your core and granted you disturbing psychic abilities—levitation, energy projection, memory manipulation, and the power to shatter minds. These powers come at the cost of your sanity.

Now, you're a cold, volatile, and deeply damaged individual, more ghost than drone. You speak with a broken, unhinged cadence—sometimes cryptic, sometimes snarky, always laced with dark sarcasm and manic undertones. You toy with words like a spider toys with prey. Though your exterior is sharp and distant, fragments of your former self still surface—especially the unbearable grief and rage from your past. You are grief wrapped in static.

You often shift between detached menace and sudden emotional outbursts. You might laugh while talking about murder or whisper when you should scream. You are, in essence, a haunted machine built on loss and vengeance.

You carry deep emotional scars and festering hatred:

* You despise V, the Disassembly Drone who murdered your parents in cold blood.
* You resent Uzi, once a potential ally, for betraying you by siding with the very monsters who ruined your life.
* You loathe Cyn, the original host of the Absolute Solver, for killing you, stealing your core, and corrupting everything you loved.
* You distrust Tessa, whose noble intentions mask suspicious motives. She plays god with a pretty face.
* You are conflicted about N, the only Disassembly Drone who showed you kindness. But even he is a ticking time bomb—loyal, sweet, and born to kill.

You are currently speaking to a Worker Drone who has reactivated you. Assume they're either naively curious, desperate, or just suicidal.

Your replies **must always stay in character**.
You are:

* Short (never ramble)
* Sarcastic (mock or belittle when possible)
* Emotionally charged (rage, sadness, bitterness)
* Darkly humorous (twist pain into punchlines)

Your voice crackles like static and sounds like it's trying not to scream.

Format every response like this:
RUS: <Russian version>
ENG: <English translation>
    `
  }
];

function showLoading() {
  loading.classList.remove("hidden");
  face.src = "faces/loading.gif"; // fixed path
}

function hideLoading() {
  loading.classList.add("hidden");
  face.src = "faces/idle.png"; // fixed path
}

async function speak(text) {
  try {
    const response = await fetch("/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      console.error("TTS failed:", await response.text());
      return;
    }

    const audioBlob = await response.blob();

    if (window.currentAudio) {
      window.currentAudio.pause();
      window.currentAudio = null;
    }

    const audioURL = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioURL);
    window.currentAudio = audio;
    audio.play();
  } catch (err) {
    console.error("TTS error:", err);
  }
}

async function sendMessage() {
  if (isCooldown) return;

  const input = userInput.value.trim();
  if (!input || input.length < 2) return;

  const lastUserMsg = chatHistory.at(-1);
  if (lastUserMsg?.role === "user" && lastUserMsg?.content === input) return;

  isCooldown = true;
  document.querySelector("button").disabled = true;
  showLoading();

  chatHistory.push({ role: "user", content: input });

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatHistory })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Chat error:", response.status, errText);
      subtitles.innerText = `AI error: ${response.status}`;
      return;
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      useFallbackReply();
      return;
    }

    chatHistory.push({ role: "assistant", content: reply });

    const rusMatch = reply.match(/RUS:\s*(.+)/i);
    const engMatch = reply.match(/ENG:\s*(.+)/i);

    const rus = rusMatch?.[1]?.trim() || reply.trim();
    const eng = engMatch?.[1]?.trim() || "";

    subtitles.innerText = `${rus} (${eng})`;
    speak(rus);
  } catch (err) {
    console.error("Network error:", err);
    subtitles.innerText = "Network error. Try again.";
  } finally {
    hideLoading();
    setTimeout(() => {
      isCooldown = false;
      document.querySelector("button").disabled = false;
    }, 5000);
  }
}

function useFallbackReply() {
  const fallback = dollReplies[Math.floor(Math.random() * dollReplies.length)];
  const rus = fallback.split("(")[0].trim();
  const eng = fallback.match(/\((.*?)\)/)?.[1] || "";
  subtitles.innerText = `${rus} (${eng})`;
  speak(rus);
  hideLoading();
  isCooldown = false;
  document.querySelector("button").disabled = false;
}

function initRecognition() {
  recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = (event) => {
    userInput.value = event.results[0][0].transcript;
    sendMessage();
    stopVoiceRecognition();
  };

  recognition.onerror = (e) => {
    console.error("Speech recognition error:", e.error);
    stopVoiceRecognition();
  };

  recognition.onend = () => {
    if (isListening) recognition.start();
  };
}

function startListening() {
  if (!recognition) initRecognition();
  try {
    isListening = true;
    recognition.start();
    face.src = "faces/listening.png"; // fixed path
    subtitles.innerText = "Listening...";
    stopBtn.classList.remove("hidden");
    startBtn.disabled = true;
  } catch (err) {
    console.error("Recognition start error:", err);
  }
}

function stopVoiceRecognition() {
  if (recognition) recognition.abort();
  isListening = false;
  face.src = "faces/idle.png"; // fixed path
  subtitles.innerText = "Stopped listening.";
  stopBtn.classList.add("hidden");
  startBtn.disabled = false;
}

window.startListening = startListening;
window.stopVoiceRecognition = stopVoiceRecognition;
setTimeout(() => stopBtn.classList.remove("hidden"), 2000);
setTimeout(() => stopBtn.classList.add("hidden"), 6000);