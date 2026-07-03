// Alfred AI butler client. The AI now runs SERVER-SIDE in the `alfred-chat`
// edge function using a secret GEMINI_API_KEY — the key never ships in the
// browser bundle. This module just calls the function and re-streams the reply
// for the typewriter effect.

import { supabase } from "@/integrations/supabase/client";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export const BUTLER_CHAT_KEY = "alfred.butler.history";

/** The AI is server-side now; there's no client key to check. */
export function butlerReady(): boolean {
  return true;
}

export async function* streamButlerReply(
  history: ChatMessage[],
  userMessage: string,
  context: string,
): AsyncGenerator<string> {
  let reply = "";
  try {
    const { data, error } = await supabase.functions.invoke("alfred-chat", {
      body: { history, message: userMessage, context },
    });
    if (error) {
      const status = (error as { context?: { status?: number } })?.context?.status;
      if (status === 429) {
        yield "A touch too many requests at once, sir — give me a breath and try again.";
        return;
      }
      throw error;
    }
    reply = ((data as { reply?: string } | null)?.reply ?? "").trim();
    if (!reply) {
      yield "I'm afraid I've drawn a blank, sir. Do try again in a moment.";
      return;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    yield `I encountered a difficulty, sir: ${msg}. If this persists, the AI service may need setup — check that the alfred-chat function is deployed and GEMINI_API_KEY is set.`;
    return;
  }

  // Re-stream the full reply in small chunks so the typing animation still plays.
  const tokens = reply.split(/(\s+)/);
  for (let i = 0; i < tokens.length; i += 3) {
    yield tokens.slice(i, i + 3).join("");
    await new Promise((r) => setTimeout(r, 16));
  }
}

export const QUICK_PROMPTS = [
  { label: "How am I doing?", icon: "📊" },
  { label: "What should I focus on today?", icon: "🎯" },
  { label: "Review my goal progress", icon: "🏆" },
  { label: "Give me a productivity tip", icon: "💡" },
] as const;
