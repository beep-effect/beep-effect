# MCP Stateless Kit and Drivers

## Status

Lifecycle: `completed-retained`

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

P4 Close. PR 1 (#1192) and PR 2 (#1204) merged 2026-09-22; PR 3 (gov-legal, practice-kg,
`.mcpb` smoke) is #1209; PR 4 (this lane, `mcp-nlp-pr4`) records the D-cli-contract capture in
`history/nlp-mcp-capture.md` and holds nlp-mcp on `v2025_06_18` behind the exception-ledger row in
`SPEC.md` and the re-entry gate in the exploration `MAP.md`. The closeout reflection is written and
the manifest is `completed-retained`.

Goal B checkpoint: `goals/ontology-sidecar-stateless-identity` is unblocked since #1192 merged (it
consumes `CurrentMcpDispatchAnchor`, the dual-read and `@beep/mcp-kit/client`; keep those
signatures stable).

## Latest Evidence

- 2026-09-22 closeout: PR 1 #1192 (kit on rc.117, `@beep/mcp-kit/client`, conformance port),
  PR 2 #1204 (m365, uspto), PR 3 #1209 (gov-legal, practice-kg, `.mcpb` smoke over
  `server/discover`) — each flipped host passes `conformance2026` over HTTP and stdio; kit 88,
  m365 20, uspto 26, gov-legal 32, practice-kg 21 tests. PR 4: `history/nlp-mcp-capture.md`
  holds nlp-mcp on `v2025_06_18` (Claude Code 2.1.275 sends `initialize` by default,
  `server/discover` only under `MCP_PROTOCOL_NEGOTIATION=auto`); exception-ledger row and MAP
  re-entry gate recorded. Closeout reflection: `history/reflections/2026-09-22-claude.md`.
- `history/sql-pg-pgclient-census.md` — the inherited S0 census.
- The exploration's Gate B/C evidence is in
  `explorations/effect-mcp-2026-07-28/research/verification/README.md` and `reviews/`.

## Notes

- Sibling goal `goals/ontology-sidecar-stateless-identity` starts after PR 1 of this goal merges.
- nlp-mcp is the `.mcp.json` host Claude Code launches daily; it flips only after the capture in
  PR 4 shows a daily CLI sending `server/discover` first on stdio (D-cli-contract).
