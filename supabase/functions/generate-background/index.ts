// Edge function: turn a text "vibe" into a real background image via Gemini's
// image model, returned as a data URL the client stores as its "image" scene.
//
// Needs the GEMINI_API_KEY secret (same one the chat + breakdown functions use).
// The image model can be overridden with the GEMINI_IMAGE_MODEL secret without a
// code change, since model names for image generation evolve.

import {
  callGemini,
  corsHeaders,
  extractInlineImage,
  rateLimitedResponse,
} from "../_shared/gemini.ts";

interface ReqBody {
  prompt?: string;
}

const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image-preview";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { prompt }: ReqBody = await req.json().catch(() => ({}));
    const vibe = (prompt || "").trim().slice(0, 300);

    const imagePrompt =
      `Create a beautiful abstract background wallpaper for a dark productivity app. ` +
      `Vibe: ${vibe || "calm, elegant, modern"}. ` +
      `Requirements: no text, no words, no letters, no logos, no people, no UI. ` +
      `Rich but not busy, with darker regions so light-coloured text stays legible ` +
      `on top. Cinematic, high quality, seamless, full-bleed, landscape orientation.`;

    const model = Deno.env.get("GEMINI_IMAGE_MODEL") || DEFAULT_IMAGE_MODEL;

    try {
      const resp = await callGemini({
        model,
        contents: [{ role: "user", parts: [{ text: imagePrompt }] }],
        generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
      });

      const img = extractInlineImage(resp);
      if (!img) {
        const reason = resp.promptFeedback?.blockReason;
        return new Response(
          JSON.stringify({
            error: reason ? `The request was blocked (${reason}).` : "No image was generated.",
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({ image: `data:${img.mimeType};base64,${img.data}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 429) return rateLimitedResponse();
      throw err;
    }
  } catch (err) {
    console.error("generate-background error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
