/**
 * Static content for the KAMPS sections of The Gap Report.
 * UI copy rule: no em dashes anywhere in rendered text.
 */

export const kampsIdentity = {
  name: "KAMPS",
  longName: "Kenya Abduction Monitoring & Prediction System",
  kicker: "The Blueprint",
  title: "The Kenya Abduction Monitoring & Prediction System",
  lede: "KAMPS counts what the state will not. Zone-level risk corrected for population and reporting bias, capture-recapture on the undercount, and pattern vehicles from the public record, all on sources anyone can open. The blueprint below is the specification; the live engine runs further down this page.",
};

export type ArchLayer = {
  index: string;
  name: string;
  role: string;
  points: string[];
};

export const architecture: ArchLayer[] = [
  {
    index: "01",
    name: "Collection",
    role: "Field and open-source intake",
    points: [
      "Tella app: encrypted, offline-capable field documentation",
      "ACLED and news RSS collectors on a VPN/Tor collection server",
      "Access to Information Act requests: police occurrence books, mortuary registries, IPOA summaries",
    ],
  },
  {
    index: "02",
    name: "Verification",
    role: "Berkeley Protocol standard",
    points: [
      "Two independent sources required before a record enters the warehouse",
      "Splink probabilistic record linkage: deduplication across sources",
      "Three-tier reliability hierarchy: anchor on Tier 1, corroborate with Tier 2",
    ],
  },
  {
    index: "03",
    name: "Analysis",
    role: "Six-stage statistical engine",
    points: [
      "Runs on an air-gapped, encrypted workstation (Tails OS, LUKS)",
      "Empirical Bayes, MSE, spatial scan, temporal anomaly, composite index",
      "Every result carries provenance and a documented verification trail",
    ],
  },
  {
    index: "04",
    name: "Alert",
    role: "Aggregate output only",
    points: [
      "Zone-level risk and vehicle pattern descriptors, nothing finer",
      "Published through a read-only Tor hidden service",
      "No individual names, no individual rankings, no raw data",
    ],
  },
];

export type TierSpec = {
  tier: string;
  label: string;
  sources: string[];
  use: string;
};

export const dataTiers: TierSpec[] = [
  {
    tier: "Tier 1",
    label: "Anchor sources",
    sources: ["Missing Voices verified database", "KNCHR official reports", "Court judgments and inquests", "IPOA investigation summaries"],
    use: "Anchor records: multi-source verified cases that define the incident universe",
  },
  {
    tier: "Tier 2",
    label: "Corroboration sources",
    sources: ["ACLED geocoded events", "UCDP GED", "Hospital and mortuary registries", "Mainstream news reports"],
    use: "Corroboration and capture-recapture lists: the overlap structure that powers MSE",
  },
  {
    tier: "Tier 3",
    label: "Signal sources",
    sources: ["Social media reports", "Citizen journalism", "Police OB records", "Anonymous tips"],
    use: "Verification-gated leads: never counted until independently confirmed",
  },
];

export type PipelineStage = {
  stage: string;
  name: string;
  method: string;
  output: string;
};

export const pipeline: PipelineStage[] = [
  {
    stage: "1",
    name: "Crude rates",
    method: "Incidents divided by population, per 100,000, using KNBS 2019 census county denominators",
    output: "Raw per-capita rates by county",
  },
  {
    stage: "2",
    name: "Empirical Bayes smoothing",
    method: "Poisson-Gamma shrinkage toward the national mean (Marshall global prior)",
    output: "Stabilized rates: no more spurious spikes from small populations",
  },
  {
    stage: "3",
    name: "Multiple Systems Estimation",
    method: "Capture-recapture across independent lists (currently Missing Voices and public-record news; police and mortuary lists pending ATI requests)",
    output: "Underreporting factors by zone: the hidden caseload, quantified",
  },
  {
    stage: "4",
    name: "Spatial scan statistics",
    method: "Variable-circle scan (Kulldorff Poisson), 999 Monte Carlo replications, population-adjusted",
    output: "Significant clusters with relative risk and p-values",
  },
  {
    stage: "5",
    name: "Temporal anomaly detection",
    method: "Rolling 90-day baseline per zone, flagged at 2 standard deviations",
    output: "Zones deviating from their own recent history",
  },
  {
    stage: "6",
    name: "Composite risk index",
    method: "Weighted aggregation of stages 2 through 5, the documented vehicle signal, and ACLED's trailing-12-month corroboration, walk-forward calibrated and scaled 0 to 100",
    output: "Zone-level risk bands with confidence grading",
  },
];

