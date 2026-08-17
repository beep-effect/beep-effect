You are a repo-archaeology lane in a 16-lane parallel study. Your output is a report FILE, not a chat answer.

OUTPUT CONTRACT:
- Write to: goals/agentic-cad-patent-tooling/research/2026-08-17-fanout/reports/r2-cadsense.md
- CREATE within FIRST 5 turns, APPEND as you read. Final chat message = pointer only.
- Cite `path/to/file.ts:LINE` for every structural claim. Read real code.
- DO NOT build, install, or run. Read only. `node_modules/` exists — IGNORE it entirely, never read into it.

TARGET REPO: ~/YeeBois/research/CAD_STUFF/cadsense (github.com/AadiJo/cadsense). A Bun + Turborepo TypeScript monorepo — structurally the closest sibling to the reader's own stack, so pay special attention to conventions.

Answer with file:line evidence:
1. WHAT IS IT — the actual product/purpose, in two sentences, derived from code not marketing.
2. MONOREPO TOPOLOGY — apps/ and packages/ inventory, what each does, the dependency graph between them, turbo pipeline config.
3. CAD SURFACE — what CAD capability exists? Which kernel/renderer/format support? Where does geometry come from?
4. AGENT/AI DESIGN — is there an agent loop, tool definitions, MCP server, or model calls? Find and quote the prompts and tool schemas.
5. STACK DETAIL — runtime (Bun?), framework, state management, testing (vitest?), and whether it uses Effect or effect-adjacent patterns anywhere.
6. `oxlint-plugin-cadsense` — what rules does it enforce? Custom lint plugins reveal the team's hard-won invariants; enumerate them.
7. `patches/` — what is patched and why? Patches reveal upstream bugs worth knowing about.
8. LICENSE and reuse posture.
9. PORTABILITY VERDICT — ranked, concrete list of what a TypeScript/Effect monorepo should steal from this repo, naming files, and what to avoid.
