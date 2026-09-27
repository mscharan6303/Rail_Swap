// Smart matching: compute compatibility between two requests
import type { Database } from "@/integrations/supabase/types";

type Req = Database["public"]["Tables"]["exchange_requests"]["Row"];

export function compatibility(a: Req, b: Req): number {
  if (a.train_number !== b.train_number) return 0;
  if (a.journey_date !== b.journey_date) return 0;

  let score = 50; // base for same train + date

  // Berth swap match: A wants what B has, B wants what A has
  const aWants = a.desired_berth.toLowerCase();
  const bWants = b.desired_berth.toLowerCase();
  const aHas = a.current_berth.toLowerCase();
  const bHas = b.current_berth.toLowerCase();

  const aWantsB = aWants === "any" || aWants === bHas;
  const bWantsA = bWants === "any" || bWants === aHas;

  if (aWantsB && bWantsA) score += 30;
  else if (aWantsB || bWantsA) score += 10;

  // Same coach
  if (a.coach_number.toUpperCase() === b.coach_number.toUpperCase()) score += 10;

  // Same route
  if (a.boarding_station.toLowerCase() === b.boarding_station.toLowerCase()) score += 5;
  if (a.destination_station.toLowerCase() === b.destination_station.toLowerCase()) score += 5;

  return Math.min(100, score);
}
