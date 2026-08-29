You are a research lane in a parallel study. Your output is a CITED report FILE, not a chat answer.

OUTPUT CONTRACT:
- Write to: goals/agentic-cad-patent-tooling/research/2026-08-17-fanout/reports/x10-vector-figure-pipeline.md
- CREATE within FIRST 5 turns, APPEND as you go. Final chat message = pointer only.
- Inline citations (URL + date). Label `UNVERIFIED`.

CONTEXT: A real patent attorney's corpus contains 552 `.svg` and 175 Adobe Illustrator `.ai` files, edited as recently as 2026-08 — alongside 837 `.dwg`. The patent FIGURE deliverable in this practice is vector artwork, not a 3D model. Prior research in this study assumed 3D->projection; that assumption is now suspect.

TOPIC: The REAL patent-figure production pipeline, and how software should slot into it.

Cover:
1. HOW PATENT DRAFTSMEN ACTUALLY WORK in 2026 — the tool chain (AutoCAD, Illustrator, CorelDRAW, Visio, Inkscape), the handoff from attorney to draftsman, turnaround, per-sheet pricing, and the file formats exchanged at each step. Search x.com, forums, and patent-illustration service sites for primary evidence.
2. THE `.ai` FORMAT — Adobe Illustrator files are PDF-compatible containers. Can they be read/rendered without Adobe? (pdf.js, Ghostscript, `svglib`, Inkscape CLI, `pdf2svg`). What is lost? Layer/artboard handling.
3. SVG AS THE PATENT FIGURE SUBSTRATE — is SVG a good canonical representation for a filed patent figure? Cover: line weights vs 37 CFR 1.84 requirements, text/font embedding (USPTO wants no font issues), conversion SVG->PDF at the required resolution, hatching/shading as SVG patterns, and whether reference numerals should be SVG `<text>` (machine-readable!) or outlined paths.
4. REFERENCE NUMERALS AS DATA — this is the key idea to evaluate: if figures are SVG with structured `<text>` numerals and `<g>` groups, the numeral->part mapping becomes machine-readable and can be cross-checked against specification text automatically. Find anyone doing this. Find the tooling for extracting numerals + lead lines from existing vector figures, and from raster figures (OCR + lead-line tracing).
5. VECTOR EDITING PROGRAMMATICALLY — libraries for reading/writing/transforming SVG in TypeScript with geometric rigor (svgo, paper.js, svg.js, @svgdotjs, flatten-js, clipper), and for converting DXF->SVG faithfully.
6. PDF AS FILING TARGET — Patent Center PDF requirements; vector vs raster; how to produce a compliant PDF from SVG headlessly on Linux (which renderer preserves vectors and line weights).
7. AI ON VECTOR ART — any model or tool that generates/edits SVG line art usefully in 2026 (LLM SVG generation quality, vectorization models, VLMs reading technical drawings). Be honest about quality; cite evidence.

END WITH: a recommended canonical internal representation for a patent figure in a knowledge-graph-backed system, with the tradeoffs of SVG vs PDF vs DXF vs "the 3D model that generated it", and an argument for which is the durable source of truth.
