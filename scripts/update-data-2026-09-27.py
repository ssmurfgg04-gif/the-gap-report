#!/usr/bin/env python3
"""KAMPS data refresh, 2026-09-27.

1. UCDP GED v26.1 (through 2025) replaces v23.1 (through 2022).
2. Incidents: upgrade June 2026 records with KNCHR named victims, add
   Sept 2026 Kiprotich abduction + missing persons, add context stats.
3. Vehicles: remove DEMO records, add the real June 2026 Subaru pattern
   documented by KNCHR.
"""
import csv, json, sys, collections

DATA = "/home/z/my-project/data"

# ---------- 1. UCDP ged26.1 ----------
src = "/tmp/ged261/GEDEvent_v26_1.csv"
keep = ["id", "year", "type_of_violence", "conflict_new_id", "date_start",
        "deaths_a", "deaths_b", "deaths_civilians", "best", "high", "low",
        "latitude", "longitude", "country_id", "country", "admin1", "admin2",
        "location", "source_all", "where_description", "event_clarity",
        "type_of_sub_conflict", "conflict_name"]

rows = []
with open(src, newline="", encoding="utf-8") as f:
    r = csv.DictReader(f, delimiter=",")
    for row in r:
        if row["country_id"] == "501" and row["country"] == "Kenya":
            rows.append({k: row.get(k, "") for k in keep})

