# Citation Verified Span Substrate Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Hostile-text fixture spike | completed | Execute the deferred spike over surrogate pairs, combining marks, ligatures, curly quotes, collapsed whitespace, duplicate occurrences, page boundaries, and source drift. Compare all incoming units against canonical half-open UTF-16 and specify normalization-to-raw mapping, straddle reconstruction, ambiguity, and re-anchor failure semantics before freezing implementation contracts. | Executable fixtures expose the current assumptions; one explicit conversion/mapping contract is recorded; every fixture has an exact raw-slice success or typed fail-closed expectation; unresolved conversion contradictions block P1. |
| P1 Implement | complete | Add the smallest schema-first verified-anchor construction and persistence contract in provenance plus Effect-first normalization/source mapping, explicit boundary adapters, and straddle over direct `GroundedExtraction[]` input in langextract. | Exact raw slices produce matter-scoped verified anchors; absent, stale, ambiguous, malformed-unit, and cross-matter inputs fail closed; required persistence fields and re-anchor history round-trip. |
| P2 Verify | in progress | Run the hostile-text, raw-slice, straddle, drift/re-anchor, ambiguity, matter-scope, persistence, focused package, and repo proof matrix. | Every `SPEC.md` acceptance criterion is green, or blockers are archived reproducibly without weakening equality, privilege, or closed-failure rules. |
| P3 Close | pending | Drive the implementation PR to mergeable through Yeet, write the closeout reflection, archive proof, and synchronize packet evidence/status. | Yeet/GitHub reports the PR mergeable; a schema-valid reflection exists; README, PLAN, and manifest match the evidence. |

## P3 Closeout Checklist

Before marking the packet closed (`status` to `completed-retained` / `complete`):

1. Write a closeout reflection via `/reflect` to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`, covering tooling,
   implementation, and goal/prompt quality.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md`, this plan, and `ops/manifest.json` with final evidence.
4. Confirm Yeet/GitHub mergeability and archive the hostile-text contract and
   persistence/re-anchor proof without privileged source text.

## Execution Notes

- P0 is a hard implementation gate, not optional research. Do not freeze a
  public conversion contract before the hostile-text fixtures run.
- Coordinate the separately owned full-source consumer through the
  file-processing source-text resolver and workspace-local provider. This
  packet owns the portable `SourceTextIdentity` contract and raw-text
  alignment mechanics, not filesystem or workspace access.
- Preserve unrelated worktree changes and keep `SPEC.md` normative.
- Locate normalized, emit raw, and prove `source.slice(start, end) === quote`
  at every successful construction or re-anchor.
- Use `GroundedExtraction[]` directly; do not repair or depend on the lossy
  `AnnotatedDocument` handoff in this goal.
- Keep citation vocabulary, engine parity, and court-vocabulary dependencies
  out of this substrate.

## Verification Commands

```sh
test "$(wc -m < goals/citation-verified-span-substrate/GOAL.md)" -le 4000
jq . goals/citation-verified-span-substrate/ops/manifest.json
rg -n "citation-verified-span-substrate|GOAL.md|agentLaunchers|packetAnchorDocument" goals/citation-verified-span-substrate
git diff --check -- goals/citation-verified-span-substrate
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
