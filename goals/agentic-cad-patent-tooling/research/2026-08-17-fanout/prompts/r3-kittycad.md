You are a repo-archaeology lane in a 16-lane parallel study. Your output is a report FILE, not a chat answer.

OUTPUT CONTRACT:
- Write to: ~/YeeBois/projects/beep-effect2/goals/agentic-cad-patent-tooling/research/_fanout-2026-08-17/reports/r3-kittycad-zoo.md
- CREATE within FIRST 5 turns, APPEND as you read. Final chat message = pointer only.
- Cite `path/to/file:LINE`. Read real code. DO NOT build/install/run. Ignore any node_modules.

TARGET: ~/YeeBois/research/CAD_STUFF/KittyCAD — contains two checkouts: `kittycad.ts` (the TypeScript SDK) and `modeling-app` (Zoo Design Studio, the desktop/web CAD app). ~1.2GB total.

The central question: **how much of Zoo can be used WITHOUT their cloud, and what does the TS SDK actually expose to an agent?**

Answer with file:line evidence:
1. `kittycad.ts` SDK — how is it generated (OpenAPI?), what is the full API surface grouped by domain, and specifically: the text-to-CAD endpoints, file conversion endpoints (STEP/STL/GLTF/OBJ), the ML endpoints, and the modeling websocket. Give exact function names and signatures for the ones that matter.
2. KCL — the KittyCAD Language. Where is the parser/interpreter (Rust? WASM?), is it usable standalone, what does the language look like (paste a representative sample), and could an LLM target it? Is there a grammar/spec file?
3. THE ENGINE SPLIT — critical: which parts of geometry execution happen locally (WASM in the app) vs on Zoo's servers? Find the boundary in code. Can `modeling-app` run fully offline, and if not, exactly which operations require the network?
4. AGENT SURFACES — any MCP server, "Text-to-CAD" prompt plumbing, or ML-ephant integration in these repos. Quote prompts/tool schemas if present.
5. FILE FORMAT IO — what import/export is implemented locally vs server-side.
6. LICENSES — exact license of each checkout (they may differ; MIT? AGPL?). Flag contamination risk for a proprietary desktop app.
7. UI/UX PATTERNS worth stealing for a CAD panel inside another desktop app (the code editor + 3D viewport + feature tree layout, command palette, selection model). Name files.
8. VERDICT — three options ranked: (a) use Zoo's cloud API, (b) vendor/self-host parts of the engine, (c) ignore and use OCCT-based stack instead. Give the evidence for each, and the decisive fact.
