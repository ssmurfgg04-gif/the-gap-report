/**
 * KAMPS deterministic seed generator.
 *
 * Produces SIMULATED demonstration data for the Kenya Abduction Monitoring &
 * Prediction System prototype. Modeled on the scale of published aggregates
 * (Missing Voices: 423 disappearances since 2019; 2024-2026 escalation),
 * but every incident, plate, and sighting is synthetic. Ground truth (the
 * number of incidents the simulator actually generated, including those no
 * list captured) is stored in KampsMeta so the demo can show how close the
 * MSE estimate lands to the truth it is designed to recover.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

// ————— deterministic PRNG (mulberry32) —————
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260927);
const randRange = (lo: number, hi: number) => lo + (hi - lo) * rand();
const randInt = (lo: number, hi: number) => Math.floor(randRange(lo, hi + 1));

// ————— zones —————
type ZoneSpec = {
  name: string; county: string; lat: number; lng: number;
  population: number; urbanicity: number;
  /** base monthly incident intensity (true, pre-capture) */
  base: number;
  /** multiplier timeline applied to base */
  trend?: Array<{ from: string; to: string; mult: number }>;
};

const zones: ZoneSpec[] = [
  { name: "Kasarani", county: "Nairobi", lat: -1.22, lng: 36.90, population: 780000, urbanicity: 0.95, base: 0.62,
    trend: [{ from: "2024-11", to: "2026-08", mult: 2.4 }] }, // documented police-drop hotspot
  { name: "Embakasi", county: "Nairobi", lat: -1.32, lng: 36.90, population: 978000, urbanicity: 0.95, base: 0.50,
    trend: [{ from: "2024-11", to: "2026-08", mult: 1.8 }] },
  { name: "Starehe", county: "Nairobi", lat: -1.283, lng: 36.83, population: 276000, urbanicity: 1.0, base: 0.42,
    trend: [{ from: "2024-11", to: "2025-06", mult: 2.1 }] },
  { name: "Dagoretti North", county: "Nairobi", lat: -1.30, lng: 36.78, population: 287000, urbanicity: 0.95, base: 0.34,
    trend: [{ from: "2024-11", to: "2026-08", mult: 1.5 }] },
  { name: "Ruiru", county: "Kiambu", lat: -1.15, lng: 36.97, population: 355000, urbanicity: 0.8, base: 0.30,
    trend: [{ from: "2025-01", to: "2026-08", mult: 1.9 }] },
  { name: "Naivasha", county: "Nakuru", lat: -0.72, lng: 36.43, population: 375000, urbanicity: 0.55, base: 0.24,
    trend: [{ from: "2025-04", to: "2025-10", mult: 2.0 }] },
  { name: "Nakuru Town West", county: "Nakuru", lat: -0.28, lng: 36.05, population: 380000, urbanicity: 0.7, base: 0.22 },
  { name: "Kisumu Central", county: "Kisumu", lat: -0.09, lng: 34.77, population: 165000, urbanicity: 0.85, base: 0.26,
    trend: [{ from: "2023-06", to: "2023-11", mult: 2.2 }] }, // protest wave
  { name: "Nyali", county: "Mombasa", lat: -4.04, lng: 39.70, population: 250000, urbanicity: 0.8, base: 0.18 },
  { name: "Nyeri Central", county: "Nyeri", lat: -0.42, lng: 36.95, population: 190000, urbanicity: 0.6, base: 0.13 },
  { name: "Garissa Township", county: "Garissa", lat: 0.46, lng: 39.64, population: 160000, urbanicity: 0.25, base: 0.22,
    trend: [{ from: "2025-03", to: "2026-08", mult: 1.6 }] },
  { name: "Turkana Central", county: "Turkana", lat: 2.49, lng: 35.60, population: 120000, urbanicity: 0.05, base: 0.20,
    trend: [{ from: "2025-06", to: "2026-08", mult: 1.5 }] },
];

// ————— capture probabilities by urbanicity —————
// Rural zones are far less visible to the civil-society list (the documented
// underreporting pattern MSE exists to quantify).
function captureProbs(urbanicity: number) {
  return {
    mv: 0.45 + 0.35 * urbanicity,        // Missing Voices (strongest in cities)
    ob: 0.20 + 0.18 * urbanicity,        // Police occurrence book (partial digitization)
    mort: 0.14 + 0.16 * urbanicity,      // mortuary / unclaimed-body registries
  };
}

// global era multipliers (true intensity across all zones)
const era = (ym: string): number => {
  if (ym < "2021-09") return 0.72;
  if (ym < "2023-01") return 0.95;
  if (ym < "2024-01") return 1.15;
  if (ym < "2024-11") return 1.3;
  if (ym < "2025-07") return 1.9; // Dec-2024 wave and aftermath
  return 1.55;
};

const START = new Date("2019-08-01T00:00:00Z");
const END = new Date("2026-09-20T00:00:00Z");

