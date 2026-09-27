import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/privacy")({
  head: () => ({ meta: [{ title: "Privacy — RailSwap" }] }),
  component: () => (
    <AppShell>
      <article className="prose max-w-2xl mx-auto px-4 py-6 prose-sm dark:prose-invert">
        <h1 className="text-2xl font-bold mb-4">Privacy policy</h1>
        <p className="text-sm text-muted-foreground">We collect only what's needed to make seat swaps work — your email, profile info you choose to share, and your exchange requests. Your data is never sold. You can request deletion at any time from Settings.</p>
        <h2 className="text-lg font-semibold mt-5">Data we store</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>Account: email, name, profile photo, bio</li>
          <li>Activity: requests, matches, chat messages, ratings</li>
        </ul>
        <h2 className="text-lg font-semibold mt-5">Sharing</h2>
        <p className="text-sm text-muted-foreground">Other users see your name and rating once you create a request or open a chat. Phone numbers are never auto-shared.</p>
      </article>
    </AppShell>
  ),
});
