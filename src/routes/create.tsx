import { createFileRoute, Navigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Info } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { JourneyVerification, type VerifiedTicket, type VerifiedPassenger } from "@/components/JourneyVerification";

export const Route = createFileRoute("/create")({
  head: () => ({ meta: [{ title: "Create request — RailSwap" }] }),
  component: CreatePage,
});

const BERTHS = ["Any", "Lower", "Middle", "Upper", "Side Lower", "Side Upper"];

function CreatePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(true);
  const [verified, setVerified] = useState<VerifiedTicket | null>(null);
  
  // Passenger selection states
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());
  const [desiredBerths, setDesiredBerths] = useState<Record<number, string>>({});
  const [notes, setNotes] = useState("");
  
  // Optional manual inputs if chart not prepared
  const [manualCoach, setManualCoach] = useState("");
  const [manualSeat, setManualSeat] = useState("");

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" />;

  const onVerified = (v: VerifiedTicket) => {
    setVerified(v);
    setVerifyOpen(false);
    
    // Auto-select first confirmed passenger
    if (v.passengers && v.passengers.length > 0) {
      const firstConfirmedIdx = v.passengers.findIndex(p => p.statusType?.toUpperCase() === "CNF" || p.statusType?.toUpperCase() === "CONFIRMED");
      if (firstConfirmedIdx !== -1) {
        setSelectedIndexes(new Set([firstConfirmedIdx]));
        setDesiredBerths({ [firstConfirmedIdx]: "Any" });
      }
    }
  };

  const togglePassenger = (index: number) => {
    const newSet = new Set(selectedIndexes);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
      if (!desiredBerths[index]) {
        setDesiredBerths(prev => ({ ...prev, [index]: "Any" }));
      }
    }
    setSelectedIndexes(newSet);
  };

  const isChartNotPrepared = verified?.passengers?.some(p => !p.coach && !p.seat) && 
    (new Date(verified.journey_date).getTime() >= new Date().setHours(0,0,0,0));

  const submit = async () => {
    if (!verified) return;
    if (selectedIndexes.size === 0) {
      toast.error("Please select at least one passenger");
      return;
    }

    setSubmitting(true);

    const { data: dup } = await supabase.from("exchange_requests").select("id")
      .eq("user_id", user.id).eq("train_number", verified.train_number).eq("journey_date", verified.journey_date).maybeSingle();
    if (dup) { setSubmitting(false); toast.error("You already have a request for this train & date"); return; }

    const selectedPassengers = Array.from(selectedIndexes).map(index => {
      const p = verified.passengers![index];
      return {
        passengerName: p.name,
        age: p.age,
        gender: p.gender,
        coach: p.coach || manualCoach || "",
        seat: p.seat || manualSeat || "",
        berth: p.berth || "",
        desiredBerth: desiredBerths[index] || "Any"
      };
    });

    // We only create one request document
    const primaryP = selectedPassengers[0];
    
    const payload = {
      user_id: user.id,
      train_number: verified.train_number,
      train_name: verified.train_name,
      journey_date: verified.journey_date,
      boarding_station: verified.boarding_station,
      destination_station: verified.destination_station,
      verification_status: verified.verification_status,
      verification_hash: verified.verification_hash,
      verified_at: new Date().toISOString(),
      
      coach_number: primaryP.coach,
      seat_number: primaryP.seat,
      current_berth: primaryP.berth,
      desired_berth: primaryP.desiredBerth,
      passenger_name: primaryP.passengerName,
      gender_preference: "any",
      notes: notes,
      status: "open"
    };

    const { error } = await supabase.from("exchange_requests").insert(payload);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Swap request posted successfully!");
    router.navigate({ to: "/requests" });
  };

  const renderStatusBadge = (status?: string) => {
    if (!status) return null;
    const t = status.toUpperCase();
    if (t === "CNF" || t === "CONFIRMED") return <Badge variant="secondary" className="bg-success/15 text-success border-0">CNF</Badge>;
    if (t === "RAC") return <Badge variant="secondary" className="bg-yellow-500/15 text-yellow-700 border-0">RAC</Badge>;
    if (t.includes("WL")) return <Badge variant="secondary" className="bg-destructive/15 text-destructive border-0">{t}</Badge>;
    return <Badge variant="secondary" className="border-0">{status}</Badge>;
  };
  
  const getBerthColor = (berth?: string) => {
    if (!berth) return "bg-muted text-muted-foreground";
    const b = berth.toLowerCase();
    if (b.includes("lower") && !b.includes("side")) return "bg-green-500/15 text-green-700";
    if (b.includes("middle")) return "bg-blue-500/15 text-blue-700";
    if (b.includes("upper") && !b.includes("side")) return "bg-purple-500/15 text-purple-700";
    if (b.includes("side")) return "bg-orange-500/15 text-orange-700";
    return "bg-muted text-muted-foreground";
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {!verified ? (
          <div className="text-center py-12">
            <ShieldCheck className="size-16 mx-auto text-primary/40 mb-4" />
            <h1 className="text-2xl font-bold mb-2">Verify Your Ticket</h1>
            <p className="text-muted-foreground mb-6">You need to verify your train ticket before posting a swap request.</p>
            <Button onClick={() => setVerifyOpen(true)} className="bg-gradient-primary">
              Verify Ticket Now
            </Button>
            <JourneyVerification open={verifyOpen} onOpenChange={setVerifyOpen} onVerified={onVerified} />
          </div>
        ) : (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">Select Passengers to Swap</h1>
            
            {/* Summary Bar */}
            <div className="rounded-2xl border bg-secondary/30 p-4 flex flex-col gap-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <span className="font-semibold">{verified.train_number}</span>
                  <span className="text-muted-foreground text-xs">{verified.boarding_station} → {verified.destination_station}</span>
                </div>
                <div className="text-right flex flex-col gap-1">
                  <span className="text-muted-foreground text-xs">Verified via {verified.verification_status.toUpperCase()}</span>
                </div>
              </div>
              <div className="flex items-center justify-between border-t pt-2 border-border/50">
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Departure</span>
                  <span className="font-medium">{verified.journey_date}{verified.departure_time ? ` at ${verified.departure_time}` : ""}</span>
                </div>
                {(verified.arrival_date || verified.arrival_time) && (
                  <div className="flex flex-col gap-0.5 text-right">
                    <span className="text-xs text-muted-foreground uppercase tracking-wider">Arrival</span>
                    <span className="font-medium">{verified.arrival_date || verified.journey_date}{verified.arrival_time ? ` at ${verified.arrival_time}` : ""}</span>
                  </div>
                )}
              </div>
            </div>

            {isChartNotPrepared && (
              <div className="rounded-xl bg-blue-500/10 text-blue-700 dark:text-blue-400 p-3 text-sm flex gap-2 items-start">
                <Info className="size-4 shrink-0 mt-0.5" />
                <p>Chart not yet prepared — coach & seat will be assigned ~4 hours before departure. You can still post your request now.</p>
              </div>
            )}

            <div className="space-y-4">
              {verified.passengers?.map((passenger, index) => {
                const isSelected = selectedIndexes.has(index);
                const isDisabled = passenger.statusType?.toUpperCase() !== "CNF" && passenger.statusType?.toUpperCase() !== "CONFIRMED";
                
                return (
                  <div key={index} className={`rounded-2xl border transition-all overflow-hidden ${isSelected ? "border-primary shadow-sm ring-1 ring-primary/20" : "bg-card"} ${!isDisabled ? "hover:border-primary/50" : "opacity-80"}`}>
                    <div 
                      className={`flex gap-3 p-4 ${!isDisabled ? "cursor-pointer" : ""}`}
                      onClick={() => {
                        if (!isDisabled) togglePassenger(index);
                      }}
                    >
                      <Checkbox 
                        checked={isSelected} 
                        disabled={isDisabled}
                        className="mt-1 pointer-events-none"
                      />
                      <div className="flex-1 opacity-100 data-[disabled=true]:opacity-50" data-disabled={isDisabled}>
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-semibold text-base">{passenger.name || `Passenger ${index + 1}`}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {passenger.age ? `${passenger.age} · ` : ""}{passenger.gender || ""}
                            </p>
                          </div>
                          <div className="text-right flex flex-col items-end gap-1">
                            <span className="font-medium">
                              Coach {passenger.coach || "TBD"} / Seat {passenger.seat || "TBD"}
                            </span>
                            <div className="flex gap-1.5 mt-1">
                              {passenger.berth && (
                                <Badge variant="secondary" className={`border-0 ${getBerthColor(passenger.berth)}`}>
                                  {passenger.berth}
                                </Badge>
                              )}
                              {renderStatusBadge(passenger.statusType)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {isSelected && (
                      <div className="px-4 pb-4 pt-3 bg-primary/5 border-t border-primary/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold">Desired berth preference</span>
                          <span className="text-xs text-muted-foreground">Select which berth you want to swap for.</span>
                        </div>
                        <Select 
                          value={desiredBerths[index]} 
                          onValueChange={(v) => setDesiredBerths(prev => ({ ...prev, [index]: v }))}
                        >
                          <SelectTrigger className="w-[180px] h-11 text-sm border-2 border-primary/50 hover:border-primary bg-background rounded-xl font-semibold shadow-sm focus:ring-primary/30">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BERTHS.map(b => <SelectItem key={b} value={b} className="text-sm py-2">{b}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {isChartNotPrepared && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Coach (optional)</label>
                  <Input value={manualCoach} onChange={e => setManualCoach(e.target.value.toUpperCase())} placeholder="e.g. B1" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Seat (optional)</label>
                  <Input value={manualSeat} onChange={e => setManualSeat(e.target.value)} type="number" placeholder="e.g. 23" />
                </div>
              </div>
            )}

            <div className="pt-2">
              <label className="text-sm font-medium block mb-1.5">Notes (optional)</label>
              <Textarea 
                value={notes} 
                onChange={e => setNotes(e.target.value)} 
                placeholder="e.g. Travelling with elderly parent, prefer lower berth" 
                rows={2} 
              />
            </div>

            <div className="pt-4 pb-10">
              <Button 
                onClick={submit} 
                disabled={submitting || selectedIndexes.size === 0} 
                className="w-full bg-[#f97316] hover:bg-[#ea580c] text-white"
                size="lg"
              >
                {submitting ? "Posting..." : `Post request for ${selectedIndexes.size} passenger${selectedIndexes.size === 1 ? "" : "s"}`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
