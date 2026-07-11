# Ontology Agent Surface Plan

## Status

Status: `active` — P0 is implemented locally and awaits host ROBOT validation.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Bootstrap + Hardening | in-progress (host verification required) | Re-verify the exploration inventory against live source; generalize verified repairs beyond `sh:hasValue`; preserve empty/base prefixes; run ROBOT host validation. Confirm exact toolkit/driver placement and record any decision-invalidating drift. | Capability facts and package placement are recorded; supported repair strategies retain verify-then-offer proof; base-prefix fingerprint fixtures pass; ROBOT interop evidence is archived or an explicit host blocker is recorded. Evidence: [`history/2026-07-11-p0-hardening.md`](./history/2026-07-11-p0-hardening.md). |
| P1 Toolkit Definition | pending | Define the curated agent-first schemas and thin handlers; implement stateless open/apply/CAS-save, real deltas, server-owned budgets, typed CAS/drift errors, and the shared ingestion classifier where touched. Resolve semantic-vs-byte CAS semantics before freezing the save contract. | Required tool capabilities are schema-typed and real-engine tested; stateless CAS rejects stale writes recoverably; operation/result ceilings cannot be overridden by callers; no session repository or silent cache exists. |
| P2 Transport + Safety | pending | Mount authenticated, Origin-validated streamable HTTP `/mcp` on the loopback sidecar; wire TierGate fail-closed and per-change actor attribution. Land the `capability-metadata` + `sparql-query` first slice as live proof before enabling mutation. | An actual MCP client completes `initialize` → `tools/list` → `tools/call` against `/mcp`; the first slice returns bounded Oxigraph results; every mutation is gated, attributed, budgeted, and covered by typed refusal/conflict proof. |
| P3 Harden + Close | pending | Benchmark stateless parse/open at 1k/10k/100k, finish tool/capability documentation and real-stack acceptance, drive Yeet to mergeable, and close with reflection. | Benchmarks and acceptance evidence are archived; reasoner/tool limits are documented; `bun run beep yeet` reports the PR work mergeable; README/manifest are current; a valid closeout reflection exists and reflection lint passes. |

Each implementation phase lands through `bun run beep yeet` (repair → verify →
publish → monitor). Do not mark the packet complete until P3's PR work is
mergeable.

## P3 Closeout Checklist

Before marking the packet closed (`status` to `completed-retained` /
`complete`):

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`; its frontmatter must validate
   against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (`reflectionRequired: true`).
3. Update `README.md` status/latest evidence and synchronize PLAN/manifest
   phase statuses plus `initiative.status`.
4. Confirm Yeet/GitHub evidence shows the packet's PR work mergeable.

## Execution Notes

- Preserve unrelated worktree changes and keep `SPEC.md` normative.
- Start from the inherited ledger in `research/SOURCES.md`; re-verify drifting
  source paths and protocol/auth behavior before implementation.
- Archive phase notes, ROBOT output, live-client transcripts, and benchmarks
  under `history/` without recording bearer tokens or sensitive values.
- Treat production TierGate wiring as a repo precedent requiring focused
  review, not incidental transport glue.
- Do not hide stateless latency with caching; that reopens the session model.

## Verification Commands

```sh
test "$(wc -m < goals/ontology-agent-surface/GOAL.md)" -le 4000
jq . goals/ontology-agent-surface/ops/manifest.json
rg -n "ontology-agent-surface|GOAL.md|agentLaunchers|packetAnchorDocument" goals/ontology-agent-surface
git diff --check -- goals/ontology-agent-surface
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
