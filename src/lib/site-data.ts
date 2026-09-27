export type Capability = {
  name: string;
  detail: string;
};

export type Player = {
  index: string;
  name: string;
  epithet: string;
  affiliation: string;
  what: string;
  scale: string;
  gap: string;
  closest: boolean;
};

export type MatrixCell = "core" | "partial" | "none";

export type MatrixRow = {
  capability: string;
  values: MatrixCell[]; // 8 players, same order as players
  thisSystem: "core" | "partial";
};

export const players: Player[] = [
  {
    index: "01",
    name: "Early Warning Project",
    epithet: "The statistical benchmark",
    affiliation: "US Holocaust Memorial Museum + Dartmouth College",
    what: "Generates annual Statistical Risk Assessments estimating the likelihood of new mass killing onset in 160+ countries. A logistic regression model with elastic-net regularization, trained on 1960 to 2015 data and fed 30+ variables: regional civil-liberties inequality, population size, mass-killing history, infant mortality, coup attempts, elite-approved political killings.",
    scale: "Country level · Annual resolution · 160+ countries",
    gap: "Predicts mass-killing onset (25+ deaths/year) at the national level, not individual abductions at the sub-county level. Temporal resolution is annual, not weekly. No vehicle tracking, OSINT, or social-network analysis.",
    closest: true,
  },
  {
    index: "02",
    name: "ACLED CAST",
    epithet: "The operational analog",
    affiliation: "Armed Conflict Location & Event Data Project",
    what: "A conflict forecasting platform that predicts political violence events up to six months ahead for every country in the world, built on ACLED's event-level database of political violence and protest spanning 1997 to the present.",
    scale: "Country + sub-national · Six-month horizon · Global",
    gap: "Predicts political violence events (battles, protests, riots), not targeted abductions of specific individuals. No vehicle re-identification, no network analysis of activist communities, no bias-corrected disappearance estimation.",
    closest: true,
  },
  {
    index: "03",
    name: "HRDAG",
    epithet: "The methodological gold standard",
    affiliation: "Human Rights Data Analysis Group",
    what: "Applies rigorous statistics (Multiple Systems Estimation, capture-recapture) to reveal gaps in human rights records. In one project they estimated 163,537 deaths when only a fraction were documented, proving recorded cases are a systematic undercount of the truth.",
    scale: "Project-based · Specific conflicts and countries · Retrospective",
    gap: "Retrospective analysis: estimating how many were killed after the fact. No prospective prediction, no vehicle tracking, no real-time monitoring. Their MSE methods should inform the system's bias-correction layer.",
    closest: true,
  },
  {
    index: "04",
    name: "Forensic Architecture",
    epithet: "The investigation unit",
    affiliation: "Goldsmiths, University of London",
    what: "Undertakes advanced spatial and media investigations into human rights violations using 3D models, animations, interactive cartographies and open-source data. 70+ completed forensic investigations that counter official narratives of contentious events. PATTRN, their open-source participatory fact-mapping tool.",
    scale: "Incident-specific · Post-incident · 70+ investigations",
    gap: "Post-incident reconstruction: building evidence after an event. No pre-incident prediction. Case-by-case rather than systemic pattern modeling. Methodology is directly relevant; application is not.",
    closest: false,
  },
  {
    index: "05",
    name: "Amnesty Crisis Evidence Lab",
    epithet: "OSINT at scale",
    affiliation: "Amnesty International",
    what: "Open-source investigations using satellite imagery, social media analysis and digital forensics. Their Mariupol theatre strike work verified 46 photos and videos to establish a clear war crime. Amnesty Decoders micro-tasks thousands of volunteers: Decode Darfur engaged 30,000+ volunteers contributing 10,000+ hours.",
    scale: "Incident-specific · Global reach · Crowdsourced at scale",
    gap: "Documentation and advocacy, establishing what happened and pushing for accountability. No statistical risk modeling, no vehicle pattern detection, no real-time early warning.",
    closest: false,
  },
  {
    index: "06",
    name: "Sentinel Project",
    epithet: "The early-warning framework",
    affiliation: "The Sentinel Project for Genocide Prevention",
    what: "Operates a four-phase Early Warning System: (1) Risk Assessment of static predisposing characteristics, (2) Monitoring with dynamic information gathering, (3) Threat Analysis integrating information into situations of concern, (4) Prevention Planning working directly with threatened communities.",
    scale: "Community level · Months-to-years horizon · Direct engagement",
    gap: "Focuses on genocide and mass atrocities at community level, not enforced disappearances at individual/sub-county level. Temporal horizon of months-years, not weeks. No vehicle re-identification or spatial scan statistics.",
    closest: false,
  },
  {
    index: "07",
    name: "Bellingcat",
    epithet: "The OSINT methodology",
    affiliation: "Independent investigative collective",
    what: "Open-source investigations using satellite imagery, social media, flight tracking and vehicle tracking: Russian missile launchers across Ukraine, chemical attacks in Syria, war crimes across multiple conflicts. Their Online Investigation Toolkit curates tools for OSINT practitioners.",
    scale: "Case-specific · Global · Reactive",
    gap: "Specific investigations reconstructing particular events after they occur, not systematic, continuous monitoring. No predictive modeling, spatial statistics, or real-time risk assessment. Vehicle tracking is case-specific, not pattern-based.",
    closest: true,
  },
  {
    index: "08",
    name: "Conflict Archives",
    epithet: "The evidentiary standard",
    affiliation: "Syrian Archive · Yemeni Archive · Ukrainian Archives",
    what: "Comprehensive documentation of confirmed incidents with rigorous preservation protocols: investigators manually tag weather, munitions and coordinates in observation sheets, maintain chain-of-custody processes, and archive satellite imagery with evidentiary naming conventions that support criminal complaints.",
    scale: "Incident-level · Archival · Multi-conflict datasets",
    gap: "Documentation for accountability, building evidence for future prosecutions. Reactive, not proactive. No statistical risk modeling or early warning.",
    closest: false,
  },
];

