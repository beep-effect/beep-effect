# Text.js Console UI — Sources & Provenance

<!--
The provenance ledger for this packet. Start it in the `research` stage and keep
it current through graduate; the graduated goal inherits a copy. Purpose: let an
implementing agent trace every decision back to its origin — a mined source
(repo + file:line), an upstream repo + LICENSE, an external citation, or an
in-repo brick.

RULES
- Never fabricate a URL/DOI/repo link. Reproduce only sources that actually
  appear on disk in RESEARCH.md / research/*.md; if a claim has no on-disk URL,
  cite the RESEARCH.md section that carries it instead.
- Licenses are load-bearing: copyleft (AGPL/GPL/MPL) upstream is CLEAN-ROOM
  reimplement only (pattern, not vendored code); permissive (MIT/Apache/BSD) may
  be ported WITH attribution; missing/unverified LICENSE ⇒ treat as reference
  only. State the discipline per repo.
- Register this file in ops/manifest.json `exploration.sources`.
-->

- **Cluster / origin:** the operator's link to `https://textjs.org/llms.txt`
  (2026-11-03) and the pages it indexes.
- **Provenance:** [`CAPTURE.md`](../CAPTURE.md); first research sweep
  2026-11-10 in [`RESEARCH.md`](../RESEARCH.md), read from a shallow clone of
  the upstream repo at `f4ef6c9`. No codex review yet.

## 1. Mined source corpus

Upstream paths are relative to `anomalyco/textjs` at `f4ef6c9` (branch `dev`,
2026-11-06). Nothing is ported yet; every row is reference until align picks
a direction.

| Id | Repo | File:line | What it is | Disposition |
|----|------|-----------|------------|-------------|
| M1 | anomalyco/textjs | `ARCHITECTURE.md` | Render pipeline, console pacing rules, package map | reference |
| M2 | anomalyco/textjs | `packages/app/src/mcp/server.ts:205` | `createTextMcpServer` | reference |
| M3 | anomalyco/textjs | `packages/app/src/mcp/server.ts:246-560` | The 14 MCP tool registrations | reference (protocol shape is a port candidate) |
| M4 | anomalyco/textjs | `packages/react/src/testing.tsx:126,299,304` | `render`, `cleanup`, `renderToString` | reference |
| M5 | anomalyco/textjs | `packages/react/src/terminal.tsx:328` | `renderToTerminal` | reference |
| M6 | anomalyco/textjs | `packages/react/src/root.tsx:322` | `createConsoleRoot` | reference |
| M7 | anomalyco/textjs | `packages/react/src/ansi-frame.ts:11` | `frameToAnsi` | reference |
| M8 | anomalyco/textjs | `packages/react/src/reconciler.ts:72` | TX003 on DOM host elements | reference (constraint) |
| M9 | anomalyco/textjs | `packages/app/src/cli/index.ts:168` | TX019, `text run` needs Bun | reference (constraint) |
| M10 | anomalyco/textjs | `CHANGELOG.md` 1.6.0, 1.6.1 | Embed sizes, release cadence | reference |
| M11 | anomalyco/textjs | `apps/web/src/docs/content/{mcp,testing,terminal,curl,embedding,support-policy,introduction}.md` | Docs source for the pages cited in section 3 | reference |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| https://github.com/anomalyco/textjs | MIT (`LICENSE` on branch `dev`, "Copyright (c) 2026 Anomaly", read 2026-11-03; GitHub API reports `MIT` 2026-11-10) | port-with-attribution | Undecided. Port candidates named in RESEARCH "What is actually new": the frame contract, the driving protocol with its idle rule, terminal content negotiation |
| https://github.com/vadimdemedes/ink | MIT (GitHub API, 2026-11-10) | reference only | Comparable; nothing taken |
| https://github.com/anomalyco/opentui | MIT (GitHub API, 2026-11-10) | reference only | Comparable; nothing taken |
| https://github.com/Textualize/textual | MIT (GitHub API, 2026-11-10) | reference only | Comparable; nothing taken |
| https://github.com/charmbracelet/bubbletea | MIT (GitHub API, 2026-11-10) | reference only | Comparable; nothing taken |
| https://github.com/Yomguithereal/react-blessed | MIT (GitHub API, 2026-11-10) | reference only | Comparable; nothing taken |

## 3. External research sources

- Text.js `llms.txt` index — https://textjs.org/llms.txt (snapshot:
  [`../assets/textjs-llms-2026-11-03.txt`](../assets/textjs-llms-2026-11-03.txt))
- MCP for Coding Agents — https://textjs.org/docs/mcp
- Testing — https://textjs.org/docs/testing
- Running in a Terminal — https://textjs.org/docs/terminal
- The Turbolog Engine — https://textjs.org/docs/turbolog-engine
- Docs markdown source — `apps/web/src/docs/content/*.md` in the upstream repo
- curl and Terminal Clients — https://textjs.org/docs/curl
- Embedding — https://textjs.org/docs/embedding
- Support Policy — https://textjs.org/docs/support-policy
- GitHub API, `repos/anomalyco/textjs` and its `contributors` and `releases`
  (read 2026-11-10; RESEARCH "Maturity")
- npm registry, `@textjs/app`, `@textjs/react`, `@textjs/core`,
  `create-text-app`, and the npm downloads API for `@textjs/app` (read
  2026-11-10; RESEARCH "Maturity")
- EveryDev listing — https://www.everydev.ai/tools/textjs (third party; its
  enterprise-tier claim is unverified)
- Agent terminal drivers: https://socket.dev/npm/package/aiterm-mcp,
  https://mcpservers.org/servers/dragoscirjan/mcp-tuikit,
  https://glama.ai/mcp/servers/nvms/tui-mcp,
  https://mcpservers.org/servers/elleryfamilia/terminal-mcp
- Smoke test run 2026-11-10 — RESEARCH "Smoke test" (no URL; run locally
  against `@textjs/react@1.6.1`)

## 4. In-repo capability references

Full table with gaps in RESEARCH "In-Repo Capability Inventory".

- `@beep/cli-kit` — `packages/foundation/capability/cli-kit/src/` (`CliAudience`,
  `CliTheme`, `Render`, `Doc`, `Status`, `CliPrompt`, `TestTerminal`)
- `@beep/repo-cli` — `packages/tooling/tool/cli/src/commands/` (`Session`,
  `Palantiri`, `Accounts`, `Yeet`, `Observability`, `Qa`)
- `@beep/qa-capture` — `packages/tooling/library/qa-capture/`
- Effect-native MCP servers — `packages/drivers/uspto-mcp/src/Server.ts`,
  `packages/drivers/m365-mcp/`, `apps/practice-gateway/src/Server.ts`
- `effect/cli` and `effect/Terminal` — `.repos/effect/packages/effect/src/`

## 5. Cross-links & provenance

- This packet: [`../README.md`](../README.md), [`../CAPTURE.md`](../CAPTURE.md),
  [`../RESEARCH.md`](../RESEARCH.md).
- Adjacent graduated explorations: `explorations/observability-palantiri`,
  `explorations/agent-observability-rebuild`, `explorations/fleet-coordination`.
- Graduated goal: `goals/lane-cockpit-spike` (its `research/SOURCES.md`
  reproduces the rows the spike builds on).
