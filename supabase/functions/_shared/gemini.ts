// Tiny shared wrapper around Google Gemini's REST API for our edge functions.
// Uses the free tier (gemini-2.5-flash). Reads GEMINI_API_KEY from Deno env.

const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models";

export const DEFAULT_MODEL = "gemini-2.5-flash";

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args: Record<string, unknown> };
}

export interface GeminiContent {
  role?: "user" | "model";
  parts: GeminiPart[];
}

// Simplified JSON-Schema-ish parameter shape Gemini accepts for tool params.
export interface GeminiFunctionDeclaration {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

export interface GeminiRequest {
  model?: string;
  systemInstruction?: string;
  contents: GeminiContent[];
  tools?: { functionDeclarations: GeminiFunctionDeclaration[] }[];
  forceFunction?: string;
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
    /** For image-capable models, e.g. ["TEXT", "IMAGE"]. */
    responseModalities?: string[];
  };
}

export interface GeminiResponse {
  candidates?: {
    content?: GeminiContent;
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason?: string };
  error?: { code: number; message: string; status: string };
}

export async function callGemini(req: GeminiRequest): Promise<GeminiResponse> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) {
    throw new Error(
      "GEMINI_API_KEY is not configured — set it via `supabase secrets set`.",
    );
  }
  const model = req.model ?? DEFAULT_MODEL;
  const body: Record<string, unknown> = {
    contents: req.contents,
    ...(req.systemInstruction
      ? { systemInstruction: { parts: [{ text: req.systemInstruction }] } }
      : {}),
    ...(req.tools ? { tools: req.tools } : {}),
    ...(req.forceFunction
      ? {
          toolConfig: {
            functionCallingConfig: {
              mode: "ANY",
              allowedFunctionNames: [req.forceFunction],
            },
          },
        }
      : {}),
    ...(req.generationConfig
      ? { generationConfig: req.generationConfig }
      : {}),
  };

  const resp = await fetch(
    `${GEMINI_ENDPOINT}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!resp.ok) {
    const text = await resp.text();
    let parsed: GeminiResponse | null = null;
    try {
      parsed = JSON.parse(text) as GeminiResponse;
    } catch {
      /* not json */
    }
    const msg = parsed?.error?.message ?? text;
    const err = new Error(`Gemini ${resp.status}: ${msg}`);
    // Surface 429 so callers can format a friendly rate-limit message.
    (err as Error & { status?: number }).status = resp.status;
    throw err;
  }
  return (await resp.json()) as GeminiResponse;
}

/** Extract the first function-call payload, or null. */
export function extractFunctionCall<T = Record<string, unknown>>(
  resp: GeminiResponse,
): { name: string; args: T } | null {
  const parts = resp.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    if (p.functionCall) {
      return {
        name: p.functionCall.name,
        args: (p.functionCall.args ?? {}) as T,
      };
    }
  }
  return null;
}

/** Extract the first inline image (base64) from the response, or null. */
export function extractInlineImage(
  resp: GeminiResponse,
): { mimeType: string; data: string } | null {
  const parts = resp.candidates?.[0]?.content?.parts ?? [];
  for (const p of parts) {
    if (p.inlineData?.data) {
      return { mimeType: p.inlineData.mimeType || "image/png", data: p.inlineData.data };
    }
  }
  return null;
}

/** Extract concatenated text from the first candidate, or "". */
export function extractText(resp: GeminiResponse): string {
  const parts = resp.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map((p) => p.text ?? "")
    .filter(Boolean)
    .join("")
    .trim();
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function rateLimitedResponse(): Response {
  return new Response(
    JSON.stringify({ error: "Rate limit reached. Please wait a moment." }),
    {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
