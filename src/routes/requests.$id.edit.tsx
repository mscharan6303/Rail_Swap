import { createFileRoute, Navigate, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrainCombobox, StationCombobox, getTrainByNumber, type Train } from "@/components/TrainPickers";
import { Skeleton } from "@/components/Skeleton";

export const Route = createFileRoute("/requests/$id/edit")({
  head: () => ({ meta: [{ title: "Edit request — RailSwap" }] }),
  component: EditRequest,
});

const BERTHS = ["Lower", "Middle", "Upper", "Side Lower", "Side Upper", "Window"];

function EditRequest() {
  const { id } = Route.useParams();
  const { user, loading: aLoad } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [train, setTrain] = useState<Train | null>(null);
  const [form, setForm] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("exchange_requests").select("*").eq("id", id).maybeSingle();
      if (!data) { setLoading(false); return; }
      if (data.user_id !== user.id) { toast.error("Not your request"); router.navigate({ to: "/requests" }); return; }
      const t = getTrainByNumber(data.train_number) ?? null;
      setTrain(t);
      setForm({
        train_number: data.train_number, train_name: data.train_name,
        journey_date: data.journey_date, boarding_station: data.boarding_station,
        destination_station: data.destination_station, coach_number: data.coach_number,
        seat_number: data.seat_number, current_berth: data.current_berth,
        desired_berth: data.desired_berth, gender_preference: data.gender_preference ?? "any",
        notes: data.notes ?? "",
      });
      setLoading(false);
    })();
  }, [id, user, router]);

  const destStations = useMemo(() => {
    if (!train || !form?.boarding_station) return [];
    const idx = train.stations.indexOf(form.boarding_station);
    return idx >= 0 ? train.stations.slice(idx + 1) : [];
  }, [train, form?.boarding_station]);

  if (aLoad || loading || !form) return <AppShell><div className="max-w-2xl mx-auto p-6"><Skeleton className="h-96 rounded-3xl" /></div></AppShell>;
  if (!user) return <Navigate to="/login" />;

  const set = (k: string, v: string) => setForm((s: any) => ({ ...s, [k]: v }));

  const onTrainSelect = (t: Train) => {
    setTrain(t);
    setForm((s: any) => ({ ...s, train_number: t.number, train_name: t.name, boarding_station: "", destination_station: "" }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.boarding_station || !form.destination_station) { toast.error("Pick boarding and destination"); return; }
    if (form.boarding_station === form.destination_station) { toast.error("Boarding and destination cannot be same"); return; }
    setSaving(true);
    const { error } = await supabase.from("exchange_requests").update(form).eq("id", id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Request updated");
    router.navigate({ to: "/requests/$id", params: { id } });
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-5">Edit request</h1>
        <form onSubmit={submit} className="space-y-5 rounded-3xl border bg-card p-5 md:p-6 shadow-elegant">
          <Field label="Train">
            <TrainCombobox value={train ? { number: train.number, name: train.name } : undefined} onSelect={onTrainSelect} />
          </Field>
          <Field label="Journey date"><Input type="date" value={form.journey_date} onChange={e => set("journey_date", e.target.value)} /></Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Boarding">
              <StationCombobox stations={train?.stations ?? []} value={form.boarding_station} onSelect={s => setForm((f: any) => ({ ...f, boarding_station: s, destination_station: "" }))} disabled={!train} />
            </Field>
            <Field label="Destination">
              <StationCombobox stations={destStations} value={form.destination_station} onSelect={s => set("destination_station", s)} disabled={!form.boarding_station} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Coach"><Input value={form.coach_number} onChange={e => set("coach_number", e.target.value.toUpperCase())} /></Field>
            <Field label="Seat"><Input value={form.seat_number} onChange={e => set("seat_number", e.target.value)} inputMode="numeric" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Current berth">
              <Select value={form.current_berth} onValueChange={v => set("current_berth", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{BERTHS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Desired berth">
              <Select value={form.desired_berth} onValueChange={v => set("desired_berth", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{[...BERTHS, "Any"].map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Notes">
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} rows={3} maxLength={300} />
          </Field>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => router.history.back()}>Cancel</Button>
            <Button type="submit" disabled={saving} className="flex-1 bg-gradient-accent text-accent-foreground">{saving ? "Saving…" : "Save changes"}</Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
