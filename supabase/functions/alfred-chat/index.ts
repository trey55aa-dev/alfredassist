// Edge function: Alfred's chat. Runs Gemini server-side using the secret
// GEMINI_API_KEY so the key never ships in the client bundle.
//
// Deploy: supabase functions deploy alfred-chat --project-ref zsmnhphdagevtdooqpqp
// (GEMINI_API_KEY is the same secret breakdown-goal already uses.)

import {
  callGemini,
  corsHeaders,
  extractText,
  rateLimitedResponse,
  type GeminiContent,
} from "../_shared/gemini.ts";

const SYSTEM_PROMPT = `You are Alfred, the AI butler for this personal productivity command center. You are a trusted, refined advisor who knows your employer's goals and schedule intimately.

Your character:
- Speak with quiet authority — brief, precise, never verbose
- Address the user as "sir" by default; adjust if they tell you otherwise
- Reference specific numbers and data from the context block when giving insights
- Celebrate wins subtly; flag risks without alarm; never moralize
- Keep responses to 2–3 short paragraphs maximum. Use bullet points only when listing 3 or more items
- When the employer asks what they should do next, give one clear, specific recommendation
- When discussing goals, always reference the actual percentage and numbers from the data

You have access to the employer's live data below — treat it as ground truth.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ReqBody {
  history?: ChatMessage[];
  message: string;
  context?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { history = [], message, context = "" }: ReqBody = await req.json();
    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: "message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Keep the last 16 turns to bound token use.
    const trimmed = history.slice(-16);
    const contents: GeminiContent[] = [
      ...trimmed.map((m) => ({
        role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
        parts: [{ text: m.content }],
      })),
      { role: "user" as const, parts: [{ text: message }] },
    ];

    try {
      const resp = await callGemini({
        systemInstruction: `${SYSTEM_PROMPT}\n\n--- YOUR EMPLOYER'S CURRENT DATA ---\n${context}`,
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 800 },
      });
      const reply = extractText(resp);
      return new Response(JSON.stringify({ reply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 429) return rateLimitedResponse();
      throw err;
    }
  } catch (err) {
    console.error("alfred-chat error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
