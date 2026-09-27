export type TrainRouteStations = { code: string; name: string }[];

export type TrainOption = {
  train_number: string;
  train_name: string;
};

type RawRow = Record<string, unknown>;

function normTrainNumber(v: unknown): string {
  // trains.json seems to store something like { "": "'00851'" }
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "" in (v as Record<string, unknown>)) return String((v as Record<string, unknown>)['']);
  return String(v ?? "");
}

function stripQuotes(v: string) {
  // remove wrapping quotes and leading apostrophes in the dataset like "'00851'"
  return v.replace(/^\s*['"]/, "").replace(/['"]\s*$/, "");
}

export function buildTrainOptions(rows: RawRow[]): TrainOption[] {
  const map = new Map<string, TrainOption>();

  for (const r of rows) {
    const trainNumberRaw = (r["Train No"] as unknown as { [k: string]: unknown })?.[""] ?? r["Train No"];
    const trainNameRaw = (r as any)["train Name"]?.[""] ?? (r as any)["train Name"];

    const train_number = stripQuotes(normTrainNumber(trainNumberRaw));
    const train_name = String(trainNameRaw ?? "");

    if (!train_number) continue;
    map.set(train_number, { train_number, train_name });
  }

  return Array.from(map.values()).sort((a, b) => a.train_number.localeCompare(b.train_number));
}

export function getRouteStationsForTrain(rows: RawRow[], train_number: string): TrainRouteStations {
  // Use dataset fields: "Train No"."" and station code/name/islno.
  const matched: RawRow[] = [];
  for (const r of rows) {
    const tn = stripQuotes(normTrainNumber((r as any)["Train No"]?.[""] ?? (r as any)["Train No"]));
    if (tn === train_number) matched.push(r);
  }

  matched.sort((a, b) => Number((a as any).islno ?? 0) - Number((b as any).islno ?? 0));

  const out: { code: string; name: string }[] = [];
  let lastCode = "";
  for (const r of matched) {
    const code = String((r as any)["station Code"] ?? "");
    const name = String((r as any)["Station Name"] ?? "");
    if (!code) continue;
    if (code === lastCode) continue;
    out.push({ code, name });
    lastCode = code;
  }

  return out;
}

export function findStationIndex(stations: { code: string; name: string }[], stationCode: string) {
  return stations.findIndex((s) => s.code === stationCode);
}
