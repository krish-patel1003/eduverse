// Server-side text-to-speech via Gemini TTS.
// Returns a playable WAV data URL + the exact audio duration, which lets the
// player lock the hand-drawn animation to real narration timing (frame-accurate
// sync). Any failure returns null so the player falls back to Web Speech.

const apiKey = process.env.GEMINI_API_KEY;
const TTS_MODEL = process.env.GEMINI_TTS_MODEL ?? "gemini-2.5-flash-preview-tts";
const VOICE = process.env.GEMINI_TTS_VOICE ?? "Kore";
const TTS_ENABLED = process.env.ENABLE_TTS !== "false";

export interface SceneAudio {
  dataUrl: string;
  durationMs: number;
}

function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const channels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function parseRate(mime: string | undefined): number {
  const m = mime?.match(/rate=(\d+)/);
  return m ? parseInt(m[1], 10) : 24000;
}

let ttsDisabledThisProcess = false;

async function synthesizeOne(text: string): Promise<SceneAudio | null> {
  if (!apiKey || !TTS_ENABLED || ttsDisabledThisProcess) return null;
  const clean = text.trim();
  if (!clean) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: clean }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } },
          },
        },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      // If the model/modality isn't available to this key, stop trying for the run.
      if (res.status === 404 || res.status === 400) ttsDisabledThisProcess = true;
      console.error(`TTS ${res.status}: ${detail.slice(0, 200)}`);
      return null;
    }
    const data = await res.json();
    const part = data?.candidates?.[0]?.content?.parts?.find(
      (p: { inlineData?: { data?: string; mimeType?: string } }) => p.inlineData?.data
    );
    const b64: string | undefined = part?.inlineData?.data;
    if (!b64) return null;
    const rate = parseRate(part.inlineData.mimeType);
    const pcm = Buffer.from(b64, "base64");
    const wav = pcmToWav(pcm, rate);
    const durationMs = Math.round((pcm.length / (rate * 2)) * 1000);
    return { dataUrl: `data:audio/wav;base64,${wav.toString("base64")}`, durationMs };
  } catch (err) {
    console.error("TTS failed:", err);
    return null;
  }
}

/** Synthesize narration for every scene in parallel. Returns aligned array. */
export async function synthesizeScenes(narrations: string[]): Promise<(SceneAudio | null)[]> {
  if (!apiKey || !TTS_ENABLED) return narrations.map(() => null);
  const results = await Promise.allSettled(narrations.map((n) => synthesizeOne(n)));
  return results.map((r) => (r.status === "fulfilled" ? r.value : null));
}
