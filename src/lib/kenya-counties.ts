/**
 * Kenya counties geometry: 47 county polygons from public/kenya-counties.json
 * (county boundaries, Douglas-Peucker simplified), projected at module load
 * into a 420x460 SVG viewBox using the same equirectangular approach as
 * src/lib/kenya-map.ts: uniform scale, cos(mean latitude) x-correction, and
 * padding. Path strings and centroids are precomputed once so every consumer
 * (full map, dashboard mini map) shares one coordinate space with zero
 * per-render geometry work.
 */
import countiesJson from "../../public/kenya-counties.json";

export type CountyCentroid = { lat: number; lng: number };

export type CountyFeature = {
  /** canonical census county name */
  name: string;
  /** normalized join key (lowercase alphanumerics only) */
  key: string;
  /** SVG path string covering every ring of the county, in 420x460 map space */
  path: string;
  /** projected centroid, map space */
  cx: number;
  cy: number;
  /** geographic centroid (area-weighted, largest polygon) */
  centroid: CountyCentroid;
};

type Ring = [number, number][];
type Poly = Ring[];

type RawGeometry =
  | { type: "Polygon"; coordinates: Poly }
  | { type: "MultiPolygon"; coordinates: Poly[] };

type RawFeature = { properties: { name: string }; geometry: RawGeometry };

const features = (countiesJson as unknown as { features: RawFeature[] }).features;

export const COUNTIES_VIEWBOX = "0 0 420 460" as const;
const W = 420;
const H = 460;
const PAD = 12;

// ————— bounds over every ring, once at module load —————
let lonMin = Infinity;
let lonMax = -Infinity;
let latMin = Infinity;
let latMax = -Infinity;
for (const f of features) {
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) {
    for (const ring of poly) {
      for (const [lng, lat] of ring) {
        if (lng < lonMin) lonMin = lng;
        if (lng > lonMax) lonMax = lng;
        if (lat < latMin) latMin = lat;
        if (lat > latMax) latMax = lat;
      }
    }
  }
}

// equirectangular with cos(latMid) x-scale (matches kenya-map.ts)
const LAT_MID = (latMin + latMax) / 2;
const KX = Math.cos((LAT_MID * Math.PI) / 180);
const SPAN_X = (lonMax - lonMin) * KX;
const SPAN_Y = latMax - latMin;
const SCALE = Math.min((W - 2 * PAD) / SPAN_X, (H - 2 * PAD) / SPAN_Y);
const OFF_X = (W - SPAN_X * SCALE) / 2;
const OFF_Y = (H - SPAN_Y * SCALE) / 2;

/** Project a geographic coordinate into the 420x460 counties map space. */
export function projectCounty(lat: number, lng: number): { x: number; y: number } {
  return {
    x: (lng - lonMin) * KX * SCALE + OFF_X,
    y: H - ((lat - latMin) * SCALE + OFF_Y),
  };
}

/** Case- and punctuation-insensitive county key for joining zones to counties. */
export function countyKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function ringsOf(f: RawFeature): Poly[] {
  return f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
}

function ringCentroid(ring: Ring): { area: number; lat: number; lng: number } {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    a += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  a /= 2;
  if (Math.abs(a) < 1e-9) {
    let sx = 0;
    let sy = 0;
    for (const [x, y] of ring) {
      sx += x;
      sy += y;
    }
    return { area: 0, lng: sx / ring.length, lat: sy / ring.length };
  }
  return { area: Math.abs(a), lng: cx / (6 * a), lat: cy / (6 * a) };
}

/** Centroid of the largest outer ring: robust for counties with islands or long arms. */
function featureCentroid(polys: Poly[]): CountyCentroid {
  let best: { area: number; lat: number; lng: number } | null = null;
  for (const poly of polys) {
    const c = ringCentroid(poly[0]);
    if (!best || c.area > best.area) best = c;
  }
  return best ? { lat: best.lat, lng: best.lng } : { lat: 0, lng: 0 };
}

function ringPath(ring: Ring): string {
  let d = "";
  for (let i = 0; i < ring.length; i++) {
    const p = projectCounty(ring[i][1], ring[i][0]);
    d += (i === 0 ? "M" : "L") + p.x.toFixed(1) + "," + p.y.toFixed(1);
  }
  return d + "Z";
}

export const COUNTIES: CountyFeature[] = features.map((f) => {
  const polys = ringsOf(f);
  const centroid = featureCentroid(polys);
  const c = projectCounty(centroid.lat, centroid.lng);
  return {
    name: f.properties.name,
    key: countyKey(f.properties.name),
    path: polys.flatMap((poly) => poly.map(ringPath)).join(""),
    cx: c.x,
    cy: c.y,
    centroid,
  };
});

export const COUNTY_BY_KEY: ReadonlyMap<string, CountyFeature> = new Map(
  COUNTIES.map((c) => [c.key, c])
);

/** Former-province grouping used for map tooltips (pre-2013 administrative regions). */
const FORMER_PROVINCES: Record<string, string> = {
  baringo: "Rift Valley", bomet: "Rift Valley", "elgeyomarakwet": "Rift Valley",
  kajiado: "Rift Valley", kericho: "Rift Valley", kiambu: "Central",
  kirinyaga: "Central", "laikipia": "Rift Valley", machakos: "Eastern",
  makueni: "Eastern", marsabit: "Eastern", meru: "Eastern",
  muranga: "Central", narok: "Rift Valley", nyandarua: "Central",
  nyeri: "Central", samburu: "Rift Valley", "taitataveta": "Coast",
  "transnzoia": "Rift Valley", turkana: "Rift Valley", "uasingishu": "Rift Valley",
  "westpokot": "Rift Valley", bungoma: "Western", busia: "Western",
  kakamega: "Western", vihiga: "Western", "homabay": "Nyanza",
  kisii: "Nyanza", kisumu: "Nyanza", migori: "Nyanza", nyamira: "Nyanza",
  siaya: "Nyanza", garissa: "North Eastern", mandera: "North Eastern",
  wajir: "North Eastern", isiolo: "Eastern", embu: "Eastern",
  "tharakanithi": "Eastern", kitui: "Eastern", mombasa: "Coast",
  kilifi: "Coast", kwale: "Coast", lamu: "Coast", "tanariver": "Coast",
  nairobi: "Nairobi", nakuru: "Rift Valley", nandi: "Rift Valley",
};

/** Former province for a county key (returns "Kenya" as a neutral fallback). */
export function countyRegion(key: string): string {
  return FORMER_PROVINCES[key] ?? "Kenya";
}
