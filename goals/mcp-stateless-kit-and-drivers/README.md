# MCP Stateless Kit and Drivers

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Rebase `@beep/mcp-kit` on the MCP `2026-07-28` adapter that `effect@4.0.0-rc.117` already ships on
`main`, give the kit an in-repo 2026 client (`@beep/mcp-kit/client`) and a conformance port, and cut
the five stdio hosts over to `[McpProtocol.v2026_07_28]` in a fixed order: m365, uspto, gov-legal,
practice-kg, then nlp-mcp behind a live first-message capture of the vendor CLIs.

## Launch

```text
/goal follow the instructions in goals/mcp-stateless-kit-and-drivers/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan (four PRs).
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - carried source ledger; primary is the exploration.
6. [`../../explorations/effect-mcp-2026-07-28/`](../../explorations/effect-mcp-2026-07-28/) - BRIEF, MAP, DECISIONS (G1–G9 and the
   2026-09-22 rulings), RESEARCH with the verified lane reports.

## Current Phase

P1 Implement, in progress. PR 1 (kit rebase on rc.117 `registerToolkit`, dual-read caller,
dispatch anchor, `@beep/mcp-kit/client`, conformance port, README consumer table) is published
from lane `mcp-stateless-kit`; every host still compiles on `v2025_06_18`. Next: PR 2 (m365, uspto).

Goal B checkpoint: `goals/ontology-sidecar-stateless-identity` may start once PR 1 merges (it
consumes `CurrentMcpDispatchAnchor`, the dual-read and `@beep/mcp-kit/client`; keep those
signatures stable).

## Latest Evidence

- 2026-09-22: `bunx vitest run` in `packages/foundation/capability/mcp-kit`: 74 tests pass,
  including every verification-matrix filter and the 15-arm `conformance 2026-07-28` suite on
  the kit fixture host over HTTP and stdio. PR 1 decisions are in `PLAN.md`.
- `history/sql-pg-pgclient-census.md` — the inherited S0 census.
- The exploration's Gate B/C evidence is in
  `explorations/effect-mcp-2026-07-28/research/verification/README.md` and `reviews/`.

## Notes

- Sibling goal `goals/ontology-sidecar-stateless-identity` starts after PR 1 of this goal merges.
- nlp-mcp is the `.mcp.json` host Claude Code launches daily; it flips only after the capture in
  PR 4 shows a daily CLI sending `server/discover` first on stdio (D-cli-contract).
