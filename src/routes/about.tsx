import { createFileRoute, Link } from "@tanstack/react-router";
import { Train, Users, ShieldCheck, Heart } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({ meta: [{ title: "About — RailSwap" }] }),
  component: () => (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="text-center">
          <span className="size-14 mx-auto rounded-2xl bg-gradient-accent flex items-center justify-center shadow-glow"><Train className="size-7 text-accent-foreground" /></span>
          <h1 className="text-3xl font-bold mt-4">About RailSwap</h1>
          <p className="text-muted-foreground mt-2 max-w-xl mx-auto">A community-built platform that helps Indian train passengers find compatible swap partners — safely, quickly, and for free.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Step n={1} title="Post" body="Create a request with your train, seat and desired berth." />
          <Step n={2} title="Match" body="See compatible passengers travelling on the same train." />
          <Step n={3} title="Swap" body="Chat, agree, and request the swap onboard with the TTE." />
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <Pill icon={<Users />} title="Community-first" />
          <Pill icon={<ShieldCheck />} title="Safety built-in" />
          <Pill icon={<Heart />} title="Free forever" />
        </div>
        <div className="text-center">
          <Button asChild className="bg-gradient-accent text-accent-foreground"><Link to="/login">Get started</Link></Button>
        </div>
        <p className="text-xs text-center text-muted-foreground">RailSwap is not affiliated with IRCTC or Indian Railways.</p>
      </div>
    </AppShell>
  ),
});

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="size-8 rounded-lg bg-gradient-primary text-primary-foreground flex items-center justify-center font-bold mb-2">{n}</div>
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{body}</p>
    </div>
  );
}
function Pill({ icon, title }: { icon: React.ReactNode; title: string }) {
  return <div className="rounded-xl border bg-card p-3 flex items-center gap-2 [&>svg]:size-4 [&>svg]:text-accent">{icon}<span className="font-medium text-sm">{title}</span></div>;
}