with open(f"{DATA}/ucdp-kenya.csv", "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=keep)
    w.writeheader()
    w.writerows(rows)

by_year = collections.Counter(int(r["year"]) for r in rows)
types = collections.Counter(r["type_of_violence"] for r in rows)
deaths = sum(int(float(r["best"] or 0)) for r in rows)
civ = sum(int(float(r["deaths_civilians"] or 0)) for r in rows)
summary = {
    "version": "UCDP GED v26.1 (replaces v23.1)",
    "kenya_events": len(rows),
    "coverage": "1989-01-01..2025-12-31",
    "type_of_violence": {"state_based": types.get("1", 0), "non_state": types.get("2", 0), "one_sided": types.get("3", 0)},
    "deaths_best": deaths,
    "deaths_civilians": civ,
    "by_year": dict(sorted(by_year.items())),
    "source": "https://ucdp.uu.se/downloads/ UCDP GED v26.1 CSV",
    "license": "CC BY 4.0",
    "retrieved_at": "2026-09-27",
}
with open(f"{DATA}/ucdp-kenya-summary.json", "w") as f:
    json.dump(summary, f, indent=2)
print(f"UCDP: {len(rows)} Kenya events 1989-2025 (was 1,126 through 2022). 2023-2025 added: {sum(1 for r in rows if int(r['year']) >= 2023)}")

# ---------- 2. incidents ----------
with open(f"{DATA}/incidents-public-record.json") as f:
    inc = json.load(f)

# upgrade the six Parliament protesters with KNCHR names
for i in inc["incidents"]:
    if i["person"] == "Six unnamed June 25 anniversary protesters":
        i["person"] = "Boniface Mulinge Muteti, Elisha Ochieng Alam, Collins Otieno, Fredrick Ojiro, Christine Alubengo, Michael Ngige (six Parliament protesters)"
        i["notes"] = "Arrested outside Parliament on live TV, not booked at any station, ambushed by 10+ armed men in civilian clothes, driven off in three Subaru station wagons, severely tortured, dumped along Langata Road and Ngong Road at about 04:00 on 27 June 2026."
        i["sourceName"] = "KNCHR / Citizen Digital"
        i["sourceUrl"] = "https://www.knchr.org/Articles/ArtMID/2432/ArticleID/1258/Enforced-Disappearances-Torture-and-other-Human-Rights-Violations-following-the-25th-June-2026-Protests-Marking-the-2nd-Anniversary-of-the-2024-Gen-Z-Protests"
    if i["person"] == "Three other Mathare activists (unnamed)":
        i["person"] = "Macmillan Kiarie, Michael Oloo, Abdilaziz Duba"
        i["notes"] = "Reported picked up by security agencies in Nairobi the week before 29 June 2026; still unaccounted for at the date of the KNCHR statement. Earlier Citizen Digital reporting described three Mathare activists still missing."
        i["sourceName"] = "KNCHR / Citizen Digital"
        i["sourceUrl"] = "https://www.knchr.org/Articles/ArtMID/2432/ArticleID/1258/Enforced-Disappearances-Torture-and-other-Human-Rights-Violations-following-the-25th-June-2026-Protests-Marking-the-2nd-Anniversary-of-the-2024-Gen-Z-Protests"
        i["date"] = "2026-06-25"
        i["datePrecision"] = "month"  # week before 29 June

new_incidents = [
    {
        "id": "kiprotich-2026-09-01",
        "date": "2026-09-01",
        "datePrecision": "day",
        "person": "Alex Kiprotich",
        "location": "Nairobi",
        "status": "returned",
        "category": "abduction",
        "sourceName": "KNCHR",
        "sourceUrl": "https://www.knchr.org/Articles/ArtMID/2432/ArticleID/1262/The-KNCHR-Condemns-the-Abduction-of-Standard-Group-Associate-Editor-Alex-Kiprotich",
        "notes": "Standard Group Associate Editor abducted on the night of 1 September 2026; found safe shortly after. KNCHR condemned the abduction on 3 September and noted the Inspector-General's commitment to investigate through the Anti-Abduction Unit.",
    },
    {
        "id": "githurai-2026-06-25",
        "date": "2026-06-25",
        "datePrecision": "day",
        "person": "Unidentified male (Githurai)",
        "location": "Githurai, Nairobi",
        "status": "missing",
        "category": "abduction",
        "sourceName": "KNCHR",
        "sourceUrl": "https://www.knchr.org/Articles/ArtMID/2432/ArticleID/1258/Enforced-Disappearances-Torture-and-other-Human-Rights-Violations-following-the-25th-June-2026-Protests-Marking-the-2nd-Anniversary-of-the-2024-Gen-Z-Protests",
        "notes": "Forcibly apprehended by unknown individuals and taken away in a concealed Subaru vehicle during the 25 June 2026 protests; identified only in the KNCHR statement.",
    },
]
existing_keys = {i["person"] for i in inc["incidents"]}
for ni in new_incidents:
    if ni["person"] not in existing_keys:
        inc["incidents"].append(ni)

inc["incidents"].sort(key=lambda x: x["date"])
inc["sources"] = list({i["sourceUrl"] for i in inc["incidents"]})

cs = inc.setdefault("context_statistics", [])
new_stats = [
    {
        "statistic": "KNCHR National Reparations Framework and report (presented to the President 15 June 2026) documented 35 enforced disappearance cases",
        "source": "KNCHR, 31 August 2026 statement",
        "sourceUrl": "https://www.knchr.org/Articles/ArtMID/2432/ArticleID/1261/KNCHR-Calls-for-an-End-to-Enforced-Disappearances",
    },
    {
        "statistic": "KNCHR documented 11 new enforced disappearance cases during the 25 June 2026 protests: protesters arrested, held incommunicado, later found tortured",
        "source": "KNCHR, 31 August 2026 statement",
        "sourceUrl": "https://www.knchr.org/Articles/ArtMID/2432/ArticleID/1261/KNCHR-Calls-for-an-End-to-Enforced-Disappearances",
    },
]
have = {s.get("statistic") for s in cs}
for s in new_stats:
    if s["statistic"] not in have:
        cs.append(s)

with open(f"{DATA}/incidents-public-record.json", "w") as f:
    json.dump(inc, f, indent=2, ensure_ascii=False)
print(f"Incidents: {len(inc['incidents'])} total; context stats: {len(cs)}")

# ---------- 3. vehicles: real records only ----------
with open(f"{DATA}/vehicles-public-record.json") as f:
    vehicles = json.load(f)

real = [v for v in vehicles if not v.get("simulated")]
knchr_1258 = "https://www.knchr.org/Articles/ArtMID/2432/ArticleID/1258/Enforced-Disappearances-Torture-and-other-Human-Rights-Violations-following-the-25th-June-2026-Protests-Marking-the-2nd-Anniversary-of-the-2024-Gen-Z-Protests"

june_pattern = {
    "vehicleKey": "R3",
    "platePartial": "unmarked",
    "make": "Subaru",
    "model": "Station Wagon (multiple units)",
    "color": "Unmarked / concealed",
    "simulated": False,
    "summary": ("Pattern documented by KNCHR during the 25 June 2026 protests: three Subaru "
                "station wagons carrying more than ten armed men in civilian clothes took six "
                "arrested protesters from an isolated area where a police truck had abandoned "
                "them; a concealed Subaru was used in a separate Githurai abduction; and Subaru "
                "vehicles were used again when the six were dumped on Langata Road and Ngong "
                "Road at about 04:00 on 27 June. The make recurs across abduction, transfer "
                "and dump sites in the same 48-hour window, which is exactly the pattern the "
                "four-zone rule is built to surface."),
    "sourceUrls": [knchr_1258],
    "sourceNames": ["KNCHR (29 June 2026 statement)"],
    "sightings": [
        {"id": 1, "date": "2026-06-25", "zoneName": "Nairobi", "source": "KNCHR: three station wagons, abduction of six Parliament protesters"},
        {"id": 2, "date": "2026-06-25", "zoneName": "Nairobi", "source": "KNCHR: concealed Subaru, Githurai abduction"},
        {"id": 3, "date": "2026-06-27", "zoneName": "Nairobi", "source": "KNCHR: Subaru vehicles dumping victims on Langata Road and Ngong Road"},
    ],
}
if not any(v["vehicleKey"] == "R3" for v in real):
    real.append(june_pattern)

with open(f"{DATA}/vehicles-public-record.json", "w") as f:
    json.dump(real, f, indent=2, ensure_ascii=False)
print(f"Vehicles: {len(real)} real records (demo removed); keys: {[v['vehicleKey'] for v in real]}")
print("ALL DATA UPDATES DONE")
