import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/help")({
  head: () => ({ meta: [{ title: "Help & support — RailSwap" }] }),
  component: () => (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-2xl font-bold">Help & support</h1>
        <FAQ q="How does seat swapping work?" a="Post your current and desired berth. Other passengers on the same train see your request and can offer to swap. You then chat to coordinate and exchange at the boarding point." />
        <FAQ q="Is RailSwap official?" a="No. RailSwap is an independent community tool and is not affiliated with IRCTC or Indian Railways." />
        <FAQ q="Is it safe?" a="We require email verification, support reporting & blocking, and never share your personal details. Always meet in public spaces." />
        <FAQ q="Does this guarantee a swap?" a="No. Swaps depend on a willing matching passenger and TTE approval onboard." />
        <FAQ q="How do I report someone?" a="Open the chat and tap the flag icon, or email support@railswap.example." />
      </div>
    </AppShell>
  ),
});

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <details className="rounded-2xl border bg-card p-4 group">
      <summary className="cursor-pointer font-semibold list-none flex items-center justify-between">{q}<span className="text-accent group-open:rotate-45 transition-transform">+</span></summary>
      <p className="text-sm text-muted-foreground mt-2">{a}</p>
    </details>
  );
}
