# Citation Extraction Engine Plan

## Status

Status: `in_progress`

The official source is cloned, pinned, licensed, and executable under Python
3.11. P0 still owes case-level fixture accounting and regex-safety evidence.
P1 and later production work remain blocked by both prerequisite public
contracts.

## Delivery Rule

This is one all-in implementation PR to control hosted CI cost. Work may use
reviewable local commits, but do not publish partial phase PRs or repeatedly
push incomplete checkpoints. Publish after local parity and repo gates are
green, then address hosted review in the same PR.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Source baseline and accounting | in progress | Maintain the detached official eyecite pin; enumerate every canonical API, model family, unittest method, embedded fixture case, regex family, and unique TS-port capability; freeze provenance and normalization rules. | Pins/tree hashes/licenses and upstream execution are recorded; case-level ledger and regex inventory contain no unreviewed source; root notice covers copied/adapted material; both dependency contracts are compatible before P1. |
| P1 Schema rebaseline and transform proof | pending/blocked | Rebuild provisional citation values into separate semantic, mention/evidence, resolution, document, and diagnostic schemas; implement the first current-form slice plus lawful wire/Bluebook transformations. | Schema disposition is applied; old mixed/duplicated contracts are removed; current forms pass exact-span differential tests and transformation laws. |
| P2 Canonical eyecite parity | pending/blocked | Port models/document behavior, cleaning, tokenization, full/reference extraction, filtering/disambiguation, resolution, and annotation from the pinned Python oracle using Effect-native internals. | Every canonical capability and fixture-case row is ported or subsumed with equivalent proof; no canonical row is rejected, deferred, or unexplained. |
| P3 Proven TS extensions | pending/blocked | Audit unique `eyecite-ts`/`eyecite-js` behaviors and implement every extension whose final disposition is adopted. | Every extension row has a final disposition; adopted rows have regression proof and rejected/follow-up rows have source-grounded rationale. |
| P4 Verify | pending/blocked | Run differential fixtures, exact UTF-16 anchors, transform properties, adversarial regex/runtime, package/type/docgen, and repo proof. | Zero unexplained oracle differences; all `SPEC.md` acceptance criteria and local Yeet verification are green. |
| P5 Close | pending/blocked | Publish the single PR, monitor hosted checks/review, write the reflection, and synchronize lifecycle evidence. | The PR is mergeable; reflection and packet state ship with the implementation. |

## Internal Implementation Order

1. Current full/short case, `Id.`, supra, 35 U.S.C., and 37 C.F.R. vertical
   slice.
2. Canonical model/document semantics and cleaning/tokenization.
3. Remaining canonical full/reference extraction, resolution, and annotation.
4. Accepted TypeScript-port extensions.
5. Full differential/property/performance/docgen proof.

The order provides early integration evidence but does not narrow the
completion contract.

## Blockers

- `goals/citation-verified-span-substrate`: verified source identity, canonical
  UTF-16 raw anchors, normalization mapping, straddle, and drift behavior.
- `goals/court-reporter-vocabulary`: stable public court/reporter IDs, lookups,
  artifact version, and compatibility classification.

P0 may continue while blocked. Do not replace either dependency with a local
look-alike or raw generated-file import.

## Verification Commands

```sh
test "$(wc -m < goals/citation-extraction-engine/GOAL.md)" -le 4000
jq . goals/citation-extraction-engine/ops/manifest.json
test "$(git -C /home/elpresidank/YeeBois/research/law_stuff/repos/eyecite rev-parse HEAD)" = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
git diff --check -- goals/citation-extraction-engine THIRD_PARTY_NOTICES.md
bun run beep yeet verify
bun run beep lint reflection-artifacts
```

## Closeout Checklist

1. Confirm every canonical/extension/schema ledger row has a terminal state.
2. Archive differential, span, transform, and regex evidence.
3. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`.
4. Run reflection lint and local Yeet verification.
5. Update README, PLAN, manifest, and lifecycle status in the implementation PR.
6. Publish once, monitor, and repair hosted findings in that same PR.
