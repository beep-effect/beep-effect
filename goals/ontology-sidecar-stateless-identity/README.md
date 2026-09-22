# Ontology Sidecar Stateless Identity

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Move the desktop ontology MCP sidecar (`apps/professional-desktop/server/OntologyMcpTransport.ts`)
to `[McpProtocol.v2026_07_28]` with `GovernedTierGate` keyed on a server-side digest of the
per-launch bearer the sidecar already verifies ("a run is a sidecar launch"), the integration
harness on the 2026 wire through `@beep/mcp-kit/client`, and the Origin allow-list owned by
`OntologyMcpServerConfig` with one Origin check.

## Launch

```text
/goal follow the instructions in goals/ontology-sidecar-stateless-identity/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - carried source ledger; primary is the exploration.
6. [`../../explorations/effect-mcp-2026-07-28/`](../../explorations/effect-mcp-2026-07-28/) - BRIEF, MAP, DECISIONS (D-run-key, D-origin,
   D-posture), RESEARCH §3.3–3.4 and lanes 22-r3 / 24-r5.
7. [`../agent-execution-authority/SPEC.md`](../agent-execution-authority/SPEC.md) - decision 10 home.

## Current Phase

Waits for `goals/mcp-stateless-kit-and-drivers` PR 1 (kit dual-read, dispatch anchor,
`@beep/mcp-kit/client`, conformance port). First action once it merges: provide the kit dispatch
anchor as `launch:<digest>` from the desktop, retarget `runIdOf` and `OntologyChangeActor` to it,
and land the launch-keyed tests.

## Latest Evidence

Not started. Governance identity evidence: `explorations/effect-mcp-2026-07-28/research/22-r3-governance-identity.md`;
HTTP security: `24-r5-http-security-observability.md`.

## Notes

- The raw bearer never reaches a ledger, span, or log: only its digest keys the run.
- HTTP cancellation on 2026 is an accepted Effect gap; record it, do not work around it.
