// Edge function: takes a goal + user context, asks Lovable AI to produce
// a phased plan of concrete sub-steps. Returns structured JSON via tool calling.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

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
  context?: string; // free-form: schedule, current routine, constraints
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { goal, context }: ReqBody = await req.json();

    if (!goal?.title) {
      return new Response(
        JSON.stringify({ error: "Goal title is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
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
- Today is ${today}.`;

    const userPrompt = `GOAL:
- Title: ${goal.title}
- Category: ${goal.category ?? "—"}
- Timeframe: ${goal.timeframe ?? "—"}
- Quarter: ${goal.quarter ?? "—"}
- Deadline: ${goal.deadline ?? "—"}
- Target: ${goal.target != null ? `${goal.current ?? 0} → ${goal.target}${goal.unit ? " " + goal.unit : ""}` : "—"}

USER CONTEXT (schedule, current routine, constraints):
${context?.trim() || "(none provided — assume an average busy adult with 30–45 min/day to spare)"}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
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
                          title: {
                            type: "string",
                            description: "Concise action title.",
                          },
                          detail: {
                            type: "string",
                            description:
                              "1–2 sentence explanation: how, frequency, target metric.",
                          },
                          durationWeeks: {
                            type: "number",
                            description: "Estimated weeks to complete.",
                          },
                        },
                        required: ["title", "detail", "durationWeeks"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["summary", "steps"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "submit_plan" },
          },
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({
            error: "Rate limit exceeded. Try again in a moment.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({
            error:
              "AI credits depleted. Add credits in Settings → Workspace → Usage.",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(
        JSON.stringify({ error: "AI gateway error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "AI did not return a structured plan" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const plan = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(plan), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
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
