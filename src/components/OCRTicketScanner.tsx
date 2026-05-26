import { useRef, useState } from "react";
import Tesseract from "tesseract.js";
import { Button } from "@/components/ui/button";
import { Loader2, Camera, Upload, X, ScanLine } from "lucide-react";

export type ExtractedTicket = {
  raw: string;
  train_number?: string;
  train_name?: string;
  journey_date?: string;
  coach_number?: string;
  seat_number?: string;
  boarding_station?: string;
  destination_station?: string;
  departure_time?: string;
  arrival_date?: string;
  arrival_time?: string;
  current_berth?: string;
  pnr?: string;
  passengers: { name: string; coach?: string; seat?: string; gender?: string; age?: string; berth?: string; bookingStatus?: string; currentStatus?: string; isConfirmed?: boolean; statusType?: string }[];
  ticket_status?: "CNF" | "WL" | "RAC" | "UNKNOWN";
};

interface Props {
  onExtractSuccess: (data: ExtractedTicket) => void;
  onExtractError?: (err: string) => void;
}

const MAX_DIM = 1600;

async function compressImage(file: File | Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((res) => canvas.toBlob(b => res(b!), "image/jpeg", 0.85));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function parseTicket(text: string): ExtractedTicket {
  let upper = text.toUpperCase();
  upper = upper.replace(/ELECTRONIC\s+RESERVATION\s+SLIP[\s\S]{0,20}?\(?\s*ERS\s*\)?/i, "ELECTRONIC RESERVATION SLIP");
  
  const train_number = upper.match(/\b\d{5}\b/)?.[0];
  const trainNameMatch = upper.match(/([A-Z][A-Z ]{2,40}?(EXPRESS|MAIL|RAJDHANI|SHATABDI|DURONTO|SUPERFAST))/);
  const train_name = trainNameMatch?.[1]?.trim();

  // BUG A - Date fixing
  let journey_date: string | undefined;
  const today = new Date();
  today.setHours(0,0,0,0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const isPrintDate = (dStr: string) => {
    const d = new Date(dStr);
    return d.getTime() === today.getTime() || d.getTime() === yesterday.getTime();
  };
  const isFuture = (dStr: string) => {
    return new Date(dStr).getTime() >= today.getTime();
  };

  const labels = ["DATE OF JOURNEY", "DOJ", "JOURNEY DATE", "TRAVEL DATE", "DATE OF TRAVEL"];
  const dateRegex = /\b(\d{2}[-/][A-Z]{3}[-/]\d{4}|\d{2}[-/]\d{2}[-/]\d{4}|202\d[-/]\d{2}[-/]\d{2})\b/gi;
  
  let labeledDate: string | undefined;
  for (const label of labels) {
    const idx = upper.indexOf(label);
    if (idx !== -1) {
      const slice = upper.substring(idx, idx + 60);
      const matches = [...slice.matchAll(dateRegex)];
      for (const m of matches) {
        let d = m[1];
        if (d) {
          if (!isPrintDate(d)) {
            if (/^\d{4}/.test(d)) d = d.replace(/\//g, "-");
            else if (/[A-Z]/i.test(d)) { /* 03-Jul-2026 */ d = d.replace(/\//g, "-"); }
            else { const [day, month, year] = d.split(/[-/]/); d = `${year}-${month}-${day}`; }
            labeledDate = d;
            break;
          }
        }
      }
      if (labeledDate) break;
    }
  }

  if (labeledDate) {
    journey_date = labeledDate;
  } else {
    // Look for first DD-Mon-YYYY that isn't today/yesterday (print date)
    const ddMonYyyyMatches = [...upper.matchAll(/\b(\d{2}[-/][A-Z]{3}[-/]\d{4})\b/gi)];
    for (const m of ddMonYyyyMatches) {
      let d = m[1].replace(/\//g, "-");
      if (!isPrintDate(d)) {
        journey_date = d;
        break;
      }
    }
  }

  // Passengers
  const rawPassengers: any[] = [];
  
  // Passenger table parsing regex:
  // Match across entire text to handle single-line OCR outputs and comma-separated SMS
  const passengerMatches = [...upper.matchAll(/([A-Z][A-Z\s.']{2,30})[\s,\-]+(\d{1,3})(?:[\s,\-]+(?:YRS|YEARS|Y))?[\s,\-]+(M|F|MALE|FEMALE)\b/g)];
  
  if (passengerMatches.length > 0) {
    for (let i = 0; i < passengerMatches.length; i++) {
      const match = passengerMatches[i];
      let pName = match[1].trim();
      // Clean up common headers accidentally caught
      pName = pName.replace(/^(?:NAME|PASSENGER|AGE|SEX|GENDER)\s*/i, "").trim();
      
      const age = match[2];
      const gender = match[3].startsWith("F") ? "female" : "male";
      
      // Look at text after this passenger, up to the next passenger (or end of string)
      const nextIndex = passengerMatches[i+1] ? passengerMatches[i+1].index : upper.length;
      const chunk = upper.substring(match.index + match[0].length, nextIndex);
      
      const coachMatch = chunk.match(/\b([A-Z]{1,2}\d{1,2})\b/);
      const seatMatch = chunk.match(/(?:SEAT|BERTH)\s*(?:NO\.?)?\s*(\d{1,3})/i) || chunk.match(/\b\d{1,3}\b(?!\s*(?:M|F|MALE|FEMALE|YEARS|YRS|KG|KM))/);
      
      let coach = coachMatch ? coachMatch[1] : undefined;
      let seat = seatMatch ? (seatMatch[1] !== age ? seatMatch[1] : undefined) : undefined;
      let berth: string | undefined;
      let pStatusType: string | undefined;
      
      const statusRegex = /(CNF|WL|RAC|RLWL|PQWL|GNWL)[\s/|*\-_]+([A-Z0-9]{1,4})[\s/|*\-_]+(\d{1,3})(?:[\s/|*\-_]+(LOWER|UPPER|MIDDLE|SIDE\s*LOWER|SIDE\s*UPPER|WINDOW|LB|UB|MB|SL|SU)\b)?/gi;
      const statusMatches = [...chunk.matchAll(statusRegex)];
      if (statusMatches.length > 0) {
        const lastMatch = statusMatches[statusMatches.length - 1];
        pStatusType = lastMatch[1].toUpperCase();
        if (lastMatch[2] !== "0") coach = lastMatch[2];
        if (lastMatch[3] !== "0") seat = lastMatch[3];
        if (lastMatch[4]) berth = lastMatch[4].trim();
      }
      
      if (!berth) {
        const bMatch = chunk.match(/(LOWER|UPPER|MIDDLE|SIDE\s*LOWER|SIDE\s*UPPER|WINDOW|LB|UB|MB|SL|SU)\b/i);
        if (bMatch) berth = bMatch[1].trim();
      }
      
      rawPassengers.push({ name: pName, age, gender, coach, seat, berth, statusType: pStatusType });
    }
  } else {
    // Add fallback matching ONLY if table regex missed EVERYTHING
    const coachSeatMatches = [...upper.matchAll(/\b([A-Z]{1,2}\d{1,2})[\s,\-/]+(\d{1,3})\b/g)];
    const ageGender = [...upper.matchAll(/\b(\d{1,2})[\s,\-]*(?:YRS|YEARS|Y)?[\s,\-]*(M|F|MALE|FEMALE)\b/g)];
    const names = [...upper.matchAll(/(?:NAME|PASSENGER)[:\s]+([A-Z][A-Z\s.']+)/g)];
    
    const count = Math.max(coachSeatMatches.length, ageGender.length, names.length);
    for (let i = 0; i < count; i++) {
      let n = names[i] ? names[i][1].trim() : undefined;
      // Prevent headers from becoming passenger names
      if (n && /^(?:AGE|GENDER|BOOKING|STATUS|CURRENT|DETAILS|CLASS|SEX)/.test(n)) {
        n = undefined;
      }
      rawPassengers.push({
        name: n,
        coach: coachSeatMatches[i] ? coachSeatMatches[i][1] : undefined,
        seat: coachSeatMatches[i] ? coachSeatMatches[i][2] : undefined,
        age: ageGender[i] ? ageGender[i][1] : undefined,
        gender: ageGender[i] ? (ageGender[i][2].startsWith("F") ? "female" : "male") : undefined,
      });
    }
  }

  // Deduplicate
  const passengers: ExtractedTicket["passengers"] = [];
  const seenUniqueKey = new Set<string>();
  let fallbackIndex = 1;

  for (const rp of rawPassengers) {
    if (passengers.length >= 6) break;
    // Skip if completely empty block
    if (!rp.name && !rp.age && !rp.gender && !rp.coach && !rp.seat) continue;
    
    let pName = rp.name || `Passenger ${fallbackIndex}`;
    
    // Create a unique key for this passenger based on all their attributes
    // This prevents deduplication from accidentally hiding passengers with the same name or missing names
    const uniqueKey = `${pName.toLowerCase()}-${rp.age || ""}-${rp.gender || ""}-${rp.coach || ""}-${rp.seat || ""}`;
    
    if (seenUniqueKey.has(uniqueKey)) continue;
    seenUniqueKey.add(uniqueKey);

    if (!rp.name) fallbackIndex++;

    passengers.push({
      name: pName,
      coach: rp.coach,
      seat: rp.seat,
      age: rp.age,
      gender: rp.gender,
      berth: rp.berth,
      statusType: rp.statusType
    });
  }

  const ignore = new Set([
    "PNR","TRAIN","DATE","FROM","CLASS","SEAT","BERTH","PASSENGER","NAME","AGE","SEX","MALE","FEMALE",
    "WL","RAC","CNF","NO","TO","IRCTC","TICKET","JOURNEY","COACH","SL","AC","SLIP","FARE","CASH","BANK",
    "SGST","CGST","INFO","MAIL","SMS","DOJ","RESV","UPTO","INR","TOTAL","NET","NON","VEG","FOOD","OPT",
    "QUOTA","GN","TQ","LD","PT","SS","HP","PH","DP","YRS","YEAR","YEARS","ADULT","CHILD","TKT","TIME",
    "HRS","MIN","DEP","ARR","SCH","ACT","VIA","NEW","OLD","LTD","CORP","PAY","RS","SPL","EXP","MAIL",
    "THE","HIS","HER","AND","FOR","ARE","HAS","WAS","YOU","NOT","ALL","ANY","BUT","CAN","OUT","OUR",
    "DAY","PER","ETC","WWW","COM","ORG","IND","GOV","TAX","PAN","GST","THIS","THAT","WITH","INTO","UPON",
    "ONLY","RS","AMT","PAID","DUE","BAL","FEE","CHG","CHGS","BED","ROLL","MEAL","W/O","WITHOUT",
    "GENDER","STATUS","CURRENT","BOOKING","DETAILS",
    "JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC",
    "MON","TUE","WED","THU","FRI","SAT","SUN"
  ]);

  let boarding_station = "";
  let destination_station = "";

  // --- Station Extraction ---

  // Strategy 2: Station codes in parentheses/brackets (Restricted to header to avoid bottom-of-page garbage)
  let pBoarding = "";
  let pDest = "";
  const headerEnd = upper.indexOf("PASSENGER");
  const headerText = upper.substring(0, headerEnd > -1 ? headerEnd : 1000);
  
  const parenMatchRegex = /[([<{]([A-Z]{3,4})[)\]>}]/g;
  let parenStations = [...headerText.matchAll(parenMatchRegex)]
    .map(m => m[1])
    .filter(w => !ignore.has(w) && !/^(?:WL|RAC|GN|PQ|RS|SS|LD|HP|PT|PQWL|RLWL|TQWL|GNWL)$/.test(w));

  // Remove adjacent identical duplicates (so [TPTY, TPTY, OGL] becomes [TPTY, OGL])
  parenStations = parenStations.filter((s, i, arr) => i === 0 || s !== arr[i-1]);

  if (parenStations.length >= 2) {
    // The last paren code in the header is ALWAYS the destination.
    // The second-to-last is ALWAYS the boarding station.
    // This perfectly ignores "Booked From" and "Electronic Reservation Slip (ERS)" at the top!
    pDest = parenStations[parenStations.length - 1];
    pBoarding = parenStations[parenStations.length - 2];
  }

  // Strategy 3: Explicit From and To markers
  let eBoarding = "";
  let eDest = "";
  const explicitRoute = upper.match(/(?:FROM|BOARDING\s*AT|BDG)[\s:-]*([A-Z]{3,4})[\s\S]{1,150}?(?:TO|RESV\s*UPTO)[\s:-]*([A-Z]{3,4})/i);
  if (explicitRoute) {
    eBoarding = explicitRoute[1];
    eDest = explicitRoute[2];
  } else {
    const getCodeAfter = (prefixRegex: RegExp) => {
      const match = upper.match(prefixRegex);
      if (!match) return "";
      const chunk = upper.substring(match.index! + match[0].length, match.index! + match[0].length + 80);
      const codes = [...chunk.matchAll(/\b([A-Z]{3,4})\b/g)].map(m => m[1]).filter(w => !ignore.has(w));
      return codes[0] || "";
    };
    eBoarding = getCodeAfter(/\b(?:BOARDING\s*AT|FROM)\b/i);
    eDest = getCodeAfter(/\b(?:TO|RESV\s*UPTO)\b/i);
  }

  // Cascade extraction logic
  const fill = (testB: string, testD: string) => {
    if (!boarding_station && testB && testB !== destination_station) boarding_station = testB;
    if (!destination_station && testD && testD !== boarding_station) destination_station = testD;
  };

  fill(pBoarding, pDest); // Priority 1: Parentheses (usually reliable)
  fill(eBoarding, eDest); // Priority 2: Text proximity
  
  // Fallback: If still missing, just use the first valid codes
  if (!boarding_station || !destination_station) {
    const stationCodes = [...upper.matchAll(/\b[A-Z]{3,4}\b/g)].map(m => m[0]).filter(w => !ignore.has(w));
    if (!boarding_station) boarding_station = stationCodes[0] || "";
    if (!destination_station) {
      destination_station = stationCodes.find(s => s !== boarding_station) || stationCodes[1] || "";
    }
  }

  let departure_time: string | undefined;
  let arrival_date: string | undefined;
  let arrival_time: string | undefined;

  const filler = "(?:[^a-zA-Z0-9]|TIME|DATE|AT|ON|HRS|MINS)*";
  const dateOpt = "(?:(\\d{2}[-/][A-Z]{3}[-/]\\d{4}|\\d{2}[-/]\\d{2}[-/]\\d{4})" + filler + ")?";

  // Try explicit markers first
  const explicitDepMatch = upper.match(new RegExp(`(?:SCH\\s*DEP|SCHEDULED\\s*DEPARTURE|\\bDEP(?:ARTURE)?\\b)${filler}${dateOpt}(\\d{2}:\\d{2})`, "i"));
  if (explicitDepMatch) {
    departure_time = explicitDepMatch[2];
  }

  const explicitArrMatch = upper.match(new RegExp(`(?:SCH\\s*ARR|SCHEDULED\\s*ARRIVAL|\\bARR(?:IVAL)?\\b|\\bUPTO\\b)${filler}${dateOpt}(\\d{2}:\\d{2})`, "i"));
  if (explicitArrMatch) {
    if (explicitArrMatch[1]) arrival_date = explicitArrMatch[1].replace(/\//g, "-");
    arrival_time = explicitArrMatch[2];
  }

  const dtRegex = /\b(\d{2}[-/][A-Z]{3}[-/]\d{4}|\d{2}[-/]\d{2}[-/]\d{4})\s+(\d{2}:\d{2})\b/gi;
  const rawDtMatches = [...upper.matchAll(dtRegex)];
  
  // Filter out booking/printing timestamps (e.g. "Booked On: 24-Oct 06:59")
  const dtMatches = rawDtMatches.filter(m => {
    const context = upper.substring(Math.max(0, m.index - 40), m.index);
    return !/(?:BOOK|BOOKED|BOOKING|ISSUE|ISSUED|PRINT|PRINTED|PRINTING|TRANSACT|TRANSACTION|PAY|PAYMENT|RECEIPT)(?:[^a-zA-Z0-9]|TIME|DATE|AT|ON|HRS|MINS)*$/i.test(context);
  });
  
  if (dtMatches.length >= 1) {
    const context = upper.substring(Math.max(0, dtMatches[0].index - 30), dtMatches[0].index);
    const isArrival = /(?:ARR|ARRIVAL|TO|UPTO)[\s:.\-]*$/i.test(context);
    
    if (isArrival) {
      if (!arrival_date) arrival_date = dtMatches[0][1].replace(/\//g, "-");
      if (!arrival_time) arrival_time = dtMatches[0][2];
    } else {
      if (!departure_time) departure_time = dtMatches[0][2];
      
      if (dtMatches.length >= 2) {
        if (!arrival_date) arrival_date = dtMatches[1][1].replace(/\//g, "-");
        if (!arrival_time) arrival_time = dtMatches[1][2];
      }
    }
  }

  let ticket_status: ExtractedTicket["ticket_status"] = "UNKNOWN";
  
  // Only look at the text before instructions/T&C to avoid false positive "CANCELLED"
  const textBodyEnd = upper.indexOf("INSTRUCTION");
  const ticketBody = upper.substring(0, textBodyEnd > -1 ? textBodyEnd : upper.length);
  
  if (/\bCNF\b|\bCONFIRMED\b/.test(ticketBody)) ticket_status = "CNF";
  else if (/\bWL\b|\bWAITLISTED\b/.test(ticketBody)) ticket_status = "WL";
  else if (/\bRAC\b/.test(ticketBody)) ticket_status = "RAC";
  else if (/\bCANCELLED\b/.test(ticketBody)) ticket_status = "CANCELLED";

  // If we couldn't find status in the main body, fallback to looking everywhere but prioritize CNF
  if (ticket_status === "UNKNOWN") {
    if (/\bCNF\b|\bCONFIRMED\b/.test(upper)) ticket_status = "CNF";
    else if (/\bCANCELLED\b/.test(upper)) ticket_status = "CANCELLED";
  }

  const berthMatch = upper.match(/\b(LOWER|UPPER|MIDDLE|SIDE\s*LOWER|SIDE\s*UPPER|WINDOW)\b/);
  const current_berth = berthMatch?.[1]?.replace(/\s+/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  let pnr: string | undefined;
  const pnrMatch = upper.match(/(?:PNR|PNR\s*NO|PNR\s*NUMBER|PNR\s*NO\.)[\s:.\-*_~|]*(\d{10})\b/i);
  if (pnrMatch) {
    pnr = pnrMatch[1];
  } else {
    // Look for a 10 digit number in the first 1000 characters
    const fallbackPnr = upper.substring(0, 1000).match(/\b(\d{10})\b/);
    if (fallbackPnr) pnr = fallbackPnr[1];
  }

  return {
    raw: text,
    train_number,
    train_name,
    journey_date,
    departure_time,
    arrival_date,
    arrival_time,
    coach_number: passengers[0]?.coach,
    seat_number: passengers[0]?.seat,
    boarding_station,
    destination_station,
    current_berth,
    pnr,
    passengers: passengers.length ? passengers.map(p => ({
      ...p,
      statusType: p.statusType || ticket_status,
      isConfirmed: (p.statusType || ticket_status) === "CNF"
    })) : [],
    ticket_status,
  };
}

type PdfJsLib = typeof import("pdfjs-dist");
let pdfjsLib: PdfJsLib | null = null;
async function getPdfJs(): Promise<PdfJsLib> {
  if (!pdfjsLib) {
    pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.mjs",
      import.meta.url,
    ).toString();
  }
  return pdfjsLib;
}

function saveNewStation(code: string, name: string) {
  if (!code) return;
  try {
    const existing = JSON.parse(localStorage.getItem("customStations") || "[]");
    const upper = code.toUpperCase();
    const exists = existing.find((s: any) => s.code?.toUpperCase() === upper);
    if (!exists && code.length >= 2) {
      existing.push({ code: upper, name: name || upper, custom: true });
      localStorage.setItem("customStations", JSON.stringify(existing));
    }
  } catch { /* noop */ }
}

function saveDetectedStations(boarding?: string, destination?: string) {
  const handle = (s?: string) => {
    if (!s) return;
    const m = s.match(/([A-Z\s]+)\(([A-Z]+)\)/);
    if (m) saveNewStation(m[2], m[1].trim());
    else saveNewStation(s, s);
  };
  handle(boarding);
  handle(destination);
}

export function OCRTicketScanner({ onExtractSuccess, onExtractError }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  const onPick = async (file: File) => {
    try {
      if (file.type === "application/pdf") {
        if (preview) URL.revokeObjectURL(preview);
        setPdfFile(file);
        setBlob(null);
        setPreview("pdf");
        return;
      }
      const compressed = await compressImage(file);
      setBlob(compressed);
      setPdfFile(null);
      if (preview && preview !== "pdf") URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(compressed));
    } catch {
      onExtractError?.("Could not load file. Please try another file.");
    }
  };

  const reset = () => {
    if (preview && preview !== "pdf") URL.revokeObjectURL(preview);
    setPreview(null);
    setBlob(null);
    setPdfFile(null);
  };

  const extractFromPdf = async (file: File): Promise<string> => {
    const pdfjs = await getPdfJs();
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    let text = "";
    const maxPages = Math.min(pdf.numPages, 3);
    for (let i = 1; i <= maxPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += " " + content.items.map((it: any) => it.str).join(" ");
    }
    const letters = (text.match(/[a-zA-Z]/g) || []).length;
    if (text.length > 200 && letters > 50) return text;
    // Fallback: render first page → OCR
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext("2d")!;
    await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    const ocr = await Tesseract.recognize(dataUrl, "eng");
    return text + " " + ocr.data.text;
  };

  const submit = async () => {
    if (!blob && !pdfFile) return;
    setBusy(true);
    try {
      let text = "";
      if (pdfFile) {
        text = await extractFromPdf(pdfFile);
      } else if (blob) {
        const url = URL.createObjectURL(blob);
        const result = await Tesseract.recognize(url, "eng");
        URL.revokeObjectURL(url);
        text = result.data.text;
      }
      const parsed = parseTicket(text);
      saveDetectedStations(parsed.boarding_station, parsed.destination_station);
      reset();
      onExtractSuccess(parsed);
    } catch {
      onExtractError?.("Uploaded image has not clarity. Please upload a clear image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border-2 border-dashed bg-secondary/40 min-h-[260px] flex flex-col items-center justify-center p-4 relative">
        {preview ? (
          <>
            {pdfFile ? (
              <div className="flex flex-col items-center text-center px-4">
                <ScanLine className="size-10 text-primary mb-2" />
                <p className="text-sm font-medium truncate max-w-[260px]">{pdfFile.name}</p>
                <p className="text-xs text-muted-foreground">PDF ticket ready to extract.</p>
              </div>
            ) : (
              <img src={preview} alt="Ticket preview" className="max-h-[260px] rounded-xl object-contain" />
            )}
            <button
              type="button"
              onClick={reset}
              className="absolute top-2 right-2 size-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center border hover:bg-background"
              aria-label="Remove file"
            >
              <X className="size-4" />
            </button>
          </>
        ) : (
          <>
            <ScanLine className="size-10 text-muted-foreground mb-2" />
            <p className="text-sm font-medium">Add your ticket</p>
            <p className="text-xs text-muted-foreground mb-4">JPG, PNG, WEBP or PDF — file stays on your device.</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => cameraInput.current?.click()}>
                <Camera className="size-4 mr-1.5" /> Take photo
              </Button>
              <Button type="button" onClick={() => fileInput.current?.click()}>
                <Upload className="size-4 mr-1.5" /> Upload
              </Button>
            </div>
          </>
        )}
        <input
          ref={cameraInput}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          capture="environment"
          className="hidden"
          onChange={e => e.target.files?.[0] && onPick(e.target.files[0])}
        />
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={e => e.target.files?.[0] && onPick(e.target.files[0])}
        />
      </div>

      {preview && (
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={reset} disabled={busy}>Retake</Button>
          <Button type="button" className="flex-1 bg-gradient-accent text-accent-foreground" onClick={submit} disabled={busy}>
            {busy ? <><Loader2 className="size-4 mr-1.5 animate-spin" /> Reading…</> : "Extract details"}
          </Button>
        </div>
      )}
    </div>
  );
}
