/**
 * Vehicle re-identification: the "4-zone rule".
 *
 * A vehicle descriptor is flagged as a suspected pattern vehicle when, within
 * a single 30-day window, it accumulates at least 4 sightings inside a 25 km
 * radius that overlap locations of verified incidents. The rule is the civil
 * society analog of law-enforcement ANPR pattern analysis, turned toward
 * state actors instead of citizens.
 */
import { haversineKm } from "./stats";

export const VEHICLE_RULE = {
  threshold: 4,          // minimum sightings in window
  windowDays: 30,        // sliding temporal window
  radiusKm: 25,          // spatial cluster radius
  incidentLeadDays: 30,  // incidents counted around window (+/-)
} as const;

export type Sighting = {
  id: number;
  date: Date;
  zoneId: number;
  zoneName: string;
  vehicleKey: string;
  platePartial: string;
  make: string;
  model: string;
  color: string;
  source: string;
};

export type IncidentLite = { date: Date; zoneId: number };

export type VehicleAssessment = {
  vehicleKey: string;
  platePartial: string;
  make: string;
  model: string;
  color: string;
  status: "flagged" | "monitoring" | "cleared";
  confidence: number;          // 0-1
  clusterSightings: number;    // sightings in the best window
  windowStart: Date;
  windowEnd: Date;
  zones: string[];             // zones in the spatial cluster
  incidentOverlap: number;     // verified incidents co-located in time+space
  lastSeen: Date;
  totalSightings: number;
  sightings: Sighting[];       // full chronological series for the timeline UI
};

export type ZoneCoord = { id: number; name: string; lat: number; lng: number };

export function assessVehicles(
  sightings: Sighting[],
  incidents: IncidentLite[],
  zoneCoords: ZoneCoord[]
): VehicleAssessment[] {
  const coordById = new Map(zoneCoords.map(z => [z.id, z]));
  const byKey = new Map<string, Sighting[]>();
  for (const s of sightings) {
    if (!byKey.has(s.vehicleKey)) byKey.set(s.vehicleKey, []);
    byKey.get(s.vehicleKey)!.push(s);
  }

  const results: VehicleAssessment[] = [];

  for (const [key, series] of byKey) {
    series.sort((a, b) => a.date.getTime() - b.date.getTime());
    const DAY = 86400000;

    let best: {
      anchor: Sighting;
      members: Sighting[];
      incidentOverlap: number;
    } | null = null;

    for (const anchor of series) {
      // temporal window: sightings within the 30 days FOLLOWING the anchor
      // (sliding forward window, per the plan's TIME_WINDOW_DAYS = 30)
      const t0 = anchor.date.getTime();
      const members = series.filter(s => {
        const dt = s.date.getTime() - t0;
        return dt >= 0 && dt <= VEHICLE_RULE.windowDays * DAY;
      });
      // spatial cluster: zone centroids within radiusKm of the anchor's zone
      const anchorCoord = coordById.get(anchor.zoneId);
      const inRadius = (zoneId: number) => {
        if (zoneId === anchor.zoneId || !anchorCoord) return true;
        const c = coordById.get(zoneId);
        if (!c) return false;
        return haversineKm(anchorCoord.lat, anchorCoord.lng, c.lat, c.lng) <= VEHICLE_RULE.radiusKm;
      };
      const spatial = members.filter(s => inRadius(s.zoneId));
      const clusterZones = [...new Set(spatial.map(m => m.zoneId))];

      // incidents co-located with the cluster, within the window plus lead time
      const winStart = anchor.date.getTime() - VEHICLE_RULE.incidentLeadDays * DAY;
      const winEnd = anchor.date.getTime() + VEHICLE_RULE.windowDays * DAY + VEHICLE_RULE.incidentLeadDays * DAY;
      const incidentOverlap = incidents.filter(
        inc => clusterZones.includes(inc.zoneId) && inc.date.getTime() >= winStart && inc.date.getTime() <= winEnd
      ).length;

      if (!best || spatial.length > best.members.length) {
        best = { anchor, members: spatial, incidentOverlap };
      } else if (best && spatial.length === best.members.length && incidentOverlap > best.incidentOverlap) {
        best = { anchor, members: spatial, incidentOverlap };
      }
    }

    if (!best) continue;
    const n = best.members.length;
    const zones = [...new Set(best.members.map(m => m.zoneName))];

    let status: VehicleAssessment["status"] = "cleared";
    if (n >= VEHICLE_RULE.threshold) {
      status = best.incidentOverlap >= 1 ? "flagged" : "monitoring";
    }
    const confidence = Math.min(
      0.95,
      0.5 + 0.07 * Math.max(0, n - VEHICLE_RULE.threshold) + 0.09 * Math.min(best.incidentOverlap, 3)
    );

    const template = series[0];
    results.push({
      vehicleKey: key,
      platePartial: template.platePartial,
      make: template.make,
      model: template.model,
      color: template.color,
      status,
      confidence: status === "cleared" ? Math.min(0.4, confidence) : Math.round(confidence * 100) / 100,
      clusterSightings: n,
      windowStart: best.anchor.date,
      windowEnd: new Date(best.anchor.date.getTime() + VEHICLE_RULE.windowDays * DAY),
      zones,
      incidentOverlap: best.incidentOverlap,
      lastSeen: series[series.length - 1].date,
      totalSightings: series.length,
      sightings: series,
    });
  }

  // flagged first, then monitoring, then cleared; within status by confidence
  const order = { flagged: 0, monitoring: 1, cleared: 2 } as const;
  results.sort((a, b) => order[a.status] - order[b.status] || b.confidence - a.confidence);
  return results;
}

/** Haversine helper re-export for consumers that need zone distances. */
export { haversineKm };
