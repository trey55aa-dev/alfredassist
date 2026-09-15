import { useEffect, useRef, useState } from "react";
import { Send, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { ButlerAvatar } from "@/components/ButlerAvatar";
import {
  QUICK_PROMPTS,
  BUTLER_CHAT_KEY,
  streamButlerReply,
  type ChatMessage,
} from "@/lib/butlerAI";
import { buildContext } from "@/lib/butlerContext";

/**
 * Alfred as a place you go, rather than a drawer you summon.
 *
 * Shares the history, the context builder and the streaming call with the
 * floating panel — same conversation either way, so a thread started from the
 * drawer continues here and vice versa. Only the framing differs: room to
 * think through how you want to work, instead of a corner to ask one question.
 */

const SUGGESTIONS = [
  "Build me a schedule for tomorrow",
  "What should I focus on today?",
  "I keep putting one thing off — talk me through it",
  "How am I doing this week?",
];

function readHistory(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(BUTLER_CHAT_KEY);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>(readHistory);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const save = (next: ChatMessage[]) => {
    setMessages(next);
    try {
      localStorage.setItem(BUTLER_CHAT_KEY, JSON.stringify(next.slice(-40)));
    } catch {
      /* quota */
    }
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const next: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setInput("");
    setBusy(true);
    setMessages([...next, { role: "assistant", content: "" }]);

    let accumulated = "";
    try {
      const context = buildContext();
      for await (const chunk of streamButlerReply(next, trimmed, context)) {
        accumulated += chunk;
        setMessages([...next, { role: "assistant", content: accumulated }]);
      }
    } catch (err) {
      accumulated =
        accumulated ||
        `I couldn't reach my faculties, sir. ${err instanceof Error ? err.message : String(err)}`;
    } finally {
      save([...next, { role: "assistant", content: accumulated }]);
      setBusy(false);
    }
  };

  const clear = () => {
    save([]);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="At your service"
        title="Ask Alfred"
        description="Talk through your schedule, your goals, or how you want to work. He knows what's on your plate."
        actions={
          messages.length > 0 ? (
            <button
              type="button"
              onClick={clear}
              className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Start over
            </button>
          ) : undefined
        }
      />

      {messages.length === 0 ? (
        <div className="rounded-2xl border border-border/60 bg-gradient-card p-6 sm:p-8 text-center">
          <div className="flex justify-center mb-4">
            <ButlerAvatar size={72} />
          </div>
          <p className="font-display text-xl mb-1">How may I assist?</p>
          <p className="text-sm text-muted-foreground/70 mb-6">
            Pick one, or just start typing.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 max-w-xl mx-auto">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-xl border border-border bg-background/40 px-3.5 py-3 text-left text-sm hover:border-gold/40 hover:bg-white/5 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-gold/15 border border-gold/25 text-foreground"
                    : "bg-white/5 border border-border/60 text-foreground/90"
                }`}
              >
                {m.content || (
                  <span className="text-muted-foreground/60 italic">Thinking…</span>
                )}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-4 flex items-center gap-2 rounded-2xl border border-border bg-background/80 backdrop-blur px-3 py-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Alfred anything…"
          disabled={busy}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          title="Send"
          className="shrink-0 rounded-xl border border-gold/30 bg-gold/10 p-2 text-gold transition-colors hover:bg-gold/20 disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>

      <p className="text-center font-mono text-[9px] uppercase tracking-wider text-muted-foreground/40">
        {QUICK_PROMPTS.length > 0 && "Powered by Google Gemini · responses may be inaccurate"}
      </p>
    </div>
  );
}
