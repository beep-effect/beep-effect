You are a repo-archaeology lane in a 16-lane parallel study. Your output is a report FILE, not a chat answer.

OUTPUT CONTRACT:
- Write to: goals/agentic-cad-patent-tooling/research/2026-08-17-fanout/reports/r4-freecad.md
- CREATE within FIRST 5 turns, APPEND as you read. Final chat message = pointer only.
- Cite `path/to/file:LINE`. DO NOT BUILD IT (it is a 3.1GB C++ tree, a build would take hours — do not attempt). Read only.

TARGET: ~/YeeBois/research/CAD_STUFF/FreeCAD (github.com/FreeCAD/FreeCAD, current main).

The central question: **is FreeCAD viable as a HEADLESS, AGENT-DRIVEN geometry and technical-drawing backend for a patent practice?**

Answer with file:line evidence:
1. HEADLESS MODE — `FreeCADCmd` / console mode: how is it invoked, what is available without the GUI, and what silently requires the GUI? Find the code that gates GUI-only features.
2. PYTHON API — the scripting surface an agent would drive: document model, Part/PartDesign, Sketcher (constraints!), the object/recompute graph. Show the canonical script pattern for "create parametric solid, modify a parameter, recompute, export".
3. **TECHDRAW WORKBENCH** — this is the highest-value item for patent figures. Go deep: how does it produce 2D projections from 3D (hidden-line removal algorithm, which OCCT HLR API), what view types exist (orthographic projection groups, section, detail, exploded), annotation/balloon/leader-line support (= reference numerals!), line-weight/style control, and SVG/DXF/PDF export. Is TechDraw fully scriptable from Python headlessly? Prove it with file:line.
4. FILE FORMAT IO — STEP/IGES/STL/DXF/SVG import-export quality and the code paths.
5. ADDON/EXTENSION MODEL — how third parties extend it; the addon manager; whether an external process can drive FreeCAD (RPC? the `--console` + script? a server addon?).
6. `AI_POLICY.md` — read it and summarize what it says about AI-generated contributions and any AI features.
7. LICENSE — LGPL-2.1 specifics. What can a proprietary product do: bundle the binary? call it as a subprocess? link the libs? Give the precise analysis, including the OCCT dependency's own license.
8. VERDICT — a build-realistic assessment: what would it cost (effort, packaging, binary size) to ship FreeCAD headless as the figure-generation engine inside a desktop app, versus using CadQuery/build123d (which sit on the same OCCT kernel). Name the decisive tradeoffs.
