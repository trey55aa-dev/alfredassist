// Analyze a journal transcript: suggest mood + short summary, via Gemini.
// Input: { transcript: string, moods?: string[] }
// Output: { mood: string, summary: string }

import {
  callGemini,
  corsHeaders,
  extractFunctionCall,
  rateLimitedResponse,
} from "../_shared/gemini.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { transcript, moods } = await req.json();
    if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
      return new Response(
        JSON.stringify({
          mood: "reflective",
          summary: "A quiet entry, sir. The silence speaks volumes.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const allowedMoods: string[] =
      Array.isArray(moods) && moods.length
        ? moods
        : ["radiant", "steady", "tired", "anxious", "reflective", "fired-up"];

    try {
      const resp = await callGemini({
        systemInstruction: `You are Alfred, a discreet butler reflecting on the user's day. Given a journal transcript, pick the single best mood from this list: ${allowedMoods.join(", ")}. Then write a concise, butler-toned summary (1-2 sentences, under 220 characters) capturing the essence of the entry. Call analyze_journal with your answer.`,
        contents: [{ role: "user", parts: [{ text: transcript }] }],
        forceFunction: "analyze_journal",
        tools: [
          {
            functionDeclarations: [
              {
                name: "analyze_journal",
                description: "Return the suggested mood and short summary.",
                parameters: {
                  type: "object",
                  properties: {
                    mood: { type: "string", enum: allowedMoods },
                    summary: { type: "string" },
                  },
                  required: ["mood", "summary"],
                },
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.4 },
      });

      const call = extractFunctionCall<{ mood: string; summary: string }>(resp);
      let mood = "steady";
      let summary = "";
      if (call) {
        if (allowedMoods.includes(call.args.mood)) mood = call.args.mood;
        if (typeof call.args.summary === "string")
          summary = call.args.summary.trim();
      }
      if (!summary) {
        summary =
          transcript.split(/[.!?]+/)[0]?.trim().slice(0, 200) ||
          "An entry recorded.";
      }

      return new Response(JSON.stringify({ mood, summary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 429) return rateLimitedResponse();
      throw err;
    }
  } catch (err) {
    console.error("analyze-journal error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
