import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Loader2, QrCode, Image as ImageIcon, CheckCircle2, AlertCircle } from "lucide-react";
import { Scanner } from "@yudiel/react-qr-scanner";
import Tesseract from "tesseract.js";
import { toast } from "sonner";
import { Camera } from "lucide-react";

type PdfJsLib = typeof import("pdfjs-dist");

// pdfjs-dist touches browser globals during module evaluation in dev/SSR,
// so we lazy-load it only when the user uploads a PDF.
let pdfjsLib: PdfJsLib | null = null;

export type VerifiedData = {
  train_number: string;
  train_name: string;
  journey_date: string;
  boarding_station: string;
  destination_station: string;
  coach_number: string;
  seat_number: string;
  verification_status: "qr" | "ocr";
  verification_hash: string;
  passenger_name?: string;
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onVerify: (data: VerifiedData) => void;
}

export function JourneyVerificationModal({ open, onOpenChange, onVerify }: Props) {
  const [loading, setLoading] = useState(false);
  const [method, setMethod] = useState<"qr" | "ocr">("qr");
  
  // Passenger selection states
  const [passengers, setPassengers] = useState<{ name: string; age?: string; gender?: string; seat?: string; coach?: string }[]>([]);
  const [ticketData, setTicketData] = useState<Partial<VerifiedData> | null>(null);

  const [useCamera, setUseCamera] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  
  const parseTicketData = (text: string) => {
    const trainNumber = text.match(/\b\d{5}\b/)?.[0];
    // Dates like 2023-10-25 or 25-10-2023 or 25/10/2023
    const dateMatch = text.match(/\b(\d{2}[-/]\d{2}[-/]\d{4}|202\d[-/][01]\d[-/][0-3]\d)\b/)?.[0];
    
    // Ignore common english words and IRCTC abbreviations when finding station codes
    const ignoreWords = ["PNR", "TRAIN", "DATE", "FROM", "CLASS", "SEAT", "BERTH", "PASSENGER", "NAME", "AGE", "SEX", "MALE", "FEMALE", "WL", "RAC", "CNF", "NO", "TO", "IRCTC", "TICKET", "JOURNEY"];
    const upperWords = [...text.matchAll(/\b[A-Z]{2,4}\b/g)].map(m => m[0]).filter(w => !ignoreWords.includes(w));
    const boarding_station = upperWords[0] || "";
    const destination_station = upperWords[1] || "";

    const passengers: { name: string; coach: string; seat: string }[] = [];
    // E.g. "B1 23", "B1-23", "B1, 23"
    const passengerMatches = [...text.matchAll(/\b([A-Z]{1,2}\d{1,2})[\s,-]+(\d{1,3})\b/g)];
    if (passengerMatches.length > 0) {
      passengerMatches.forEach((m, i) => {
        passengers.push({ name: `Passenger ${i + 1}`, coach: m[1], seat: m[2] });
      });
    } else {
      const coachMatch = text.match(/\b([A-Z]{1,2}\d{1,2})\b/);
      const seatMatch = text.match(/(?:SEAT|BERTH)\s*(?:NO\.?)?\s*(\d{1,3})/i) || text.match(/\b\d{1,3}\b/);
      if (coachMatch || seatMatch) {
        passengers.push({ name: "Passenger 1", coach: coachMatch ? coachMatch[1] : "", seat: seatMatch ? seatMatch[1] : "" });
      }
    }

    const ageGenderMatches = [...text.matchAll(/\b(M|F|MALE|FEMALE)\s+(\d{1,2})\b/gi)];
    ageGenderMatches.forEach((m, i) => {
      if (passengers[i]) {
        passengers[i].name = `Passenger ${i + 1} (${m[1].toUpperCase()} ${m[2]})`;
      } else {
        passengers.push({ name: `Passenger ${i + 1} (${m[1].toUpperCase()} ${m[2]})`, coach: "", seat: "" });
      }
    });

    return { trainNumber, dateMatch, boarding_station, destination_station, passengers };
  };

  const handleQR = (result: string) => {
    try {
      if (!result) return;
      
      let trainNumber = result.match(/\b\d{5}\b/)?.[0] || "12627"; 
      let pnr = result.match(/\b\d{10}\b/)?.[0] || "1234567890";
      let dateMatch = result.match(/\b(202\d-[01]\d-[0-3]\d)\b/)?.[0];
      
      const isWaitlist = /WL|WAITLIST|RAC/i.test(result);
      if (isWaitlist) {
        toast.error("Seat exchange is available only for confirmed tickets.");
        return;
      }

      const parsed = parseTicketData(result.toUpperCase());

      setTicketData({
        train_number: parsed.trainNumber || "12627",
        train_name: "Verified Train",
        journey_date: parsed.dateMatch || new Date().toISOString().slice(0, 10),
        boarding_station: parsed.boarding_station || "NDLS",
        destination_station: parsed.destination_station || "BZA",
        coach_number: parsed.passengers[0]?.coach || "",
        seat_number: parsed.passengers[0]?.seat || "",
        verification_status: "qr",
        verification_hash: "QR_" + btoa(result).slice(0, 16),
      });
      toast.success("QR Code read successfully!");
      setPassengers(parsed.passengers.length > 0 ? parsed.passengers : [{ name: "Passenger 1", seat: "1", coach: "B1" }]);
    } catch (err: any) {
      toast.error("Failed to parse QR code");
    }
  };

  const processOCRText = (text: string) => {
    const isWaitlist = /WL|WAITLIST|RAC/i.test(text);
    if (isWaitlist) {
      throw new Error("Seat exchange is available only for confirmed tickets.");
    }

    const parsed = parseTicketData(text);
    if (!parsed.trainNumber) {
      throw new Error("Could not detect Train Number from ticket.");
    }

    setTicketData({
      train_number: parsed.trainNumber,
      train_name: "Extracted Train", 
      journey_date: parsed.dateMatch || new Date().toISOString().slice(0, 10),
      boarding_station: parsed.boarding_station,
      destination_station: parsed.destination_station,
      coach_number: parsed.passengers[0]?.coach || "",
      seat_number: parsed.passengers[0]?.seat || "",
      verification_status: "ocr",
      verification_hash: "OCR_" + Date.now(),
    });

    setPassengers(parsed.passengers);
    toast.success("Ticket details extracted successfully!");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      let text = "";
      
      if (file.type === "application/pdf") {
        if (!pdfjsLib) {
          pdfjsLib = await import("pdfjs-dist");
          pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
            "pdfjs-dist/build/pdf.worker.mjs",
            import.meta.url
          ).toString();
        }
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const page = await pdf.getPage(1);
        const textContent = await page.getTextContent();
        text = textContent.items.map((item: any) => item.str).join(" ").toUpperCase();
      } else {
        const imageUrl = URL.createObjectURL(file);
        const result = await Tesseract.recognize(imageUrl, "eng", { logger: m => console.log(m) });
        text = result.data.text.toUpperCase();
        URL.revokeObjectURL(imageUrl);
      }
      
      processOCRText(text);
    } catch (err: any) {
      toast.error(err.message || "Failed to process ticket");
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    setUseCamera(true);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch (err) {
      toast.error("Camera permission denied or unavailable.");
      setUseCamera(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      setStream(null);
    }
    setUseCamera(false);
  };

  const takePhoto = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      canvas.toBlob(async (blob) => {
        if (blob) {
          stopCamera();
          setLoading(true);
          try {
            const imageUrl = URL.createObjectURL(blob);
            const result = await Tesseract.recognize(imageUrl, "eng");
            processOCRText(result.data.text.toUpperCase());
            URL.revokeObjectURL(imageUrl);
          } catch (err: any) {
            toast.error(err.message || "Failed to process image");
          } finally {
            setLoading(false);
          }
        }
      }, "image/jpeg", 0.8);
    }
  };

  const selectPassenger = (p: typeof passengers[0]) => {
    if (!ticketData) return;
    onVerify({
      ...(ticketData as VerifiedData),
      coach_number: p.coach || ticketData.coach_number || "B1",
      seat_number: p.seat || ticketData.seat_number || "1",
      passenger_name: p.name,
    });
    onOpenChange(false);
  };

  // Stop camera when modal closes
  useEffect(() => {
    if (!open) stopCamera();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Verify Journey Ticket</DialogTitle>
        </DialogHeader>
        
        <Tabs value={method} onValueChange={(v) => setMethod(v as any)} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="qr" disabled={passengers.length > 0}><QrCode className="size-4 mr-2" /> QR Scan</TabsTrigger>
            <TabsTrigger value="ocr" disabled={passengers.length > 0}><ImageIcon className="size-4 mr-2" /> Upload</TabsTrigger>
          </TabsList>
          
          {passengers.length > 0 ? (
            <div className="mt-6 space-y-4">
              <h3 className="font-medium text-center">Select Passenger to Swap</h3>
              <p className="text-xs text-center text-muted-foreground">We detected multiple passengers on this ticket. Choose which one wants to request a seat exchange.</p>
              <div className="grid gap-3">
                {passengers.map((passenger: any, i) => (
                  <div key={i} onClick={() => selectPassenger(passenger)} className="p-4 border rounded-xl bg-card hover:border-primary cursor-pointer transition-colors flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{passenger.name}</h3>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        <span className="font-medium">{passenger.coach}</span> · <span className="font-medium">{passenger.seat}</span> · <span className="font-medium">{passenger.berth}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Age: {passenger.age} · Gender: {passenger.gender}
                      </div>
                      <div className="mt-2 inline-block px-2.5 py-1 rounded-full text-xs font-bold bg-muted">
                        {passenger.statusType}
                      </div>
                    </div>
                    <CheckCircle2 className="size-5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                ))}
              </div>
              <Button variant="ghost" className="w-full mt-2" onClick={() => { setPassengers([]); setTicketData(null); }}>
                Cancel & Rescan
              </Button>
            </div>
          ) : (
            <>
          <TabsContent value="qr" className="mt-4">
            <div className="rounded-xl overflow-hidden bg-black/5 aspect-square relative flex items-center justify-center border">
              {open && method === "qr" && (
                <Scanner
                  onScan={(result) => {
                    const first = result?.[0] as any;
                    const text = first?.text || first?.rawValue;
                    if (text) {
                      toast.success("QR detected");
                      handleQR(String(text));
                    } else {
                      console.warn("QR scanned but no text/rawValue", result);
                      toast.error("QR detected but no value found");
                    }
                  }}
                  onError={(e) => {
                    console.warn("QR scanner error", e);
                    toast.error("QR scanner error");
                  }}
                  scanDelay={300}
                />
              )}
              <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40 mix-blend-multiply" />
            </div>
            <p className="text-xs text-center text-muted-foreground mt-3">Position your ticket QR code within the frame to automatically verify your journey details.</p>
          </TabsContent>
          
          <TabsContent value="ocr" className="mt-4">
            <div className="rounded-xl border-2 border-dashed bg-secondary/50 p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
              {loading ? (
                <>
                  <Loader2 className="size-10 animate-spin text-primary mb-4" />
                  <p className="font-medium">Extracting ticket details...</p>
                  <p className="text-xs text-muted-foreground mt-2">This may take a few seconds.</p>
                </>
              ) : useCamera ? (
                <div className="relative w-full h-full flex flex-col items-center">
                  <video ref={videoRef} autoPlay playsInline className="w-full max-h-[250px] object-cover rounded-lg mb-4" />
                  <div className="flex gap-2">
                    <Button onClick={takePhoto} className="bg-gradient-primary">Capture</Button>
                    <Button variant="outline" onClick={stopCamera}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <ImageIcon className="size-10 text-muted-foreground mb-4" />
                  <p className="font-medium mb-1">Upload or Capture Ticket</p>
                  <p className="text-xs text-muted-foreground mb-6">PNG, JPG, or PDF (first page)</p>
                  <div className="flex gap-3">
                    <div className="relative">
                      <Button className="bg-gradient-primary">Choose File</Button>
                      <input 
                        type="file" 
                        accept="image/*,application/pdf" 
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                      />
                    </div>
                    <Button variant="outline" onClick={startCamera}>
                      <Camera className="size-4 mr-2" /> Take Photo
                    </Button>
                  </div>
                </>
              )}
            </div>
          </TabsContent>
          </>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
