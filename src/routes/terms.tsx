import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/terms")({
  head: () => ({ meta: [{ title: "Terms — RailSwap" }] }),
  component: () => (
    <AppShell>
      <article className="max-w-2xl mx-auto px-4 py-6 space-y-3">
        <h1 className="text-2xl font-bold">Terms & conditions</h1>
        <p className="text-sm text-muted-foreground">By using RailSwap you agree to use the platform respectfully and lawfully. RailSwap is a community matchmaking service — final seat reassignment is at the discretion of the on-board TTE and Indian Railways. We are not affiliated with IRCTC or Indian Railways.</p>
        <p className="text-sm text-muted-foreground">No commercial reselling of seats, no harassment, no fraudulent claims. Violations result in account suspension.</p>
      </article>
    </AppShell>
  ),
});
