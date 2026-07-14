# USPTO PTMNFEE2 Ingest Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Current-release discovery | pending | Through an authorized session/API key, capture the exact 2026 filenames, archive members/layout, delimiter/widths, encoding, null/date/header rules, complete `MaintFeeEventsDesc`, documentation, sizes/counts/headers, numeric rate limits, and anonymous resolved-file behavior. Verify cumulative semantics, checksum stability, attribution fields, and compatibility with the prosecution goal's generator. | A dated evidence note and adversarial sample answer every honest unknown; release/documentation/code-list checksums are pinned; unresolved facts block P1. |
| P1 Implement | pending | Reuse the prosecution goal's generator; add staged release discovery/download/validation, schema-first lossless parsing, explicit drift failures, atomic full replacement, refresh manifest, and Public Domain Mark-attributed fixtures. | Valid release publishes completely and deterministically; corrupt/partial/drifted releases leave the prior snapshot intact; fixture satisfies the patent-spine input shape. |
| P2 Verify | pending | Run layout/code/schema adversaries, checksum/determinism, full-replace/rollback, fixture attribution, patent-spine contract, focused package, and repo proof lanes. | Every `SPEC.md` criterion is green or a reproducible blocker is archived without weakening replacement, provenance, or ownership boundaries. |
| P3 Close | pending | Drive the implementation PR to mergeable through Yeet, write the reflection, archive source-safe proof, and synchronize packet evidence/status. | Yeet/GitHub reports mergeable; schema-valid reflection exists; README, PLAN, and manifest match evidence. |

## P0 Evidence Checklist

- Product/release identity and authorized discovery route.
- Exact archive/file/documentation/code-list shapes and checksums.
- Complete code enumeration and namespace/diff result.
- Compressed/uncompressed size, row count, content type, and response headers.
- Numeric rate limit if found; otherwise dated `NOT FOUND` evidence and safe policy.
- Anonymous resolved-file result after the 2026 registration change.
- Fixture extraction identities and Public Domain Mark 1.0 attribution plan.
- Proof that the shared four-vocabulary mechanism fits without a fork.

## P3 Closeout Checklist

1. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update README, PLAN, and manifest with final evidence/status.
4. Confirm Yeet/GitHub mergeability and archive deterministic refresh,
   rollback/full-replace, attribution, and intake proof without secrets.

## Execution Notes

- P0 is a hard gate; third-party layouts and inferred code lists are not contracts.
- Preserve unrelated worktree changes and keep `SPEC.md` normative.
- Never commit an API key, portal session, or signed/ephemeral download URL.
- Do not family-collapse records or infer current legal status.
- Scheduling stays in the reliability packet; this goal owns one refresh execution.

## Verification Commands

```sh
test "$(wc -m < goals/uspto-ptmnfee2-ingest/GOAL.md)" -le 4000
jq . goals/uspto-ptmnfee2-ingest/ops/manifest.json
rg -n "uspto-ptmnfee2-ingest|GOAL.md|agentLaunchers|packetAnchorDocument" goals/uspto-ptmnfee2-ingest
git diff --check -- goals/uspto-ptmnfee2-ingest
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
