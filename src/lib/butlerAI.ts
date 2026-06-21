// Alfred AI butler — wraps Gemini 1.5 Flash with streaming.
//
// API key: add VITE_GEMINI_API_KEY to your .env file.
// Get a free key at https://aistudio.google.com
// Restrict the key to your Lovable domain in AI Studio settings so it can
// safely live in the client bundle.

import { GoogleGenerativeAI } from "@google/generative-ai";

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

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const BUTLER_CHAT_KEY = "alfred.butler.history";

function apiKey(): string | undefined {
  return import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
}

export function butlerReady(): boolean {
  return Boolean(apiKey());
}

export async function* streamButlerReply(
  history: ChatMessage[],
  userMessage: string,
  context: string,
): AsyncGenerator<string> {
  const key = apiKey();
  if (!key) {
    yield "I'm afraid my connection isn't configured yet, sir. Please add `VITE_GEMINI_API_KEY` to your `.env` file — a free Google AI Studio key will do nicely. Once that's in place, I'll be fully at your service.";
    return;
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: `${SYSTEM_PROMPT}\n\n--- YOUR EMPLOYER'S CURRENT DATA ---\n${context}`,
  });

  const geminiHistory = history.map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  try {
    const chat = model.startChat({ history: geminiHistory });
    const result = await chat.sendMessageStream(userMessage);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    yield `I encountered a difficulty, sir: ${msg}. Please verify your API key is valid and try again.`;
  }
}

export const QUICK_PROMPTS = [
  { label: "How am I doing?", icon: "📊" },
  { label: "What should I focus on today?", icon: "🎯" },
  { label: "Review my goal progress", icon: "🏆" },
  { label: "Give me a productivity tip", icon: "💡" },
] as const;
