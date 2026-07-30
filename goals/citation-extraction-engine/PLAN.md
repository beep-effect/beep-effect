# Citation Extraction Engine Plan

## Status

Status: `in-progress`

The official source is cloned, pinned, licensed, and executable under Python
3.11. P0 still owes independent source/runtime case reconciliation, executable
ledger accounting, authorized TypeScript-donor baselines, prerequisite
compatibility evidence, and regex-safety limits. P1 and later production work
remain blocked by both prerequisite public contracts.

## Delivery Rule

This is one all-in implementation PR to control hosted CI cost. Work may use
reviewable local commits, but do not publish partial phase PRs or repeatedly
push incomplete checkpoints.

This means one PR, not one commit or one unverifiable batch:

1. both prerequisite contracts must be merged/available and the compatibility
   gate must pass before P1;
2. each phase ends in a focused local green commit with its evidence archived;
3. no partial surface is described as stable or complete before all parity
   rows close; and
4. publish only after local parity and repo gates are green, then address hosted
   review in the same PR.

If the all-in branch becomes too large to review or verify safely, stop for
product direction. Do not silently split the PR, weaken parity, or hide
unfinished behavior behind public exports.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Source baseline and accounting | in-progress | Maintain the detached official eyecite pin; independently enumerate every canonical API, model family, unittest method, assertion/subtest case, regex family, and unique TS-port capability; freeze provenance, limits, and normalization rules. | Pins/tree hashes/licenses and upstream execution are recorded; static source inventory and runtime case export reconcile; the executable accounting checker passes negative controls; donor-suite holdpoints are resolved; regex limits/strategy are frozen; root notice covers copied/adapted material; both dependency contracts are compatible before P1. |
| P1 Schema rebaseline and transform proof | pending | Rebuild provisional citation values into separate semantic, mention/evidence, resolution, document, and diagnostic schemas; implement the first current-form slice plus lawful base/Bluebook codecs. | Schema disposition is applied; old mixed/duplicated contracts are removed; current forms pass exact-span differential tests and transformation laws. |
| P2 Canonical eyecite parity | pending | Port models/document behavior, cleaning, tokenization, full/reference extraction, filtering/disambiguation, resolution, and annotation from the pinned Python oracle using Effect-native internals. | Every canonical capability and fixture-case row is ported or subsumed with equivalent proof; no canonical row is rejected, deferred, or unexplained. |
| P3 Proven TS extensions | pending | Audit unique `eyecite-ts`/`eyecite-js` behaviors and implement every extension whose final disposition is adopted. | Every extension row has a final disposition; adopted rows have regression proof, rejected rows have source-grounded rationale, and follow-ups name an existing successor goal. |
| P4 Verify | pending | Run differential fixtures, exact UTF-16 anchors, transform properties, adversarial regex/runtime, package/type/docgen, and repo proof. | Zero unexplained oracle differences; all `SPEC.md` acceptance criteria and local Yeet verification are green. |
| P5 Close | pending | Publish the single PR, monitor hosted checks/review, write the reflection, and synchronize lifecycle evidence. | The PR is mergeable; reflection and packet state ship with the implementation. |

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

Before P1, create
`history/evidence/prerequisite-compatibility.md`. It must name the exact
published schemas/services, canonical import subpaths, anchor/vocabulary
artifact versions, compatibility result, approved adaptations, reviewer, date,
and reproducing commands. Until that artifact is approved, the packet's
separation/removal decisions are binding but exact prerequisite-derived fields,
brands, imports, versions, and codecs are provisional.

## P0 Executable Deliverables

P0 creates these committed, schema-decoded artifacts:

- `packages/law-practice/use-cases/test/fixtures/eyecite/source-inventory.json`
  from an AST/source walk of the pinned public API, tests, fixtures, model
  families, and regex families;
- `canonical-cases.json`, independently produced from instrumented runtime
  oracle cases;
- `typescript-extensions.json`, with every pinned donor export and
  test-observed behavior;
- `divergences.json`, with normalized comparison rules and focused target
  tests; and
- `regex-inventory.json` plus an adversarial corpus and benchmark metadata.

The schemas and test helpers are published only from
`@beep/law-practice-use-cases/test`. Add a package script named
`citation:parity-check` that independently reconciles source inventory, runtime
cases, capability rows, fixtures, target tests, provenance, hashes, divergences,
and regex families.

The checker must fail for:

