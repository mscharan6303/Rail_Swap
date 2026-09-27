import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";

type N = Database["public"]["Tables"]["notifications"]["Row"];

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — RailSwap" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user, loading: aLoad } = useAuth();
  const [items, setItems] = useState<N[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => { setItems(data ?? []); setLoading(false); });
  }, [user]);

  if (aLoad) return null;
  if (!user) return <Navigate to="/login" />;

  const markAll = async () => {
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setItems(items.map(i => ({ ...i, read: true })));
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-bold">Notifications</h1>
          {items.some(i => !i.read) && <Button size="sm" variant="outline" onClick={markAll}><CheckCheck className="size-4 mr-1" /> Mark all read</Button>}
        </div>

        {loading ? <Skeleton className="h-32" /> : items.length === 0 ? (
          <EmptyState title="All caught up" body="You'll see match alerts and journey reminders here." />
        ) : (
          <ul className="space-y-2">
            {items.map(n => (
              <li key={n.id} className={`rounded-2xl border p-4 flex gap-3 animate-fade-in ${n.read ? "bg-card" : "bg-accent/5 border-accent/30"}`}>
                <span className="size-9 rounded-xl bg-gradient-accent text-accent-foreground flex items-center justify-center shrink-0"><Bell className="size-4" /></span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{n.title}</p>
                  {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                  <p className="text-[11px] text-muted-foreground mt-1">{new Date(n.created_at!).toLocaleString()}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
