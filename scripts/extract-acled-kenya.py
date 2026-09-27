#!/usr/bin/env python3
"""Extract Kenya rows from the ACLED Africa aggregated xlsx into
data/acled-kenya-aggregates.json: weekly county-level counts of events and
fatalities by event/sub-event type.

The xlsx carries corrupt dimension metadata (openpyxl read_only reports
1x1 and regular mode dies on a dangling drawing reference), so this parses
the sheet XML directly from the zip with a streaming parser.

Usage: python3 scripts/extract-acled-kenya.py <xlsx> <out.json>"""
import zipfile
import xml.etree.ElementTree as ET
import json
import sys
from datetime import date, timedelta

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def col_idx(letters):
    idx = 0
    for ch in letters:
        idx = idx * 26 + (ord(ch) - 64)
    return idx - 1


def excel_date(serial):
    return (date(1899, 12, 30) + timedelta(days=int(serial))).isoformat()


def parse_shared(z):
    try:
        with z.open('xl/sharedStrings.xml') as f:
            out = []
            for _, e in ET.iterparse(f, events=('end',)):
                if e.tag.endswith('}si'):
                    out.append(''.join(t.text or '' for t in e.iter() if t.tag.endswith('}t')))
                    e.clear()
            return out
    except KeyError:
        return []


def main(path, out_path):
    z = zipfile.ZipFile(path)
    shared = parse_shared(z)
    rows = []
    centroids = {}
    with z.open('xl/worksheets/sheet1.xml') as f:
        header = None
        for _, row in ET.iterparse(f, events=('end',)):
            if not row.tag.endswith('}row'):
                continue
            cells = {}
            for c in row.findall('m:c', NS):
                ref = c.get('r', '')
                letters = ''.join(ch for ch in ref if ch.isalpha())
                if not letters:
                    continue
                ci = col_idx(letters)
                t = c.get('t')
                v = c.find('m:v', NS)
                if t == 's' and v is not None:
                    val = shared[int(v.text)]
                elif v is not None:
                    val = v.text
                else:
                    val = None
                cells[ci] = val
            row.clear()
            if header is None:
                header = {ci: str(v) for ci, v in cells.items() if v}
                continue
            if cells.get(2) != 'Kenya':
                continue
            try:
                wk = excel_date(float(cells.get(0)))
            except (TypeError, ValueError):
                continue
            adm = cells.get(3) or ''
            if adm not in centroids and cells.get(11) and cells.get(12):
                try:
                    centroids[adm] = [float(cells.get(12)), float(cells.get(11))]  # [lng, lat]
                except (TypeError, ValueError):
                    pass
            rows.append({
                'week': wk,
                'admin1': adm,
                'eventType': cells.get(4) or '',
                'subEventType': cells.get(5) or '',
                'events': int(float(cells.get(6) or 0)),
                'fatalities': int(float(cells.get(7) or 0)),
            })

    weeks = sorted({r['week'] for r in rows})
    from datetime import datetime, timezone
    payload = {
        'source': 'ACLED Africa aggregated data file (myACLED Open tier download)',
        'file': path.split('/')[-1],
        'url': 'https://acleddata.com/aggregated/aggregated-data-africa',
        'retrieved_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'tier': 'Open myACLED: weekly aggregates by Admin 1. Event-level REST access requires Research Partner tier or above.',
        'coverage': {
            'weeks': len(weeks),
            'firstWeek': weeks[0] if weeks else None,
            'lastWeek': weeks[-1] if weeks else None,
            'counties': len({r['admin1'] for r in rows}),
        },
        'rows': len(rows),
        'countyCentroids': centroids,
        'notes': [
            'Kenya row = one county-week-event/sub-event combination; values are event and fatality counts.',
            'Weekly file refreshed by ACLED every Monday; re-run scripts/ingest-acled.mjs to update.',
            'Abduction/forced disappearance appears as a sub-event type under Violence against civilians.',
        ],
        'kenyaRows': rows,
    }
    with open(out_path, 'w') as f:
        json.dump(payload, f)
    print(f'rows: {len(rows)}, weeks: {weeks[0] if weeks else "-"}..{weeks[-1] if weeks else "-"} ({len(weeks)}), counties: {len(centroids) or payload["coverage"]["counties"]}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
