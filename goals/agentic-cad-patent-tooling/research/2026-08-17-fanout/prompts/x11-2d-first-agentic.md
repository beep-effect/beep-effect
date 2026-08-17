You are a research lane in a parallel study. Your output is a CITED report FILE, not a chat answer.

OUTPUT CONTRACT:
- Write to: ~/YeeBois/projects/beep-effect2/goals/agentic-cad-patent-tooling/research/_fanout-2026-08-17/reports/x11-2d-first-agentic.md
- CREATE within FIRST 5 turns, APPEND as you go. Final chat message = pointer only.
- Inline citations (URL + date). Label `UNVERIFIED`. Take positions and defend them with evidence.

CONTEXT: A study is deciding the architecture for AI-assisted patent figure work. Evidence just arrived that the target practice's corpus is DWG-dominant (837 files) with vector SVG/AI artwork as the figure deliverable, and only 201 STEP solids. The obvious architecture (text -> 3D parametric solid -> hidden-line projection -> 2D figure) may be the WRONG one for this job.

TOPIC: Is 2D-NATIVE agentic drawing a better path to patent figures than 3D-then-project? Argue both sides with evidence, then decide.

Cover:
1. THE 3D->PROJECT PATH — build123d `project_to_viewport`/`TechnicalDrawing`, FreeCAD TechDraw, OCCT HLR. What does it give you for free (correct occlusion, consistent multi-view, section views, exact geometry) and what does it cost (you must first have a correct 3D model, which is the hard part)?
2. THE 2D-NATIVE PATH — an agent authoring DXF/SVG directly (via `ezdxf`, SVG emission, or a constraint-based 2D sketcher). What does it give you (patent figures are often schematic, exploded, or diagrammatic — flowcharts, block diagrams, circuit schematics, method-step figures — which have NO underlying 3D model at all) and what does it cost (no occlusion guarantees, no dimensional truth)?
3. FIGURE-TYPE CENSUS — what kinds of figures actually appear in US patents? Estimate the distribution: perspective views of a device, exploded assemblies, section views, flowcharts/method diagrams, block/system diagrams, circuit schematics, chemical structures, GUI screenshots, graphs. Cite any study or dataset (USPTO figure datasets, DeepPatent, PatentNet). THIS IS THE CRUX: if most patent figures are diagrams rather than device renderings, a 3D-first architecture serves a minority of the work.
4. DIAGRAM GENERATION — how good are LLMs at generating flowcharts/block diagrams as vector art in 2026 (mermaid, graphviz, D2, tldraw, excalidraw, direct SVG)? Could a "method-step figure" be reliably auto-drafted from claim text? Find evidence and examples.
5. CONSTRAINT-BASED 2D — is there a scriptable 2D constraint solver worth using (FreeCAD Sketcher's solver, planegcs, SolveSpace's solver, `ezdxf` + a solver)? Can it run headless/WASM?
6. EDIT-IN-PLACE — the practical reality is often "take the existing figure and modify it" (add a reference numeral, add a new element, produce a variant for a continuation). Which representation makes an AGENT best at editing an existing figure? Argue it.

END WITH: a decisive recommendation on 2D-native vs 3D-then-project vs hybrid, tied to the figure-type distribution evidence from item 3. State what would change your mind.