export const capabilities: MatrixRow[] = [
  {
    capability: "Predicts individual abductions",
    values: ["none", "none", "none", "none", "none", "partial", "none", "none"],
    thisSystem: "core",
  },
  {
    capability: "Sub-national geographic resolution",
    values: ["none", "partial", "core", "core", "core", "partial", "core", "core"],
    thisSystem: "core",
  },
  {
    capability: "Real-time or near-real-time",
    values: ["none", "core", "none", "none", "core", "partial", "core", "none"],
    thisSystem: "core",
  },
  {
    capability: "Vehicle pattern recognition",
    values: ["none", "none", "none", "none", "none", "none", "partial", "none"],
    thisSystem: "core",
  },
  {
    capability: "Bias correction (MSE, EB smoothing)",
    values: ["partial", "none", "core", "none", "none", "none", "none", "none"],
    thisSystem: "core",
  },
  {
    capability: "Network analysis of activists",
    values: ["none", "none", "none", "none", "none", "none", "partial", "none"],
    thisSystem: "core",
  },
  {
    capability: "Focus on state abductions of civil society",
    values: ["none", "none", "core", "core", "core", "none", "core", "core"],
    thisSystem: "core",
  },
  {
    capability: "Spatial scan statistics",
    values: ["none", "none", "none", "none", "none", "none", "none", "none"],
    thisSystem: "core",
  },
];

export const whyNot: { index: string; title: string; body: string }[] = [
  {
    index: "1",
    title: "Different missions",
    body: "The Early Warning Project exists to prevent mass atrocities, not individual abductions. HRDAG provides accurate historical records for accountability, not prediction. Forensic Architecture counters official narratives through investigation, not early warning. Bellingcat conducts specific investigations, not systematic monitoring.",
  },
  {
    index: "2",
    title: "Different scale requirements",
    body: "Mass atrocity prediction works at the country level with annual temporal resolution. Individual abduction prediction requires sub-county geographic resolution and weekly temporal resolution: a fundamentally different technical challenge that none of the existing systems were designed for.",
  },
  {
    index: "3",
    title: "Different data requirements",
    body: "Existing systems rely on open data (news reports, satellite imagery, social media). This system requires verified civil society data (Missing Voices, 7 years), government records via ATI (police occurrence books, mortuary registries), and encrypted field collection (Tella app): a hybrid approach nobody else uses.",
  },
  {
    index: "4",
    title: "The vehicle component is novel",
    body: "No human rights organization globally uses vehicle re-identification (the four-zone rule) as an early warning indicator for state abductions. The closest analog is law enforcement's use of ANPR for crime prediction, but applied by civil society against the state rather than by the state against citizens.",
  },
  {
    index: "5",
    title: "The ethical tightrope is unique",
    body: "A system that predicts which activists will be abducted creates a targeting list if compromised. This is why Amnesty and HRW focus on documentation after the fact. The resolution (aggregate zone-level outputs without individual rankings) is itself a methodological innovation.",
  },
];

