import { NextRequest, NextResponse } from "next/server";

// Multi-modal helper: takes 1..N PNG/JPEG data URLs (one per slide/page/diagram)
// and returns a per-image text description. The caller (intake queue's "Describe
// images" action) chunks the descriptions like any other doc so they slot
// into the standard retrieval pipeline.
//
// Why not a real CLIP-style image embedding? OpenAI doesn't ship one in the
// embeddings API, and shipping a CLIP wasm bundle would add ~50 MB to the
// client. A vision-described-then-text-embedded path captures most of the
// signal at zero extra dependency cost.

const VISION_MAX_BODY_BYTES = 20 * 1024 * 1024; // 20 MB — images are heavy

const SYSTEM_PROMPT = `You describe a single page or diagram image for a forward-deployed onboarding workspace.
Output: one paragraph (≤ 100 words). Focus on:
- What this page/diagram shows
- Any system names, tools, team names, processes, numbers, or labels visible
- The role this page plays in a larger document (intro, architecture, process flow, table of metrics, etc.)
Plain prose, no markdown.`;

type VisionRequest = {
  images?: { id: string; dataUrl: string; label?: string }[];
};

export async function POST(req: NextRequest) {
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > VISION_MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (raw.length > VISION_MAX_BODY_BYTES) {
    return NextResponse.json({ error: "too_large" }, { status: 413 });
  }
  let parsed: VisionRequest;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const images = parsed.images ?? [];
  if (images.length === 0) {
    return NextResponse.json({ error: "no_images" }, { status: 400 });
  }
  if (images.length > 12) {
    return NextResponse.json({ error: "too_many" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "no_api_key" });
  }

  const descriptions: { id: string; text: string }[] = [];
  for (const img of images) {
    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: img.label
                      ? `Image label: ${img.label}. Describe.`
                      : "Describe.",
                  },
                  {
                    type: "image_url",
                    image_url: { url: img.dataUrl, detail: "low" },
                  },
                ],
              },
            ],
            temperature: 0.2,
            max_tokens: 300,
          }),
        },
      );
      if (!response.ok) {
        descriptions.push({
          id: img.id,
          text: `(Vision call failed: status ${response.status})`,
        });
        continue;
      }
      const data = await response.json();
      const text =
        (data.choices?.[0]?.message?.content ?? "").trim() ||
        "(Empty description)";
      descriptions.push({ id: img.id, text });
    } catch (err) {
      descriptions.push({
        id: img.id,
        text: `(Vision call errored: ${err instanceof Error ? err.message : String(err)})`,
      });
    }
  }

  return NextResponse.json({ descriptions });
}
