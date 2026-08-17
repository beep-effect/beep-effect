You are a repo-archaeology lane in a 16-lane parallel study. Your output is a report FILE, not a chat answer.

OUTPUT CONTRACT:
- Write to: goals/agentic-cad-patent-tooling/research/2026-08-17-fanout/reports/r5-multi-agent-cad.md
- CREATE within FIRST 5 turns, APPEND as you read. Final chat message = pointer only.
- Cite `path/to/file.py:LINE`. Read real code. DO NOT install the conda env or run anything.

TARGET: ~/YeeBois/research/CAD_STUFF/Multi-Agent-CAD (github.com/Pan-Chera/Multi-Agent-CAD). Small (~3MB) Python repo — so READ IT THOROUGHLY, nearly end to end. This is the lane where depth is cheap; be exhaustive.

Answer with file:line evidence:
1. AGENT TOPOLOGY — enumerate every agent, its role, its inputs/outputs, and the orchestration graph between them. ASCII diagram. Is it a pipeline, a debate, a planner/executor, a critic loop?
2. PROMPTS — find and QUOTE every system/role prompt verbatim in an appendix section of your report. This is the single most valuable extraction from this repo; do not paraphrase them.
3. TOOL/FUNCTION SCHEMAS — what tools do the agents get, with exact schemas.
4. THE "DETERMINISTIC CODER" — the git log mentions a deterministic coder path with runtime-issue detection. Find it. How does deterministic generation interact with the LLM path, and how are runtime issues detected and reported?
5. GEOMETRY BACKEND — what CAD library executes the output (CadQuery? OpenSCAD? FreeCAD?), and how is generated code sandboxed/executed.
6. VALIDATION & REPAIR LOOP — exactly how failures are caught and fed back. Number of retries, error taxonomy, any geometric (not just syntactic) validation.
7. EVALUATION — `docs/` and any benchmark/eval harness: what is measured, on what dataset, with what results. Report actual numbers.
8. `legacy_refs/` — what earlier approach was abandoned and why? Abandoned approaches are evidence.
9. LICENSE.
10. PORTABILITY VERDICT — the ranked list of patterns to port to a TypeScript/Effect agent runtime, and the anti-patterns to avoid. Be specific about what makes multi-agent worth it here versus a single agent with a good repair loop — take a position with evidence.
