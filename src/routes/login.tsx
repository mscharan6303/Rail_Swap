import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Train, Mail, Lock, User as UserIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — RailSwap" }] }),
  component: LoginPage,
});

function LoginPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp } = useAuth();
  const router = useRouter();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (mode === "signup" && !name)) { toast.error("Fill all fields"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    setLoading(true);
    const res = mode === "signin" ? await signIn(email, password) : await signUp(email, password, name);
    setLoading(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success(mode === "signin" ? "Welcome back!" : "Account created!");
    router.navigate({ to: "/home" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-hero relative">
      <div className="absolute top-6 left-6">
        <Link to="/" className="text-white/80 hover:text-white text-sm">← Back</Link>
      </div>
      <div className="w-full max-w-md rounded-3xl bg-card text-card-foreground shadow-elevated p-8 animate-scale-in">
        <div className="flex items-center gap-2 mb-6">
          <span className="size-10 rounded-xl bg-gradient-accent flex items-center justify-center shadow-glow">
            <Train className="size-5 text-accent-foreground" />
          </span>
          <div>
            <p className="font-bold text-lg leading-tight">RailSwap</p>
            <p className="text-xs text-muted-foreground">{mode === "signin" ? "Welcome back" : "Create your account"}</p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input id="name" value={name} onChange={e => setName(e.target.value)} className="pl-9" placeholder="Aarav Kumar" />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="pl-9" placeholder="you@example.com" autoComplete="email" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} className="pl-9" placeholder="••••••••" autoComplete={mode === "signin" ? "current-password" : "new-password"} />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full h-11 bg-gradient-accent text-accent-foreground hover:opacity-90 font-semibold">
            {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
          <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="text-accent font-medium hover:underline">
            {mode === "signin" ? "Create account" : "Sign in"}
          </button>
        </p>
        <p className="mt-3 text-[11px] text-center text-muted-foreground">Phone OTP coming soon. Use email for now.</p>
      </div>
    </div>
  );
}
