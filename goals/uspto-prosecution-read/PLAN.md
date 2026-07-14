# USPTO Prosecution Read Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Four contract spikes | pending | (1) Prove the live OA endpoint/envelope and reconcile PFW transactions with OA Text Retrieval; (2) prove authoritative retrieval and checksum stability for all four vocabularies; (3) capture the current `PTMNFEE2` layout, members, complete code list, sizes, numeric limits, and anonymous resolved-download behavior; (4) verify authenticated ODP `Retry-After`/rate headers, retryable statuses, bounds, and read idempotency assumptions. | Four dated evidence notes exist; the observation, generator, and transport contracts contain no invented provider facts; unresolved contradictions block P1. |
| P1 Implement | pending | Add the smallest schema-first prosecution observation, typed technical failures/retry hints, deterministic four-vocabulary generator/drift report, and existing-host MCP exposure. **Named transport item:** adopt the promoted `@beep/api-transport` transformer for every `@beep/uspto` request while preserving one logical request per service call; leave sequential-per-key orchestration above the driver. | Fixture-backed observation meets the patent-spine port; generator reruns are deterministic; drift is visible; soft MCP gate and two-control ownership remain intact. |
| P2 Verify | pending | Run observation/error, generator/drift, transport/header/idempotency, MCP-gate, package, docgen/law, and repo proof lanes; archive sanitized evidence. | Every `SPEC.md` acceptance criterion is green or a reproducible blocker is recorded without weakening authority, determinism, or consent boundaries. |
| P3 Close | pending | Drive the implementation PR to mergeable through Yeet, write the reflection, archive proof, and synchronize packet evidence/status. | Yeet/GitHub reports mergeable; schema-valid reflection exists; README, PLAN, and manifest match evidence. |

## P0 Spike Outputs

1. `history/` note naming the authoritative OA/document and transaction paths,
   envelope versions, sanitized capture identities, and fixture consequences.
2. `history/` note naming retrieval routes, dates, checksums, namespace handling,
   and pinned rerun results for all four vocabularies.
3. `history/` note answering every current `PTMNFEE2` unknown without folding
   bulk ingestion into this goal.
4. `history/` note recording authenticated response headers/statuses, exact
   `Retry-After` interpretation, retry budget, and which reads are safe to retry.

## P3 Closeout Checklist

1. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update README, PLAN, and manifest with final evidence/status.
4. Confirm Yeet/GitHub mergeability and archive deterministic generation,
   observation-contract, transport, and MCP-gate proof without credentials.

## Execution Notes

- P0 is a hard gate. Do not infer an endpoint, archive layout, code list, header,
  rate limit, or retry-safe mutation.
- Preserve unrelated worktree changes and keep `SPEC.md` normative.
- The sibling ingest reuses this generator; coordinate its input/manifest seam
  without implementing its weekly replacement flow here.
- Credentialed captures are optional acceptance evidence and must be sanitized.
- Do not move the scheduler/cursor above-driver boundary into transport adoption.

## Verification Commands

```sh
test "$(wc -m < goals/uspto-prosecution-read/GOAL.md)" -le 4000
jq . goals/uspto-prosecution-read/ops/manifest.json
rg -n "uspto-prosecution-read|GOAL.md|agentLaunchers|packetAnchorDocument" goals/uspto-prosecution-read
git diff --check -- goals/uspto-prosecution-read
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
