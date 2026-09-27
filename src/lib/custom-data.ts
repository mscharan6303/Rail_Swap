// Persistent registry for trains and stations discovered from scanned tickets.
// Lets the app accept QR/OCR data even when entries aren't in the bundled JSON files.

export type CustomTrain = { number: string; name: string; stations: string[] };
export type CustomStation = { stnCode: string; stnName: string };

const TRAIN_KEY = "customTrains";
const STATION_KEY = "customStationsV2";

function read<T>(key: string): T[] {
  if (typeof localStorage === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(key) || "[]") as T[]; } catch { return []; }
}
function write<T>(key: string, v: T[]) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* noop */ }
}

export function getCustomTrains(): CustomTrain[] { return read<CustomTrain>(TRAIN_KEY); }
export function getCustomStations(): CustomStation[] { return read<CustomStation>(STATION_KEY); }

export function addCustomTrain(t: CustomTrain) {
  if (!t?.number) return;
  const list = getCustomTrains();
  const i = list.findIndex(x => x.number === t.number);
  const stations = Array.from(new Set([...(i >= 0 ? list[i].stations : []), ...(t.stations || [])])).filter(Boolean);
  const entry: CustomTrain = { number: t.number, name: t.name || (i >= 0 ? list[i].name : t.number), stations };
  if (i >= 0) list[i] = entry; else list.push(entry);
  write(TRAIN_KEY, list);
}

export function addCustomStation(s: CustomStation) {
  if (!s?.stnName && !s?.stnCode) return;
  const code = (s.stnCode || s.stnName).toUpperCase();
  const name = s.stnName || code;
  const list = getCustomStations();
  if (list.some(x => x.stnCode.toUpperCase() === code)) return;
  list.push({ stnCode: code, stnName: name });
  write(STATION_KEY, list);
}

// Best-effort: split "Mumbai Central (BCT)" or "BCT" into code/name parts.
export function splitStationLabel(label: string): { stnCode: string; stnName: string } {
  if (!label) return { stnCode: "", stnName: "" };
  const m = label.match(/^(.+?)\s*\(([A-Z0-9]{2,6})\)\s*$/);
  if (m) return { stnName: m[1].trim(), stnCode: m[2].trim() };
  if (/^[A-Z0-9]{2,6}$/.test(label.trim())) return { stnCode: label.trim(), stnName: label.trim() };
  return { stnName: label.trim(), stnCode: label.trim().toUpperCase().slice(0, 6) };
}
