# Effect MCP 2026-07-28 Stateless Protocol Adoption

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Effect-TS/effect#7265 merged the MCP `2026-07-28` protocol adapter (stateless `server/discover`,
`McpRequestContext`, multi-round-trip tool results, `subscriptions/listen`, JSON
`structuredContent`). Every in-repo MCP server still pins `McpProtocol.v2025_06_18` through
`@beep/mcp-kit`, and the upstream handler-requirement change breaks the kit before any protocol
switch.

## Next Open Question

None: graduated 2026-09-22 into `goals/mcp-stateless-kit-and-drivers` (kit rebase, `@beep/mcp-kit/client`,
five stdio hosts, nlp-mcp behind the live capture) and `goals/ontology-sidecar-stateless-identity`
(run key = per-launch bearer digest, sidecar pin, Origin policy). Re-entry gates live in `MAP.md`.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-09-16: packet opened from a plan-mode grounding grill; G1–G9 scope decisions logged;
  stage set to research with native grok CLI lanes.
- 2026-09-16: Gate A plan review (28 findings, briefs rewritten); ten grok research lanes and the
  orchestrator snapshot spike (`research/25-r4-spike-census.md`) complete.
- 2026-09-17: Gate B verification complete: 184 claims, 175 survive, 9 struck
  (`research/verification/README.md`). Manifest open questions reseeded for the align grill.
- 2026-09-17: Stage 2 synthesis written (`RESEARCH.md`, `research/impact-matrix.md`,
  `research/sizing.md`, `research/SOURCES.md`); Gate C (three grok reviewers, 30 findings, all
  `not-ready`) folded in; open questions reseeded as eight named decisions for the align grill.
- 2026-09-21: capture PR #1169 merged. `effect@4.0.0-rc.117` shipped with the adapter and #1173
  moved `main` to it, closing G1/G7 by events: S0 and S5b struck from `research/sizing.md`,
  D-pin-sha withdrawn (seven decisions remain), `DECISIONS.md` entry added.
- 2026-09-22: align grill closed in one session (`DECISIONS.md`: D-posture, D-cli-contract,
  D-run-key, D-client-home, D-conformance, D-projection, D-origin, goal split); `BRIEF.md` and
  `MAP.md` written; graduated into two goal packets; Gate D reviews in `reviews/gate-d-*.md`.