export const safeguardPairs: { risk: string; mitigation: string }[] = [
  {
    risk: "Database compromise creates a kill list",
    mitigation: "Air-gapped master database, aggregate-only outputs, no individual rankings anywhere in the pipeline",
  },
  {
    risk: "Wrong zone prediction misdirects protective resources",
    mitigation: "Confidence intervals on every estimate, multiple independent indicators, human review before any action",
  },
  {
    risk: "Adversary learns of the system and adapts tactics",
    mitigation: "Regular methodology review, detection thresholds recalibrated, compartmentalized partner knowledge",
  },
  {
    risk: "Publication endangers communities or individuals",
    mitigation: "Strict output controls, sub-county aggregation floor, community consultation before publication",
  },
  {
    risk: "Legal challenge under the Data Protection Act 2019",
    mitigation: "DPIA before deployment, documented lawful basis, data minimization, ODPC compliance procedures",
  },
  {
    risk: "Partner organization infiltrated",
    mitigation: "Need-to-know compartmentalization, verification protocols, secure collection channels end to end",
  },
];

export const ethicsStatement = {
  headline: "The system exists to protect people, not to predict them.",
  body: "A system that identifies who will be abducted next is functionally a targeting list. A system that identifies which zones carry statistically elevated risk after adjusting for population and underreporting is a protective tool. The difference is not semantic. It is the difference between a weapon and a shield, and it drives every design decision above.",
};

export const roadmapPhases: { phase: string; window: string; title: string; items: string[] }[] = [
  {
    phase: "Phase 1",
    window: "Weeks 1 to 4",
    title: "Foundation",
    items: [
      "Missing Voices partnership and DPIA",
      "Encrypted PostgreSQL + PostGIS infrastructure",
      "Historical ingestion: 423 disappearances, 1,461 killings, ACLED back to 1997",
      "First crude-rate and EB-smoothed maps",
    ],
  },
  {
    phase: "Phase 2",
    window: "Weeks 5 to 8",
    title: "Advanced analytics",
    items: [
      "SaTScan cluster detection on verified incidents",
      "ATI filings and MSE underreporting factors by zone",
      "Spatial regression for excess risk",
      "Activist network visibility mapping",
    ],
  },
  {
    phase: "Phase 3",
    window: "Weeks 9 to 12",
    title: "Vehicle detection",
    items: [
      "YOLOv8 fine-tuned on Kenyan vehicle types",
      "Tella to secure server to analyst pipeline",
      "Four-zone rule calibrated against public case patterns",
      "Security audit of the full system",
    ],
  },
  {
    phase: "Phase 4",
    window: "Months 4 to 6",
    title: "Pilot and launch",
    items: [
      "Shadow mode: outputs generated, compared against outcomes",
      "Partner review with trusted CSOs",
      "Public launch of aggregate outputs over Tor",
      "Quarterly public risk reports begin",
    ],
  },
];

export const vehicleRuleSpec = [
  { label: "Sightings", value: "4+", note: "minimum in window" },
  { label: "Window", value: "30 days", note: "sliding" },
  { label: "Radius", value: "25 km", note: "spatial cluster" },
  { label: "Overlap", value: "incidents", note: "co-located in time" },
];

export const livePanel = {
  kicker: "The Instrument, Running",
  title: "Real data. Real statistics.",
  lede: "This panel runs the six-stage pipeline against the ingested real datasets: the Missing Voices victim database and monthly statistics, a curated public-record incident file with source URLs, KNCHR statements, KNBS 2019 census denominators for all 47 counties, and UCDP GED organized-violence events from 1989 to 2025. Every number is computed live and traced to its source.",
  dataNote:
    "Entity resolution deduplicates the lists before counting. Where the data cannot support a statistic, the engine says so instead of inventing one: that is the system working as designed.",
};
