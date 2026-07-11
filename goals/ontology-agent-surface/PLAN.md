# Ontology Agent Surface Plan

## Status

Status: `complete` — P0-P3 implementation and local closeout evidence are
recorded. ROBOT interop, the canonical host benchmark, repaired socket/live-client
re-proof, and the P3 Yeet/GitHub mergeability gate remain explicit operator
commands; the uncommitted local closeout state is not achieved closeout until
those required host gates are accepted.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Bootstrap + Hardening | complete (ROBOT host command retained) | Re-verify the exploration inventory against live source; generalize verified repairs beyond `sh:hasValue`; preserve empty/base prefixes; run ROBOT host validation. Confirm exact toolkit/driver placement and record any decision-invalidating drift. | Capability facts and package placement are recorded; supported repair strategies retain verify-then-offer proof; base-prefix fingerprint fixtures pass; the absent ROBOT binary and exact host command are archived. Evidence: [`history/2026-07-11-p0-hardening.md`](./history/2026-07-11-p0-hardening.md). |
| P1 Toolkit Definition | complete | Define the curated agent-first schemas and thin handlers; implement stateless open/apply/CAS-save, real deltas, server-owned budgets, typed CAS/drift errors, and the shared ingestion classifier where touched. Resolve semantic-vs-byte CAS semantics before freezing the save contract. | Required tool capabilities are schema-typed and real-engine tested; stateless CAS rejects stale writes recoverably; operation/result ceilings cannot be overridden by callers; no session repository or silent cache exists. Evidence: [`history/2026-07-11-p1-toolkit.md`](./history/2026-07-11-p1-toolkit.md). |
| P2 Transport + Safety | complete (repaired socket re-proof retained) | Mount authenticated, Origin-validated streamable HTTP `/mcp` on the loopback sidecar; wire TierGate fail-closed and per-change actor attribution. Land the `capability-metadata` + `sparql-query` first slice as live proof before enabling mutation. | The real launched-sidecar transcript proves initialize/list/capability/SPARQL, and the in-memory route proves the complete auth and safety matrix after repair. The node-socket and launched-sidecar re-proof commands remain recorded for the host. Evidence: [`history/2026-07-11-p2-transport.md`](./history/2026-07-11-p2-transport.md) and [`history/2026-07-11-p2-live-client.log`](./history/2026-07-11-p2-live-client.log). |
| P3 Harden + Close | complete (host closeout required) | Benchmark stateless parse/open at 1k/10k/100k, finish tool/capability documentation and real-stack acceptance, drive Yeet to mergeable, and close with reflection. | Sandbox benchmarks, authored capability docs, criterion-by-criterion acceptance, packet state, and the valid reflection are recorded. Canonical benchmark numbers, ROBOT, retained socket/client re-proof, and P3 Yeet/GitHub mergeability remain host gates. Evidence: [`history/2026-07-11-p3-harden-close.md`](./history/2026-07-11-p3-harden-close.md). |

Each implementation phase lands through `bun run beep yeet` (repair → verify →
publish → monitor). The phase status above records local artifact completion;
the packet's completion gate is not achieved until P3's PR work is mergeable.

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
