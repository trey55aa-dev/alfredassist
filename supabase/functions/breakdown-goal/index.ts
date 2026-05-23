// Edge function: takes a goal + user context, asks Gemini to produce a phased
// plan of concrete sub-steps. Returns structured JSON via Gemini function calling.

import {
  callGemini,
  corsHeaders,
  extractFunctionCall,
  rateLimitedResponse,
} from "../_shared/gemini.ts";

interface ReqBody {
  goal: {
    title: string;
    category?: string;
    timeframe?: string;
    quarter?: string | null;
    deadline?: string;
    target?: number;
    current?: number;
    unit?: string;
  };
  context?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const { goal, context }: ReqBody = await req.json();
    if (!goal?.title) {
      return new Response(JSON.stringify({ error: "Goal title is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    const systemPrompt = `You are Alfred — a meticulous, encouraging life-coach butler.
The user has set an ambitious goal. Decompose it into a phased plan of concrete, time-bound sub-steps that fit their actual schedule and current habits.

Rules:
- Produce 4–8 sub-steps total, ordered chronologically.
- Each step must be measurable and achievable in ~1–4 weeks.
- Use progressive overload — start where the user is, build gradually toward the target.
- If the user mentions constraints (time, equipment, injuries), respect them.
- Tone: brief, confident, butler-like. No filler.
- Today is ${today}.
- Call the submit_plan function with the final plan.`;

    const userPrompt = `GOAL:
- Title: ${goal.title}
- Category: ${goal.category ?? "—"}
- Timeframe: ${goal.timeframe ?? "—"}
- Quarter: ${goal.quarter ?? "—"}
- Deadline: ${goal.deadline ?? "—"}
- Target: ${
      goal.target != null
        ? `${goal.current ?? 0} → ${goal.target}${goal.unit ? " " + goal.unit : ""}`
        : "—"
    }

USER CONTEXT (schedule, current routine, constraints):
${context?.trim() || "(none provided — assume an average busy adult with 30–45 min/day to spare)"}`;

    try {
      const resp = await callGemini({
        systemInstruction: systemPrompt,
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        forceFunction: "submit_plan",
        tools: [
          {
            functionDeclarations: [
              {
                name: "submit_plan",
                description: "Submit the phased breakdown plan.",
                parameters: {
                  type: "object",
                  properties: {
                    summary: {
                      type: "string",
                      description:
                        "One-sentence butler-style overview of the strategy.",
                    },
                    steps: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          title: { type: "string" },
                          detail: { type: "string" },
                          durationWeeks: { type: "number" },
                        },
                        required: ["title", "detail", "durationWeeks"],
                      },
                    },
                  },
                  required: ["summary", "steps"],
                },
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.7 },
      });

      const call = extractFunctionCall<{
        summary: string;
        steps: { title: string; detail: string; durationWeeks: number }[];
      }>(resp);

      if (!call) {
        console.error("No function call in response", JSON.stringify(resp));
        return new Response(
          JSON.stringify({ error: "AI did not return a structured plan" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      return new Response(JSON.stringify(call.args), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 429) return rateLimitedResponse();
      throw err;
    }
  } catch (err) {
    console.error("breakdown-goal error:", err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
