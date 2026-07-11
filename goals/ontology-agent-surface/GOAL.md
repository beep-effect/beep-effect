# GOAL: expose the ontology workbench to agents safely

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: agents can inspect, query, safely change, validate, repair, and export
provenance for saved Turtle ontologies through a curated MCP toolkit on the
professional-desktop sidecar, with real-engine and live-client proof.

This is a compact `/goal` launcher. Treat the packet files as the contract:

- `goals/ontology-agent-surface/README.md`
- `goals/ontology-agent-surface/SPEC.md`
- `goals/ontology-agent-surface/PLAN.md`
- `goals/ontology-agent-surface/ops/manifest.json`
- `goals/ontology-agent-surface/research/SOURCES.md`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the standards named by
`SPEC.md`. Repo standards outrank packet prose when they conflict.

Scope:

- In: ontology domain/use-case/server surfaces; N3, SHACL, Oxigraph, canonize,
  and MCP-kit integration points; an ontology MCP driver/toolkit; the
  professional-desktop sidecar `/mcp` mount and auth; focused tests, docs,
  benchmarks, packet evidence, and necessary architecture consolidations.
- Out: server session repositories or live two-writer sessions, stdio MCP,
  OWL 2 DL reasoning, broad 25+ tool inventories, registry fetch,
  multi-format import/export, server workspaces, unrelated product refactors.

Hard constraints (details and numbering in `SPEC.md`):

- Keep the curated agent-first vocabulary near ten task tools; wrap ontology
  use-cases directly rather than mirroring UI RPC payloads.
- V1 is stateless over saved files: open, apply typed change ops, and save only
  under an rdfc-1.0 fingerprint CAS precondition. Unsaved webview state stays
  invisible; reserve `sessionHandle` for v2 without implementing it.
- Serve streamable HTTP at sidecar `/mcp`, loopback-only, Origin-validated,
  authenticated through `RpcSessionAuth`; no v1 stdio transport.
- Every mutation is fail-closed through TierGate, retains caller identity in
  the per-change PROV-O journal, and obeys static operation/result budgets.
  Refusals, drift caps, and CAS conflicts are typed, recoverable tool errors;
  never silently no-op.
- Prove tools with real N3/Oxigraph/SHACL layers and the endpoint with an
  actual MCP client. Do not declare fakes-only coverage sufficient.

Workflow:

1. Inspect the source exploration, packet docs, and live repo state.
2. Execute `PLAN.md` in order, P0 through P3, without widening the packet.
3. Preserve unrelated worktree changes and keep decisions evidence-backed.
4. Update phase evidence and packet state as work lands.
5. Drive each implementation phase through `bun run beep yeet` (repair,
   verify, publish, monitor); do not call the goal complete before mergeable.
6. At P3 Close, write `history/reflections/<YYYY-MM-DD>-<agent>.md` via
   `/reflect`; `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] Every `SPEC.md` acceptance criterion is satisfied.
- [ ] Required checks pass, or unrelated failures are reproduced and recorded.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/ontology-agent-surface/GOAL.md)" -le 4000
jq . goals/ontology-agent-surface/ops/manifest.json
git diff --check -- goals/ontology-agent-surface
bun run beep yeet verify
bun run beep lint reflection-artifacts
```

Stop and report if a stateful session repository, second transport, OWL 2 DL
reasoning, broad tool expansion, unresolved actor identity, unreviewed auth or
security redesign, new dependency/lockfile change, destructive state, or scope
beyond `SPEC.md` becomes necessary. Also stop on contradictory source evidence
or when a required real-engine/live-client proof cannot be produced.

Done only when acceptance and verification pass and Yeet reports the PR work
mergeable, or when a blocker is reported with file/command evidence.
