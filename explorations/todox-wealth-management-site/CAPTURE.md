# Capture

<!--
Stage 0 is append-only. The credential reference supplied with the request is
deliberately not reproduced because this repository is public.
-->

## 2026-08-27 — original request

Install or verify the Impeccable plugin and skills for Claude Desktop, Claude
Code, Grok, and Codex from:

- https://impeccable.style/llms.txt

Fan out several Grok agents. Instruct each one to use the Firecrawl skill that
matches its work rather than treating Firecrawl as a generic scraper. Use the
result to seed Claude Fable, which will design and implement a new Todox.ai
marketing site in the existing `apps/todox` Next.js app.

Firecrawl onboarding source:

- https://docs.firecrawl.dev/ai-onboarding#cli

The site should sell an agentic professional runtime to wealth-management
firms. The two account targets are related, not independent:

- https://www.marinerwealthadvisors.com/
- https://www.linkedin.com/company/adviceperiod/
- https://www.adviceperiod.com/
- AdvicePeriod is a child brand/company within Mariner.

A user-supplied advisor domain expert and a second wealth-management contact
informed the sales-only research. Their names, relationship context, and
profile URLs remain outside the public packet.

Historical Claude artifacts made for the advisor domain expert:

- https://claude.ai/public/artifacts/94890cda-b60c-453c-8773-90d35e975dfd
- https://claude.ai/public/artifacts/6f0c3839-b55e-4187-a634-d348dcc3d208

Four Notion pages were supplied for product-direction, meeting, competitor,
and proposal context. One resolved publicly during this pass; three required
authenticated read-only access. Their share links and page identifiers are not
reproduced in this public repository. Research records use only the opaque
labels defined in the access matrix.

Relevant repository material:

- `docs/agent-memory-infra`
- `docs/graphs`
- `docs/mirror`
- `docs/product`
- `docs/runbooks`
- `docs/AI_GRAPH_ENGINEERING.jpeg`
- `docs/BEEPGRAPH_ARCHITECTURE.md`
- `docs/PROSE_TO_PROOF_ARCHITECTURE_MAP.md`
- `docs/PROSE_TO_PROOF_CHAT.html`
- `docs/PROSE_TO_PROOF_FOR_TOM.md`
- `docs/PROSE_TO_PROOF_GRAPH.html`
- `docs/PROSE_TO_PROOF_USER_STORY.md`
- `docs/PROSE_TO_PROOF_VISION.md`
- `docs/PROSE_TO_PROOF_VISUALIZATION.html`
- `docs/README.md`
- `docs/ROADMAP.md`

Research goals:

- Map the Mariner and AdvicePeriod sites.
- Find public customer, advisor, executive, and operating-model stories.
- Search social, interview, podcast, video, trade-press, and newsroom sources.
- Determine whether Firecrawl can access the supplied LinkedIn, Claude, and
  Notion sources.
- Research AI competitors and identify a defensible position around local
  authority, explainability, provenance, review, and service-as-software.
- Mine source-backed sales prose and objection handling.
- Collect inspiration for themes, typography, color palettes, editorial tone,
  imagery, diagrams, and interactions.
- Store the full work in this exploration packet.

Firecrawl authentication was supplied as a 1Password secret reference. Keep it
out of repository files and prompts; use 1Password authorization or the
already-authenticated Firecrawl CLI. The user authorized sufficient Firecrawl
credits and requested no arbitrary scrape cap.

## 2026-08-27 — clarified responsibility boundary

Codex is not designing or building the website. This packet collects evidence,
sales prose, markup/content candidates, and inspiration for themes, fonts,
palettes, and interaction ideas. Claude Fable owns components, layout,
information hierarchy, visual direction, theme, branding, and implementation.
