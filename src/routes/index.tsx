import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { Train, Shield, Users, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RailSwap — Swap train seats safely" },
      { name: "description", content: "Find compatible passengers and swap your Indian train seat in seconds." },
    ],
  }),
  component: Splash,
});

function Splash() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.navigate({ to: "/home" });
  }, [loading, user, router]);

  return (
    <div className="min-h-screen bg-gradient-hero text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 0, transparent 40%), radial-gradient(circle at 80% 80%, white 0, transparent 40%)" }} />
      <div className="relative max-w-5xl mx-auto px-6 py-10 flex flex-col min-h-screen">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl">
            <span className="size-9 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Train className="size-5" />
            </span>
            RailSwap
          </div>
          <Link to="/login" className="text-sm font-medium hover:underline">Sign in</Link>
        </header>

        <div className="flex-1 flex flex-col justify-center py-12 max-w-2xl animate-slide-up">
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-medium mb-4">
            <Sparkles className="size-3" /> Smart matching for Indian trains
          </span>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-balance leading-[1.05]">
            Swap your <span className="text-accent-glow">train seat</span> in seconds.
          </h1>
          <p className="mt-5 text-lg text-white/80 max-w-xl text-balance">
            Lower berth for upper. Window for aisle. Find a compatible passenger on the same train and swap safely — built for India.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90 h-12 px-6 rounded-xl font-semibold">
              <Link to="/login">Get Started <ArrowRight className="ml-1 size-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 h-12 rounded-xl">
              <Link to="/about">How it works</Link>
            </Button>
          </div>

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Feature icon={<Shield className="size-5" />} title="Verified users" body="OTP & ID checks for trust." />
            <Feature icon={<Users className="size-5" />} title="Smart matching" body="Compatibility score for each match." />
            <Feature icon={<Train className="size-5" />} title="Same-train priority" body="Coach & seat-aware suggestions." />
          </div>
        </div>

        <p className="text-xs text-white/60 text-center pb-2">This app is not affiliated with IRCTC or Indian Railways.</p>
      </div>
    </div>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/15 p-4">
      <div className="size-9 rounded-lg bg-white/15 flex items-center justify-center mb-2">{icon}</div>
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-white/70 mt-0.5">{body}</p>
    </div>
  );
}
