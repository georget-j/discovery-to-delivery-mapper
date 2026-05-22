import { NextRequest, NextResponse } from "next/server";

// Fallback transcription endpoint for browsers without SpeechRecognition
// (Firefox primarily). Receives a raw audio blob via multipart/form-data
// and proxies to OpenAI Whisper. Native SpeechRecognition stays the
// primary path because it's free + streaming.

const MAX_BYTES = 25 * 1024 * 1024; // OpenAI's per-file ceiling

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" });
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
    upstream.append("model", "whisper-1");
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
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Whisper error ${response.status}: ${detail.slice(0, 200)}`,
      );
    }

    const text = (await response.text()).trim();
    return NextResponse.json({ text });
  } catch (err) {
    console.error("Transcription failed:", err);
    return NextResponse.json({
      error: "transcription_failed",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