- a missing or duplicate canonical case;
- an unknown/composite disposition or workflow state;
- a canonical row that is rejected, deferred, or lacks equivalent subsumption
  proof;
- an adopted extension without source, license, and regression evidence;
- a follow-up without an existing `successorGoal`;
- a fixture without a source hash/license;
- an unexplained normalized difference; or
- an unaccounted regex family.

Commit negative-control tests that deliberately introduce each defect and prove
the checker rejects it. Aggregate percentages and hand-maintained method counts
are informational only.

## P0 Holdpoints

### TypeScript donor suites

Do not install donor dependencies without explicit user authorization. After
authorization, use only the pinned checkouts and frozen lockfiles:

```sh
(cd "$EYECITE_TS_ROOT" && pnpm install --frozen-lockfile && pnpm test -- --run)
(cd "$EYECITE_JS_ROOT" && bun install --frozen-lockfile && bun test)
```

Record commit/tree, tool versions, before/after clean status, exact command,
result, and logs under `history/evidence/`. Do not edit lockfiles, install
globally, or move an extension out of `audit` on source inspection alone.

### Runtime and regex safety

Before P1, freeze the annotated `CitationEngineLimits` schema, numeric defaults
and maxima, and execution strategy in evidence. It must bound source UTF-16
length, candidates/mentions, pattern evaluations/matches, resolution edges,
annotation replacements/output growth, concurrency, and stage deadlines using
`Duration`. Requests may only tighten server-owned limits.

The adversarial lane uses geometric input sizes, recorded warmups/repetitions,
runtime/tool/CPU metadata, and a stable pass rule: no accepted pattern family
may exceed a `3.5x` median-time increase for two consecutive input doublings.
Absolute latency is informational; deterministic work counters and configured
caps are exact gates. A seeded catastrophic pattern must fail the lane.

A wall-clock timeout does not interrupt synchronous JavaScript regex execution.
Prefer statically reviewed patterns with literal prefilters and bounded work.
Rewrite or reject patterns that cannot meet the gate. Use killable isolation
only if canonical behavior cannot otherwise be preserved, and record that
decision before P1.

## Portable Verification Commands

```sh
test "$(wc -m < goals/citation-extraction-engine/GOAL.md)" -le 4000
jq -e . goals/citation-extraction-engine/ops/manifest.json >/dev/null
bun run beep goals index --check
bun run beep goals doctor
bunx markdownlint-cli2 'goals/citation-extraction-engine/**/*.md'
git diff --check origin/main...HEAD -- goals/citation-extraction-engine goals/INDEX.md THIRD_PARTY_NOTICES.md
git diff --check -- goals/citation-extraction-engine goals/INDEX.md THIRD_PARTY_NOTICES.md
bun run beep yeet verify
bun run beep lint reflection-artifacts
```

P0 creates this additional portable gate and adds it to the manifest before P0
can close:

```sh
bun run --cwd packages/law-practice/use-cases citation:parity-check
```

`yeet verify` and reflection lint are close gates, not reasons to claim an
unfinished phase is green.

## Optional Maintainer Oracle Regeneration

The live checkout is not a portable CI dependency. A maintainer who has the
clone sets `EYECITE_ORACLE_ROOT` and verifies the captured pin before
regenerating:

```sh
test -n "${EYECITE_ORACLE_ROOT:-}"
test "$(git -C "$EYECITE_ORACLE_ROOT" rev-parse HEAD)" = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
test "$(git -C "$EYECITE_ORACLE_ROOT" rev-parse 'HEAD^{tree}')" = "a35a58fac03400f71a93a93485b77f1d56f2b02f"
test -z "$(git -C "$EYECITE_ORACLE_ROOT" status --porcelain)"
(cd "$EYECITE_ORACLE_ROOT" && uv run --python 3.11 python -m unittest discover -s tests -p 'test_*.py')
```

An unavailable live clone is a skipped maintainer lane, not a failed portable
close gate. Regenerated committed fixtures must still pass the portable
accounting checker.

## Closeout Checklist

1. Confirm every canonical/extension/schema row has a valid disposition,
   complete workflow state, and required proof/successor reference.
2. Archive differential, span, transform, and regex evidence.
3. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`.
4. Run reflection lint and local Yeet verification.
5. Update README, PLAN, manifest, and lifecycle status in the implementation PR.
6. Publish once, monitor, and repair hosted findings in that same PR.
