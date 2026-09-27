import { createFileRoute, Link, Navigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Train, Calendar, MapPin, Trash2, MessageCircle, Edit, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { compatibility } from "@/lib/matching";
import { AppShell } from "@/components/AppShell";
import { RequestCard, StatusBadge } from "@/components/RequestCard";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

type Req = Database["public"]["Tables"]["exchange_requests"]["Row"];

export const Route = createFileRoute("/requests/$id")({
  head: () => ({ meta: [{ title: "Request — RailSwap" }] }),
  component: RequestDetail,
});

function RequestDetail() {
  const { id } = Route.useParams();
  const { user, loading: aLoad } = useAuth();
  const router = useRouter();
  const [req, setReq] = useState<Req | null>(null);
  const [matches, setMatches] = useState<{ req: Req; score: number }[]>([]);
  const [activeChats, setActiveChats] = useState<{ match_id: string; other_user: string; messages: any[]; profile?: {name:string, avatar_url:string} }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;
    const fetchData = async () => {
      const { data: r } = await supabase.from("exchange_requests").select("*").eq("id", id).maybeSingle();
      if (!r) { if (isMounted) setLoading(false); return; }
      if (isMounted) setReq(r);
      const { data: candidates } = await supabase.from("exchange_requests").select("*")
        .eq("train_number", r.train_number).eq("journey_date", r.journey_date).neq("user_id", r.user_id).eq("status", "open");
      const scored = (candidates ?? []).map(c => ({ req: c, score: compatibility(r, c) })).filter(x => x.score >= 60).sort((a,b) => b.score - a.score);
      if (isMounted) setMatches(scored);

      if (r.user_id === user.id) {
        const { data: chats } = await supabase.from("matches").select("id, user_a, user_b, messages(id, content, created_at, sender_id, read_at)")
          .or(`request_a.eq.${r.id},request_b.eq.${r.id}`);
        if (chats && isMounted) {
          // Fetch profiles for all other users
          const otherIds = chats.map((c: any) => c.user_a === user.id ? c.user_b : c.user_a);
          const { data: profs } = await supabase.from("profiles").select("id, name, avatar_url").in("id", otherIds);
          
          const formatted = chats.map((c: any) => {
            const otherUser = c.user_a === user.id ? c.user_b : c.user_a;
            const profile = profs?.find(p => p.id === otherUser);
            return {
              match_id: c.id,
              other_user: otherUser,
              messages: c.messages || [],
              unreadCount: (c.messages || []).filter((m: any) => m.sender_id !== user.id && m.read_at === null).length,
              profile: profile ? { name: profile.name || "Passenger", avatar_url: profile.avatar_url || "" } : undefined
            };
          });
          setActiveChats(formatted);
        }
      }
      if (isMounted) setLoading(false);
    };

    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => { isMounted = false; clearInterval(interval); };
  }, [id, user]);

  useEffect(() => {
    if (!user || !req) return;
    const ch = supabase.channel(`chats-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) => {
        const newMsg = p.new as any;
        setActiveChats(chats => {
          const exists = chats.some(c => c.match_id === newMsg.match_id);
          if (exists) {
            toast("New message received!");
            return chats.map(c => c.match_id === newMsg.match_id ? { ...c, messages: [...c.messages, newMsg], unreadCount: ((c as any).unreadCount || 0) + 1 } : c);
          }
          return chats;
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "matches" }, async (p) => {
        const newMatch = p.new as any;
        if (newMatch.request_a === req.id || newMatch.request_b === req.id) {
          // Fetch the profile for the new match
          const otherId = newMatch.user_a === user.id ? newMatch.user_b : newMatch.user_a;
          const { data: prof } = await supabase.from("profiles").select("name, avatar_url").eq("id", otherId).maybeSingle();
          
          setActiveChats(prev => [...prev, {
            match_id: newMatch.id,
            other_user: otherId,
            messages: [],
            unreadCount: 0,
            profile: prof ? { name: prof.name || "Passenger", avatar_url: prof.avatar_url || "" } : undefined
          }]);
          toast.success("Someone is interested in your swap!");
        }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, user, req]);

  if (aLoad) return null;
  if (!user) return <Navigate to="/login" />;

  const isOwner = req?.user_id === user.id;

  const startChat = async () => {
    if (!req || isOwner) return;
    // Find or create match
    const { data: existing } = await supabase.from("matches").select("*")
      .or(`and(request_a.eq.${req.id},user_b.eq.${user.id}),and(request_b.eq.${req.id},user_a.eq.${user.id})`).maybeSingle();
    let matchId = existing?.id;
    if (!matchId) {
      const { data: myArr } = await supabase.from("exchange_requests").select("*").eq("user_id", user.id)
        .eq("train_number", req.train_number).eq("journey_date", req.journey_date).eq("status", "open").limit(1);
      const my = myArr?.[0];
      const { data: m, error } = await supabase.from("matches").insert({
        request_a: req.id, request_b: my?.id ?? req.id, user_a: req.user_id, user_b: user.id,
        compatibility: my ? compatibility(req, my) : 50,
      }).select("id").single();
      if (error) { toast.error(error.message); return; }
      matchId = m.id;
    }
    router.navigate({ to: "/chat/$matchId", params: { matchId: matchId! } });
  };

  const updateStatus = async (newStatus: string) => {
    if (!req) return;
    const { error } = await supabase.from("exchange_requests").update({ status: newStatus }).eq("id", req.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Request marked as ${newStatus}`);
    setReq({ ...req, status: newStatus });
  };

  const deleteRequest = async () => {
    if (!req) return;
    if (!confirm("Delete this request permanently?")) return;
    await supabase.from("matches").delete().or(`request_a.eq.${req.id},request_b.eq.${req.id}`);
    const { error } = await supabase.from("exchange_requests").delete().eq("id", req.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Request deleted");
    router.navigate({ to: "/requests" });
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <button onClick={() => router.history.back()} className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-4" /> Back
        </button>

        {loading || !req ? <Skeleton className="h-64 rounded-3xl" /> : (
          <>
            <div className="rounded-3xl bg-gradient-primary text-primary-foreground p-6 shadow-elevated">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="size-12 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center">
                    <Train className="size-6" />
                  </span>
                  <div>
                    <p className="font-bold text-xl">{req.train_name}</p>
                    <p className="text-sm opacity-80">#{req.train_number}</p>
                  </div>
                </div>
                <StatusBadge status={req.status ?? "open"} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                <Info icon={<Calendar className="size-4" />} label="Date" value={new Date(req.journey_date).toLocaleDateString("en-IN",{day:"numeric",month:"short",year:"numeric"})} />
                <Info icon={<MapPin className="size-4" />} label="Route" value={`${req.boarding_station} → ${req.destination_station}`} />
                <Info label="Coach / Seat" value={`Coach ${req.coach_number} / Seat ${req.seat_number}`} />
                <Info label="Berth swap" value={`${req.current_berth} → ${req.desired_berth}`} />
              </div>
              {req.notes && <p className="mt-4 text-sm opacity-90 bg-white/10 rounded-xl p-3">{req.notes}</p>}
            </div>

            <div className="flex flex-col gap-3">
              {!isOwner ? (
                <Button onClick={startChat} className="w-full bg-gradient-accent text-accent-foreground"><Train className="size-4 mr-1" /> Send Swap Request & Chat</Button>
              ) : (
                <>
                  <div className="flex gap-2">
                    <Button onClick={deleteRequest} variant="destructive" className="flex-1">
                      <Trash2 className="size-4 mr-1" /> Delete Request
                    </Button>
                  </div>
                  <div className="flex items-center gap-3 w-full bg-secondary/30 p-3 rounded-2xl border">
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Request Status</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Update the visibility of your swap request.</p>
                    </div>
                    <Select value={req.status || "open"} onValueChange={updateStatus}>
                      <SelectTrigger className="w-[130px] h-9 bg-background font-medium shadow-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </div>

            {isOwner && (
              <section className="space-y-6">
                {activeChats.length > 0 && (
                  <div>
                    <h2 className="font-semibold mb-3 flex items-center gap-2"><MessageCircle className="size-4 text-primary" /> Active Chats</h2>
                    <div className="grid gap-3">
                      {activeChats.map(c => (
                        <div key={c.match_id} onClick={() => router.navigate({ to: "/chat/$matchId", params: { matchId: c.match_id } })} className="cursor-pointer border rounded-2xl p-4 bg-card hover:bg-secondary/50 flex items-center justify-between relative">
                          {(c as any).unreadCount > 0 && (
                            <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg z-10">
                              {(c as any).unreadCount} New
                            </span>
                          )}
                          <div>
                            <div className="flex items-center gap-2">
                              {c.profile?.avatar_url && <img src={c.profile.avatar_url} className="size-4 rounded-full" alt="" />}
                              <p className="font-semibold text-sm">{c.profile?.name || "Passenger"}</p>
                            </div>
                            <p className={`text-xs mt-0.5 truncate max-w-[200px] ${(c as any).unreadCount > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                              {c.messages?.length ? c.messages[c.messages.length - 1].content : "Chat opened"}
                            </p>
                          </div>
                          <Button variant="ghost" size="sm" className="bg-primary/10 text-primary">Open Chat</Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <h2 className="font-semibold mb-3">Compatible passengers</h2>
                  {matches.length === 0
                    ? <EmptyState title="No matches yet" body="We'll notify you the moment a compatible passenger posts." />
                    : <div className="grid gap-3 md:grid-cols-2">{matches.map(m => <RequestCard key={m.req.id} req={m.req} score={m.score} />)}</div>}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function Info({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide opacity-70 flex items-center gap-1">{icon}{label}</p>
      <p className="font-semibold mt-0.5">{value}</p>
    </div>
  );
}
