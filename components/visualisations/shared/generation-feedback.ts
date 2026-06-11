import { toast } from "@/lib/toast";

// The visualisation routes now report WHY a generation produced a template
// (rate limit, timeout, invalid output) and whether an AI map was salvaged
// with some content dropped. Surface that instead of silently rendering a
// template the user can mistake for an AI result.
export function notifyGenerationOutcome(data: {
  source?: string;
  fallbackReason?: string;
  partial?: boolean;
}): void {
  if (data.source === "template_fallback") {
    const description =
      data.fallbackReason === "rate_limited"
        ? "OpenAI rate limit hit — try again in a minute."
        : data.fallbackReason === "timeout" ||
            data.fallbackReason === "upstream"
          ? "The AI service was unavailable."
          : "The AI output failed validation.";
    toast.info("Showing a template version", {
      description: `${description} Generate again to retry.`,
    });
  } else if (data.partial) {
    toast.info("Some AI content was dropped", {
      description:
        "Parts of the AI map failed validation and were removed — review the result.",
    });
  }
}
