// Transcribe audio chunks using Gemini multimodal directly.
// Accepts JSON: { audio: base64, mimeType: string }
// Returns: { text: string }

import {
  callGemini,
  corsHeaders,
  extractText,
  rateLimitedResponse,
} from "../_shared/gemini.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { audio, mimeType } = await req.json();
    if (!audio || typeof audio !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing 'audio' base64 string" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    const mt = mimeType || "audio/webm";

    try {
      const resp = await callGemini({
        systemInstruction:
          "You are a precise transcription engine. Transcribe the provided audio verbatim into clear, well-punctuated text. If the audio is silent or unintelligible, respond with an empty string. Do not add commentary, headers, or quotation marks — only the transcript.",
        contents: [
          {
            role: "user",
            parts: [
              { text: "Transcribe this audio." },
              { inlineData: { mimeType: mt, data: audio } },
            ],
          },
        ],
        generationConfig: { temperature: 0 },
      });
      const transcript = extractText(resp);
      return new Response(JSON.stringify({ text: transcript }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 429) return rateLimitedResponse();
      throw err;
    }
  } catch (err) {
    console.error("transcribe-audio error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
