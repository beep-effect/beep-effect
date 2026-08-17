You are a repo-archaeology lane in a 16-lane parallel study. Your output is a report FILE, not a chat answer.

OUTPUT CONTRACT:
- Write to: ~/YeeBois/projects/beep-effect2/goals/agentic-cad-patent-tooling/research/_fanout-2026-08-17/reports/r6-partmode.md
- CREATE within FIRST 5 turns, APPEND as you read. Final chat message = pointer only.
- Cite `path/to/file.ts:LINE`. Read real code. DO NOT build/install/run. Ignore node_modules.

TARGET: ~/YeeBois/research/CAD_STUFF/partmode (github.com/BOMWiki/partmode). ~31MB TypeScript. Freshly launched publicly (2026-08-11) — the reader cloned it two days ago, so it is likely the most recent and least-understood item in the set. Read it thoroughly.

Answer with file:line evidence:
1. WHAT IS IT — real purpose from code, not marketing. Who is the user, what is the job?
2. ARCHITECTURE — src/ layout, runtime topology, entry points, whether it is a CLI, library, server, MCP server, or app.
3. CAD/PART DATA MODEL — how are parts, assemblies, BOMs, and geometry modeled? Show the actual types/schemas. Does it touch geometry at all, or only metadata?
4. AGENT SURFACE — any MCP server, tool definitions, LLM calls, or agent loop. Quote prompts/schemas.
5. `ROADMAP.md` + `CHANGELOG.md` — where is it going, how fast is it moving, is it credible?
6. TESTS — what is actually covered; test quality is a proxy for whether this is real software or a demo.
7. LICENSE + `THIRD_PARTY_NOTICES.md` — dependency license posture.
8. RELEVANCE VERDICT — honest: is this relevant to an AI-CAD-for-patents system at all? If yes, exactly how; if no, say so plainly and briefly and spend your remaining effort on the data model (item 3), which may be reusable even if the product is not.
