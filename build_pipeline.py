#!/usr/bin/env python3
"""Build pipeline.json for the PIC Operations Board from a QuickBooks estimates dump.

Usage: python3 build_pipeline.py <estimates.json> [output.json]

<estimates.json> is the raw result of the QBO "get estimates" tool:
  {"data": [ { accept_status:{status}, lines:[{description,...}], ... }, ... ]}

Counts = number of currently-Accepted estimates that mention each color / material.
Rules (set with the owner):
  - Colors: plain color words in the line descriptions.
  - Materials: specialty coatings only. PTFE is excluded. 958-303, Molykote, and
    Precise Lube are excluded (hand-spray / not wanted). TM-001A + Dianex are
    lumped together as "Specialty". McLube includes the MAC### shorthand.
"""
import json, re, sys, datetime, collections

COLORS = ['ORANGE','BLACK','RED','BLUE','GREEN','WHITE','GRAY','GREY',
          'YELLOW','BROWN','CLEAR','GOLD','SILVER','PURPLE','PINK','TAN']
# display name -> regex (case-insensitive) over the full description text
MATERIALS = [
    ('McLube',       r'MCLUBE|MAC\s?41\d'),
    ('Emralon 310',  r'EMRALON'),
    ('Specialty',    r'DIANEX|TM-?001'),   # TM-001A + Dianex lumped
    ('Klübertop',    r'KL[UÜ]BERTOP'),
]

def main():
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else 'pipeline.json'
    d = json.load(open(src))
    rows = d.get('data', d if isinstance(d, list) else [])
    acc = [e for e in rows if ((e.get('accept_status') or {}).get('status') == 'Accepted')]

    col = collections.defaultdict(set)   # color -> set of estimate refs
    mat = collections.defaultdict(set)   # material -> set of estimate refs
    for e in acc:
        ref = e.get('reference_number') or e.get('id')
        full = ' '.join((l.get('description') or '') for l in (e.get('lines') or [])).upper()
        for c in COLORS:
            if re.search(r'\b' + c + r'\b', full):
                col['Gray' if c in ('GRAY', 'GREY') else c.title()].add(ref)
        for name, pat in MATERIALS:
            if re.search(pat, full):
                mat[name].add(ref)

    colors = {k: len(v) for k, v in sorted(col.items(), key=lambda kv: -len(kv[1]))}
    materials = {k: len(v) for k, v in sorted(mat.items(), key=lambda kv: -len(kv[1]))}
    payload = {
        "asOf": datetime.date.today().strftime('%b %-d, %Y'),
        "accepted": len(acc),
        "colors": colors,
        "materials": materials,
    }
    with open(out, 'w') as f:
        json.dump(payload, f, indent=2, ensure_ascii=False)
    print(json.dumps(payload, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