function monthsBetween(a: Date, b: Date): number {
  return (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth());
}
const ym = (d: Date) => d.toISOString().slice(0, 7);

// Poisson draw (Knuth) with the deterministic rng
function poisson(lambda: number): number {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rand(); } while (p > L);
  return k - 1;
}

async function main() {
  // wipe KAMPS tables
  await db.kampsSighting.deleteMany();
  await db.kampsIncident.deleteMany();
  await db.kampsZone.deleteMany();
  await db.kampsMeta.deleteMany();

  const zoneRows = await Promise.all(
    zones.map((z, i) =>
      db.kampsZone.create({
        data: { id: i + 1, name: z.name, county: z.county, lat: z.lat, lng: z.lng,
                population: z.population, urbanicity: z.urbanicity },
      })
    )
  );

  // ————— incidents —————
  type IncidentRow = { date: Date; zoneId: number; mv: boolean; ob: boolean; mort: boolean };
  const incidents: IncidentRow[] = [];
  const nMonths = monthsBetween(START, END);

  for (let m = 0; m <= nMonths; m++) {
    const monthStart = new Date(START); monthStart.setUTCMonth(monthStart.getUTCMonth() + m);
    const daysInMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 0)).getUTCDate();
    zones.forEach((z, zi) => {
      let mult = era(ym(monthStart));
      z.trend?.forEach(t => { if (ym(monthStart) >= t.from && ym(monthStart) <= t.to) mult *= t.mult; });
      const lambda = z.base * mult;
      const k = poisson(lambda);
      for (let j = 0; j < k; j++) {
        const day = randInt(1, daysInMonth);
        const date = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth(), day, randInt(0, 23), randInt(0, 59)));
        const p = captureProbs(z.urbanicity);
        const mv = rand() < p.mv, ob = rand() < p.ob, mort = rand() < p.mort;
        incidents.push({ date, zoneId: zoneRows[zi].id, mv, ob, mort });
      }
    });
  }

  const all = incidents.length;                          // ground truth total
  const documented = incidents.filter(i => i.mv || i.ob || i.mort);

  // write documented incidents only (the warehouse holds what lists captured)
  let iid = 0;
  const chunk = 500;
  for (let c = 0; c < documented.length; c += chunk) {
    await db.kampsIncident.createMany({
      data: documented.slice(c, c + chunk).map(i => ({
        id: ++iid, date: i.date, zoneId: i.zoneId,
        inMissingVoices: i.mv, inPoliceOB: i.ob, inMortuary: i.mort,
      })),
    });
  }

  // ————— vehicle sightings —————
  // Descriptors are FICTIONAL. They echo publicly reported vehicle patterns
  // (unmarked Subarus near abduction sites) without replicating any real plate.
  type SightingSpec = { vehicleKey: string; platePartial: string; make: string; model: string; color: string; date: string; zoneName: string; source: string };
  const sightingSpecs: SightingSpec[] = [
    // V1: flagged — dense Nairobi cluster, 6 sightings / 30 days, incident overlap
    { vehicleKey: "V1", platePartial: "KDG 4\u00b77B", make: "Subaru", model: "Forester", color: "Silver", date: "2026-07-04", zoneName: "Kasarani", source: "traffic camera still" },
    { vehicleKey: "V1", platePartial: "KDG 4\u00b77B", make: "Subaru", model: "Forester", color: "Silver", date: "2026-07-09", zoneName: "Embakasi", source: "field monitor (Tella)" },
    { vehicleKey: "V1", platePartial: "KDG 4\u00b77B", make: "Subaru", model: "Forester", color: "Silver", date: "2026-07-15", zoneName: "Kasarani", source: "citizen report" },
    { vehicleKey: "V1", platePartial: "KDG 4\u00b77B", make: "Subaru", model: "Forester", color: "Silver", date: "2026-07-21", zoneName: "Ruiru", source: "OSINT geolocation" },
    { vehicleKey: "V1", platePartial: "KDG 4\u00b77B", make: "Subaru", model: "Forester", color: "Silver", date: "2026-07-27", zoneName: "Kasarani", source: "field monitor (Tella)" },
    { vehicleKey: "V1", platePartial: "KDG 4\u00b77B", make: "Subaru", model: "Forester", color: "Silver", date: "2026-08-03", zoneName: "Embakasi", source: "traffic camera still" },
    // V2: flagged — central Nairobi cluster, 5 sightings
    { vehicleKey: "V2", platePartial: "KCX 9\u00b71Y", make: "Subaru", model: "Legacy", color: "White", date: "2026-06-08", zoneName: "Starehe", source: "traffic camera still" },
    { vehicleKey: "V2", platePartial: "KCX 9\u00b71Y", make: "Subaru", model: "Legacy", color: "White", date: "2026-06-14", zoneName: "Starehe", source: "citizen report" },
    { vehicleKey: "V2", platePartial: "KCX 9\u00b71Y", make: "Subaru", model: "Legacy", color: "White", date: "2026-06-22", zoneName: "Dagoretti North", source: "field monitor (Tella)" },
    { vehicleKey: "V2", platePartial: "KCX 9\u00b71Y", make: "Subaru", model: "Legacy", color: "White", date: "2026-06-29", zoneName: "Starehe", source: "OSINT geolocation" },
    { vehicleKey: "V2", platePartial: "KCX 9\u00b71Y", make: "Subaru", model: "Legacy", color: "White", date: "2026-07-03", zoneName: "Dagoretti North", source: "traffic camera still" },
    // V3: flagged — government-prefix partial, Nairobi + Kiambu, 7 sightings
    { vehicleKey: "V3", platePartial: "GK A2\u00b7", make: "Toyota", model: "Land Cruiser", color: "Grey", date: "2026-07-11", zoneName: "Kasarani", source: "traffic camera still" },
    { vehicleKey: "V3", platePartial: "GK A2\u00b7", make: "Toyota", model: "Land Cruiser", color: "Grey", date: "2026-07-15", zoneName: "Embakasi", source: "field monitor (Tella)" },
    { vehicleKey: "V3", platePartial: "GK A2\u00b7", make: "Toyota", model: "Land Cruiser", color: "Grey", date: "2026-07-22", zoneName: "Ruiru", source: "citizen report" },
    { vehicleKey: "V3", platePartial: "GK A2\u00b7", make: "Toyota", model: "Land Cruiser", color: "Grey", date: "2026-07-28", zoneName: "Kasarani", source: "OSINT geolocation" },
    { vehicleKey: "V3", platePartial: "GK A2\u00b7", make: "Toyota", model: "Land Cruiser", color: "Grey", date: "2026-08-02", zoneName: "Embakasi", source: "traffic camera still" },
    { vehicleKey: "V3", platePartial: "GK A2\u00b7", make: "Toyota", model: "Land Cruiser", color: "Grey", date: "2026-08-09", zoneName: "Ruiru", source: "field monitor (Tella)" },
    { vehicleKey: "V3", platePartial: "GK A2\u00b7", make: "Toyota", model: "Land Cruiser", color: "Grey", date: "2026-08-14", zoneName: "Kasarani", source: "traffic camera still" },
    // V4: NOT flagged — 3 sightings spread over ~90 days (below threshold)
    { vehicleKey: "V4", platePartial: "KBY 3\u00b76T", make: "Toyota", model: "Axio", color: "Blue", date: "2026-05-02", zoneName: "Naivasha", source: "citizen report" },
    { vehicleKey: "V4", platePartial: "KBY 3\u00b76T", make: "Toyota", model: "Axio", color: "Blue", date: "2026-06-18", zoneName: "Naivasha", source: "citizen report" },
    { vehicleKey: "V4", platePartial: "KBY 3\u00b76T", make: "Toyota", model: "Axio", color: "Blue", date: "2026-08-01", zoneName: "Nakuru Town West", source: "traffic camera still" },
    // V5: NOT flagged — only 2 sightings
    { vehicleKey: "V5", platePartial: "KBZ 7\u00b79M", make: "Nissan", model: "X-Trail", color: "Black", date: "2026-07-12", zoneName: "Kisumu Central", source: "citizen report" },
    { vehicleKey: "V5", platePartial: "KBZ 7\u00b79M", make: "Nissan", model: "X-Trail", color: "Black", date: "2026-08-23", zoneName: "Kisumu Central", source: "field monitor (Tella)" },
  ];

  let sid = 0;
  for (const s of sightingSpecs) {
    const zone = zoneRows.find(z => z.name === s.zoneName)!;
    await db.kampsSighting.create({
      data: {
        id: ++sid, date: new Date(`${s.date}T10:00:00Z`), zoneId: zone.id,
        vehicleKey: s.vehicleKey, platePartial: s.platePartial,
        make: s.make, model: s.model, color: s.color, source: s.source,
      },
    });
  }

  // ————— meta —————
  await db.kampsMeta.createMany({
    data: [
      { key: "simulated_true_total", value: String(all) },
      { key: "documented_total", value: String(documented.length) },
      { key: "as_of", value: END.toISOString() },
      { key: "seed", value: "20260927" },
      { key: "generated_at", value: new Date().toISOString() },
    ],
  });

  const perZone = zoneRows.map(z => {
    const doc = documented.filter(i => i.zoneId === z.id).length;
    const tru = incidents.filter(i => i.zoneId === z.id).length;
    return `  ${z.name}: documented ${doc} / true ${tru}`;
  }).join("\n");

  console.log(`KAMPS seed complete.`);
  console.log(`  total true incidents:      ${all}`);
  console.log(`  documented (captured >=1): ${documented.length}  (${(100 * documented.length / all).toFixed(1)}% capture)`);
  console.log(`  sightings: ${sid}`);
  console.log(`Per zone:\n${perZone}`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
