import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { QrCode, Image as ImageIcon, ArrowLeft, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { OCRTicketScanner, type ExtractedTicket } from "./OCRTicketScanner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { addCustomStation, addCustomTrain, splitStationLabel } from "@/lib/custom-data";

export type VerifiedPassenger = {
  name: string;
  age?: string;
  gender?: string;
  coach?: string;
  seat?: string;
  berth?: string;
  bookingStatus?: string;
  currentStatus?: string;
  statusType?: string;
};

export type VerifiedTicket = {
  train_number: string;
  train_name: string;
  journey_date: string;
  boarding_station: string;
  destination_station: string;
  coach_number: string;
  seat_number: string;
  current_berth?: string;
  passenger_name?: string;
  passengers?: VerifiedPassenger[];
  selected_passengers?: VerifiedPassenger[];
  verification_status: "ocr";
  verification_hash: string;
  arrival_date?: string;
  arrival_time?: string;
  pnr?: string;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onVerified: (data: VerifiedTicket) => void;
}

type Step = "scan" | "success";

async function sha256(input: string) {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function normalizeDate(d: string): string | undefined {
  if (!d) return undefined;
  const s = d.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) return s.replace(/\//g, "-");
  const m = s.match(/^(\d{2})[-/](\d{2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return undefined;
}

const parseSeatStatus = (status: string) => {
  const s = (status || "").trim();
  const parts = s.split("/").map(p => p.trim()).filter(Boolean);
  const statusType = (parts[0] || "UNKNOWN").toUpperCase();
  const isConfirmed = statusType === "CNF";
  let coach = "", seat = "", berth = "";
  if (parts.length >= 4) {
    coach = parts[1] || "";
    seat = parts[2] || "";
    berth = parts.slice(3).join(" ");
  } else if (parts.length === 3) {
    coach = parts[1] || "";
    seat = parts[2] || "";
  }
  return { coach, seat, berth, isConfirmed, statusType };
};

const parseFromJSON = (json: any) => {
  const seen = new Set<string>();
  const passengers: any[] = [];
  for (const [i, p] of (json.passengers || []).entries()) {
    const status = p.currentStatus || p.bookingStatus || p.status || "";
    const { coach, seat, berth, isConfirmed, statusType } = parseSeatStatus(status);
    const name = p.name || p.passengerName || `Passenger ${i + 1}`;
    const key = `${name}|${p.age || ""}|${coach}|${seat}`.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    passengers.push({
      name,
      age: String(p.age || ""),
      gender: p.gender === "M" ? "Male" : p.gender === "F" ? "Female" : (p.gender || ""),
      coach, seat, berth, bookingStatus: p.bookingStatus || "", currentStatus: status, isConfirmed, statusType,
    });
  }
  if (passengers.length === 0) {
    passengers.push({ name: "Passenger 1", coach: "", seat: "", berth: "", isConfirmed: true, statusType: "CNF" });
  }
  return {
    pnr: json.pnr || json.pnrNumber || "",
    trainNumber: json.trainNo || json.trainNumber || json.train_no || "",
    trainName: json.trainName || json.train_name || "",
    journeyDate: json.doj || json.journeyDate || json.date || "",
    boardingStation: json.boardingStation || json.from || json.fromStation || "",
    destinationStation: json.destinationStation || json.to || json.toStation || "",
    travelClass: json.class || json.travelClass || json.coach_class || "",
    quota: json.quota || "", passengers, parseError: false,
  };
};

const parsePositionalPipe = (raw: string) => {
  console.log("[RAILSWAP-DEBUG] Raw QR string:", raw);
  const parts = raw.split("|").map(s => s.trim());
  
  const pnr = parts[0] || "";
  const trainNumber = parts[1] || "";
  const trainName = parts[2] || "";
  const journeyDate = parts[3] || "";
  const boardingStation = parts[4] || "";
  const destinationStation = parts[5] || "";
  const travelClass = parts[6] || "";
  const quota = parts[7] || "";

  console.log("[RAILSWAP-DEBUG] Parsed fields:", { pnr, trainNumber, trainName, journeyDate, boardingStation, destinationStation, travelClass, quota });

  const passengers: any[] = [];
  let i = 8;
  
  while (i < parts.length) {
    const name = parts[i];
    if (!name) {
      i++;
      continue;
    }
    
    if (/^[A-Z][A-Z\s.']{1,30}$/i.test(name) && /^\d{1,3}$/.test(parts[i+1] || "")) {
      const age = parts[i+1];
      const genderRaw = parts[i+2] || "";
      const gender = genderRaw.toUpperCase() === "M" ? "Male" : genderRaw.toUpperCase() === "F" ? "Female" : genderRaw;
      
      let coach = "";
      let seat = "";
      let berth = "";
      let statusType = "CNF";
      let isConfirmed = true;
      let currentStatus = "";
      
      const isNameAndAge = (idx: number) => parts[idx] && /^[A-Z][A-Z\s.']{1,30}$/i.test(parts[idx]) && /^\d{1,3}$/.test(parts[idx+1] || "");
      
      let skip = 5;
      let p3 = parts[i+3] || "";
      
      if (p3.includes("/")) {
        skip = 4;
      } else if (isNameAndAge(i + 9)) {
        skip = 9;
      } else if (isNameAndAge(i + 6)) {
        skip = 6;
      } else if (isNameAndAge(i + 5)) {
        skip = 5;
      } else {
        const remaining = parts.length - i;
        if (remaining === 9) skip = 9;
        else if (remaining === 6) skip = 6;
        else if (remaining === 4 && p3.includes("/")) skip = 4;
        else skip = remaining >= 5 ? 5 : remaining;
      }

      if (skip === 4) {
        const sp = p3.split("/");
        statusType = sp[0] || "";
        coach = sp[1] || "";
        seat = sp[2] || "";
        berth = sp[3] || "";
        currentStatus = p3;
      } else if (skip === 9) {
        coach = parts[i+3] || "";
        seat = parts[i+4] || "";
        berth = parts[i+5] || "";
        currentStatus = parts[i+7] || "";
        statusType = parts[i+8] || "CNF";
      } else if (skip === 6) {
        currentStatus = parts[i+3] || "";
        statusType = (currentStatus.match(/^[A-Z]+/i) || ["CNF"])[0];
        coach = parts[i+4] || "";
        seat = parts[i+5] || "";
      } else {
        // skip === 5
        currentStatus = parts[i+4] || "";
        statusType = (currentStatus.match(/^[A-Z]+/i) || ["CNF"])[0];
      }

      const mapBerth = (v: string) => {
        const up = v.toUpperCase();
        if(up === "LB") return "Lower";
        if(up === "MB") return "Middle";
        if(up === "UB") return "Upper";
        if(up === "SL") return "Side Lower";
        if(up === "SU") return "Side Upper";
        return v;
      };
      berth = mapBerth(berth);

      if (!/^(CNF|RAC)/i.test(statusType)) {
        isConfirmed = false;
      }

      const passenger = {
        name, age, gender, coach, seat, berth, currentStatus, isConfirmed, statusType
      };
      passengers.push(passenger);
      console.log("[RAILSWAP-DEBUG] Found passenger block:", passenger);
      
      i += skip;
    } else {
      i++;
    }
  }

  return { pnr, trainNumber, trainName, journeyDate, boardingStation, destinationStation, travelClass, quota, passengers, parseError: !trainNumber && !pnr };
};

const parseLabeledPipe = (raw: string) => {
  const pairs: Record<string, string> = {};
  for (const seg of raw.split("|")) {
    const idx = seg.indexOf(":");
    if (idx !== -1) {
      const key = seg.substring(0, idx).trim().toLowerCase().replace(/[\s.]/g, "");
      pairs[key] = seg.substring(idx + 1).trim();
    }
  }
  const txnId = pairs["txnid"] || pairs["transactionid"] || "";
  const pnr = pairs["pnrno"] || pairs["pnr"] || pairs["pnrnumber"] || (raw.match(/\b(\d{10})\b/) || [])[1] || "";
  const trainMatch = raw.match(/(\d{4,5})[\/\s]+([A-Z][A-Z0-9\s]+(?:EXP(?:RESS)?|MAIL|SF|RAJDHANI|SHATABDI|DURONTO|INTERCITY|PASSENGER))/i);
  const trainNumber = pairs["trainno"] || pairs["train"] || (trainMatch ? trainMatch[1] : "");
  const trainName = pairs["trainname"] || (trainMatch ? trainMatch[2].trim() : "");
  const journeyDate = pairs["date"] || pairs["journeydate"] || pairs["doj"] || (raw.match(/(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4}|\d{1,2}[-\/]\d{2}[-\/]\d{4})/) || [])[1] || "";
  const boardingStation = pairs["boardingat"] || pairs["boardingstation"] || pairs["from"] || "";
  const destinationStation = pairs["to"] || pairs["destinationstation"] || pairs["destination"] || "";
  const travelClass = pairs["class"] || pairs["travelclass"] || "";
  const passengers: any[] = [];
  const nameMatches = Array.from(raw.matchAll(/Passenger Name[:\s]+([A-Z][A-Z\s]+?)(?:\||$)/gi));
  const statusMatches = Array.from(raw.matchAll(/Status[:\s]*((?:CNF|WL|RAC|RLWL|PQWL|GNWL)[^|]*?)(?:\||Passenger|$)/gi));
  const ageMatches = Array.from(raw.matchAll(/Age[:\s]*(\d+)/gi));
  const genderMatches = Array.from(raw.matchAll(/Gender[:\s]*(Male|Female|M|F)/gi));
  for (let i = 0; i < nameMatches.length; i++) {
    const statusRaw = statusMatches[i] ? statusMatches[i][1].trim() : "";
    const { coach, seat, berth, isConfirmed, statusType } = parseSeatStatus(statusRaw);
    passengers.push({ name: nameMatches[i][1].trim(), age: ageMatches[i] ? ageMatches[i][1] : "", gender: genderMatches[i] ? (genderMatches[i][1] === "M" ? "Male" : genderMatches[i][1] === "F" ? "Female" : genderMatches[i][1]) : "", coach, seat, berth, currentStatus: statusRaw, isConfirmed, statusType });
  }
  if (!trainNumber && !pnr && txnId) {
    return { parseError: true, errorMessage: "This QR is a payment receipt, not a ticket QR. Please use 'Upload Ticket Image' instead.", passengers: [] as any[] };
  }
  if (passengers.length === 0) passengers.push({ name: pairs["passengername"] || "Passenger 1", age: "", gender: "", coach: "", seat: "", berth: "", isConfirmed: true, statusType: "CNF" });
  return { pnr, trainNumber, trainName, journeyDate, boardingStation, destinationStation, travelClass, quota: pairs["quota"] || "", passengers, parseError: !trainNumber && !pnr };
};

const parseIRCTCData = (rawData: string): any => {
  if (!rawData?.trim()) return { parseError: true, errorMessage: "Empty QR data", passengers: [] };
  const raw = rawData.trim();
  try {
    const json = JSON.parse(raw);
    if (json && (json.pnr || json.trainNo || json.trainNumber)) return parseFromJSON(json);
  } catch { /* not json */ }
  try {
    const json = JSON.parse(atob(raw));
    if (json && (json.pnr || json.trainNo)) return parseFromJSON(json);
  } catch { /* not base64 json */ }
  if (raw.includes("|")) {
    const parts = raw.split("|").map(s => s.trim());
    if (parts.length >= 8 && /^\d{10}$/.test(parts[0]) && /^\d{4,5}$/.test(parts[1])) {
      return parsePositionalPipe(raw);
    }
    return parseLabeledPipe(raw);
  }
  const pnr = (raw.match(/\b(\d{10})\b/) || [])[1] || "";
  const trainMatch = raw.match(/(\d{4,5})[\/\s]+([A-Z][A-Z0-9\s]+(?:EXP(?:RESS)?|MAIL|SF|RAJDHANI|SHATABDI|DURONTO))/i);
  const trainNumber = trainMatch ? trainMatch[1] : ((raw.match(/(?:Train No|Train)[.:\s\/]+([0-9]{4,5})/i) || [])[1] || "");
  const trainName = trainMatch ? trainMatch[2].trim() : "";
  const journeyDate = (raw.match(/(\d{1,2}[-\/][A-Za-z]{3}[-\/]\d{4}|\d{1,2}[-\/]\d{2}[-\/]\d{4})/) || [])[1] || "";
  const boardingStation = ((raw.match(/(?:Boarding\s*At|Boarding|From)[:\s]+([A-Z][A-Z\s()]+?)(?:\n|To\b|Arrival|$)/i) || [])[1] || "").trim();
  const destinationStation = ((raw.match(/\bTo\b[:\s]+([A-Z][A-Z\s()]+?)(?:\n|Arrival|Class|$)/i) || [])[1] || "").trim();
  const classMatch = raw.match(/(?:SLEEPER CLASS|AC\s*[123]\s*TIER|CHAIR CAR|FIRST CLASS|SECOND SITTING)\s*\(([A-Z0-9]+)\)/i);
  const travelClass = classMatch ? classMatch[1] : ((raw.match(/Class[:\s]+([A-Z0-9]{1,3})\b/i) || [])[1] || "");
  const passengers: any[] = [];
  const pp = /(\d+)\.\s+([A-Z][A-Z\s]+?)\s+(\d{1,3})\s+([MF])\s+(CNF|WL|RAC|RLWL|PQWL|GNWL)[\/\s]([A-Z0-9\/\s]*)/gi;
  let m;
  while ((m = pp.exec(raw)) !== null) {
    const { coach, seat, berth, isConfirmed, statusType } = parseSeatStatus(m[5] + "/" + m[6].trim());
    passengers.push({ name: m[2].trim(), age: m[3], gender: m[4] === "M" ? "Male" : "Female", coach, seat, berth, isConfirmed, statusType });
  }
  if (passengers.length === 0 && (trainNumber || pnr)) {
    passengers.push({ name: "Passenger 1", coach: "", seat: "", berth: "", isConfirmed: true, statusType: "CNF" });
  }
  return { pnr, trainNumber, trainName, journeyDate, boardingStation, destinationStation, travelClass, quota: "", passengers, parseError: !trainNumber && !pnr };
};

function parseQrText(raw: string): ExtractedTicket {
  const d = parseIRCTCData(raw);
  const first = d.passengers?.[0];
  const statusType = (first?.statusType || "UNKNOWN").toUpperCase();
  let ticket_status: ExtractedTicket["ticket_status"] = "UNKNOWN";
  if (statusType === "CNF") ticket_status = "CNF";
  else if (statusType === "WL" || /WL$/.test(statusType)) ticket_status = "WL";
  else if (statusType === "RAC") ticket_status = "RAC";
  return {
    raw,
    train_number: d.trainNumber || undefined,
    train_name: d.trainName || undefined,
    journey_date: normalizeDate(d.journeyDate) || d.journeyDate || undefined,
    boarding_station: d.boardingStation || undefined,
    destination_station: d.destinationStation || undefined,
    coach_number: first?.coach || undefined,
    seat_number: first?.seat || undefined,
    current_berth: first?.berth || undefined,
    passengers: d.passengers || [],
    ticket_status,
    pnr: d.pnr || undefined,
  };
}

function statusBadgeClass(s?: string) {
  const t = (s || "").toUpperCase();
  if (t === "CNF" || t === "CONFIRMED") return "bg-success/15 text-success";
  if (t === "RAC") return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
  if (t.includes("WL")) return "bg-destructive/15 text-destructive";
  return "bg-muted text-muted-foreground";
}

function isPastDate(d?: string) {
  if (!d) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(d) < today;
}

export function JourneyVerification({ open, onOpenChange, onVerified }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("scan");
  const [extracted, setExtracted] = useState<ExtractedTicket | null>(null);
  const [hash, setHash] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [selectedIdxs, setSelectedIdxs] = useState<number[]>([]);

  useEffect(() => {
    if (!open) {
      setStep("scan"); setExtracted(null); setError(null); setSelectedIdxs([]);
    }
  }, [open]);

  const validate = (data: ExtractedTicket) => {
    if (!data.journey_date || !data.train_number) {
      return "Uploaded image has not clarity. Please upload a clear image.";
    }
    if (data.journey_date && isPastDate(data.journey_date)) {
      return "This journey has already completed. Seat exchange not allowed.";
    }
    if (data.ticket_status === "CANCELLED") {
      return "Seat exchange is not allowed for cancelled tickets.";
    }
    if (data.ticket_status !== "CNF") {
      return "Seat exchange is available only for confirmed tickets.";
    }
    return null;
  };

  const handleScanned = async (raw: string, src: "qr" | "ocr", parsed?: ExtractedTicket) => {
    const data = parsed ?? parseQrText(raw);
    const err = validate(data);
    if (err) {
      setError(err);
      toast.error(err);
      return;
    }
    setExtracted(data);
    setError(null);
    
    // Automatically confirm and emit the data to the parent without intermediate steps
    confirmDirect(data, src);
  };

  const confirmDirect = async (data: ExtractedTicket) => {
    setChecking(true);
    try {
      if (!user) return;
      
      const uniqueTicketId = data.pnr || `${data.train_number}|${data.journey_date}|${data.passengers.map(p=>p.name).join(",")}`;
      const verification_hash = await sha256(uniqueTicketId);

      // Global duplicate check across all users
      const { data: dup } = await supabase
        .from("exchange_requests")
        .select("user_id")
        .eq("verification_hash", verification_hash)
        .maybeSingle();
        
      if (dup) {
        const msg = dup.user_id === user.id 
          ? "You have already created a swap request using this ticket." 
          : "This ticket has already been claimed by another user.";
        setError(msg);
        toast.error(msg);
        setChecking(false);
        return;
      }
      
      if (data.train_number) {
        addCustomTrain({
          number: data.train_number,
          name: data.train_name || data.train_number,
          stations: [data.boarding_station, data.destination_station].filter(Boolean) as string[],
        });
      }
      for (const s of [data.boarding_station, data.destination_station]) {
        if (s) addCustomStation(splitStationLabel(s));
      }

      setHash(verification_hash);
      setStep("success");
      
      const verified: VerifiedTicket = {
        train_number: data.train_number!,
        train_name: data.train_name || "Verified Train",
        journey_date: data.journey_date!,
        boarding_station: data.boarding_station || "",
        destination_station: data.destination_station || "",
        coach_number: data.coach_number || "",
        seat_number: data.seat_number || "",
        current_berth: data.current_berth,
        passengers: data.passengers as VerifiedPassenger[],
        selected_passengers: [],
        verification_status: `ocr:${data.pnr || ""}` as "ocr",
        verification_hash,
        departure_time: data.departure_time,
        arrival_date: data.arrival_date,
        arrival_time: data.arrival_time,
        pnr: data.pnr,
      };
      
      setTimeout(() => { onVerified(verified); onOpenChange(false); }, 700);
    } catch (e: any) {
      toast.error(e?.message || "Verification failed");
    } finally {
      setChecking(false);
    }
  };

  const togglePassenger = (i: number) => {
    setSelectedIdxs(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]);
  };

  const confirm = async () => {
    if (!extracted || !user) return;
    setChecking(true);
    try {
      const idxs = selectedIdxs.length ? selectedIdxs : [0];
      const primary = extracted.passengers[idxs[0]] ?? extracted.passengers[0];
      const seat = primary?.seat ?? extracted.seat_number ?? "";
      const coach = primary?.coach ?? extracted.coach_number ?? "";
      const verification_hash = await sha256(
        `${extracted.train_number}|${extracted.journey_date}|${coach}|${seat}|${user.id}`
      );

      // Duplicate check
      const { data: dup } = await supabase
        .from("exchange_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("verification_hash", verification_hash)
        .maybeSingle();
      if (dup) {
        const m = "You already have an active request for this seat.";
        setError(m); toast.error(m); setChecking(false); return;
      }

      // Persist scanned train/stations so they're picker-selectable next time too.
      if (extracted.train_number) {
        addCustomTrain({
          number: extracted.train_number,
          name: extracted.train_name || extracted.train_number,
          stations: [extracted.boarding_station, extracted.destination_station].filter(Boolean) as string[],
        });
      }
      for (const s of [extracted.boarding_station, extracted.destination_station]) {
        if (s) addCustomStation(splitStationLabel(s));
      }

      setHash(verification_hash);
      setStep("success");
      const selected = idxs.map(i => extracted.passengers[i]).filter(Boolean) as VerifiedPassenger[];
      const verified: VerifiedTicket = {
        train_number: extracted.train_number!,
        train_name: extracted.train_name || "Verified Train",
        journey_date: extracted.journey_date!,
        boarding_station: extracted.boarding_station || "",
        destination_station: extracted.destination_station || "",
        coach_number: coach,
        seat_number: seat,
        current_berth: primary?.berth || extracted.current_berth,
        passenger_name: primary?.name,
        passengers: extracted.passengers as VerifiedPassenger[],
        selected_passengers: selected,
        verification_status: "ocr",
        verification_hash,
        departure_time: extracted.departure_time,
        arrival_date: extracted.arrival_date,
        arrival_time: extracted.arrival_time,
      };
      // Slight delay so the success state is visible
      setTimeout(() => { onVerified(verified); onOpenChange(false); }, 700);
    } catch (e: any) {
      toast.error(e?.message || "Verification failed");
    } finally {
      setChecking(false);
    }
  };

  const Header = useMemo(() => (
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <ShieldCheck className="size-5 text-primary" /> Verify your journey
      </DialogTitle>
      <DialogDescription>Verify your ticket once — we use it to match you with trusted passengers.</DialogDescription>
    </DialogHeader>
  ), []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        {Header}

        {step === "scan" && (
          <div className="space-y-3 mt-2">
            <OCRTicketScanner
              onExtractSuccess={(data) => handleScanned(data.raw, "ocr", data)}
              onExtractError={(e) => { setError(e); toast.error(e); }}
            />
            {error && <ErrorRow text={error} />}
          </div>
        )}

        {/* Removed passenger and review steps */}

        {step === "success" && (
          <div className="py-8 flex flex-col items-center text-center gap-2">
            <CheckCircle2 className="size-12 text-success" />
            <p className="font-semibold">Ticket verified</p>
            <p className="text-xs text-muted-foreground">Filling your request form…</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-3" /> Back
    </button>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function ErrorRow({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-destructive/10 text-destructive text-xs px-3 py-2 flex items-start gap-2">
      <AlertCircle className="size-4 shrink-0 mt-0.5" /> <span>{text}</span>
    </div>
  );
}
