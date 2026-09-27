/**
 * KAMPS real-data layer: loaders for the ingested datasets under /data/.
 *
 * Source of truth: files ingested by the data agent (see data/manifest.json):
 *   - county-populations.json  (KNBS 2019 census via Wikipedia, exact totals)
 *   - ucdp-kenya.csv           (UCDP GED v23.1, 1,126 events 1989-2022)
 *   - kenya-counties.geojson   (IEBC county boundaries)
 *   - missing-voices.json      (Missing Voices Coalition, 200 victims + series)
 *   - incidents-public-record.json (29 sourced incidents 2024-2026)
 *   - vehicles-public-record.json (documented vehicle patterns, with sources)
 *
 * Every record returned here is real and traceable to its source URL.
 * Vehicle records carry documented sighting events with the source that
 * reported them; there are no synthetic rows anywhere in the system.
 */
import fs from "fs";
import path from "path";

const DATA = path.join(process.cwd(), "data");

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA, file), "utf-8")) as T;
}

// ————— county model —————
export type County = {
  id: number;
  name: string;      // canonical, without "County"
  code: number;
  population: number; // 2019 census
};

type RawCounty = {
  name: string;
  code: number;
  population2019: number;
};

let countyCache: County[] | null = null;
export function loadCounties(): County[] {
  if (countyCache) return countyCache;
  const raw = readJson<RawCounty[]>("county-populations.json");
  countyCache = raw
    .map((c, i) => ({
      id: i + 1,
      name: c.name.replace(/\s*County$/i, "").trim(),
      code: c.code,
      population: c.population2019,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return countyCache!;
}

// ————— town -> county gazetteer (for free-text locations) —————
const TOWN_TO_COUNTY: Record<string, string> = {
  // towns appearing in the ingested location strings
  maua: "Meru", naivasha: "Nakuru", thika: "Kiambu", embulbul: "Kajiado",
  kigumo: "Kirinyaga", tuaini: "Nyandarua", "kahawa west": "Nairobi",
  githurai: "Nairobi", "ng'iya": "Siaya", ngiya: "Siaya", turbo: "Uasin Gishu",
  ngong: "Kajiado", kikuyu: "Kiambu", matuu: "Machakos", kitengela: "Kajiado",
  mlolongo: "Machakos", uthiru: "Nairobi", juja: "Kiambu", mathare: "Nairobi",
  karen: "Nairobi", ruiru: "Kiambu", eldoret: "Uasin Gishu", lodwar: "Turkana",
  "moi avenue": "Nairobi", "imenti house": "Nairobi", cbd: "Nairobi", nrb: "Nairobi",
  "industrial area": "Nairobi", "enterprise road": "Nairobi",
  "central police station": "Nairobi", dagoretti: "Nairobi",
  kasarani: "Nairobi", starehe: "Nairobi", embakasi: "Nairobi",
  kisii: "Kisii", kericho: "Kericho", bomet: "Bomet", kitui: "Kitui",
  isiolo: "Isiolo", marsabit: "Marsabit", wajir: "Wajir", mandera: "Mandera",
  tana: "Tana River", lamu: "Lamu", malindi: "Kilifi", voi: "Taita Taveta",
  machakos: "Machakos", makueni: "Makueni", nyeri: "Nyeri",
  muranga: "Murang'a", murang: "Murang'a", laikipia: "Laikipia",
  nyandarua: "Nyandarua", kirinyaga: "Kirinyaga", embu: "Embu",
  meru: "Meru", tharaka: "Tharaka Nithi", busia: "Busia", siaya: "Siaya",
  kisumu: "Kisumu", homabay: "Homa Bay", "homa bay": "Homa Bay",
  migori: "Migori", nyamira: "Nyamira", vihiga: "Vihiga", kakamega: "Kakamega",
  bungoma: "Bungoma", transnzoya: "Trans Nzoia", "trans nzoia": "Trans Nzoia",
  kapenguria: "West Pokot", "west pokot": "West Pokot", elgeyo: "Elgeyo Marakwet",
  "elgeyo marakwet": "Elgeyo Marakwet", nandi: "Nandi", ahero: "Kisumu",
  mombasa: "Mombasa", kilifi: "Kilifi", kwale: "Kwale", narok: "Narok",
  kajiado: "Kajiado", nakuru: "Nakuru", nyando: "Kisumu",
};

const NAME_FIXES: Record<string, string> = {
  "murang'a": "Murang'a", muranga: "Murang'a", "trans nzoya": "Trans Nzoia",
  "homabay": "Homa Bay", "taita taveta": "Taita Taveta",
};

/** Map a free-text location to a canonical county name, or null. */
export function mapToCounty(location: string | null | undefined, countyNames: Set<string>): string | null {
  if (!location) return null;
  const lower = location.toLowerCase().replace(/\s+/g, " ").trim();
  if (!lower || lower === "?" || lower === "unknown") return null;
  // direct county name (possibly followed by " county")
  const direct = NAME_FIXES[lower] ?? lower;
  if (countyNames.has(direct)) return direct;
  const stripped = direct.replace(/\s*county$/i, "").trim();
  if (countyNames.has(stripped)) return stripped;
  // scan for any county name or known town inside the string
  for (const [key, county] of Object.entries(TOWN_TO_COUNTY)) {
    if (lower.includes(key)) return county;
  }
  for (const name of countyNames) {
    if (lower.includes(name.toLowerCase())) return name;
  }
  return null;
}

export function isOutsideKenya(location: string | null | undefined): boolean {
  if (!location) return false;
  const l = location.toLowerCase();
  // Only exclude locations verifiably outside Kenya: foreign countries or
  // foreign towns. The bare word "outside" is NOT an exclusion signal
  // ("Nairobi (outside Parliament)" is a Nairobi incident).
  return (
    l.includes("uganda") ||
    l.includes("tanzania") ||
    l.includes("kampala") ||
    l.includes("kireka") ||
    l.includes("outside kenya") ||
    l.includes("outside the country")
  );
}

// ————— UCDP GED events —————
export type UcdpEvent = {
  id: number;
  year: number;
  typeOfViolence: 1 | 2 | 3; // 1 state-based, 2 non-state, 3 one-sided
  dateStart: string;
  best: number;           // best estimate deaths
  civilians: number;
  lat: number;
  lng: number;
  where: string;
  county: string | null;  // assigned via point-in-polygon
};

type GeoJson = {
  features: Array<{
    properties: { COUNTY?: string; county?: string; name?: string; NAME_1?: string; ADM1_EN?: string };
    geometry: {
      type: "Polygon" | "MultiPolygon";
      coordinates: number[][][] | number[][][][];
    };
  }>;
};

// ray-casting point-in-polygon
function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1];
    const xj = ring[j][0], yj = ring[j][1];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInCounty(lng: number, lat: number, feature: GeoJson["features"][number]): boolean {
  const g = feature.geometry;
  if (g.type === "Polygon") {
    return (g.coordinates as number[][][]).some(ring => pointInRing(lng, lat, ring));
  }
  return (g.coordinates as number[][][][]).some(poly =>
    poly.some(ring => pointInRing(lng, lat, ring))
  );
}

let geoCache: Array<{ name: string; feature: GeoJson["features"][number] }> | null = null;
function loadGeo(): Array<{ name: string; feature: GeoJson["features"][number] }> {
  if (geoCache) return geoCache;
  const gj = readJson<GeoJson>("kenya-counties.geojson");
  geoCache = gj.features
    .map(f => {
      const p = f.properties ?? {};
      const raw = p.COUNTY ?? p.county ?? p.name ?? p.NAME_1 ?? p.ADM1_EN ?? "";
      const name = String(raw).replace(/\s*County$/i, "").trim();
      return { name, feature: f };
    })
    .filter(c => c.name && c.name.toLowerCase() !== "null");
  return geoCache;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      out.push(cur); cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

let ucdpCache: UcdpEvent[] | null = null;
export function loadUcdp(): UcdpEvent[] {
  if (ucdpCache) return ucdpCache;
  const csv = fs.readFileSync(path.join(DATA, "ucdp-kenya.csv"), "utf-8");
  const lines = csv.split("\n");
  const header = parseCsvLine(lines[0]);
  const col = (name: string) => header.indexOf(name);
  const iId = col("id"), iYear = col("year"), iType = col("type_of_violence"),
    iDate = col("date_start"), iBest = col("best"), iCiv = col("deaths_civilians"),
    iLat = col("latitude"), iLng = col("longitude"), iWhere = col("where_description");

  const geo = loadGeo();
  const events: UcdpEvent[] = [];
  for (let li = 1; li < lines.length; li++) {
    const line = lines[li];
    if (!line.trim()) continue;
    const v = parseCsvLine(line);
    const lat = Number(v[iLat]);
    const lng = Number(v[iLng]);
    if (!isFinite(lat) || !isFinite(lng) || (lat === -1 && lng === -1)) continue;
    let county: string | null = null;
    for (const g of geo) {
      if (pointInCounty(lng, lat, g.feature)) { county = g.name; break; }
    }
    events.push({
      id: Number(v[iId]),
      year: Number(v[iYear]),
      typeOfViolence: (Number(v[iType]) as 1 | 2 | 3) ?? 3,
      dateStart: v[iDate],
      best: Number(v[iBest]) || 0,
      civilians: Number(v[iCiv]) || 0,
      lat, lng,
      where: v[iWhere] ?? "",
      county,
    });
  }
  ucdpCache = events;
  return events;
}

// ————— Missing Voices —————
export type MvVictim = {
  no: number;
  name: string;
  age: number | null;
  sex: string | null;
  location: string | null;
  mannerOfDeath: string | null;
  date: string | null;
  sourceUrl: string | null;
  county: string | null;
};

export type MonthlyPoint = { month: string; ed: number; killings: number; incidents: number };

type RawMv = {
  statistics: Array<{
    type: string;
    year?: string;
    months?: string[];
    enforcedDisappearanceCases?: (number | null)[];
    killingCases?: (number | null)[];
    incidentCases?: (number | null)[];
  }>;
  victims: Array<{
    no: number; name: string; age: number | null; sex: string | null;
    location: string | null; mannerOfDeath: string | null; date: string | null;
    sourceUrl: string | null;
  }>;
};

let mvCache: { victims: MvVictim[]; monthly: MonthlyPoint[] } | null = null;
export function loadMissingVoices(): { victims: MvVictim[]; monthly: MonthlyPoint[] } {
  if (mvCache) return mvCache;
  const raw = readJson<RawMv>("missing-voices.json");
  const countyNames = new Set(loadCounties().map(c => c.name));

  const victims: MvVictim[] = raw.victims
    .filter(v => v.date && /^\d{4}-\d{2}-\d{2}$/.test(v.date))
    .map(v => ({
      no: v.no, name: v.name, age: v.age, sex: v.sex,
      location: v.location, mannerOfDeath: v.mannerOfDeath,
      date: v.date, sourceUrl: v.sourceUrl,
      county: mapToCounty(v.location, countyNames),
    }));

  const monthly: MonthlyPoint[] = [];
  for (const s of raw.statistics) {
    if (s.type !== "monthly_series" || !s.year || !s.months) continue;
    s.months.forEach((m, i) => {
      const mm = String(i + 1).padStart(2, "0");
      monthly.push({
        month: `${s.year}-${mm}`,
        ed: Number(s.enforcedDisappearanceCases?.[i] ?? 0) || 0,
        killings: Number(s.killingCases?.[i] ?? 0) || 0,
        incidents: Number(s.incidentCases?.[i] ?? 0) || 0,
      });
    });
  }
  monthly.sort((a, b) => a.month.localeCompare(b.month));
  mvCache = { victims, monthly };
  return mvCache;
}

// ————— public-record incidents (curated, sourced) —————
export type PublicIncident = {
  id: string;
  date: string;
  datePrecision: string;
  person: string;
  location: string | null;
  county: string | null;
  status: string;
  category: string;
  sourceName: string;
  sourceUrl: string;
  notes: string | null;
};

type RawIncidents = { incidents: Array<Record<string, string>> };

let incCache: PublicIncident[] | null = null;
export function loadPublicRecordIncidents(): PublicIncident[] {
  if (incCache) return incCache;
  const raw = readJson<RawIncidents>("incidents-public-record.json");
  const countyNames = new Set(loadCounties().map(c => c.name));
  incCache = raw.incidents
    .map((r, i) => ({
      id: `pr-${i + 1}`,
      date: String(r.date),
      datePrecision: String(r.datePrecision ?? "day"),
      person: String(r.person ?? "Unknown"),
      location: r.location ? String(r.location) : null,
      county: mapToCounty(r.location, countyNames),
      status: String(r.status ?? "unknown"),
      category: String(r.category ?? "abduction"),
      sourceName: String(r.sourceName ?? ""),
      sourceUrl: String(r.sourceUrl ?? ""),
      notes: r.notes ? String(r.notes) : null,
    }))
    .filter(r => !isOutsideKenya(r.location))
    .sort((a, b) => a.date.localeCompare(b.date));
  return incCache;
}

// ————— vehicles: documented pattern records —————
export type VehicleCase = {
  vehicleKey: string;
  platePartial: string;
  make: string;
  model: string;
  color: string;
  summary: string;
  sourceUrls: string[];
  sourceNames: string[];
  /** documented sighting events with reporting sources */
  sightings: Array<{ id: number; date: string; zoneName: string; source: string }>;
};

let vehCache: VehicleCase[] | null = null;
export function loadVehicleCases(): VehicleCase[] {
  if (vehCache) return vehCache;
  const file = path.join(DATA, "vehicles-public-record.json");
  if (!fs.existsSync(file)) {
    vehCache = [];
    return vehCache;
  }
  vehCache = readJson<VehicleCase[]>("vehicles-public-record.json");
  return vehCache;
}

// ————— manifest (provenance) —————
export type ManifestFile = {
  file: string;
  format: string;
  rows_or_features: string | number;
  source: string;
  license: string;
  retrieved_at: string;
  quality: "verified" | "partial" | "failed";
  notes: string;
};
export type Manifest = {
  files: ManifestFile[];
  gaps: string[];
  retrieved_at: string;
};

export function loadManifest(): Manifest {
  const m = readJson<Manifest>("manifest.json");
  return { files: m.files ?? [], gaps: m.gaps ?? [], retrieved_at: m.retrieved_at ?? "" };
}
