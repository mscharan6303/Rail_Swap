import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Search, TrendingUp, Train as TrainIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { RequestCard } from "@/components/RequestCard";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Database } from "@/integrations/supabase/types";

type Req = Database["public"]["Tables"]["exchange_requests"]["Row"];

export const Route = createFileRoute("/home")({
  head: () => ({ meta: [{ title: "Home — RailSwap" }] }),
  component: HomePage,
});

function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useI18n();
  const [feed, setFeed] = useState<Req[]>([]);
  const [mine, setMine] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    const fetchData = async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: openReqs }, { data: myReqs }] = await Promise.all([
        supabase.from("exchange_requests").select("*").eq("status", "open").gte("journey_date", today).neq("user_id", user.id).order("journey_date", { ascending: true }).limit(20),
        supabase.from("exchange_requests").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
      ]);
      if (isMounted) {
        setFeed(openReqs ?? []);
        setMine(myReqs ?? []);
        setLoading(false);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [user]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" />;

  const filtered = feed.filter(r =>
    !search || r.train_number.includes(search) || r.train_name.toLowerCase().includes(search.toLowerCase()) ||
    r.boarding_station.toLowerCase().includes(search.toLowerCase()) || r.destination_station.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <section className="rounded-3xl bg-gradient-hero text-white p-6 md:p-8 relative overflow-hidden animate-fade-in">
          <div className="absolute -right-10 -top-10 size-48 rounded-full bg-white/10 blur-2xl" />
          <p className="text-sm opacity-80">{t("welcome")}</p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">Find your perfect seat swap</h1>
          <p className="text-sm opacity-80 mt-1 max-w-md">Post a request or browse fellow passengers travelling with you.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild className="bg-white text-primary hover:bg-white/90 rounded-xl">
              <Link to="/create"><Plus className="size-4 mr-1" /> Create request</Link>
            </Button>
            <Button asChild variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10 rounded-xl">
              <Link to="/requests">My requests</Link>
            </Button>
          </div>
        </section>

        <div className="grid grid-cols-3 gap-3">
          <Stat label="Open" value={feed.length} />
          <Stat label="Yours" value={mine.length} />
          <Stat label="Trust" value="★ 5.0" />
        </div>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold flex items-center gap-2"><TrendingUp className="size-4 text-accent" /> Nearby matches</h2>
            <Link to="/requests" className="text-xs text-accent hover:underline">View all</Link>
          </div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search train, route…" className="pl-9 rounded-xl" />
          </div>
          {loading ? (
            <div className="grid gap-3 md:grid-cols-2"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState title="No open requests yet" body="Be the first to post a swap request for your train." action={
              <Button asChild className="bg-gradient-accent text-accent-foreground"><Link to="/create"><Plus className="size-4 mr-1" /> Create request</Link></Button>
            } />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filtered.map(r => <RequestCard key={r.id} req={r} />)}
            </div>
          )}
        </section>

        {mine.length > 0 && (
          <section>
            <h2 className="font-semibold mb-3 flex items-center gap-2"><TrainIcon className="size-4 text-accent" /> Your recent requests</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {mine.map(r => <RequestCard key={r.id} req={r} />)}
            </div>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-card p-4 text-center">
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
