import type { Database } from "@/integrations/supabase/types";
import { Link } from "@tanstack/react-router";
import { Train, Calendar, MapPin, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Req = Database["public"]["Tables"]["exchange_requests"]["Row"];

export function RequestCard({ req, score, unreadCount }: { req: Req; score?: number; unreadCount?: number }) {
  return (
    <Link
      to="/requests/$id"
      params={{ id: req.id }}
      className="block rounded-2xl border bg-card p-4 hover:shadow-elevated transition-all hover:-translate-y-0.5 animate-fade-in relative"
    >
      {!!unreadCount && unreadCount > 0 && (
        <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg z-10">
          {unreadCount} New
        </span>
      )}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className="size-9 rounded-xl bg-gradient-primary text-primary-foreground flex items-center justify-center">
            <Train className="size-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold leading-tight">{req.train_name}</p>
            </div>
            <p className="text-xs text-muted-foreground">#{req.train_number} · Coach {req.coach_number} · Seat {req.seat_number}</p>
          </div>
        </div>
        <StatusBadge status={req.status ?? "open"} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="size-3.5" />{new Date(req.journey_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground truncate">
          <MapPin className="size-3.5 shrink-0" /><span className="truncate">{req.boarding_station} <ArrowRight className="size-3 inline" /> {req.destination_station}</span>
        </div>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Berth: <span className="font-medium text-foreground">{req.current_berth}</span> → <span className="font-medium text-accent">{req.desired_berth}</span>
        </span>
        {score !== undefined && (
          <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent font-semibold">{score}% match</span>
        )}
      </div>
      {(req.verification_status && (req.verification_status.startsWith('qr') || req.verification_status.startsWith('ocr'))) && (
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t">
          {req.verification_status.startsWith("qr") && (
            <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
              QR Verified
            </Badge>
          )}
          {req.verification_status.startsWith("ocr") && (
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
              OCR Verified
            </Badge>
          )}
          {req.verification_status.includes(":") && req.verification_status.split(":")[1] && (
            <Badge variant="outline" className="border-border text-muted-foreground">
              PNR: {req.verification_status.split(":")[1].replace(/^(\d{3})\d{4}(\d{3})$/, "$1XXXX$2")}
            </Badge>
          )}
          {/* Same Train and Same Date Verification badges would typically be calculated based on comparison with another request. If available in req, display here */}
          {(req as any).same_train_verified && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 border-purple-200">
              Same Train Verified
            </Badge>
          )}
          {(req as any).same_date_verified && (
            <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
              Same Date Verified
            </Badge>
          )}
        </div>
      )}
    </Link>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "bg-success/15 text-success",
    matched: "bg-accent/15 text-accent",
    pending: "bg-warning/20 text-warning-foreground",
    completed: "bg-primary/15 text-primary",
    cancelled: "bg-destructive/15 text-destructive",
  };
  return <Badge variant="secondary" className={`${map[status] ?? "bg-muted"} capitalize border-0`}>{status}</Badge>;
}
