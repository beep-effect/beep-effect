You are a research lane in a parallel study. Your output is a CITED report FILE, not a chat answer.

OUTPUT CONTRACT:
- Write to: goals/agentic-cad-patent-tooling/research/2026-08-17-fanout/reports/x9-dwg-dxf-ingest.md
- CREATE the file within your FIRST 5 turns with a heading skeleton, then APPEND as you research. Never save writing for the end.
- Final chat message = a pointer paragraph + the path.
- Inline citations (URL + date) on every non-obvious claim. Label `UNVERIFIED` where unconfirmed.

CONTEXT THAT MAKES THIS LANE URGENT: a real patent attorney's working corpus was just inventoried. It contains 837 `.dwg` files (13.8 GB, actively edited through 2026-05) versus only 201 STEP files. AutoCAD DWG — not STEP — is the dominant format. Every prior assumption in this study was 3D-solid-biased and is now suspect.

TOPIC: Ingesting, converting, and RENDERING AutoCAD DWG/DXF in a TypeScript/web/Tauri desktop app, offline, in 2026.

Cover exhaustively:
1. DWG READERS — every option, with license, maturity, last commit, and fidelity:
   - LibreDWG (GNU) — note the GPL-3 license precisely and what it contaminates; is there an LGPL path? What about the `@mlightcad/libredwg-web` WASM build?
   - ODA (Open Design Alliance) File Converter / Drawings SDK — cost, redistribution terms, membership requirements. Is the free File Converter redistributable inside a commercial desktop app? Quote the terms.
   - Autodesk RealDWG — cost and terms.
   - dwg2dxf paths, `libdxfrw`, Teigha legacy, `dwgread`.
   - Anything new in 2026 (search x.com and GitHub for recent DWG WASM work).
2. DXF READERS in JS/TS — `dxf-parser`, `dxf-viewer`, `three-dxf`, `@mlightcad/*`, `ezdxf` (Python, MIT) — API surface, entity coverage (LWPOLYLINE, SPLINE, HATCH, DIMENSION, MTEXT, BLOCK/INSERT, XREF, layouts/paper space), and known fidelity gaps.
3. RENDERING — what does it take to draw a DWG/DXF faithfully on canvas/WebGL: layers, linetypes, lineweights, hatches, text with SHX/TTF font substitution (SHX fonts are a classic failure — cover it), dimension rendering, paper space vs model space. Which library gets closest?
4. 3D IN DWG — DWG can hold 3D solids (ACIS/SAT bodies). Can any open reader extract them, or is 3D DWG effectively opaque without ODA/Autodesk? This is decisive.
5. CONVERSION PIPELINES — batch DWG -> DXF -> SVG/PDF headlessly on Linux. Name working toolchains and their license posture. Include LibreCAD, QCAD (and QCAD's `dwg2` plugin licensing), Bricsys, FreeCAD's importDWG (which shells out to a converter — find which).
6. THUMBNAILS — DWG files embed a preview bitmap. How to extract it cheaply for a document-browser grid (this may be the 90% solution for a viewer). Cite the format spec.
7. LICENSE TRAP TABLE — for a proprietary/closed Tauri desktop app: which options are safe to bundle, which are safe only as a separately-invoked subprocess, and which are unusable. Be precise about GPL-3 vs LGPL vs commercial.

END WITH: a recommended DWG ingest architecture for a local-only Tauri + TypeScript app, a runner-up, and the single specific thing that will bite.
