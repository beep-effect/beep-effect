# Ontology Sidecar Stateless Identity Plan

## Status

Status: `pending` (blocked on `goals/mcp-stateless-kit-and-drivers` PR 1; graduated 2026-09-22).

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Done in the exploration (lanes 22-r3, 24-r5; Gate B; Gate C). | `explorations/effect-mcp-2026-07-28/RESEARCH.md` §3.3–3.4. |
| P1 Implement | pending | One PR: run key + tests + actor + span + sidecar pin + Origin/CORS. | Acceptance criteria met. |
| P2 Verify | pending | package-verify, hosted Heavy / Test Integration, conformance. | Green or blockers documented. |
| P3 Yeet: PR to mergeable | pending | `bun run beep yeet publish --start-pr-early --monitor --pr`; goal slug in the commit. | `mergeStateStatus` CLEAN; zero unresolved threads. |
| P4 Close | pending | SPEC wording, epistemic docs, reflection, status flip (same PR or a small second one). | Reflection exists; `bun run beep goals set-status ontology-sidecar-stateless-identity completed-retained`. |

## PR train

1. **PR 1 — identity + pin + origin (one PR).** Desktop provides the kit dispatch anchor as
   `launch:<digest>` from the verified bearer; `runIdOf` reads the anchor; the kit's
   `mcp-session-id` read is deleted; tests (delete "keys the run on the session, not on the
   per-request client id", add launch-key, grant-expired permanence, never-evict, stray-header);
   `OntologyChangeActor` on the anchor; gate spans `epistemic.governed_tier_gate.*` with `run_id`;
   sidecar pin `v2026_07_28`; harness and `live-mcp-client.ts` on `@beep/mcp-kit/client`;
   conformance run; `OntologyMcpServerConfig` allow-list (deny-all default, desktop provider);
   Origin middleware before CORS; `OPTIONS` 403; `S.TaggedError`; CORS headers. The identity change and the
   pin are only provable together, so they ship together.
2. **PR 2 (may fold into PR 1) — doctrine wording and closeout.** Decision 10 in
   `goals/agent-execution-authority/SPEC.md`, epistemic package docs, HTTP cancellation gap note,
   reflection, status flip.

## P4 Closeout Checklist

- [ ] Reflection at `history/reflections/<date>-<agent>.md`; `bun run beep lint reflection-artifacts`.
- [ ] `bun run beep goals set-status ontology-sidecar-stateless-identity completed-retained` in the final PR.
- [ ] Exploration README Trail updated; Atlas regenerated.

## Execution Notes

- Raw bearer never in a ledger, span, log, or assertion; compare digests.
- Hosted Heavy / Test Integration is the exit proof for the sidecar wire; local tier-1 green is not
  sufficient (Gate C sizing finding).

## Verification Commands

```sh
bun run beep quality package-verify @beep/epistemic-server
bun run beep quality package-verify @beep/ontology-config
bun run beep quality package-verify @beep/ontology-server
bun run beep ci lane test-integration --affected --base origin/main
test "$(wc -m < goals/ontology-sidecar-stateless-identity/GOAL.md)" -le 4000
jq . goals/ontology-sidecar-stateless-identity/ops/manifest.json
git diff --check -- goals/ontology-sidecar-stateless-identity
```
