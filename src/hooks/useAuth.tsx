import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, user_id, display_name, avatar_url")
      .eq("user_id", userId)
      .maybeSingle();

    if (data) {
      setProfile(data);
      return;
    }

    // No profile yet — happens on first Google/OAuth sign-in.
    // Pull name + avatar from the provider metadata and seed the row.
    const { data: authData } = await supabase.auth.getUser();
    const meta = authData?.user?.user_metadata ?? {};
    const display_name: string | null =
      meta.full_name ?? meta.name ?? meta.display_name ??
      authData?.user?.email?.split("@")[0] ?? null;
    const avatar_url: string | null = meta.avatar_url ?? meta.picture ?? null;

    await supabase
      .from("profiles")
      .upsert({ user_id: userId, display_name, avatar_url }, { onConflict: "user_id" });

    const { data: created } = await supabase
      .from("profiles")
      .select("id, user_id, display_name, avatar_url")
      .eq("user_id", userId)
      .maybeSingle();
    setProfile(created);
  };

  useEffect(() => {
    // Listener FIRST (per Lovable Cloud auth rules)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        // Defer Supabase calls outside the listener to avoid deadlocks
        setTimeout(() => loadProfile(newSession.user.id), 0);
      } else {
        setProfile(null);
      }
    });

    // Then check existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) loadProfile(existing.user.id);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user) await loadProfile(user.id);
  };

  const updateDisplayName = async (name: string) => {
    if (!user) return;
    const trimmed = name.trim();
    // Upsert keeps it robust whether or not the profile row already exists.
    const { error } = await supabase
      .from("profiles")
      .upsert(
        { user_id: user.id, display_name: trimmed || null },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    // Also stash on the auth user metadata so future OAuth logins keep it.
    await supabase.auth.updateUser({ data: { display_name: trimmed } });
    await loadProfile(user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signOut,
        refreshProfile,
        updateDisplayName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
