import { createFileRoute, Navigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Shield, Flag } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Database } from "@/integrations/supabase/types";

type Msg = Database["public"]["Tables"]["messages"]["Row"];

export const Route = createFileRoute("/chat/$matchId")({
  head: () => ({ meta: [{ title: "Chat — RailSwap" }] }),
  component: ChatPage,
});

function ChatPage() {
  const { matchId } = Route.useParams();
  const { user, loading: aLoad } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [otherProfile, setOtherProfile] = useState<{ name: string; avatar_url: string | null } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  const [otherReq, setOtherReq] = useState<any>(null);
  const [myReq, setMyReq] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const fetchData = async () => {
      const { data: match } = await supabase.from("matches").select("user_a, user_b, request_a, request_b").eq("id", matchId).maybeSingle();
      if (match && isMounted) {
        const otherId = match.user_a === user.id ? match.user_b : match.user_a;
        setOtherProfile(prev => {
          if (!prev) {
            supabase.from("profiles").select("name, avatar_url").eq("id", otherId).maybeSingle().then(({ data: prof }) => {
              if (isMounted) setOtherProfile({ name: prof?.name || "Passenger", avatar_url: prof?.avatar_url || null });
            });
          }
          return prev;
        });

        const { data: reqs } = await supabase.from("exchange_requests").select("*").in("id", [match.request_a, match.request_b]);
        if (reqs && isMounted) {
          setMyReq(reqs.find(r => r.user_id === user.id));
          setOtherReq(prev => {
            const fresh = reqs.find(r => r.user_id !== user.id);
            if (prev && fresh && prev.status !== fresh.status) {
              if (fresh.status === 'completed') toast.success("The other passenger has confirmed the swap!");
              if (fresh.status === 'cancelled') toast.error("The other passenger has cancelled their swap.");
              if (fresh.status === 'accepted') toast.success("The other passenger has accepted your swap request.");
            }
            return fresh;
          });
        }
      }
      
      const { data: msgs } = await supabase.from("messages").select("*").eq("match_id", matchId).order("created_at");
      if (msgs && isMounted) {
        setMessages(prev => {
          const dbIds = new Set(msgs.map(m => m.id));
          const localOnly = prev.filter(m => !dbIds.has(m.id) && m.sender_id === user.id);
          return [...msgs, ...localOnly];
        });
      }

      await supabase.from("messages").update({ read_at: new Date().toISOString() })
        .eq("match_id", matchId).neq("sender_id", user.id).is("read_at", null);
    };

    fetchData();
    const interval = setInterval(fetchData, 1000);

    const ch = supabase.channel(`chat-${matchId}`, {
      config: { broadcast: { self: true } }
    })
      .on("broadcast", { event: "status_changed" }, () => {
        fetchData(); // instantly pull new status
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `match_id=eq.${matchId}` },
        (p) => {
          const newMsg = p.new as Msg;
          if (newMsg.sender_id === user.id) return;
          setMessages(m => {
            if (m.some(x => x.id === newMsg.id)) return m;
            return [...m, newMsg];
          });
        })
      .subscribe();
      
    channelRef.current = ch;
      
    return () => { 
      isMounted = false;
      clearInterval(interval);
      supabase.removeChannel(ch); 
    };
  }, [matchId, user]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  if (aLoad) return null;
  if (!user) return <Navigate to="/login" />;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim(); if (!content) return;
    setInput("");
    
    // Optimistic UI update
    const tempId = crypto.randomUUID();
    const optimisticMsg: Msg = {
      id: tempId, match_id: matchId, sender_id: user.id,
      content, image_url: null, read_at: null, created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, optimisticMsg]);
    
    const { data, error } = await supabase.from("messages").insert({ match_id: matchId, sender_id: user.id, content }).select().single();
    if (error) {
      toast.error(error.message);
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } else {
      setMessages(prev => prev.map(m => m.id === tempId ? data : m));
    }
  };

  const report = async () => {
    if (!confirm("Report this user for unsafe behaviour?")) return;
    const { data: match } = await supabase.from("matches").select("user_a, user_b").eq("id", matchId).maybeSingle();
    if (!match) return;
    const otherId = match.user_a === user.id ? match.user_b : match.user_a;
    await supabase.from("reports").insert({ reporter_id: user.id, reported_id: otherId, reason: "Reported from chat" });
    toast.success("Reported. Our team will review.");
  };

  const handleStatusAction = async () => {
    if (!myReq) return;
    
    if (myReq.status === "pending") {
      // User A accepts -> status becomes "accepted"
      await supabase.from("exchange_requests").update({ status: "accepted" }).eq("id", myReq.id);
      setMyReq({ ...myReq, status: "accepted" });
      channelRef.current?.send({ type: 'broadcast', event: 'status_changed', payload: {} });
      toast.success("Request accepted! Chat is fully unlocked.");
      return;
    }

    if (myReq.status === "accepted" || myReq.status === "open") {
      // Allow confirming even if it was open (for User B who initiated)
      if (!otherReq) {
        toast.error("Both users must have an active request for this train before a swap can be confirmed.");
        return;
      }
      if (myReq.train_number !== otherReq.train_number || myReq.journey_date !== otherReq.journey_date) {
        toast.error("Journeys do not match. Cannot swap.");
        return;
      }
      if (!confirm("Are you sure you want to finalize and confirm this swap?")) return;
      
      await supabase.from("exchange_requests").update({ status: "completed" }).eq("id", myReq.id);
      setMyReq({ ...myReq, status: "completed" });
      channelRef.current?.send({ type: 'broadcast', event: 'status_changed', payload: {} });
      
      if (otherReq.status === "completed") {
        toast.success("Swap Fully Confirmed by both passengers!");
      } else {
        toast.success("You confirmed the swap. Waiting for the other passenger to confirm.");
      }
    }
  };

  const isMyReqCompleted = myReq?.status === "completed";
  const isOtherReqCompleted = otherReq?.status === "completed";
  const swapFullyConfirmed = isMyReqCompleted && isOtherReqCompleted;
  const isCancelled = myReq?.status === "cancelled" || otherReq?.status === "cancelled";

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto h-[calc(100vh-8rem)] md:h-[calc(100vh-10rem)] flex flex-col px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => router.history.back()} className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-4" /> Back
          </button>
          <div className="text-center flex-1 flex flex-col items-center">
            <div className="flex items-center gap-2">
              {otherProfile?.avatar_url && <img src={otherProfile.avatar_url} alt="" className="size-5 rounded-full object-cover" />}
              <p className="font-semibold leading-tight">{otherProfile?.name || "Loading..."}</p>
            </div>
            {otherReq?.verification_status ? (
              <p className="text-[11px] text-success inline-flex items-center gap-1 font-medium bg-success/10 px-1.5 py-0.5 rounded-full mt-0.5">
                <Shield className="size-3" /> {otherReq.verification_status.toUpperCase()} Verified
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1 mt-0.5">Unverified Ticket</p>
            )}
          </div>
          <div className="flex gap-2">
            {!isMyReqCompleted && !isCancelled ? (
              myReq?.status === "pending" ? (
                <button onClick={handleStatusAction} className="text-primary text-sm font-semibold hover:opacity-80 border border-primary/30 px-2 py-1 rounded bg-primary/10">Accept Swap</button>
              ) : (myReq?.status === "accepted" || otherReq?.status === "accepted" || myReq?.status === "open") ? (
                <button onClick={handleStatusAction} className="text-success text-sm font-semibold hover:opacity-80 border border-success/30 px-2 py-1 rounded bg-success/10">Confirm Swap</button>
              ) : null
            ) : isCancelled ? (
              <button disabled className="text-destructive text-sm font-semibold border border-destructive/30 px-2 py-1 rounded bg-destructive/10 cursor-not-allowed">
                Swap Cancelled
              </button>
            ) : (
              <button disabled className="text-muted-foreground text-sm font-semibold border border-border px-2 py-1 rounded bg-muted/50 cursor-not-allowed">
                {swapFullyConfirmed ? "Swap Confirmed" : "Waiting for them..."}
              </button>
            )}
            <button onClick={report} className="text-destructive hover:opacity-80 p-1" aria-label="Report"><Flag className="size-4" /></button>
          </div>
        </div>

        {isCancelled && (
          <div className="bg-destructive/15 border border-destructive/30 text-destructive px-4 py-3 rounded-2xl mb-3 text-sm flex items-center justify-center gap-2 font-medium">
            <Shield className="size-4" /> This swap is no longer available because a ticket was cancelled.
          </div>
        )}

        {swapFullyConfirmed && (
          <div className="bg-success/15 border border-success/30 text-success px-4 py-3 rounded-2xl mb-3 text-sm flex items-center justify-center gap-2 font-medium">
            <Shield className="size-4" /> Both users have verified and confirmed this swap!
          </div>
        )}

        <div className="bg-secondary/30 rounded-2xl p-3 mb-3 text-xs border flex items-start gap-4">
          <div className="flex-1">
            <p className="font-medium text-foreground mb-1">Your Request Context</p>
            <p className="text-muted-foreground">Train: <span className="font-medium text-foreground">{myReq?.train_number}</span></p>
            <p className="text-muted-foreground">Date: <span className="font-medium text-foreground">{myReq?.journey_date}</span></p>
            {myReq?.verification_status?.includes(":") && myReq.verification_status.split(":")[1] && (
               <p className="text-muted-foreground">PNR: <span className="font-medium text-foreground">{myReq.verification_status.split(":")[1].replace(/^(\d{3})\d{4}(\d{3})$/, "$1XXXX$2")}</span></p>
            )}
            <p className="text-muted-foreground">Seat: <span className="font-medium text-foreground">Coach {myReq?.coach_number}, Seat {myReq?.seat_number}</span></p>
            {myReq?.notes?.includes("[Passenger:") && (
               <p className="text-muted-foreground">Passenger: <span className="font-medium text-foreground">{myReq.notes.match(/\[Passenger: (.*?)\]/)?.[1]}</span></p>
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground mb-1">Their Request Context</p>
            <p className="text-muted-foreground">Train: <span className="font-medium text-foreground">{otherReq?.train_number}</span></p>
            <p className="text-muted-foreground">Date: <span className="font-medium text-foreground">{otherReq?.journey_date}</span></p>
            {otherReq?.verification_status?.includes(":") && otherReq.verification_status.split(":")[1] && (
               <p className="text-muted-foreground">PNR: <span className="font-medium text-foreground">{otherReq.verification_status.split(":")[1].replace(/^(\d{3})\d{4}(\d{3})$/, "$1XXXX$2")}</span></p>
            )}
            <p className="text-muted-foreground">Seat: <span className="font-medium text-foreground">Coach {otherReq?.coach_number}, Seat {otherReq?.seat_number}</span></p>
            {otherReq?.notes?.includes("[Passenger:") && (
               <p className="text-muted-foreground">Passenger: <span className="font-medium text-foreground">{otherReq.notes.match(/\[Passenger: (.*?)\]/)?.[1]}</span></p>
            )}
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-3xl bg-card border p-4 space-y-2">
          {messages.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Say hi 👋 — keep it friendly and don't share OTPs or payment info.</p>}
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.sender_id === user.id ? "justify-end" : "justify-start"} items-end gap-2`}>
              {m.sender_id !== user.id && (
                <img src={otherProfile?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=fallback"} alt="Avatar" className="size-6 rounded-full" />
              )}
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm animate-fade-in ${m.sender_id === user.id ? "bg-gradient-accent text-accent-foreground rounded-br-sm" : "bg-secondary text-secondary-foreground rounded-bl-sm"}`}>
                {m.sender_id !== user.id && (
                  <p className="text-[10px] opacity-70 font-bold mb-0.5">{otherProfile?.name || "Passenger"}</p>
                )}
                <p>{m.content}</p>
                <p className="text-[10px] opacity-70 mt-0.5">{new Date(m.created_at!).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              {m.sender_id === user.id && (
                <img src={user.user_metadata?.avatar_url || "https://api.dicebear.com/7.x/avataaars/svg?seed=me"} alt="Me" className="size-6 rounded-full" />
              )}
            </div>
          ))}
        </div>

        {myReq?.status === "pending" || otherReq?.status === "pending" ? (
          <div className="mt-3 text-center text-sm text-muted-foreground p-3 border rounded-xl bg-muted/20">
            Waiting for the request to be accepted before chat fully unlocks.
          </div>
        ) : (
          <form onSubmit={send} className="mt-3 flex gap-2">
            <Input value={input} onChange={e => setInput(e.target.value)} placeholder="Type a message…" className="rounded-xl" />
            <Button type="submit" size="icon" className="bg-gradient-accent text-accent-foreground"><Send className="size-4" /></Button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
