"""Render the single-route UI state map from a reviewed source fingerprint.

Usage: uv run --with pillow --with resvg-py python tools/screens-map.py ARTIFACT_DIR
Screenshots remain outside the source repository. Missing captures stay visible.
"""
from pathlib import Path
import sys, json, hashlib, html
from PIL import Image
import resvg_py

root = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1]).resolve()
manifest = json.loads((root / 'docs/screen-states.json').read_text())
for name, expected in manifest['sourceHashes'].items():
    actual = hashlib.sha256((root / name).read_bytes()).hexdigest()
    assert actual == expected, f'Review UI state coverage after changing {name}'

width, cellw, cellh, gap = 1280, 290, 94, 28
rows = manifest['flows']
height = 64 + len(rows) * 146
rects, nodes, table, mermaid = [], [], [], ['flowchart LR']
svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">',
       '<rect width="100%" height="100%" fill="#f8fafc"/>',
       '<defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7" fill="none" stroke="#64748b"/></marker></defs>',
       '<g font-family="system-ui,sans-serif" fill="#18202d">',
       '<text x="20" y="28" font-size="19">Scrinium Note — / — UI states and captures</text>',
       '<text x="20" y="49" font-size="12">Green: captured. Amber: no browser capture. Recovery-key image stays private. Arrows show selected UI paths.</text>']

for row, flow in enumerate(rows):
    y = 86 + row * 146
    svg.append(f'<text x="20" y="{y-10}" font-size="13">{html.escape(flow["name"])}</text>')
    for col, item in enumerate(flow['states']):
        x = 20 + col * (cellw + gap)
        assert x + cellw <= width - 10 and len(item['title']) <= 36
        rect = (x, y, x+cellw, y+cellh)
        for old in rects:
            assert rect[2] <= old[0] or old[2] <= rect[0] or rect[3] <= old[1] or old[3] <= rect[1]
        rects.append(rect)
        file = item.get('file')
        capture = out / file if file else None
        exists = bool(capture and capture.is_file())
        dimensions = ''
        if exists:
            with Image.open(capture) as image:
                dimensions = f'{image.width} × {image.height}'
        caption = file or 'NO CAPTURE'
        status = 'CAPTURED' if exists else 'NOT CAPTURED'
        if item.get('private'):
            status += ' — PRIVATE'
        fill = '#e5f3e9' if exists else '#fff0d5'
        node = f'n{row}_{col}'
        svg += [f'<rect x="{x}" y="{y}" width="{cellw}" height="{cellh}" rx="5" fill="{fill}" stroke="#94a3b8"/>',
                f'<text x="{x+12}" y="{y+23}" font-size="14">{html.escape(item["title"])}</text>',
                f'<text x="{x+12}" y="{y+44}" font-size="12">/ · {html.escape(caption)}</text>',
                f'<text x="{x+12}" y="{y+66}" font-size="11">{html.escape(status)}</text>',
                f'<text x="{x+12}" y="{y+83}" font-size="11">{dimensions}</text>']
        table.append(f'| {item["title"]} | `/` | {caption} | {dimensions or "—"} | {status} |')
        mermaid.append(f'  {node}["{item["title"]}<br/>/ · {caption}"]')
        if col and flow.get('connected', True):
            # Every connection lives in its row's horizontal gutter, outside nodes.
            a, b = x-gap, x
            assert b-a == gap
            svg.append(f'<path d="M{a+2} {y+cellh/2} H{b-4}" stroke="#64748b" fill="none" marker-end="url(#arrow)"/>')
            mermaid.append(f'  n{row}_{col-1} --> {node}')
svg.append('</g></svg>')
target = out / 'screens-map.svg'
target.write_text('\n'.join(svg))
(out/'screens-map@2x.png').write_bytes(resvg_py.svg_to_bytes(svg_path=str(target), zoom=2))
markdown = '\n'.join([
    '# UI capture coverage', '',
    'One static route (`/`); screens below are component states, not separate URLs. All data is synthetic.', '',
    '```mermaid', *mermaid, '```', '',
    '| Screen / state | Route | Capture | Dimensions | Status |',
    '| --- | --- | --- | --- | --- |', *table, '',
    'The manifest fingerprints App.tsx, NoteEditor.tsx, main.tsx and the vault state model. Any change fails map generation until coverage is reviewed. Capture status and dimensions come from actual files. Geometry checks reject overlapping or overflowing nodes; arrows occupy horizontal gutters. Screenshot assets and generated maps remain local.', '',
    'Pending browser states are highlighted, not implied to pass: storage initialization/failure, failed-save retry, editor initialization failure, restore errors and clipboard denial. Password-change/recovery rotation/permanent deletion logic passed isolated tests; no browser password change or permanent deletion was submitted. The recovery-key capture is private and excluded from preview collages.', '',
    'Native file chooser, download manager and system prompts are host UI and are not redrawn. Browser download receipt could not be inspected because internal browser pages were blocked by security policy.', '',
])
(out/'screens-map.md').write_text(markdown)
print(f'Wrote {target.name}, screens-map@2x.png and screens-map.md; {len(rects)} mapped states.')
