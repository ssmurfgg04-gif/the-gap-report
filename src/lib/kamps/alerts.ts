/**
 * KAMPS alert layer: aggregate, zone-level protective messaging.
 *
 * Ethics rule (from the implementation plan): outputs are aggregate only.
 * No individual names, no individual rankings, no specific locations below
 * sub-county resolution. Alerts tell civil society partners WHERE risk is
 * statistically elevated and WHAT protective posture to adopt, never WHO
 * is at risk.
 */
import type { RiskBand } from "./stats";
import type { VehicleAssessment } from "./vehicle";

export type Severity = "critical" | "elevated" | "watch" | "info";

export type KampsAlert = {
  id: string;
  severity: Severity;
  kind: "zone-risk" | "cluster" | "vehicle" | "data";
  asOf: string;
  title: string;
  /** plain-language body, aggregate level only */
  message: string;
  drivers: string[];
  actions: string[];
  confidence: "high" | "medium" | "low";
};

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

export function zoneRiskAlerts(
  zones: Array<{
    id: number; name: string; county: string; index: number; band: RiskBand;
    confidence: "high" | "medium" | "low";
    drivers: string[];
  }>,
  asOf: Date
): KampsAlert[] {
  const actionsFor = (band: RiskBand): string[] => {
    switch (band) {
      case "critical":
        return [
          "Verify field check-in protocols for all partner staff operating in the zone",
          "Pre-position habeas corpus counsel on 24-hour call",
          "Brief partner civil society organizations on the aggregate risk elevation",
          "Increase Tella reporting frequency for field monitors to daily",
        ];
      case "elevated":
        return [
          "Verify check-in protocols for partner staff in the zone",
          "Notify legal partners of the elevated aggregate risk",
          "Review scheduled field visits against the risk window",
        ];
      default:
        return [
          "Raise monitoring frequency for the zone in the weekly review",
          "Include the zone in the next partner situational brief",
        ];
    }
  };

  return zones
    .filter(z => z.band === "critical" || z.band === "elevated" || z.band === "watch")
    .map(z => ({
      id: `zone-${z.id}`,
      severity: z.band as Severity,
      kind: "zone-risk" as const,
      asOf: fmtDate(asOf),
      title: `${z.band === "critical" ? "CRITICAL" : z.band === "elevated" ? "ELEVATED" : "WATCH"} · ${z.name} (${z.county})`,
      message:
        `Composite risk index ${Math.round(z.index * 10) / 10} of 100 for ${z.name}, ${z.county}. ` +
        `The score aggregates bias-corrected rate evidence, cluster membership, temporal deviation and vehicle signals. ` +
        `Aggregate zone-level assessment only: it names no individuals.`,
      drivers: z.drivers,
      actions: actionsFor(z.band),
      confidence: z.confidence,
    }));
}

export function clusterAlert(
  cluster: {
    zoneNames: string[]; rr: number; p: number; observed: number; expected: number; radiusKm: number;
  },
  asOf: Date
): KampsAlert {
  const pText = cluster.p < 0.001 ? "p < 0.001" : `p = ${cluster.p.toFixed(3).replace(/0+$/, "")}`;
  return {
    id: `cluster-${cluster.zoneNames.map(n => n.replace(/\s+/g, "")).join("-").toLowerCase()}`,
    severity: "info",
    kind: "cluster",
    asOf: fmtDate(asOf),
    title: `SPATIAL SCAN · significant cluster: ${cluster.zoneNames.join(", ")}`,
    message:
      `The scan statistic detected a population-adjusted excess across ${cluster.zoneNames.join(", ")} ` +
      `(${cluster.observed} adjusted cases observed vs ${cluster.expected} expected, relative risk ` +
      `${cluster.rr.toFixed(2)}x inside the cluster boundary, ${pText}, 999 Monte Carlo replications). ` +
      `This is not a raw count ranking: it is excess risk after adjusting for where people live.`,
    drivers: [
      `Relative risk ${cluster.rr.toFixed(2)}x inside vs outside`,
      `Observed ${cluster.observed} vs expected ${cluster.expected}`,
      pText,
    ],
    actions: [
      "Treat the cluster as a unit for protective planning, not as a target list",
      "Cross-reference the cluster with partner field presence",
    ],
    confidence: cluster.p < 0.05 ? "high" : "medium",
  };
}

export function vehicleAlert(v: VehicleAssessment, asOf: Date): KampsAlert {
  return {
    id: `vehicle-${v.vehicleKey.toLowerCase()}`,
    severity: "info",
    kind: "vehicle",
    asOf: fmtDate(asOf),
    title: `VEHICLE PATTERN · ${v.color} ${v.make} ${v.model} (${v.platePartial})`,
    message:
      `${v.clusterSightings} sightings in a 30-day window within a 25 km radius across ` +
      `${v.zones.join(", ")}, with ${v.incidentOverlap} verified incidents co-located in time and space. ` +
      `Meets the four-zone rule threshold. Confidence ${v.confidence.toFixed(2)}. ` +
      `Descriptor-level tracking only: no plate matches, no owner identification, no individuals.`,
    drivers: [
      `${v.clusterSightings} sightings / 30 days (threshold 4)`,
      `${v.incidentOverlap} co-located verified incidents`,
      `Last sighting ${fmtDate(v.lastSeen)}`,
    ],
    actions: [
      "Circulate the vehicle descriptor to field monitors through secure channels",
      "Request opportunistic documentation (photo, location, time) if safely encountered",
      "Do not approach or interfere with the vehicle",
    ],
    confidence: v.confidence >= 0.8 ? "high" : "medium",
  };
}

export function dataAlert(documented: number, estimated: number, asOf: Date): KampsAlert {
  return {
    id: "data-mse",
    severity: "info",
    kind: "data",
    asOf: fmtDate(asOf),
    title: "DATA LAYER · underreporting estimate updated",
    message:
      `Multiple Systems Estimation across three capture lists estimates ${estimated} total incidents ` +
      `against ${documented} documented, an underreporting factor of ` +
      `${(estimated / Math.max(documented, 1)).toFixed(2)}x. Rural zones show the widest intervals. ` +
      `All figures are aggregate; the estimation method is the same one HRDAG applied to conflict mortality records.`,
    drivers: [
      `Documented ${documented}, estimated ${estimated}`,
      "3-list capture-recapture, log-linear estimator, 400 bootstrap replications",
    ],
    actions: [
      "File or renew Access to Information requests for police and mortuary registries",
      "Prioritize field collection in zones with wide confidence intervals",
    ],
    confidence: "high",
  };
}
