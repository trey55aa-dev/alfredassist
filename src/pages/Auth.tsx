import { useEffect, useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { enableLocalMode } from "@/lib/localMode";

/**
 * A failed fetch (backend unreachable, offline, DNS gone) surfaces as a generic
 * "Failed to fetch", which reads exactly like a rejected password and sends
 * people hunting for the wrong problem. Name it for what it is.
 */
function isNetworkError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /failed to fetch|networkerror|network request failed|load failed/i.test(msg);
}

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [unreachable, setUnreachable] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  useEffect(() => {
    if (!authLoading && user) navigate(from, { replace: true });
  }, [user, authLoading, from, navigate]);

  if (!authLoading && user) return <Navigate to={from} replace />;

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Welcome aboard, sir.", {
          description: "Check your inbox to confirm — or sign in if confirmation is off.",
        });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("At your service.");
      }
    } catch (err) {
      if (isNetworkError(err)) {
        setUnreachable(true);
        toast.error("Can't reach Alfred's server.", {
          description: "This isn't your password — you can carry on offline.",
        });
      } else {
        const msg = err instanceof Error ? err.message : "Something went wrong.";
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleOffline = () => {
    enableLocalMode();
    navigate(from, { replace: true });
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) toast.error(error.message);
      // Successful start → Supabase redirects the browser; nothing else to do here.
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed.";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex h-14 w-14 rounded-md bg-gradient-gold items-center justify-center shadow-gold mb-4">
            <span className="font-display text-3xl text-primary-foreground font-semibold">A</span>
          </div>
          <h1 className="font-display text-4xl">Alfred</h1>
          <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-muted-foreground mt-1">
            At your service
          </p>
        </div>

        <Card className="p-6 bg-gradient-card border-border">
          <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
            <TabsList className="grid grid-cols-2 w-full bg-muted/40 mb-5">
              <TabsTrigger
                value="signin"
                className="font-mono text-[11px] tracking-[0.2em] uppercase data-[state=active]:bg-gold data-[state=active]:text-primary-foreground"
              >
                Sign in
              </TabsTrigger>
              <TabsTrigger
                value="signup"
                className="font-mono text-[11px] tracking-[0.2em] uppercase data-[state=active]:bg-gold data-[state=active]:text-primary-foreground"
              >
                Create account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="mt-0">
              <EmailForm
                mode="signin"
                email={email}
                setEmail={setEmail}
                password={password}
                setPassword={setPassword}
                onSubmit={handleEmail}
                busy={busy}
              />
            </TabsContent>
            <TabsContent value="signup" className="mt-0">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="name" className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
                    Name (optional)
                  </Label>
                  <Input
                    id="name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="How shall I address you?"
                    className="mt-1 bg-background/40 border-border focus-visible:ring-gold/40 focus-visible:border-gold/40"
                  />
                </div>
                <EmailForm
                  mode="signup"
                  email={email}
                  setEmail={setEmail}
                  password={password}
                  setPassword={setPassword}
                  onSubmit={handleEmail}
                  busy={busy}
                />
              </div>
            </TabsContent>
          </Tabs>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="font-mono text-[9px] tracking-[0.3em] uppercase text-muted-foreground">
              or
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            disabled={busy}
            className="w-full border-border bg-background/40 hover:bg-muted/60 text-foreground"
          >
            <GoogleIcon className="h-4 w-4 mr-2" />
            Continue with Google
          </Button>

          {unreachable && (
            <p className="mt-5 text-xs text-muted-foreground leading-relaxed border-t border-border pt-4">
              Alfred's server can't be reached right now, so signing in isn't
              possible. Your password is fine. Everything on this device still
              works — carry on offline and sign in whenever it's back.
            </p>
          )}

          <Button
            type="button"
            variant="ghost"
            onClick={handleOffline}
            className={
              unreachable
                ? "w-full mt-3 bg-gold text-primary-foreground hover:bg-gold-soft"
                : "w-full mt-4 text-muted-foreground hover:text-foreground"
            }
          >
            Use Alfred offline on this device
          </Button>
        </Card>
      </div>
    </div>
  );
}

function EmailForm({
  mode,
  email,
  setEmail,
  password,
  setPassword,
  onSubmit,
  busy,
}: {
  mode: "signin" | "signup";
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  busy: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label htmlFor="email" className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          placeholder="you@example.com"
          className="mt-1 bg-background/40 border-border focus-visible:ring-gold/40 focus-visible:border-gold/40"
        />
      </div>
      <div>
        <Label htmlFor="password" className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground">
          Password
        </Label>
        <Input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="••••••••"
          className="mt-1 bg-background/40 border-border focus-visible:ring-gold/40 focus-visible:border-gold/40"
        />
      </div>
      <Button
        type="submit"
        disabled={busy}
        className="w-full bg-gold text-primary-foreground hover:bg-gold-soft"
      >
        {busy ? "…" : mode === "signin" ? "Sign in" : "Create account"}
      </Button>
    </form>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.5-1.74 4.4-5.5 4.4-3.3 0-6-2.74-6-6.1s2.7-6.1 6-6.1c1.88 0 3.14.8 3.86 1.49l2.64-2.55C16.86 3.7 14.66 2.7 12 2.7 6.94 2.7 2.85 6.78 2.85 12s4.09 9.3 9.15 9.3c5.28 0 8.78-3.7 8.78-8.93 0-.6-.06-1.06-.14-1.52H12z"
      />
    </svg>
  );
}
