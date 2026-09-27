#!/usr/bin/env python3
"""Parse the ACLED Africa aggregated xlsx (week x Admin-1) via raw sheet XML.
Stream-parses so memory stays flat even for large sheets."""
import zipfile
import xml.etree.ElementTree as ET
import sys
from collections import defaultdict

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

def col_letter_to_idx(letters):
    idx = 0
    for ch in letters:
        idx = idx * 26 + (ord(ch) - 64)
    return idx - 1

def parse_shared_strings(z):
    try:
        with z.open('xl/sharedStrings.xml') as f:
            strings = []
            for _, elem in ET.iterparse(f, events=('end',)):
                if elem.tag.endswith('}si'):
                    text = ''.join(t.text or '' for t in elem.iter() if t.tag.endswith('}t'))
                    strings.append(text)
                    elem.clear()
            return strings
    except KeyError:
        return []

def main(path):
    z = zipfile.ZipFile(path)
    shared = parse_shared_strings(z)
    print(f'shared strings: {len(shared)}', file=sys.stderr)

    # sheet1
    with z.open('xl/worksheets/sheet1.xml') as f:
        header = None
        total = 0
        kenya = 0
        counties = defaultdict(int)
        latest = {}
        for _, row in ET.iterparse(f, events=('end',)):
            if not row.tag.endswith('}row'):
                continue
            cells = {}
            for c in row.findall('m:c', NS):
                ref = c.get('r', '')
                letters = ''.join(ch for ch in ref if ch.isalpha())
                if not letters:
                    continue
                ci = col_letter_to_idx(letters)
                t = c.get('t')
                v = c.find('m:v', NS)
                isel = c.find('m:is', NS)
                if t == 's' and v is not None:
                    val = shared[int(v.text)]
                elif t == 'inlineStr' and isel is not None:
                    val = ''.join(tt.text or '' for tt in isel.iter() if tt.tag.endswith('}t'))
                elif v is not None:
                    val = v.text
                else:
                    val = None
                cells[ci] = val
            row.clear()
            if header is None:
                header = {ci: str(v) for ci, v in cells.items() if v}
                print('HEADER:', header, file=sys.stderr)
                continue
            total += 1
            # identify country + admin columns from header
            ctry_idx = next((ci for ci, h in header.items() if h.lower() == 'country'), None)
            adm_idx = next((ci for ci, h in header.items() if h.lower() in ('admin1', 'admin 1', 'admin_1')), None)
            week_idx = next((ci for ci, h in header.items() if h.lower() == 'week'), 0)
            if ctry_idx is not None and cells.get(ctry_idx) == 'Kenya':
                kenya += 1
                adm = cells.get(adm_idx, '') if adm_idx is not None else ''
                counties[adm] += 1
                wk = str(cells.get(week_idx, ''))
                if wk > latest.get('week', ''):
                    latest['week'] = wk
            if total % 500000 == 0:
                print(f'...{total} rows', file=sys.stderr)
        print(f'total rows: {total}, Kenya rows: {kenya}', file=sys.stderr)
        print('latest week seen:', latest.get('week'), file=sys.stderr)
        print(f'Kenya admin1s ({len(counties)}):')
        for k, v in sorted(counties.items()):
            print(f'  {k}: {v} weeks')

if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '/tmp/acled-africa.xlsx')
