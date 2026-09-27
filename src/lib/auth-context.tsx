import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CustomUser = {
  id: string;
  email: string;
  user_metadata?: { name?: string };
  name?: string;
};

type AuthState = {
  user: any | null;
  session: any | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("railswap_custom_user");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        setSession({ user: parsed });
      } catch {
        localStorage.removeItem("railswap_custom_user");
      }
    }
    setLoading(false);
  }, []);

  const signUp: AuthState["signUp"] = async (email, password, name) => {
    try {
      const cleanEmail = email.trim().toLowerCase();

      // Check if email already exists in profiles
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (existing) {
        return { error: "An account with this email already exists. Please sign in." };
      }

      // Generate a new UUID for the user
      const newUserId = crypto.randomUUID();

      // Insert directly into profiles table
      let { error: insertErr } = await supabase.from("profiles").insert({
        id: newUserId,
        email: cleanEmail,
        password: password,
        name: name,
        verified: true,
      });

      // Fallback if schema cache in Supabase has not reloaded email column yet
      if (insertErr && (insertErr.message.includes("email") || insertErr.code === "PGRST204")) {
        console.warn("Retrying profile creation with basic fields:", insertErr.message);
        const { error: fallbackErr } = await supabase.from("profiles").insert({
          id: newUserId,
          name: name,
          verified: true,
        });
        if (!fallbackErr) insertErr = null;
      }

      if (insertErr) {
        console.error("Direct signup database error:", insertErr);
        return { error: insertErr.message };
      }

      const customUser = {
        id: newUserId,
        email: cleanEmail,
        name: name,
        user_metadata: { name },
      };

      localStorage.setItem("railswap_custom_user", JSON.stringify(customUser));
      setUser(customUser);
      setSession({ user: customUser });
      return {};
    } catch (err: any) {
      return { error: err.message || "Failed to create account" };
    }
  };

  const signIn: AuthState["signIn"] = async (email, password) => {
    try {
      const cleanEmail = email.trim().toLowerCase();

      // Query profiles table for email
      const { data: profile, error: fetchErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", cleanEmail)
        .maybeSingle();

      if (fetchErr || !profile) {
        return { error: "No account found with this email. Please sign up first." };
      }

      if (profile.password && profile.password !== password) {
        return { error: "Incorrect password. Please try again." };
      }

      const customUser = {
        id: profile.id,
        email: profile.email || cleanEmail,
        name: profile.name || cleanEmail.split("@")[0],
        user_metadata: { name: profile.name || cleanEmail.split("@")[0] },
      };

      localStorage.setItem("railswap_custom_user", JSON.stringify(customUser));
      setUser(customUser);
      setSession({ user: customUser });
      return {};
    } catch (err: any) {
      return { error: err.message || "Failed to sign in" };
    }
  };

  const signOut = async () => {
    localStorage.removeItem("railswap_custom_user");
    setUser(null);
    setSession(null);
  };

  return (
    <AuthCtx.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}
