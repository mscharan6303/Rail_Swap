import { createFileRoute, Navigate, useRouter } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchSelect } from "@/components/SearchSelect";
import { TrainOption, buildTrainOptions, getRouteStationsForTrain } from "@/lib/train-route";

export const Route = createFileRoute("/edit/$id")({
  head: () => ({ meta: [{ title: "Edit request — RailSwap" }] }),
  component: CreatePage,
});

const BERTHS = ["Lower", "Middle", "Upper", "Side Lower", "Side Upper", "Window"];

const schema = z.object({
  train_number: z.string().regex(/^\d{4,5}$/, "Train number must be 4-5 digits"),
  train_name: z.string().min(2).max(80),
  journey_date: z.string().refine(v => new Date(v) >= new Date(new Date().toDateString()), "Date must be today or later"),
  boarding_station: z.string().min(2).max(60),
  destination_station: z.string().min(2).max(60),
  coach_number: z.string().min(1).max(8),
  seat_number: z.string().regex(/^\d{1,3}$/, "Enter a valid seat number"),
  current_berth: z.string(),
  desired_berth: z.string(),
  gender_preference: z.enum(["any", "male", "female"]),
  notes: z.string().max(300).optional(),
});

function CreatePage() {
  const { user, loading: authLoading } = useAuth();
  const { id } = Route.useParams();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    train_number: "", train_name: "", journey_date: new Date().toISOString().slice(0,10),
    boarding_station: "", destination_station: "", coach_number: "", seat_number: "",
    current_berth: "Lower", desired_berth: "Any", gender_preference: "any" as "any" | "male" | "female", notes: "",
  });
  const set = (k: keyof typeof form, v: string) => setForm(s => ({ ...s, [k]: v }));

  const [trains, setTrains] = useState<TrainOption[]>([]);
  const [allRows, setAllRows] = useState<any[]>([]);

  useEffect(() => {
    let mounted = true;
    import("@/data/trains.json").then((m) => {
      if (!mounted) return;
      setAllRows(m.default);
      setTrains(buildTrainOptions(m.default));
    });
    return () => { mounted = false; };
  }, []);

  const routeStations = useMemo(() => {
    if (!form.train_number || !allRows.length) return [];
    return getRouteStationsForTrain(allRows, form.train_number);
  }, [form.train_number, allRows]);

  const destStations = useMemo(() => {
    if (!form.boarding_station) return [];
    const bIndex = routeStations.findIndex(s => s.name === form.boarding_station);
    if (bIndex === -1) return [];
    return routeStations.slice(bIndex + 1);
  }, [routeStations, form.boarding_station]);

  useEffect(() => {
    if (!id || !user) return;
    supabase.from("exchange_requests").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      if (data) {
        setForm({
          train_number: data.train_number,
          train_name: data.train_name,
          journey_date: data.journey_date,
          boarding_station: data.boarding_station,
          destination_station: data.destination_station,
          coach_number: data.coach_number,
          seat_number: data.seat_number,
          current_berth: data.current_berth,
          desired_berth: data.desired_berth,
          notes: data.notes ?? "",
          gender_preference: (data.gender_preference as "any" | "male" | "female") ?? "any",
        });
      }
    });
  }, [id, user]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/login" />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSubmitting(true);

    const { error } = await supabase.from("exchange_requests").update({ ...parsed.data, updated_at: new Date().toISOString() }).eq("id", id);
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Request updated!");
    router.navigate({ to: "/requests/$id", params: { id } });
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold">Edit request</h1>
        <p className="text-sm text-muted-foreground mb-6">Update your journey details.</p>

        <form onSubmit={submit} className="space-y-5 rounded-3xl border bg-card p-5 md:p-6 shadow-elegant">
          <Field label="Train">
            <SearchSelect
              options={trains}
              value={form.train_number ? `${form.train_number} - ${form.train_name}` : ""}
              onChange={() => {}}
              onSelectFull={(t) => {
                setForm(s => ({ ...s, train_number: t.train_number, train_name: t.train_name, boarding_station: "", destination_station: "" }));
              }}
              placeholder="Search by train number or name..."
              getDisplayValue={(t) => t ? `${t.train_number} - ${t.train_name}` : ""}
              getSearchText={(t) => `${t.train_number} ${t.train_name}`}
              renderItem={(t) => `${t.train_number} - ${t.train_name}`}
            />
          </Field>
          <Field label="Journey date"><Input type="date" value={form.journey_date} onChange={e => set("journey_date", e.target.value)} min={new Date().toISOString().slice(0,10)} /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Boarding">
              <SearchSelect<{ code: string; name: string }>
                options={routeStations}
                value={form.boarding_station}
                onChange={(v) => {
                  setForm(s => ({ ...s, boarding_station: v, destination_station: "" }));
                }}
                placeholder="Select station"
                getDisplayValue={(s) => s?.name ?? ""}
                getSearchText={(s) => `${s.code} ${s.name}`}
                renderItem={(s) => `${s.name} (${s.code})`}
              />
            </Field>
            <Field label="Destination">
              <SearchSelect<{ code: string; name: string }>
                options={destStations}
                value={form.destination_station}
                onChange={(v) => set("destination_station", v)}
                placeholder="Select station"
                getDisplayValue={(s) => s?.name ?? ""}
                getSearchText={(s) => `${s.code} ${s.name}`}
                renderItem={(s) => `${s.name} (${s.code})`}
              />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Coach"><Input value={form.coach_number} onChange={e => set("coach_number", e.target.value.toUpperCase())} placeholder="B3" /></Field>
            <Field label="Seat"><Input value={form.seat_number} onChange={e => set("seat_number", e.target.value)} placeholder="32" inputMode="numeric" /></Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Current berth">
              <SelectField value={form.current_berth} onChange={v => set("current_berth", v)} options={BERTHS} />
            </Field>
            <Field label="Desired berth">
              <SelectField value={form.desired_berth} onChange={v => set("desired_berth", v)} options={[...BERTHS, "Any"]} />
            </Field>
          </div>
          <Field label="Gender preference">
            <SelectField value={form.gender_preference} onChange={v => set("gender_preference", v)} options={[
              { v: "any", l: "No preference" }, { v: "female", l: "Female only (Women safety)" }, { v: "male", l: "Male only" }
            ]} />
          </Field>
          <Field label="Notes (optional)">
            <Textarea value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Travelling with elderly parent, prefer lower berth…" rows={3} maxLength={300} />
          </Field>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={() => router.history.back()}>Cancel</Button>
            <Button type="submit" disabled={submitting} className="flex-1 bg-gradient-accent text-accent-foreground hover:opacity-90">
              {submitting ? "Updating…" : "Update request"}
            </Button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function SelectField({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: (string | { v: string; l: string })[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue /></SelectTrigger>
      <SelectContent>
        {options.map(o => {
          const v = typeof o === "string" ? o : o.v;
          const l = typeof o === "string" ? o : o.l;
          return <SelectItem key={v} value={v}>{l}</SelectItem>;
        })}
      </SelectContent>
    </Select>
  );
}
