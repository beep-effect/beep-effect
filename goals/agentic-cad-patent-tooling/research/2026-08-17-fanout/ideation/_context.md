PROBLEM P: Decide what to actually BUILD for "agentic CAD" inside a solo US patent attorney's private, local-first professional desktop app.

LOCKED CONSTRAINTS (do not relitigate):
- Local-only is a hard architectural rule. No client invention data may reach any cloud model or foreign server. Enforced in code, not policy.
- The wedge is: render and LINK CAD that already exists. Not generation.
- Figures need only be DRAFT quality — a human finishes them.
- Success = the attorney (Tom) uses it on a real, privileged matter.

HARD EVIDENCE FROM RESEARCH (2026-08-17):
- His real corpus: 837 AutoCAD .dwg (13.8 GB, active thru 2026-05), 201 STEP (6.3 GB), 552 .svg + 175 Adobe .ai figure artwork (edited THIS MONTH), 54 SolidWorks, 30 Rhino. DWG outnumbers STEP 4:1.
- Patent illustrators cost $28-39/sheet offshore, $100-125/sheet US, 2-5 days, unlimited revisions. A 6-sheet utility set is $170-240. So REPLACING THE ILLUSTRATOR IS NOT THE VALUE — you can never earn back a big build on drawing fees.
- 37 CFR 1.84(p)(4)-(5) makes reference numerals a strict bijection: every numeral in the drawings must appear in the spec and vice versa; same part = same numeral in every view; never reuse a numeral for a different part. Lead lines must not cross. Numerals >= 0.32 cm.
- ClaimMaster and Patent Bots ALREADY audit numeral consistency — but only if the figure file has a text layer. Real illustrator deliveries are often outline-only PDFs with no text.
- No commercial patent tool is agent-driveable (DeepIP's REST API is the lone sales-gated exception). Every vendor keeps the numeral/figure graph hostage inside its own workspace.
- Nobody sells: disclosure -> figure PLAN + numeral map. That is 80% of the attorney's figure THINKING and 20% of the illustrator's hours.
- The app is Tauri 2 + React 19 + Effect, already ships a compiled sidecar binary, already has a three.js render driver, a knowledge graph of Matter/PatentAsset/Claim/PriorArtReference, a bitemporal epistemic edge layer, and an MCP server exposing the graph to agents. It has NO blob store and NO way to read a file back after intake.
- occt-import-js (7.6 MB WASM) reads STEP offline. NO JavaScript package anywhere exposes OCCT hidden-line-removal, so true black-line 2D projection needs a Python (build123d) sidecar.
- Local LLM box: 2x AMD R9700, 64 GB VRAM total. 2B-8B CAD models fit easily. Frontier models still fail 68-92% of complex parts.
