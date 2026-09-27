import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Train as TrainIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import trainsData from "@/data/trains.json";
import stationsData from "@/data/stations.json";
import { getCustomStations, getCustomTrains } from "@/lib/custom-data";

export type Train = { number: string; name: string; stations: string[] };

const BUILTIN_TRAINS = trainsData as Train[];
const BUILTIN_STATIONS: { stnCode: string; stnName: string }[] = ((stationsData as any).stations || []).map(
  (s: { stnCode: string; stnName: string }) => ({ stnCode: s.stnCode, stnName: s.stnName }),
);

function stationLabel(s: { stnCode: string; stnName: string }) {
  return `${s.stnName} (${s.stnCode})`;
}

function getAllTrains(): Train[] {
  const map = new Map<string, Train>();
  for (const t of BUILTIN_TRAINS) map.set(t.number, t);
  for (const t of getCustomTrains()) {
    const ex = map.get(t.number);
    map.set(t.number, ex
      ? { ...ex, stations: Array.from(new Set([...(ex.stations || []), ...(t.stations || [])])) }
      : t);
  }
  return Array.from(map.values());
}

function getAllStationLabels(): string[] {
  const map = new Map<string, string>();
  for (const s of BUILTIN_STATIONS) map.set(s.stnCode.toUpperCase(), stationLabel(s));
  for (const s of getCustomStations()) {
    const k = s.stnCode.toUpperCase();
    if (!map.has(k)) map.set(k, stationLabel(s));
  }
  return Array.from(map.values());
}

export function getTrainByNumber(number: string): Train | undefined {
  return getAllTrains().find(t => t.number === number);
}

export function TrainCombobox({
  value,
  onSelect,
  disabled,
}: {
  value?: { number: string; name: string };
  onSelect: (t: Train) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [trains, setTrains] = useState<Train[]>(() => getAllTrains());

  useEffect(() => { if (open) setTrains(getAllTrains()); }, [open]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return trains;
    return trains.filter(t =>
      t.number.toLowerCase().includes(q) || t.name.toLowerCase().includes(q),
    );
  }, [trains, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" disabled={disabled} className="w-full justify-between font-normal">
          <span className="flex items-center gap-2 truncate">
            <TrainIcon className="size-4 shrink-0 opacity-70" />
            {value?.number ? <span className="truncate">#{value.number} · {value.name}</span> : <span className="text-muted-foreground">Search train by number or name…</span>}
          </span>
          <ChevronsUpDown className="size-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Type number or name…" value={query} onValueChange={setQuery} />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>No train found.</CommandEmpty>
            <CommandGroup>
              {filtered.map(t => (
                <CommandItem
                  key={t.number}
                  value={`${t.number} ${t.name}`}
                  onSelect={() => { onSelect(t); setOpen(false); setQuery(""); }}
                >
                  <Check className={cn("size-4", value?.number === t.number ? "opacity-100" : "opacity-0")} />
                  <span className="font-medium">#{t.number}</span>
                  <span className="text-muted-foreground truncate">{t.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function StationCombobox({
  stations,
  value,
  onSelect,
  placeholder = "Select station",
  disabled,
}: {
  stations: string[];
  value?: string;
  onSelect: (s: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [allStations, setAllStations] = useState<string[]>(() => getAllStationLabels());

  useEffect(() => { if (open) setAllStations(getAllStationLabels()); }, [open]);

  const route = useMemo(() => stations || [], [stations]);
  const others = useMemo(() => {
    const set = new Set(route);
    return allStations.filter(s => !set.has(s));
  }, [route, allStations]);

  const q = query.toLowerCase().trim();
  const matchFn = (s: string) => !q || s.toLowerCase().includes(q);
  const routeFiltered = useMemo(() => route.filter(matchFn), [route, q]);
  const othersFiltered = useMemo(() => others.filter(matchFn), [others, q]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" disabled={disabled} className="w-full justify-between font-normal">
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value || placeholder}</span>
          <ChevronsUpDown className="size-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[260px]" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search by name or code…" value={query} onValueChange={setQuery} />
          <CommandList className="max-h-[320px]">
            <CommandEmpty>No station.</CommandEmpty>
            {routeFiltered.length > 0 && (
              <CommandGroup heading="Train route">
                {routeFiltered.map(s => (
                  <CommandItem key={`r-${s}`} value={s} onSelect={() => { onSelect(s); setOpen(false); setQuery(""); }}>
                    <Check className={cn("size-4", value === s ? "opacity-100" : "opacity-0")} />
                    {s}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {othersFiltered.length > 0 && (
              <CommandGroup heading="All stations">
                {othersFiltered.map(s => (
                  <CommandItem key={`a-${s}`} value={s} onSelect={() => { onSelect(s); setOpen(false); setQuery(""); }}>
                    <Check className={cn("size-4", value === s ? "opacity-100" : "opacity-0")} />
                    {s}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