export const learnings: { org: string; adopt: string; avoid: string }[] = [
  {
    org: "Early Warning Project",
    adopt: "Statistical modeling approach, risk factor identification, model validation methodology",
    avoid: "Country-level aggregation; sub-county resolution is required",
  },
  {
    org: "ACLED CAST",
    adopt: "Event-level data collection, georeferencing methodology, forecasting platform architecture",
    avoid: "Armed-conflict focus; a civil society focus is required",
  },
  {
    org: "HRDAG",
    adopt: "Multiple Systems Estimation, bias correction, statistical rigor, the convenience-sample critique",
    avoid: "Retrospective focus; prediction is required",
  },
  {
    org: "Forensic Architecture",
    adopt: "PATTRN open-source tool, spatial analysis methodology, OSINT integration",
    avoid: "Post-incident focus; early warning is required",
  },
  {
    org: "Amnesty Crisis Evidence Lab",
    adopt: "Satellite verification methodology, volunteer crowdsourcing via Decoders",
    avoid: "Investigation focus; continuous monitoring is required",
  },
  {
    org: "Sentinel Project",
    adopt: "Four-phase early warning framework, community engagement approach",
    avoid: "Genocide focus; disappearance focus is required",
  },
  {
    org: "Bellingcat",
    adopt: "Vehicle tracking methodology, OSINT toolkit, verification techniques",
    avoid: "Case-specific focus; systematic monitoring is required",
  },
  {
    org: "Conflict Archives",
    adopt: "Documentation protocols, preservation standards, evidentiary chain of custody",
    avoid: "Archival focus; real-time prediction is required",
  },
];

export const whyNow: { title: string; body: string }[] = [
  {
    title: "Technology maturity",
    body: "The core tools (Splink for record linkage, SaTScan for cluster detection, YOLOv8 for vehicle re-identification, PySAL for spatial analysis) are now open-source and accessible.",
  },
  {
    title: "Data availability",
    body: "Missing Voices holds 7 years of verified data. ACLED provides 25+ years of conflict events. Meta HRSL provides 30m-resolution population data.",
  },
  {
    title: "Methodological frameworks exist",
    body: "The Berkeley Protocol, HRDAG methods, and Bellingcat verification techniques provide a rigorous, tested foundation.",
  },
  {
    title: "Political urgency",
    body: "Kenya's 2027 election creates a window where this system could prevent mass abductions.",
  },
  {
    title: "Global attention",
    body: "Transnational repression and enforced disappearances are receiving increasing international focus.",
  },
];

export const exportRegions: { country: string; note: string }[] = [
  { country: "Mexico", note: "110,000+ disappeared persons: the largest crisis of its kind globally" },
  { country: "Philippines", note: "Drug war killings" },
  { country: "Egypt", note: "Political prisoners" },
  { country: "Belarus", note: "Opposition crackdown" },
  { country: "Myanmar", note: "Post-coup abductions" },
  { country: "Russia", note: "Opposition disappearances" },
];

export const partnerships: { org: string; theyOffer: string; systemOffers: string }[] = [
  {
    org: "HRDAG",
    theyOffer: "Statistical methodology, MSE expertise, credibility",
    systemOffers: "A new application domain: predictive, not retrospective",
  },
  {
    org: "Early Warning Project",
    theyOffer: "Statistical modeling validation, methodology review",
    systemOffers: "Sub-national prediction methodology they lack",
  },
  {
    org: "Forensic Architecture",
    theyOffer: "PATTRN tool, spatial analysis methodology",
    systemOffers: "Real-time application of their tools",
  },
  {
    org: "Bellingcat",
    theyOffer: "Vehicle tracking methodology, verification training",
    systemOffers: "A systematic application of their techniques",
  },
  {
    org: "ACLED",
    theyOffer: "Event data, CAST platform architecture",
    systemOffers: "Civil society focus for their conflict data",
  },
  {
    org: "Amnesty Decoders",
    theyOffer: "Volunteer crowdsourcing for verification",
    systemOffers: "A new use case for their platform",
  },
];

export const regionalNotes: { region: string; situation: string; missing: string }[] = [
  {
    region: "Latin America",
    situation: "Mexico has 110,000+ disappeared persons. A national registry classifies 87% of active cases as enforced disappearances; the ICRC runs forensic identification; civil-society search collectives use ground-penetrating radar and satellite imagery to locate clandestine graves.",
    missing: "A predictive system identifying who will be disappeared next. The scale is overwhelming: everything is documentation and search, not prevention.",
  },
  {
    region: "Africa",
    situation: "Sudan's coalition is establishing structured systems for collecting, verifying and preserving evidence of human rights violations: documentation protocols, verification standards, consent procedures, data security.",
    missing: "Post-hoc documentation for accountability, not predictive early warning.",
  },
  {
    region: "Middle East",
    situation: "Extensive documentation by B'Tselem, Breaking the Silence and international organizations. Forensic Architecture has investigated specific incidents using spatial analysis and digital modeling.",
    missing: "A system predicting which activists will be detained or disappeared next.",
  },
];

export const stats = [
  { value: "8", label: "Organizations analyzed" },
  { value: "8", label: "Capability dimensions" },
  { value: "3", label: "Core innovations combined" },
  { value: "6", label: "Export-ready regions" },
];
