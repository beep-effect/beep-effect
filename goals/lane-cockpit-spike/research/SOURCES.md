# Lane Cockpit Spike — Sources & Provenance

- **Source exploration:** `explorations/textjs-console-ui` — primary ledger:
  `explorations/textjs-console-ui/research/SOURCES.md`. This file reproduces
  the rows the spike builds on; the exploration's ledger stays authoritative
  for everything else.
- **Research:** `explorations/textjs-console-ui/RESEARCH.md` (first sweep
  2026-11-10, upstream read at `anomalyco/textjs` commit `f4ef6c9`).

## 1. Mined source corpus

Upstream paths are relative to `anomalyco/textjs` at `f4ef6c9`. Nothing is
vendored or ported by this goal; the renderer is consumed as a dependency.

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| M4 | Offscreen `render`, `cleanup`, `renderToString` | anomalyco/textjs | `packages/react/src/testing.tsx:126,299,304` | frame tests | use as dependency API |
| M5 | `renderToTerminal` | anomalyco/textjs | `packages/react/src/terminal.tsx:328` | terminal target | use as dependency API |
| M7 | `frameToAnsi` | anomalyco/textjs | `packages/react/src/ansi-frame.ts:11` | snapshots | reference |
| M8 | TX003 on DOM host elements | anomalyco/textjs | `packages/react/src/reconciler.ts:72` | constraint | reference |
| M1 | Render pipeline and package map | anomalyco/textjs | `ARCHITECTURE.md` | background | reference |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| https://github.com/anomalyco/textjs | MIT ("Copyright (c) 2026 Anomaly"; `LICENSE` read 2026-11-03, GitHub API 2026-11-10) | dependency only in this goal; port-with-attribution if a later goal ports | `@textjs/react@1.6.1` as an exact-pinned dependency of the lab |

## 3. External research sources

- Testing — https://textjs.org/docs/testing
- Running in a Terminal — https://textjs.org/docs/terminal
- Support Policy — https://textjs.org/docs/support-policy
- Layout, data and interactive components — https://textjs.org/llms.txt
  (index; snapshot in the exploration's `assets/`)
- Maturity facts (repo age, single contributor, release cadence) — the
  exploration's RESEARCH.md, "Maturity"
- Smoke test, 2026-11-10 — the exploration's RESEARCH.md, "Smoke test"

## 4. In-repo capability references

- Session report: `bun run beep session open --json`; row schema
  `SessionLedgerRow` in
  `packages/tooling/tool/cli/src/commands/Session/Session.schemas.ts`
- Lab apps: `apps/labs/README.md`, `standards/architecture/15-lab-apps.md`,
  `bun run beep create-package`, `bun run beep labs list`,
  `bun run beep delete-package`
- Terminal conventions to stay consistent with: `@beep/cli-kit`
  (`packages/foundation/capability/cli-kit/src/`)
- React 19.3.1 in the root `package.json` catalog

## 5. Cross-links & provenance

- Exploration: `explorations/textjs-console-ui/README.md`, `BRIEF.md`,
  `DECISIONS.md`, `MAP.md`
- Gated follow-ons (not this goal): `operator-cockpit`, `cockpit-actions`,
  `agent-frame-protocol`, `terminal-content-negotiation` in the exploration's
  `MAP.md`
