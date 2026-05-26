import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Camera, AlertCircle } from "lucide-react";

interface Props {
  onScanSuccess: (rawData: string) => void;
  onScanError?: (err: string) => void;
}

export function QRTicketScanner({ onScanSuccess, onScanError }: Props) {
  const [status, setStatus] = useState("Initializing camera…");
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number | null>(null);
  const stoppedRef = useRef(false);

  const stopCamera = () => {
    stoppedRef.current = true;
    if (animRef.current != null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try { videoRef.current.srcObject = null; } catch { /* noop */ }
    }
  };

  useEffect(() => {
    stoppedRef.current = false;

    const scanLoop = () => {
      if (stoppedRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;

      if (video.readyState >= 2) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (w > 0 && h > 0) {
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            const imageData = ctx.getImageData(0, 0, w, h);
            const result = jsQR(imageData.data, w, h, {
              inversionAttempts: "attemptBoth",
            });
            if (result && result.data) {
              setStatus("QR Detected!");
              stopCamera();
              onScanSuccess(result.data);
              return;
            }
          }
        }
      }
      animRef.current = requestAnimationFrame(scanLoop);
    };

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
        });
        if (stoppedRef.current) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute("playsinline", "true");
          await video.play().catch(() => { /* noop */ });
        }
        setStatus("Scanning QR…");
        animRef.current = requestAnimationFrame(scanLoop);
      } catch (err: any) {
        const msg = String(err?.message || err);
        if (/Permission|NotAllowed|denied/i.test(msg)) {
          setPermissionDenied(true);
          setStatus("Camera access denied. Please allow camera permission or upload an image instead.");
        } else {
          setStatus("Could not start camera. Try uploading an image.");
        }
        onScanError?.(msg);
      }
    };

    startCamera();
    return () => { stopCamera(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setStatus("Scanning uploaded image…");
    try {
      const url = URL.createObjectURL(file);
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const result = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: "attemptBoth" });
      if (result && result.data) {
        setStatus("QR Detected!");
        stopCamera();
        onScanSuccess(result.data);
      } else {
        const msg = "Invalid QR code. Please try again or upload a clearer image.";
        setStatus("Scan Failed");
        onScanError?.(msg);
      }
    } catch (err: any) {
      const msg = "Could not read image. Please try a clearer photo.";
      setStatus("Scan Failed");
      onScanError?.(msg);
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl overflow-hidden bg-black/5 aspect-square w-full border relative flex items-center justify-center">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className={`text-xs flex items-center gap-1.5 ${permissionDenied ? "text-destructive" : "text-muted-foreground"}`}>
          {busy ? <Loader2 className="size-3 animate-spin" /> : permissionDenied ? <AlertCircle className="size-3" /> : <Camera className="size-3" />}
          {status}
        </p>
        <label className="inline-flex">
          <Button type="button" variant="outline" size="sm" asChild>
            <span className="cursor-pointer inline-flex items-center gap-1.5">
              <Upload className="size-3.5" /> Upload QR image
            </span>
          </Button>
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </label>
      </div>
    </div>
  );
}
