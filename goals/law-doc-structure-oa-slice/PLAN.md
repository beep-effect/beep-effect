# Law Document Structure Office-Action Slice Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | With the attorney, construct a license-safe fixture corpus from real office actions; define rule-family identity, versioning, replay, migration, and supersession; set labeled per-family precision and abstention floors. This phase may run while the substrate is blocked. | The corpus covers positive pairs, hostile negatives, duplicates, drift, malformed/unsupported forms, Unicode/straddle, and quality/OCR cases; attorney disposition and license/provenance are recorded; version semantics and quantitative floors are explicit. |
| P1 Implement | blocked | After the verified-span substrate gate clears, add the smallest schema-first `DocStructureCandidate` variants, versioned paired OA recognition, explicit `GroundedExtraction` adapter, typed abstention, persistence/replay behavior, and docketing intake adapter. | `citation-verified-span-substrate` P0/P1 has proved the anchor contract; exactly one supported pair emits two verified candidates; all other shaped states fail closed without partial authority. |
| P2 Verify | pending | Exercise positive, hostile negative, duplicate, drift, unsupported, malformed, Unicode/straddle, low-quality/OCR-lineage, version replay, persistence, and docketing integration proof. | Every `SPEC.md` criterion and precision/abstention floor passes, or blockers are archived without weakening exact-source or fail-closed rules. |
| P3 Close | pending | Drive the implementation PR to mergeable through Yeet, write the closeout reflection, archive proof, and synchronize packet evidence/status. | Yeet/GitHub reports the PR mergeable; a schema-valid reflection exists; README, PLAN, and manifest match the evidence. |

## Dependency Gate

- P0 is intentionally executable now.
- P1 is blocked by `goals/citation-verified-span-substrate` P0/P1. It may not
  freeze or implement the anchor contract by inference; it must consume the
  proved contract, including `VersionedSourceArtifactIdentity` and raw-slice
  equality.

## P3 Closeout Checklist

Before marking the packet closed (`status` to `completed-retained` / `complete`):

1. Write a closeout reflection via `/reflect` to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`, covering tooling,
   implementation, and goal/prompt quality.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md`, this plan, and `ops/manifest.json` with final evidence.
4. Confirm precision-floor, replay/migration, exact-anchor, docketing-seam, and
   Yeet/GitHub mergeability evidence.

## Execution Notes

- Preserve unrelated worktree changes and keep `SPEC.md` normative.
- The paired rule is atomic: never authorize one member while its required
  partner is absent, ambiguous, unsupported, low-quality, or uncovered.
- Every regex family requires provenance, license disposition, local version,
  and parity fixtures before adoption.
- Decode confidence into branded `@beep/schema/UnitInterval` at boundaries;
  do not absorb owner-routed confidence cleanup.

## Verification Commands

```sh
test "$(wc -m < goals/law-doc-structure-oa-slice/GOAL.md)" -le 4000
jq . goals/law-doc-structure-oa-slice/ops/manifest.json
rg -n "law-doc-structure-oa-slice|GOAL.md|agentLaunchers|packetAnchorDocument" goals/law-doc-structure-oa-slice
git diff --check -- goals/law-doc-structure-oa-slice
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
