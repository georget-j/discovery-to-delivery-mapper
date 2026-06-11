import { NextRequest, NextResponse } from "next/server";
import { MODELS } from "@/lib/llm/models";
import { guardApiRequest } from "@/lib/api-guards";

// Fallback transcription endpoint for browsers without SpeechRecognition
// (Firefox primarily). Receives a raw audio blob via multipart/form-data
// and proxies to OpenAI Whisper. Native SpeechRecognition stays the
// primary path because it's free + streaming.

const MAX_BYTES = 4 * 1024 * 1024; // Vercel rejects bodies >4.5MB at the edge anyway

export async function POST(req: NextRequest) {
  const blocked = guardApiRequest(req, { json: false, limit: 10 });
  if (blocked) return blocked;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" }, { status: 503 });
  }

  // Reject oversized uploads from the declared length before buffering the
  // whole body into memory; the file.size check below is the backstop.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) {
    return NextResponse.json({ error: "audio_too_large" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form" }, { status: 400 });
  }
  const file = form.get("audio");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "missing_audio" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "empty_audio" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "audio_too_large" }, { status: 413 });
  }

  try {
    const upstream = new FormData();
    upstream.append("file", file, file.name || "recording.webm");
    upstream.append("model", MODELS.transcribe);
    upstream.append("response_format", "text");

    const response = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: upstream,
      },
    );

    if (!response.ok) {
      // Log the upstream body server-side only — it must not reach the client.
      const detail = await response.text().catch(() => "");
      console.error(`Whisper error ${response.status}:`, detail.slice(0, 500));
      throw new Error(`Whisper error ${response.status}`);
    }

    const text = (await response.text()).trim();
    return NextResponse.json({ text });
  } catch (err) {
    console.error("Transcription failed:", err);
    return NextResponse.json(
      { error: "transcription_failed", message: "transcription failed" },
      { status: 502 },
    );
  }
}
