# JSDoc Lead Single Source Spec

## Objective

Exported JSDoc keeps its Examples, tags and real Details and Gotchas, and stops carrying prose that repeats the code or the schema annotation beside it: 60% of 1,046 sampled blocks did. Graduated from `explorations/comment-law` (decision 2026-11-22, exported JSDoc).

## Non-Goals

- Deleting Examples or doctests.
- Free prose and local JSDoc (`comment-law-gate`, `comment-law-sweep`).

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/docgen` (lead from the annotation description when a block has none).
- `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts` and the JSDoc ratchet.
- `packages/tooling/policy-pack/lint-rules` (`informative-docs` extended: a lead restating its annotation fails).
- `.patterns/jsdoc-documentation.md`, `standards/effect-laws-v1.md` law 15, `AGENTS.md`, the `jsdoc-annotation-specialist` skill.

## Constraints

- The JSDoc Ratchet required check stays green through the change; tracked totals may only fall.
- Generated docs keep a description for every export, sourced from the annotation where the block has none.
- JSDoc tags that tools read (`@internal`, `@public`, `@expected-unused`, `@ignore`, `@deprecated`, `@since`, `@category`) and doctest fences are never deleted.
- Exports are resolved from the file's export declarations, so `export { x }`, `export default x` and module headers count as public.
- No committed per-comment or per-file inventory (S31). Out-of-repo ledgers live under `~/.local/state/beep/comment-law/`.

## Acceptance Criteria

- [ ] Type-level companions, barrels and annotated schemas pass docs lint and docgen without a lead.
- [ ] A lead that restates its annotation is flagged.
- [ ] A measured count of removed restating leads, against the sampled estimate of about 25,000 blocks.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/jsdoc-lead-single-source/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/jsdoc-lead-single-source/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/jsdoc-lead-single-source` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add jsdoc-lead-single-source --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug jsdoc-lead-single-source`; add a `kind: decision` file there, never edit this block._

### Lead-source scope: module headers, generated files and namespace members are out, 2026-11-22

Blocks carrying @packageDocumentation, @fileoverview or @file are module headers even when they lead the first re-export, so they are never restating leads. Generated files (_generated/, generated/, .generated.ts, a GENERATED FILE header) are rewritten by their generators and are not counted. Types inside a companion namespace get a derived lead in docgen, but the inventory scores only top-level exports, so the sweep leaves their written leads alone.

Lane goals/jsdoc-lead-single-source-p0

Reverse: Remove the moduleHeader and generated guards from restatingLeadFindings in JSDocDocumentationInventory.ts.

### Restating-lead predicate: at most one new content word, or new words a fifth of the lead, 2026-11-22

A written lead on an annotated schema, its same-name type companion or a barrel restates when, after stop words and documentation boilerplate (schema, type, decoded, runtime, exports, ...) are dropped and plural or past-tense endings folded, at most one of its content words is absent from the annotation description and the export's names, or absent words are at most a fifth of its content words. Calibrated on a scratch census of 13,800 in-scope leads: the strict verbatim-only rule (4,600) left obvious boilerplate such as 'Runtime type for {@link X}.' unflagged, a one-third rule deleted real qualifiers such as 'never interleaved'. Implemented once in @beep/repo-utils/JSDoc/LeadSource and shared by docgen, the inventory and the sweep codemod.

Lane goals/jsdoc-lead-single-source-p0

Reverse: Change leadRestates in packages/tooling/library/repo-utils/src/JSDoc/LeadSource.ts and re-measure the restating-lead baseline.

### Restating leads are flagged by the JSDoc inventory ratchet, not oxlint informative-docs, 2026-11-22

The oxlint docs rules only cover packages/tooling/*/*/src, while restating leads sit in every package; the JSDoc inventory already scans every docgen package and its ratchet is a required check. The inventory gains a counted-only rule restating-lead (it never opens a package, so packagesNeedingRemediation cannot grow) whose baseline starts at the measured count and may only fall. Extending informative-docs would also need a @beep/repo-utils dependency in @beep/lint-rules, which moves bun.lock, a CI binary closure input frozen during the P5 cutover.

Lane goals/jsdoc-lead-single-source-p0

Reverse: Port leadRestates into packages/tooling/policy-pack/lint-rules/src/rules/docs.ts informative-docs and drop the restating-lead inventory rule.

### Single-source exported JSDoc leads from schema annotations, 2026-11-22

Operator ruling, align round 2: keep Examples, tags, Details and Gotchas; stop requiring a lead on type-level companions, barrels and annotated schemas, derive it from the annotation, and flag a lead that restates its annotation. Rejected: keep and lint tautology, leave as is, drop all prose. Source: explorations/comment-law/DECISIONS.md.

Lane explore/comment-law

Reverse: Restore required leads in docs lint, the inventory and law 15.

### Sweep the CI binary closure files in wave 5 behind a map-sources and comment-only proof, 2026-11-23

The CI goals driver ruled that the 64 closure files wave 3 reverted ride wave 5 with identity `Term.ts`, at the ordinary gate, under two proofs attached to the PR before it opens:

- **Map-sources exclusion.** Every runner handler entry (the seven alchemy-github-runners Lambdas and the ci-runners reaper; 8 bundles, 11 functions) is built with `HandlerBundles.test.ts`'s Alchemy options at the wave 5 tree, and each map's `sources` is resolved to repo paths. A wave 5 file found there would leave for a deploy-worded wave. The intersection is empty; the handler graphs load five identity sources (the five `HandlerBundles.test.ts` pins), four `@beep/schema` modules, and the runner packages, and no `@beep/utils` or `@beep/data` module.
- **Comment-only proof.** Each of the 65 changed files is transpiled before and after with `bun build --no-bundle --minify`; all 65 outputs are byte-identical. A file that differed would leave as a code change.

All 65 files are listed in the latest release's `beep-linux-x64.closure.json` (`beep-ci-0b8fef917164`) and in the current `beep ci binary-closure --list`. After the merge the driver reads the Beep CI Binary run (expected: closure changed, binary identical, re-record, no release) and a plan_only on the merge head (expected: 0 code rows). Wave 5 merges only after the pin PR #3500 and never while another binary cycle is open.

Lane goals/jsdoc-lead-single-source-w5

Reverse: Revert the wave 5 PR; the binary re-records its closure digest back and no Lambda code hash moves

### The 25,000 estimate counts all tautological exported prose; 8,726 single-source restating leads is the addressable backlog, 2026-11-23

The measured backlog (8,726 restating leads in the JSDoc ratchet) is about a third of the
exploration's 25,000. Running the detector over the same 1,046 sampled public blocks, at the
ledger's commit, shows the gap comes from the estimate's denominator, not from a narrow detector.

| Sampled block | Sampled tautological (628) | Sampled other (418) |
| --- | --- | --- |
| Detected: annotated export or companion | 186 | 45 |
| Detected: barrel | 30 | 0 |
| Annotated, lead judged informative | 76 | 66 |
| Barrel, lead judged informative | 36 | 6 |
| No annotation (functions, layers, constants, commands) | 171 | 209 |
| Module headers (`@packageDocumentation`) | 60 | 58 |
| Test and tooling-root files | 28 | 31 |
| Empty lead (prose is in Details) | 24 | 0 |
| Namespace members, other | 17 | 3 |

- The detector agrees with the sample on 216 blocks and misses 412.
- 283 of the misses have no single source to derive a lead from, or the scope decision excludes them:
  - 171 unannotated exports;
  - 60 module headers;
  - 28 test and tooling-root blocks;
  - 24 leadless blocks.

  Deleting an unannotated lead turns a restating lead into a missing summary, which is a different
  law change from this goal's.
- The 45 detected blocks the sample did not call tautological repeat their annotation nearly word
  for word. The sampler coded the prose by what it says, not by whether it repeats; docgen derives
  the same text, so removing them loses nothing.
- Of the remaining 129 misses, 17 are namespace members or blocks with no declaration.
  The other 112 (76 annotated, 36 barrel) are paraphrases and barrel content summaries. Widening the predicate does not pay: allowing up to two or three new words, or new
  words up to half the lead, flags the extra blocks at about 60% precision against the sample,
  and the sample's own labels agree 76% under a blind relabel. Those leads stay with their
  authors.

Re-extrapolated, the detected share is 261 of 1,046 (25%), or about 10,500 of 42,134 exported
blocks. That denominator counts module headers, test files and blocks outside docgen packages,
which the inventory does not, so 8,726 measured is consistent with it. The goal keeps reporting
removed leads against the 8,726 baseline, with 25,000 as the exploration's upper bound for all
tautological exported prose.

Lane goals/jsdoc-lead-single-source-p0 · PR #3496

Reverse: Widen leadRestates or derivedLead sources in @beep/repo-utils/JSDoc/LeadSource and rewrite the jsdoc ratchet baseline

### Double-classify paraphrase leads in law-practice/domain, then stop the pass at 23% yield, 2026-11-23

The lexical `restating-lead` rule finds leads that repeat their `$I.annote` description word for
word. A second class restates it in other words: an annotated schema whose lead is a paraphrase
of its annotation. Wave 2 ran a double-classification pass on that class for its first package,
`@beep/law-practice-domain`, and stops the pass there.

- **Candidates:** 254 exports in `packages/law-practice/domain` whose lead shares words with the
  annotation but is not flagged by the lexical rule.
- **Classifier A:** an Opus 5.5 medium Agent child, given only the rows (file, export, lead,
  annotation), labelled each row `delete` (the lead says nothing the annotation does not) or
  `keep`.
- **Classifier B:** Cursor `claude-opus-5-5-medium` in a separate session with no author context:
  `cursor-agent -p --trust --mode ask --sandbox enabled --model claude-opus-5-5-medium
  --output-format text <prompt>`. Cursor's sandbox failed to mount its tool environment
  ("Mount count limit reached"), so the session ran with no tools and the rows in the prompt;
  the sandbox stayed enabled.
- **Result:** A and B agreed on 240 of 254 rows; 59 rows are `delete` on both sides (23%
  yield). Only those 59 leads are removed. An earlier pairing of two Opus Agent children agreed
  on 64; it is superseded because the second classifier must be a separate provider session.
- **Stop:** the brief stops the pass when the first package yields under about 30%. At 23%, a
  paraphrase lead is more often a different sentence than a restatement, and the cost is two
  classifier sessions per package. Later waves remove lexical restatements only.

Paraphrase removals are reported apart from the lexical count: they do not move the
`restating-lead` total, which counts only lexical restatements.

Lane goals/jsdoc-lead-single-source-p1

Reverse: Restore the 59 leads from the W2 merge base and resume the pass in later waves with the same two-classifier route

### Re-baseline restating-lead to 8,758 for the 32 leads two PRs added before #3496 merged, 2026-11-23

Main at 37f350c4c4d failed `quality:jsdoc-ratchet:regenerated` with `restating-lead: 8758 > 8726 (+32)`.
#3496 computed the 8,726 baseline at its branch base (0e305a468a0). Two PRs merged between that base
and #3496's merge and added restating leads that the baseline never saw:

| PR | File | Rows |
| --- | --- | --- |
| #3439 | `packages/foundation/modeling/identity/src/Term.ts` | +17 |
| #3439 | `packages/tooling/tool/cli/src/commands/Identity/Registry.ts` | +3 |
| #3439 | `packages/foundation/modeling/rdf/src/NamespacePin.ts` | +2 |
| #3439 | `packages/foundation/modeling/identity/src/Registry.ts` | +1 |
| #3439 | `packages/tooling/tool/cli/src/commands/Identity/index.ts` | +1 |
| #3439 | `identity/src/Curie.ts`, `identity/src/Vocab.ts`, `rdf/src/Rdf.ts` (leads removed) | -4 |
| #3493 | `packages/tooling/tool/cli/src/commands/Ci/CiFailures.ts` | +4 |
| #3493 | `packages/tooling/tool/cli/src/commands/Ci/CiMainFeed.ts` | +4 |
| #3493 | `packages/tooling/tool/cli/src/commands/Ci/CiJobAdapter.ts` | +3 |
| #3493 | `packages/tooling/tool/cli/src/commands/Ci/CiFeedArtifact.ts` | +1 |

Net: #3439 +20, #3493 +12, total +32; #3497 added none. Every added row sits in a runner-bundle
package (`@beep/identity`) or in repo-cli `Ci/` closure source, so this lane may not sweep them
outside the orchestrator's sequencing. The baseline is rewritten to 8,758 and the 32 rows join the
last P1 sweep wave, the one the P1 checkpoint in PLAN.md schedules as "CI-closure and P5 runner
packages last". That wave covers `@beep/identity`, `@beep/infra-ci-runners`,
`@beep/alchemy-github-runners`, `@beep/schema` and the repo-cli `Ci/` closure files, these 32
rows included. The orchestrator merges it on the CI goals driver's sequencing, and its PR names
those packages.

**Correction (wave 3).** The CI goals driver checked the rows against both P5 fences. Repo-cli
`Ci/*` and `Identity/*` are in no runner Lambda bundle and outside the CI closure, and identity
`src/Registry.ts` is in no handler graph and outside the closure. Of the rows, only
`identity/src/Term.ts` (17) is fenced, as closure source. The 32 above is net of the 4 leads #3439
removed, so the PRs added 36 rows: wave 3 removes 13: `rdf/src/NamespacePin.ts` 2, `identity/src/Registry.ts` 1, cli
`Identity/index.ts` 1, cli `Identity/Registry.ts` 2 of 3, and the four `Ci/` files 7 of 12. Six
cli leads stay because removing them leaves a tooling export with no description, which
`beep/require-description` rejects under `--max-warnings=0`; wave 4 teaches that rule to accept a
lead derived from the annotation and removes them. The 17 `Term.ts` rows wait for wave 5.

Lane fix/jsdoc-ratchet-restating-lead-main

Reverse: Wave 3 removes 13 of the 36 added leads; remove the 6 tooling leads in wave 4 and the 17 in identity Term.ts in wave 5, then lower the baseline with jsdoc-ratchet --write-baseline

### require-description accepts a lead derived from the export's annotation, 2026-11-23

In `packages/tooling/*/*/src` the docs oxlint config runs `beep/require-description` under `--max-warnings=0`. Wave 3 showed it rejecting a type companion (`export type X = typeof X.Type`) whose only lead restated `X`'s `$I.annote*` description: removing the lead left a tags-only block. That is the same restatement the goal removes, so the rule now treats a declaration as described when docgen can derive its lead: it records every `annote`/`annoteSchema`/`annoteClass`/`annoteError`/`annoteHttp` call whose identifier names an enclosing variable or class and whose options carry a literal `description`, and at `Program:exit` it reports only the missing descriptions that no such annotation covers, by the declaration's own name or its enclosing namespace's. This mirrors `derivedLead` in `@beep/repo-utils/JSDoc/LeadSource` (annotated value, same-named type companion, namespace members). Fixture cases cover a companion type and namespace member, an annotated class, an annotation naming another export, and an annotation without a description.

Lane goals/jsdoc-lead-single-source-w4

Reverse: Drop the derived-lead exemption from beep/require-description in policy-pack lint-rules docs.ts and restore the leads the rule then reports

### Sweep waves skip both P5 cutover fences, file by file: the CI binary closure and the runner handler graphs, 2026-11-23

The P5 cutover has two fences. Both are file fences, not package fences, and the sweep waves leave
every file behind either one untouched:

- **CI binary closure** (`beep ci binary-closure --list`): any byte change starts a binary build and
  release cycle that the CI goals driver sequences.
- **Runner handler graphs**: Alchemy hashes each runner Lambda's zip including its source map, whose
  `sourcesContent` embeds every loaded module's full text, so a JSDoc-only edit in a handler-graph
  file changes the code hash. The fenced files are the five identity sources
  `HandlerBundles.test.ts` pins (`Authority.ts`, `Id.ts`, `Root.ts`, `internal/Segment.ts`,
  `internal/schemaStatics.ts`), ci-runners `src/internal/lambda/**` and everything it imports, the
  alchemy-github-runners handler graphs, and any `@beep/schema`, `@beep/data` or `@beep/utils`
  module those graphs load. When a file is in doubt, a HandlerBundles-style before/after build that
  compares map sources decides.

Wave 3 swept 653 files in foundation, drivers and six repo-cli files, then reverted the 64 that are
closure source: drivers/github-actions (3), capability cli-kit (22), runtime-env (10), walker (1),
modeling github-commands (1), github-reporting (1), identity `Iri.ts` (1), markdown (12), utils
(12) and primitive/data (1). The CI goals driver ruled in writing that identity `Registry.ts` and
repo-cli `Ci/*` and `Identity/*` are behind neither fence, so wave 3 keeps them. Wave 4 (tooling)
applies both checks. The fenced files join wave 5 with identity `Term.ts`. Wave 5 runs only on the
orchestrator's slot, after tksr C's cumulative pin (#3500) merges, and its release gets the driver's
read.

Lane goals/jsdoc-lead-single-source-w3

Reverse: Sweep the fenced files in wave 5, on the orchestrator's slot, once it says in writing that the P5 fence has lifted

### The goal closes with 507 restating leads, each in a named category with the condition that lifts it, 2026-11-24

The goal closes with 507 `restating-lead` rows, measured at head `85069e57476` (wave 6 #3535 on main 3c58c72a). Every row falls into one of the seven categories below. The categories add up to exactly 507: 235 + 72 + 14 + 14 + 10 + 107 + 55.

**Selector.** This command reproduces the 507 from the committed inventory:

```sh
jq -r '.packages[] | (.exports[]?, .modules[]?) | .repoPath as $p
  | (.documentationShapeViolations[]? | select(.rule == "restating-lead")) | $p' \
  .beep/ci/jsdoc-documentation.inventory.jsonc | sort | uniq -c
```

The inventory is regenerated by `bun run beep quality jsdoc-ratchet --regenerate`. A file belongs to a fence category when it is in that fence's list, rebuilt on this main:

- `beep ci binary-closure --list`, plus the release `beep-linux-x64.closure.json`;
- the source-map `sources` of the eight `HandlerBundles.test.ts` bundles;
- the paths pinned by `root-tasks-turbo-inputs.test.ts`.

**Ratchet.** `standards/jsdoc-totals.regression-baseline.jsonc` holds `restating-lead` at 507 and `packagesNeedingRemediation` at 15. `quality:jsdoc-ratchet:regenerated` fails a tree whose total exceeds either one, so the count can stay at 507 or fall, never rise. Whichever wave lifts a category writes the lower baseline.

## 1. CI binary closure: 235 rows, 63 files

**Reason:** these are in the `beep` CI binary closure. A comment-only change still moves the closure digest and re-records the binary.

**Lifted by:** the pin-flow PR route. Run a wave under the closure-wave proofs (`2026-11-23-closure-wave-proofs.md`: byte-identical `bun build --no-bundle --minify` output for every file) and take it through the CI driver's binary pin cycle, never while another binary cycle is open.

| File                                                                                            | Rows |
| ----------------------------------------------------------------------------------------------- | ---: |
| `packages/foundation/capability/cli-kit/src/CliPrompt.ts`                                       |    1 |
| `packages/foundation/modeling/schema/src/AtURI.ts`                                              |    2 |
| `packages/foundation/modeling/schema/src/BufferEncoding.ts`                                     |    1 |
| `packages/foundation/modeling/schema/src/Color/Color.adjust.ts`                                 |    9 |
| `packages/foundation/modeling/schema/src/Color/Color.hex.ts`                                    |    5 |
| `packages/foundation/modeling/schema/src/Color/Color.oklch.ts`                                  |    7 |
| `packages/foundation/modeling/schema/src/Color/Color.rgb.ts`                                    |    6 |
| `packages/foundation/modeling/schema/src/Color/Color.scale.ts`                                  |    8 |
| `packages/foundation/modeling/schema/src/Color/Color.shared.ts`                                 |    2 |
| `packages/foundation/modeling/schema/src/Color/Color.transforms.ts`                             |    6 |
| `packages/foundation/modeling/schema/src/Color/Color.ts`                                        |    6 |
| `packages/foundation/modeling/schema/src/Conformance/Conformance.annotations.ts`                |    2 |
| `packages/foundation/modeling/schema/src/Conformance/Conformance.invariant.schema.ts`           |   15 |
| `packages/foundation/modeling/schema/src/Conformance/Conformance.policy.schema.ts`              |    4 |
| `packages/foundation/modeling/schema/src/Conformance/Conformance.profile.schema.ts`             |    1 |
| `packages/foundation/modeling/schema/src/Conformance/Conformance.report.schema.ts`              |    9 |
| `packages/foundation/modeling/schema/src/Conformance/Conformance.source.schema.ts`              |   14 |
| `packages/foundation/modeling/schema/src/ContinentCode.ts`                                      |    5 |
| `packages/foundation/modeling/schema/src/CountryCode.ts`                                        |    3 |
| `packages/foundation/modeling/schema/src/CredentialPatternBank/CredentialPatternBank.schema.ts` |    1 |
| `packages/foundation/modeling/schema/src/CurrencyCode.ts`                                       |    4 |
| `packages/foundation/modeling/schema/src/Did.ts`                                                |    2 |
| `packages/foundation/modeling/schema/src/Double.ts`                                             |    2 |
| `packages/foundation/modeling/schema/src/FileDiff.schema.ts`                                    |    5 |
| `packages/foundation/modeling/schema/src/FileExtension.ts`                                      |    1 |
| `packages/foundation/modeling/schema/src/FilePath/FilePath.guards.ts`                           |    5 |
| `packages/foundation/modeling/schema/src/FilePath/FilePath.roots.ts`                            |    5 |
| `packages/foundation/modeling/schema/src/FilePath/FilePath.schema.ts`                           |    2 |
| `packages/foundation/modeling/schema/src/FilePath/FilePath.segments.ts`                         |   11 |
| `packages/foundation/modeling/schema/src/FilePath/FilePath.windows.ts`                          |    5 |
| `packages/foundation/modeling/schema/src/FilePath/index.ts`                                     |    1 |
| `packages/foundation/modeling/schema/src/FileTypeChecker/FileTypeChecker.schema.ts`             |    8 |
| `packages/foundation/modeling/schema/src/Fixed64.ts`                                            |    2 |
| `packages/foundation/modeling/schema/src/Float.ts`                                              |    2 |
| `packages/foundation/modeling/schema/src/Float16Array.ts`                                       |    5 |
| `packages/foundation/modeling/schema/src/Float32Array.ts`                                       |    5 |
| `packages/foundation/modeling/schema/src/Float64Array.ts`                                       |    5 |
| `packages/foundation/modeling/schema/src/Fn/Fn.schema.ts`                                       |    2 |
| `packages/foundation/modeling/schema/src/Html.ts`                                               |    2 |
| `packages/foundation/modeling/schema/src/IeeeNumber.ts`                                         |    1 |
| `packages/foundation/modeling/schema/src/LocalDate/LocalDate.schema.ts`                         |    3 |
| `packages/foundation/modeling/schema/src/Markdown.ts`                                           |    1 |
| `packages/foundation/modeling/schema/src/MimeType.ts`                                           |    1 |
| `packages/foundation/modeling/schema/src/PatternOntology/PatternOntology.schema.ts`             |    4 |
| `packages/foundation/modeling/schema/src/Port.ts`                                               |    4 |
| `packages/foundation/modeling/schema/src/PosixPath.ts`                                          |    2 |
| `packages/foundation/modeling/schema/src/SchemaUtils/withKeyDefaults.ts`                        |    4 |
| `packages/foundation/modeling/schema/src/SeverityLevel.ts`                                      |    1 |
| `packages/foundation/modeling/schema/src/Sha256.ts`                                             |    7 |
| `packages/foundation/modeling/schema/src/Slug.ts`                                               |    1 |
| `packages/foundation/modeling/schema/src/TerritoryCode.ts`                                      |    3 |
| `packages/foundation/modeling/schema/src/URL.ts`                                                |    3 |
| `packages/foundation/modeling/schema/src/Xml.ts`                                                |    1 |
| `packages/tooling/library/repo-cli-kit/src/cli/ExitCodeError.ts`                                |    1 |
| `packages/tooling/library/repo-cli-kit/src/cli/Stdout.ts`                                       |    1 |
| `packages/tooling/library/repo-utils/src/errors/CyclicDependencyError.ts`                       |    1 |
| `packages/tooling/library/repo-utils/src/errors/DomainError.ts`                                 |    1 |
| `packages/tooling/library/repo-utils/src/errors/NoSuchFileError.ts`                             |    1 |
| `packages/tooling/library/repo-utils/src/errors/OptionInjectionError.ts`                        |    1 |
| `packages/tooling/tool/cli/src/commands/Ci/Ci.errors.ts`                                        |    2 |
| `packages/tooling/tool/cli/src/commands/Ci/CiCachePilot.schemas.ts`                             |    3 |
| `packages/tooling/tool/cli/src/commands/Ci/CiOperational.schemas.ts`                            |    4 |
| `packages/tooling/tool/cli/src/commands/Ci/CiShardOverflow.ts`                                  |    3 |

## 2. Runner handler graphs: 72 rows, 17 files

**Reason:** these files are bundled into the alchemy-github-runners Lambdas or the ci-runners reaper. A JSDoc edit changes the bundle's source map and so the Lambda code hash, which is a deploy.

**Lifted by:** the same pin-flow route, in a deploy-worded wave. It must show the map-sources intersection, and a `plan_only` on the merge head that shows only the expected code rows.

| File                                                                                | Rows |
| ----------------------------------------------------------------------------------- | ---: |
| `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.errors.ts`           |    1 |
| `packages/tooling/library/alchemy-github-runners/src/Ec2Events.models.ts`           |    4 |
| `packages/tooling/library/alchemy-github-runners/src/Ec2Fleet.models.ts`            |    3 |
| `packages/tooling/library/alchemy-github-runners/src/GitHubApp.layer.ts`            |    2 |
| `packages/tooling/library/alchemy-github-runners/src/GitHubRunners.models.ts`       |    4 |
| `packages/tooling/library/alchemy-github-runners/src/RunnerBinaries.service.ts`     |    1 |
| `packages/tooling/library/alchemy-github-runners/src/RunnerFleet.errors.ts`         |    8 |
| `packages/tooling/library/alchemy-github-runners/src/RunnerInstance.models.ts`      |    2 |
| `packages/tooling/library/alchemy-github-runners/src/RunnerMessages.models.ts`      |    1 |
| `packages/tooling/library/alchemy-github-runners/src/RunnerPool.models.ts`          |   12 |
| `packages/tooling/library/alchemy-github-runners/src/RunnerRuntime.models.ts`       |    9 |
| `packages/tooling/library/alchemy-github-runners/src/ScaleDown.program.ts`          |    2 |
| `packages/tooling/library/alchemy-github-runners/src/ScaleUp.program.ts`            |   10 |
| `packages/tooling/library/alchemy-github-runners/src/SsmParameters.models.ts`       |    2 |
| `packages/tooling/library/alchemy-github-runners/src/SsmStore.service.ts`           |    4 |
| `packages/tooling/library/alchemy-github-runners/src/TerminationWatcher.program.ts` |    2 |
| `packages/tooling/library/alchemy-github-runners/src/WorkflowJob.models.ts`         |    5 |

## 3. Lane-owned, `infra/src`: 14 rows, 5 files

**Reason:** this is the Pulumi estate that the infra-alchemy-rebuild lanes are replacing. Editing it would conflict with those lanes, and the files are expected to be deleted.

**Lifted by:** infra-alchemy-rebuild. When that goal retires the Pulumi estate, these files are deleted and the rows go with them. Any file that survives is swept in the first wave after that goal closes.

| File                             | Rows |
| -------------------------------- | ---: |
| `infra/src/AIMetrics.ts`         |    1 |
| `infra/src/CiFleetController.ts` |    3 |
| `infra/src/CiRunnerPool.ts`      |    1 |
| `infra/src/CiRunners.ts`         |    7 |
| `infra/src/CiTurboCache.ts`      |    2 |

## 4. Lane-owned, `@beep/text`: 14 rows, 9 files

**Reason:** the text-knowledge-stack-rebuild (tksr) lanes own and are rewriting `packages/foundation/modeling/text`.

**Lifted by:** tksr. Its P7 retirement and P8 closeout (lane `goals/text-knowledge-stack-rebuild-p7-retirement`) leave the package's final shape, and that closeout or the next sweep after it removes the leads that still restate.

| File                                                          | Rows |
| ------------------------------------------------------------- | ---: |
| `packages/foundation/modeling/text/src/LocatorMap.ts`         |    2 |
| `packages/foundation/modeling/text/src/Occurrence.ts`         |    1 |
| `packages/foundation/modeling/text/src/OffsetUnit.ts`         |    2 |
| `packages/foundation/modeling/text/src/QuoteKey.ts`           |    2 |
| `packages/foundation/modeling/text/src/Reanchoring.ts`        |    2 |
| `packages/foundation/modeling/text/src/Resolution.ts`         |    1 |
| `packages/foundation/modeling/text/src/Selector.ts`           |    1 |
| `packages/foundation/modeling/text/src/SourceTextIdentity.ts` |    2 |
| `packages/foundation/modeling/text/src/TextNormalization.ts`  |    1 |

## 5. Seal-pinned: 10 rows, 3 files

**Reason:** `root-tasks-turbo-inputs.test.ts` pins a sha256 digest of each of these files. A comment edit breaks the seal unless the digest is resealed in the same PR.

**Lifted by:** a seal refresh. A wave that strips these leads must update the pinned digests in `root-tasks-turbo-inputs.test.ts` in the same PR, and it is reviewed as a seal change.

| File                                                                | Rows |
| ------------------------------------------------------------------- | ---: |
| `packages/tooling/library/repo-utils/src/FsUtils.ts`                |    1 |
| `packages/tooling/library/repo-workspaces/src/WorkspacePatterns.ts` |    2 |
| `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts`      |    7 |

## 6. Would lose their summary: 107 rows, 24 `@beep/schema` files

**Reason:** this is a docgen limit. The lead derivation in `@beep/repo-utils/JSDoc/LeadSource` (`derivedLead`) finds no annotation for these exports. If the lead were removed, the export would have no summary and `packagesNeedingRemediation` would rise from 15 to 16, as the #3535 review found. Two patterns cover them:

- type companions documented as `{@inheritDoc X}`, which the derivation does not follow to `X`'s annotation;
- brand schemas whose `$I.annoteSchema(...)` sits after `S.brand(...)` inside `.pipe(...)`, a call shape the derivation does not match.

**Lifted by:** a docgen change in `derivedLead` with two parts:

1. resolve `{@inheritDoc X}` to `X`'s derived lead;
2. accept an `annoteSchema` or `annote` call at any position in the initializer's `.pipe(...)` chain.

`beep/require-description` needs the same change, because it mirrors `derivedLead`. After that the codemod strips these leads without opening a package.

| File                                                                                                          | Rows |
| ------------------------------------------------------------------------------------------------------------- | ---: |
| `packages/foundation/modeling/schema/src/Age/Age.schema.ts`                                                   |    2 |
| `packages/foundation/modeling/schema/src/CrossOriginEmbedderPolicy/CrossOriginEmbedderPolicy.schema.ts`       |    5 |
| `packages/foundation/modeling/schema/src/CrossOriginOpenerPolicy/CrossOriginOpenerPolicy.schema.ts`           |    5 |
| `packages/foundation/modeling/schema/src/CrossOriginResourcePolicy/CrossOriginResourcePolicy.schema.ts`       |    5 |
| `packages/foundation/modeling/schema/src/CryptoTxnHash/CryptoTxnHash.schema.ts`                               |    3 |
| `packages/foundation/modeling/schema/src/CryptoWalletAddress/CryptoWalletAddress.schema.ts`                   |    1 |
| `packages/foundation/modeling/schema/src/Csp/Csp.schema.ts`                                                   |   13 |
| `packages/foundation/modeling/schema/src/DomCssProperties/DomCssProperties.schema.ts`                         |    1 |
| `packages/foundation/modeling/schema/src/DomReactNode/DomReactNode.schema.ts`                                 |    2 |
| `packages/foundation/modeling/schema/src/EthAmount/EthAmount.schema.ts`                                       |    2 |
| `packages/foundation/modeling/schema/src/EthereumValidatorPublicKey/EthereumValidatorPublicKey.schema.ts`     |    4 |
| `packages/foundation/modeling/schema/src/EvmAddress/EvmAddress.schema.ts`                                     |    2 |
| `packages/foundation/modeling/schema/src/ExpectCt/ExpectCt.schema.ts`                                         |    6 |
| `packages/foundation/modeling/schema/src/ForceHttpsRedirect/ForceHttpsRedirect.schema.ts`                     |    6 |
| `packages/foundation/modeling/schema/src/FrameGuard/FrameGuard.schema.ts`                                     |    6 |
| `packages/foundation/modeling/schema/src/NoOpen/NoOpen.schema.ts`                                             |    5 |
| `packages/foundation/modeling/schema/src/NoSniff/NoSniff.schema.ts`                                           |    5 |
| `packages/foundation/modeling/schema/src/PermissionsPolicy/PermissionsPolicy.schema.ts`                       |   10 |
| `packages/foundation/modeling/schema/src/PermittedCrossDomainPolicies/PermittedCrossDomainPolicies.schema.ts` |    5 |
| `packages/foundation/modeling/schema/src/ReferrerPolicy/ReferrerPolicy.schema.ts`                             |    7 |
| `packages/foundation/modeling/schema/src/SecureHeader/SecureHeader.schema.ts`                                 |    2 |
| `packages/foundation/modeling/schema/src/SecureHeaderError/SecureHeaderError.errors.ts`                       |    2 |
| `packages/foundation/modeling/schema/src/SecureHeaderOptions/SecureHeaderOptions.schema.ts`                   |    2 |
| `packages/foundation/modeling/schema/src/XssProtection/XssProtection.schema.ts`                               |    6 |

## 7. Guard-kept: 55 rows, 15 files

**Reason:** the wave codemod's `stripLead` guard refused each of these blocks. It removes a lead only from a multi-line block that opens with a bare `/**` line, and only when tags, an Example or a Details/Gotchas section remain after the lead. It keeps three shapes:

- a lead written on the opening line (`/** Type for {@link X}.` followed by an Example);
- a single-line block (`/** ... */`, mostly on struct fields with `annoteKey` descriptions);
- a block that would be left empty.

None of these is in a fence.

**Lifted by:** a guard extension in a later sweep. It must move an opening-line lead off the `/**` line and handle single-line field blocks, which leaves the block empty and deletes it. Each such sweep needs docs-lint proof that the field still passes `beep/require-description`.

| File                                                                              | Rows |
| --------------------------------------------------------------------------------- | ---: |
| `apps/practice-m365-contacts/src/Contacts.schemas.ts`                             |    1 |
| `packages/agents/server/src/ProviderInstance/index.ts`                            |    2 |
| `packages/agents/use-cases/src/entities/ProviderInstance/index.ts`                |    3 |
| `packages/drivers/github-actions/src/Artifact.ts`                                 |    3 |
| `packages/drivers/m365/src/M365.service.ts`                                       |    2 |
| `packages/law-practice/domain/src/values/Citation/Citation.bluebook.ts`           |    1 |
| `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.annotation.ts` |    2 |
| `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.errors.ts`     |    1 |
| `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.evidence.ts`   |    1 |
| `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.input.ts`      |    3 |
| `packages/law-practice/use-cases/src/CitationEngine/CitationEngine.operations.ts` |    1 |
| `packages/ontology/use-cases/src/tools/OntologyToolkit.ts`                        |   28 |
| `packages/tooling/library/repo-workspaces/src/Workspaces.ts`                      |    2 |
| `packages/tooling/tool/cli/src/commands/Kb/Kb.schemas.ts`                         |    2 |
| `packages/tooling/tool/cli/src/commands/Kb/KbGraph.schemas.ts`                    |    3 |

Lane goals/jsdoc-lead-single-source-w6 · PR #3535

Reverse: Lift a category by its named route and lower the restating-lead baseline; delete this file once the count reaches 0

### Wave 6 sweeps the packages earlier waves deferred, minus fenced and lane-owned files, 2026-11-24

Waves 2 and 3 skipped the packages comment-law-sweep had in flight (jsonl, csv, semver, spdx, npm-spec, tsconfig, md) and `@beep/schema`. Those sweeps have merged, so wave 6 runs the codemod over them plus `package-json`, which carried 58 rows. Three sets stay out. The 53 `@beep/schema` files that sit in the CI binary closure or the runner handler graphs keep their leads, because those fences are per file. `infra/src` keeps its 14 leads: it is the Pulumi estate the infra-alchemy-rebuild lanes are replacing during the P5 cutover, and edits there would collide with them. `@beep/text` belongs to the in-flight text-knowledge-stack lanes. The codemod's guard also kept every row in ontology, law-practice, agents, m365, github-actions and cli-kit, because removing those leads would change meaning or leave an empty block. Wave 6 also restores the leads in 24 `@beep/schema` files: removing them left 54 exports with no summary. Those exports sit behind `{@inheritDoc X}` companions or annotations the inventory's lead derivation does not reach, such as `$I.annoteSchema` after `S.brand` in a `.pipe(...)`. Without the leads, `@beep/schema` would read needs-remediation and the `packagesNeedingRemediation` ceiling would rise from 15 to 16. The removed count is 338, not 445.

Lane goals/jsdoc-lead-single-source-w6

Reverse: Revert the wave 6 commit and re-run jsdoc-ratchet --write-baseline

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
