// Analyze a journal transcript: suggest mood + short summary.
// Input: { transcript: string, moods: string[] }
// Output: { mood: string, summary: string }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { transcript, moods } = await req.json();
    if (!transcript || typeof transcript !== "string" || !transcript.trim()) {
      return new Response(
        JSON.stringify({ mood: "reflective", summary: "A quiet entry, sir. The silence speaks volumes." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const allowedMoods: string[] = Array.isArray(moods) && moods.length
      ? moods
      : ["radiant", "steady", "tired", "anxious", "reflective", "fired-up"];

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                `You are Alfred, a discreet butler who reflects on the user's day. Given a journal transcript, pick the single best mood from this list: ${allowedMoods.join(", ")}. Then write a concise, butler-toned summary (1-2 sentences, under 220 characters) capturing the essence of the entry. Use the analyze_journal tool to return your answer.`,
            },
            { role: "user", content: transcript },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "analyze_journal",
                description: "Return the suggested mood and short summary.",
                parameters: {
                  type: "object",
                  properties: {
                    mood: { type: "string", enum: allowedMoods },
                    summary: { type: "string" },
                  },
                  required: ["mood", "summary"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "analyze_journal" } },
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit reached. Please wait a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Add credits in Settings → Workspace → Usage." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw new Error(`AI gateway error ${response.status}: ${text}`);
    }

    const data = await response.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    let mood = "steady";
    let summary = "";
    if (call?.function?.arguments) {
      try {
        const args = JSON.parse(call.function.arguments);
        if (args.mood && allowedMoods.includes(args.mood)) mood = args.mood;
        if (typeof args.summary === "string") summary = args.summary.trim();
      } catch (e) {
        console.error("Failed to parse tool args", e);
      }
    }
    if (!summary) {
      summary = transcript.split(/[.!?]+/)[0]?.trim().slice(0, 200) || "An entry recorded.";
    }

    return new Response(JSON.stringify({ mood, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-journal error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
