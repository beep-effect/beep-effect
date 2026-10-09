# Law Document Structure Office-Action Slice Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | With the attorney, construct a license-safe fixture corpus from real office actions; define rule-family identity, versioning, replay, migration, and supersession; set labeled per-family precision and abstention floors. This phase may run while the substrate is blocked. | The corpus covers positive pairs, hostile negatives, duplicates, drift, malformed/unsupported forms, Unicode/straddle, and quality/OCR cases; attorney disposition and license/provenance are recorded; version semantics and quantitative floors are explicit. Attorney disposition: ruled substitute per SPEC Decision Log 2026-10-09 Run 2; post-hoc spot-check pending, non-blocking. |
| P1 Implement | complete | After the verified-span substrate gate clears, add the smallest schema-first `DocStructureCandidate` variants, versioned paired OA recognition, explicit `GroundedExtraction` adapter, typed abstention, persistence/replay behavior, and docketing intake adapter. | `citation-verified-span-substrate` P0/P1 has proved the anchor contract; exactly one supported pair emits two verified candidates; all other shaped states fail closed without partial authority. |
| P2 Verify | complete | Exercise positive, hostile negative, duplicate, drift, unsupported, malformed, Unicode/straddle, low-quality/OCR-lineage, version replay, persistence, and docketing integration proof. | Every `SPEC.md` criterion and precision/abstention floor passes, or blockers are archived without weakening exact-source or fail-closed rules. |
| P3 Close | complete | Drive the implementation PR to mergeable through Yeet, write the closeout reflection, archive proof, and synchronize packet evidence/status. | Yeet/GitHub reports the PR mergeable; a schema-valid reflection exists; README, PLAN, and manifest match the evidence. |

## Dependency Gate

- P0 is intentionally executable now.
- P1 substrate gate cleared by #871 and #1415. Consume `SourceTextIdentity`,
  `VerifiedSourceText`, and `VerifiedTextAnchor` with exact raw-slice equality.
  P0 corpus and floors must pass before implementation.

## Run 1 stop receipt

P0 stays pending: both blind reports failed JSON parsing and no qualified real-OA
positive text was retrieved. The form-only inventory cannot establish valid
dual-label floors. See `history/p0/2026-10-09-label-reconciliation.md` and
`history/handoffs/oa-slice-2026-10-09.md`. No P1 implementation began.

## Run 2 resumption

Third blind audit passes with 34 parseable labels and frozen A hash. Atomic
agreement 33/34; all differences reconciled. Retained-inventory floors pass
under the Run 2 source ruling. See the floor vectors and reconciliation in P0.

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

## P1-P2 evidence

The implemented floor vector is `[16,16,18,0,0,34]`, with 32 candidates.
All three package-verifies, full docgen, test-tsgo, JSDoc ratchet, knowledge refs,
Fallow audit/health and scoped coverage pass. New source coverage is 100% in all
four metrics. See `history/p2/2026-10-09-verification.md`; P3 evidence and reflection are complete; final-head monitoring follows under S11.

## P3 evidence

Reflection `history/reflections/2026-10-09-codex.md` passes lint with zero
blocking or advisory findings. PR #1573 carries the completion citation.
Local package/parity proofs pass; the inherited main EV015 remains explicit
under Decision (o) and S11. Hosted readiness is monitored separately and is
never inferred from structural mergeability or local proof.
