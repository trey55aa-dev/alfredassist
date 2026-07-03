import { useEffect, useRef, useState, useCallback } from "react";
import { X, Send, RotateCcw, Sparkles } from "lucide-react";
import { ButlerAvatar } from "./ButlerAvatar";
import {
  QUICK_PROMPTS,
  BUTLER_CHAT_KEY,
  streamButlerReply,
  type ChatMessage,
} from "@/lib/butlerAI";
import { buildContext } from "@/lib/butlerContext";

interface Props {
  open: boolean;
  onClose: () => void;
}

function useLocalMessages(): [ChatMessage[], (msgs: ChatMessage[]) => void] {
  const [msgs, setMsgs] = useState<ChatMessage[]>(() => {
    try {
      const raw = localStorage.getItem(BUTLER_CHAT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const save = useCallback((next: ChatMessage[]) => {
    setMsgs(next);
    try {
      // keep last 40 messages so localStorage doesn't grow unbounded
      localStorage.setItem(BUTLER_CHAT_KEY, JSON.stringify(next.slice(-40)));
    } catch { /* quota */ }
  }, []);

  return [msgs, save];
}

export function ButlerPanel({ open, onClose }: Props) {
  const [messages, setMessages] = useLocalMessages();
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const userMsg: ChatMessage = { role: "user", content: trimmed };
      const next = [...messages, userMsg];
      setMessages(next);
      setInput("");
      setStreaming(true);
      abortRef.current = false;

      const context = buildContext();
      let accumulated = "";
      const placeholderIdx = next.length;

      // Insert empty assistant message to stream into
      setMessages([...next, { role: "assistant", content: "" }]);

      try {
        for await (const chunk of streamButlerReply(next, trimmed, context)) {
          if (abortRef.current) break;
          accumulated += chunk;
          setMessages((prev) => {
            const updated = [...prev];
            updated[placeholderIdx] = { role: "assistant", content: accumulated };
            return updated;
          });
        }
      } finally {
        setStreaming(false);
        // Persist the final state
        setMessages((prev) => {
          try {
            localStorage.setItem(BUTLER_CHAT_KEY, JSON.stringify(prev.slice(-40)));
          } catch { /* quota */ }
          return prev;
        });
      }
    },
    [messages, setMessages, streaming],
  );

  const clear = () => {
    abortRef.current = true;
    setMessages([]);
    setStreaming(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Panel — slides in from right on desktop, up from bottom on mobile */}
      <div
        className={`
          fixed z-[60] bg-background/95 border-border/60 shadow-2xl
          flex flex-col
          transition-transform duration-300 ease-out
          /* mobile: bottom sheet */
          bottom-0 left-0 right-0 h-[88dvh] rounded-t-2xl border-t
          /* desktop: side panel */
          md:bottom-0 md:top-0 md:left-auto md:right-0 md:h-full md:w-[400px]
          md:rounded-none md:rounded-l-2xl md:border-t-0 md:border-l
          ${open
            ? "translate-y-0 md:translate-x-0"
            : "translate-y-full md:translate-y-0 md:translate-x-full"
          }
        `}
        style={{ backdropFilter: "blur(20px)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 shrink-0">
          <ButlerAvatar
            size={40}
            state={streaming ? "thinking" : "idle"}
            className="text-foreground shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="font-display text-base text-foreground leading-none">Alfred</div>
            <div className="font-mono text-[9px] tracking-[0.2em] uppercase text-muted-foreground mt-0.5">
              {streaming ? "Composing…" : "AI Butler · at your service"}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clear}
                title="New conversation"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 space-y-4">
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center gap-5 pt-6">
              <ButlerAvatar size={72} state="idle" className="text-foreground/70" />
              <div className="text-center space-y-1">
                <p className="font-display text-lg text-foreground">Good {greeting()}, sir.</p>
                <p className="font-mono text-[10px] tracking-wider text-muted-foreground">
                  Your butler is ready. How may I assist?
                </p>
              </div>
              {/* Quick prompts */}
              <div className="grid grid-cols-2 gap-2 w-full">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => send(p.label)}
                    className="flex items-center gap-2 rounded-lg border border-border/60 bg-white/3 px-3 py-2.5 text-left text-xs text-muted-foreground hover:border-gold/40 hover:text-foreground hover:bg-white/5 transition-colors"
                  >
                    <span>{p.icon}</span>
                    <span className="font-mono text-[10px] tracking-wide">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {msg.role === "assistant" && (
                <ButlerAvatar
                  size={28}
                  state={i === messages.length - 1 && streaming ? "speaking" : "idle"}
                  className="text-foreground/80 shrink-0 mt-0.5"
                />
              )}
              <div
                className={`
                  max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap
                  ${msg.role === "user"
                    ? "bg-gold/15 border border-gold/20 text-foreground rounded-tr-sm"
                    : "bg-white/5 border border-border/40 text-foreground/90 rounded-tl-sm"
                  }
                `}
              >
                {msg.content || (
                  <span className="inline-flex gap-1 items-center text-muted-foreground">
                    <span className="animate-bounce [animation-delay:0ms]">·</span>
                    <span className="animate-bounce [animation-delay:150ms]">·</span>
                    <span className="animate-bounce [animation-delay:300ms]">·</span>
                  </span>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-border/40 px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Alfred anything…"
              disabled={streaming}
              className="flex-1 bg-white/5 border border-border/60 rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20 transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              className="shrink-0 p-2.5 rounded-xl bg-gold/15 border border-gold/30 text-gold hover:bg-gold/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
          <p className="font-mono text-[8px] tracking-wider text-muted-foreground/40 text-center mt-2">
            Powered by Google Gemini · responses may be inaccurate
          </p>
        </div>
      </div>
    </>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
