import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { RequestCard } from "@/components/RequestCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { Database } from "@/integrations/supabase/types";

type Req = Database["public"]["Tables"]["exchange_requests"]["Row"];

export const Route = createFileRoute("/requests/")({
  head: () => ({ meta: [{ title: "My requests — RailSwap" }] }),
  component: RequestsPage,
});

function RequestsPage() {
  const { user, loading: aLoad } = useAuth();
  const [items, setItems] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);

  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const fetchData = async () => {
      const { data: reqs } = await supabase.from("exchange_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (isMounted) setItems(reqs ?? []);

      if (reqs && reqs.length > 0 && isMounted) {
        const { data: matches } = await supabase.from("matches").select("id, request_a, request_b").or(`user_a.eq.${user.id},user_b.eq.${user.id}`);
        if (matches && matches.length > 0) {
          const matchIds = matches.map(m => m.id);
          const { data: msgs } = await supabase.from("messages").select("match_id").in("match_id", matchIds).neq("sender_id", user.id).is("read_at", null);
          
          const counts: Record<string, number> = {};
          msgs?.forEach(msg => {
            const match = matches.find(m => m.id === msg.match_id);
            if (match) {
              const myReqId = reqs.find(r => r.id === match.request_a || r.id === match.request_b)?.id;
              if (myReqId) {
                counts[myReqId] = (counts[myReqId] || 0) + 1;
              }
            }
          });
          if (isMounted) setUnreadCounts(counts);
        }
      }
      if (isMounted) setLoading(false);
    };

    fetchData();
    const interval = setInterval(fetchData, 1000);

    // Realtime listener for new messages to update unread counts
    const msgChannel = supabase.channel('requests-unread-messages')
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, async (payload) => {
        const msg = payload.new as any;
        if (msg.sender_id !== user.id) {
          // Fetch match to find request ID
          const { data: match } = await supabase.from("matches").select("request_a, request_b").eq("id", msg.match_id).maybeSingle();
          if (match && isMounted) {
            setItems((prevItems) => {
              const myReqId = prevItems.find(r => r.id === match.request_a || r.id === match.request_b)?.id;
              if (myReqId) {
                setUnreadCounts(prev => ({ ...prev, [myReqId]: (prev[myReqId] || 0) + 1 }));
              }
              return prevItems;
            });
          }
        }
      })
      .subscribe();

    return () => { 
      isMounted = false;
      clearInterval(interval);
      supabase.removeChannel(msgChannel); 
    };
  }, [user]);

  if (aLoad) return null;
  if (!user) return <Navigate to="/login" />;

  const groups = {
    open: items.filter(i => i.status === "open"),
    matched: items.filter(i => ["matched","pending","accepted"].includes(i.status ?? "")),
    closed: items.filter(i => ["completed","cancelled"].includes(i.status ?? "")),
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-bold">My requests</h1>
            <p className="text-sm text-muted-foreground">Track and manage your seat swaps</p>
          </div>
          <Button asChild className="bg-gradient-accent text-accent-foreground"><Link to="/create"><Plus className="size-4 mr-1" />New</Link></Button>
        </div>

        <Tabs defaultValue="open">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="open">Open ({groups.open.length})</TabsTrigger>
            <TabsTrigger value="matched">Active ({groups.matched.length})</TabsTrigger>
            <TabsTrigger value="closed">Closed ({groups.closed.length})</TabsTrigger>
          </TabsList>

          {(["open","matched","closed"] as const).map(k => (
            <TabsContent key={k} value={k} className="mt-4">
              {loading ? <div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
                : groups[k].length === 0 ? <EmptyState title="Nothing here yet" body="Create a request to get started." />
                : <div className="grid gap-3 md:grid-cols-2">{groups[k].map(r => <RequestCard key={r.id} req={r} unreadCount={unreadCounts[r.id]} />)}</div>}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppShell>
  );
}
