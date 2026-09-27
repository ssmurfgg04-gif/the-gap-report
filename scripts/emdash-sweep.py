#!/usr/bin/env python3
"""Sweep em dashes from all UI-visible strings (JSX comments and CSS comments excluded)."""
import sys

REPLACEMENTS = {
    "src/app/layout.tsx": [
        ('title: "The Gap Report — Global Landscape: Who Else Is Doing This?",',
         'title: "The Gap Report · Global Landscape: Who Else Is Doing This?",'),
        ('title: "The Gap Report — Global Landscape",',
         'title: "The Gap Report · Global Landscape",'),
    ],
    "src/components/site/hero.tsx": [
        ("what this system proposes —", "what this system proposes,"),
        ("scale, methodology, or context —", "scale, methodology, or context;"),
    ],
    "src/components/site/matrix.tsx": [
        ("against the eight organizations — plus the system this report assesses",
         "against the eight organizations, plus the system this report assesses"),
        ("from the entire field — the three dimensions",
         "from the entire field: the three dimensions"),
    ],
    "src/components/site/players.tsx": [
        ("for enforced disappearances — and the specific gap each one leaves open.",
         "for enforced disappearances, and the specific gap each one leaves open."),
    ],
    "src/components/site/outlook.tsx": [
        ("Export potential — if it works in Kenya", "Export potential, if it works in Kenya"),
        ("This is not just a Kenya system — it is a prototype", "This is not just a Kenya system; it is a prototype"),
    ],
    "src/components/site/verdict.tsx": [
        ('body: "No individual rankings — the system cannot become a targeting list.",',
         'body: "No individual rankings: the system cannot become a targeting list.",'),
        ('body: "Not just open sources — Missing Voices, ATI records, encrypted field collection.",',
         'body: "Not just open sources: Missing Voices, ATI records, encrypted field collection.",'),
        ('body: "The four-zone rule — a novel application turned against the state, not the citizen.",',
         'body: "The four-zone rule: a novel application turned against the state, not the citizen.",'),
        ('The innovation is not any single component{" "}\n            <span className="text-[var(--accent-ink)]">— it is the integration.</span>',
         'The innovation is not any single component.{" "}\n            <span className="text-[var(--accent-ink)]">It is the integration.</span>'),
        ("statistical risk modeling works — but at the", "statistical risk modeling works, but at the"),
        ("HRDAG proves bias correction works — but retrospectively.",
         "HRDAG proves bias correction works, but retrospectively."),
        ("Bellingcat proves vehicle tracking works — but case-specifically.",
         "Bellingcat proves vehicle tracking works, but case-specifically."),
        ("spatial analysis of state violence works — but",
         "spatial analysis of state violence works, but"),
        ("enforced disappearances — compiled from comparative analysis",
         "enforced disappearances, compiled from comparative analysis"),
    ],
    "src/lib/site-data.ts": [
        ("at the national level — not individual abductions",
         "at the national level, not individual abductions"),
        ("Predicts political violence events — battles, protests, riots — not targeted abductions",
         "Predicts political violence events (battles, protests, riots), not targeted abductions"),
        ("Applies rigorous statistics — Multiple Systems Estimation, capture-recapture — to reveal gaps",
         "Applies rigorous statistics (Multiple Systems Estimation, capture-recapture) to reveal gaps"),
        ("Retrospective analysis — estimating how many were killed",
         "Retrospective analysis: estimating how many were killed"),
        ("PATTRN — their open-source participatory fact-mapping tool.",
         "PATTRN, their open-source participatory fact-mapping tool."),
        ("Post-incident reconstruction — building evidence after an event.",
         "Post-incident reconstruction: building evidence after an event."),
        ("micro-tasks thousands of volunteers — Decode Darfur engaged",
         "micro-tasks thousands of volunteers: Decode Darfur engaged"),
        ("Documentation and advocacy — establishing what happened",
         "Documentation and advocacy, establishing what happened"),
        ("at community level — not enforced disappearances",
         "at community level, not enforced disappearances"),
        ("flight tracking and vehicle tracking — Russian missile launchers",
         "flight tracking and vehicle tracking: Russian missile launchers"),
        ("after they occur — not systematic, continuous monitoring.",
         "after they occur, not systematic, continuous monitoring."),
        ("rigorous preservation protocols — investigators manually tag",
         "rigorous preservation protocols: investigators manually tag"),
        ("Documentation for accountability — building evidence",
         "Documentation for accountability, building evidence"),
        ("and weekly temporal resolution — a fundamentally different technical challenge",
         "and weekly temporal resolution: a fundamentally different technical challenge"),
        ("Existing systems rely on open data — news reports, satellite imagery, social media.",
         "Existing systems rely on open data (news reports, satellite imagery, social media)."),
        ("encrypted field collection (Tella app) — a hybrid approach nobody else uses.",
         "encrypted field collection (Tella app): a hybrid approach nobody else uses."),
        ("vehicle re-identification — the four-zone rule — as an early warning indicator",
         "vehicle re-identification (the four-zone rule) as an early warning indicator"),
        ("The resolution — aggregate zone-level outputs without individual rankings — is itself",
         "The resolution (aggregate zone-level outputs without individual rankings) is itself"),
        # learnings: 8x "X focus — Y is required"
        ("Country-level aggregation — sub-county resolution is required",
         "Country-level aggregation; sub-county resolution is required"),
        ("Armed-conflict focus — a civil society focus is required",
         "Armed-conflict focus; a civil society focus is required"),
        ("Retrospective focus — prediction is required",
         "Retrospective focus; prediction is required"),
        ("Post-incident focus — early warning is required",
         "Post-incident focus; early warning is required"),
        ("Investigation focus — continuous monitoring is required",
         "Investigation focus; continuous monitoring is required"),
        ("Genocide focus — disappearance focus is required",
         "Genocide focus; disappearance focus is required"),
        ("Case-specific focus — systematic monitoring is required",
         "Case-specific focus; systematic monitoring is required"),
        ("Archival focus — real-time prediction is required",
         "Archival focus; real-time prediction is required"),
        ("The core tools — Splink for record linkage, SaTScan for cluster detection, YOLOv8 for vehicle re-identification, PySAL for spatial analysis — are now open-source",
         "The core tools (Splink for record linkage, SaTScan for cluster detection, YOLOv8 for vehicle re-identification, PySAL for spatial analysis) are now open-source"),
        ("110,000+ disappeared persons — the largest crisis of its kind globally",
         "110,000+ disappeared persons: the largest crisis of its kind globally"),
        ("A new application domain — predictive, not retrospective",
         "A new application domain: predictive, not retrospective"),
        ("The scale is overwhelming — everything is documentation and search, not prevention.",
         "The scale is overwhelming: everything is documentation and search, not prevention."),
        ("evidence of human rights violations — documentation protocols, verification standards, consent procedures, data security.",
         "evidence of human rights violations: documentation protocols, verification standards, consent procedures, data security."),
    ],
}

base = "/home/z/my-project/"
fail = False
for path, pairs in REPLACEMENTS.items():
    p = base + path
    s = open(p, encoding="utf-8").read()
    for old, new in pairs:
        if old not in s:
            print(f"MISSING in {path}: {old[:60]}...")
            fail = True
        else:
            s = s.replace(old, new)
    open(p, "w", encoding="utf-8").write(s)
    print(f"swept {path}")

# verify: remaining em dashes in UI string contexts
import re
for path in REPLACEMENTS:
    s = open(base + path, encoding="utf-8").read()
    n = s.count("—")
    print(f"remaining in {path}: {n}")
    if n:
        for i, line in enumerate(s.splitlines(), 1):
            if "—" in line and "/*" not in line and "//" not in line:
                print(f"  L{i}: {line.strip()[:100]}")

sys.exit(1 if fail else 0)
