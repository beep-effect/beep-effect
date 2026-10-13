# spdx — round-2 merged inventory

Seats read: `grok.md` (no findings), `sol.md` (1 finding), and `fable.md` (9 findings), with their shared `BRIEF.md`. There are no part-N reports. Review snapshot: `a12bef261998d2ad92153dada46373be06950692`. Live checkout: `@lab/effected-2`, HEAD `7a6b586acb973cb2dba3c312d08074eaa26fb040`; the requested branch was `@lab/effected`. No branch change was made.

Counts: **Required 1 · Backlog 8 · Codemod 1 · Rejected 0 · Groups 1**. All 10 seat findings are accounted for; no duplicate defects occur across these reports. The current `standards/effect-laws.allowlist.jsonc` has **zero** entries for `scratchpad/effected/spdx/**`, so no `allow-<n>` findings are added.

The operator revision and all its rulings, D1–D20, sections 12.5 and 14, and the inventory task's write-surface restrictions govern classification. Docs, metadata prose, coverage and Vitest-canon items remain backlog under the task's S2/S3 instruction even though the brief describes those gates as green. Probe and benchmark results below are seat evidence, not new runs. Live source confirms the cited defects. Read-only `git log --format=%h:%s -- scratchpad/effected/spdx/SpdxExpression.ts` exposes the squashed progress commit `7929b1f529`; its diff and embedded stage history preserve the law-forced Match dispatch and round-1 encoded-type repair. No change is classified as unforced, and no upstream restoration is assigned.

Group `g1` owns only `scratchpad/effected/spdx/SpdxExpression.ts`. The required repair changes a type declaration, not runtime behavior; no existing upstream test lines must change, so its `tests` list is empty. Existing expression and oracle suites are validation inputs rather than additional write ownership. README Port notes and the central ledger are excluded from all fix groups.

## Required

### sol-2-1 — Recursive encoded types admit compound operands under WITH

- file: scratchpad/effected/spdx/SpdxExpression.ts:25; recursive codec uses at :212-214 and :261-263; runtime constraint at :163
- class: type-safety   severity: required
- standard: D11; standards/effect-first-development.md EF-33; Effect SCHEMA.md, recursive schemas with different Encoded and Type.
- evidence: The structural `SpdxNode` WithException arm declares `license: SpdxNode`, while `WithExceptionNode.license` uses `S.Union([LicenseNode, LicenseRefNode])`. All four recursive suspensions expose `S.Codec<SpdxExpression, SpdxNode>`. Sol's in-memory compiler probe accepted an AndNode encoded value whose left child was WithException with an And node as its license, with zero diagnostics. Its read-only decode probe failed at `["left"]["license"]`, expecting License or LicenseRef. The compiler gate cannot reject a legally widened annotation, and schema-valid round-trip generators do not exercise this impossible encoded shape.
- failure: Public AndNode/OrNode encoded types statically accept a variant structure their runtime schema rejects. This is a remaining defect in the round-1 POJO encoded-type repair, distinct from its closed class-versus-POJO defect; it is not bookkeeping or an unforced divergence.
- fix: Narrow only the `SpdxNode` WithException arm's `license` field to `typeof LicenseNode.Encoded | typeof LicenseRefNode.Encoded`. Keep recursive suspension annotations, runtime schemas, serialization, accepted expressions and upstream test assertions unchanged.
- seats: sol-2-1

## Backlog

### fable-2-1 — Canonical outcome helpers receive self-derived expected payloads

- file: scratchpad/test/spdx/SpdxExpression.coverage.test.ts:12; scratchpad/test/spdx/SpdxExpression.test.ts:238
- class: test   severity: backlog
- standard: .patterns/testing-patterns.md:465-467; goals/effect-vitest-canon/SPEC.md D5; section 11.4; task's coverage/Vitest-canon backlog instruction.
- evidence: `assertFailure(failure, failure.pipe(Result.getFailure, O.getOrThrow))` and `assertSuccess(result, Result.getOrThrow(result))` derive the expected payload from the actual result. Equality cannot detect a wrong payload; only variant selection remains effective. Fable identifies EV005's hand-rolled-outcome detector as unable to catch self-derived payloads passed to canonical helpers.
- failure: These helper calls appear to check payloads but only narrow the variant. The existing coverage test's separate error-message assertion remains meaningful.
- fix: Make the collapsing-test parse helper return `Result.getOrThrow(SpdxExpression.parseResult(input))`. In the coverage test, obtain the error with `Effect.flip(S.decodeEffect(SpdxExpression.FromString)("MIT AND"))` and retain the explicit expected-message assertion. Preserve wrong-variant failures and payload checks.
- seats: fable-2-1
- reason: Vitest-canon and coverage cleanup belongs to backlog under the task instruction.

### fable-2-2 — The carried round-trip property ignores the configurable run floor

- file: scratchpad/test/spdx/SpdxExpression.test.ts:224-232
- class: test   severity: backlog
- standard: D10; section 11.4; task's S3 backlog instruction.
- evidence: The constrained `FromString round-trips decode(encode(e))` property has no fourth registration argument. S3-added properties in sibling files use `{ arbitrary: fcRuns(100) }`; the report cites the installed registration type and fcRuns implementation enforcing `BEEP_FC_NUM_RUNS` as a floor.
- failure: The retained real-license-id generator runs at the library default and does not participate in an environment-raised nightly property floor.
- fix: Import `fcRuns` from `@beep/fc-runs/FastCheckRuns` and add `{ arbitrary: fcRuns(100) }` as the existing property's fourth argument. Preserve the arbitrary and every assertion.
- seats: fable-2-2
- reason: S3 property/test work stays backlog for this inventory.

### fable-2-3 — Record post-fix walker performance measurements centrally

- file: scratchpad/effected/spdx/SpdxExpression.ts:36-47,323-334,424-447,523-531
- class: perf   severity: backlog
- standard: D11; standards/effect-laws-v1.md law 11; closed round-1 r2; port write-surface restriction.
- evidence: Fable reports warm lab/oracle timings: large-expression serialization x5000, 29.71/24.86 ms versus 4.95/5.41 ms; small-expression serialization x200000, 56.74/48.38 versus 5.46/5.07; large parsing x1000, 52.34/53.02 versus 51.55/55.19; license collection x5000, 52.00/44.60 versus 11.19/9.65; primary license x200000, 13.27/13.68 versus 4.24/4.02. Output bytes matched. The walkers now hoist exhaustive matchers; the report attributes residual constant-factor dispatch cost to Match's case loop and Result allocation. Native switch restoration contradicts law 11, and no further cast-free remedy is demonstrated.
- failure: No new actionable regression beyond law-forced dispatch is established. The central round-1 performance record lacks the reported post-fix measurements, which show parsing parity and substantial reduction of the prior allocation regression.
- fix: Have the orchestrator append these seat-attributed post-fix measurements to the central ledger's notes/reviewRounds for closed r2. No source or test change is assigned; revisit dispatch only when a concrete compliant alternative exists.
- seats: fable-2-3
- reason: outside the port's write surface. The report supplies a concrete ledger update, so it is retained as backlog rather than rejected; it does not request a systemic deviation entry.

### fable-2-4 — Option/Result boundaries could use match helpers

- file: scratchpad/effected/spdx/License.ts:296-299; scratchpad/effected/spdx/LicenseException.ts:178-180; scratchpad/effected/spdx/SpdxExpression.ts:392-394
- class: effect-idiom   severity: backlog
- standard: standards/effect-first-development.md EF-2 and EF-7; AGENTS.md helper preferences; law 21; D11.
- evidence: Catalog lookups use `O.isSome(known)` followed by `known.value`; FromString branches on `Result.isSuccess(result)` and accesses success/failure fields. The report cites installed `O.match`, `Result.match` and `Result.fromOption` alternatives, while explicitly recognizing guard-and-field consumption as accepted repository idiom and not a terse-effect gate violation.
- failure: Readers must follow variant guards and field access instead of one match operation; no wrong result, unsafe assertion, diagnostic or mandatory law violation is established.
- fix: As an optional equivalent cleanup, consume catalog lookups with `O.match` and FromString parsing with `Result.match`, preserving license-reference fallback and existing error payloads. Leave collector leaf pushes unchanged.
- seats: fable-2-4
- reason: Outside D11's required definition: a preference and readability improvement with equivalent behavior, rather than an established violation.

### fable-2-6 — README retains npm-artifact packaging claims

- file: scratchpad/effected/spdx/README.md:11-13
- class: docs   severity: backlog
- standard: D4; section 10.3; task's documentation backlog instruction.
- evidence: The README claims Node >=24.11.0, a peer-dependency declaration, and import-only package exports that make require fail. This lab module has no package.json or exports map; those sentences describe the upstream published artifact.
- failure: The adapted lab README still presents upstream packaging behavior as a property of this port.
- fix: Delete the two packaging paragraphs or replace them with a lab-accurate sentence describing Effect as the dependency and the lack of IO, filesystem and network use. This is outside the README's centrally owned Port notes.
- seats: fable-2-6
- reason: Documentation adaptation remains backlog.

### fable-2-7 — FromString documentation names the wrong encoding path

- file: scratchpad/effected/spdx/SpdxExpression.ts:564-567
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md accurate lead-description rubric; task's JSDoc backlog instruction.
- evidence: The facade member says encoding emits its string via each node's toString. The implementation at :396-400 explicitly receives encoded POJOs and calls the shared structural serializer because invoking their toString would call Object.prototype.toString. Fable's probe confirms encoded children are plain objects.
- failure: Readers may expect an instance's toString implementation to control codec encoding, although the codec uses the serializer directly.
- fix: State that encoding uses the shared serializer also used by each node's toString; normalize the adjacent Schema member comment's mixed indentation during that documentation edit.
- seats: fable-2-7
- reason: JSDoc accuracy and formatting cleanup remains backlog; no enforced carrier/tag gate miss is alleged.

### fable-2-8 — Schema-description prose retains a TSDoc selector artifact

- file: scratchpad/effected/spdx/SpdxExpression.ts:215,264
- class: schema   severity: backlog
- standard: standards/effect-first-development.md EF-12; task's documentation backlog instruction.
- evidence: Both runtime annotation descriptions say `its children are any (SpdxExpression:type)`, carrying a declaration-reference selector into plain metadata prose. The associated JSDoc links and runtime schema constraints are separate and valid.
- failure: Metadata readers see a formatting artifact; no validation, identity or encoded-type failure follows from these strings.
- fix: Replace `any (SpdxExpression:type)` with `members of the SpdxExpression union` in both descriptions. Preserve annotation keys and schema behavior.
- seats: fable-2-8
- reason: Runtime metadata prose is documentation cleanup outside D11's substantive schema defects.

### fable-2-9 — The oracle ambient shim still lacks its upstream explanation

- file: scratchpad/test/spdx/spdx-expression-parse.d.ts:1
- class: docs   severity: backlog
- standard: D4, carried comment bodies; task's documentation backlog instruction.
- evidence: Fable cites the pinned upstream types/spdx-expression-parse.d.ts four-line header explaining the untyped CommonJS differential oracle and throw/no-throw distinction. The live lab file is a bare three-line declare-module block.
- failure: The test-side ambient declaration omits the upstream explanation of why it exists and which oracle contract it models.
- fix: Restore the four upstream explanatory comment lines above the existing declaration. Keep the current declaration signature; changing it is unnecessary to fix the missing prose.
- seats: fable-2-9
- reason: Restoring carried documentation remains backlog.

## Handled by the deviation codemod

### fable-2-5 — Refresh stale adjusted-test citations in deviation records

- file: scratchpad/effected/spdx/README.md:138-145; scratchpad/effected/PORT_LEDGER.json (spdx deviations)
- class: docs   severity: codemod
- standard: D9; section 14; Grilling, 2026-10-09 (later), per-module/per-class deviation codemod ruling; central ownership of Port notes and ledger bookkeeping.
- evidence: Fable maps stale test citations to current assertions: collection checks moved to License.test.ts:100-107 and LicenseMetadata.test.ts:12-14; encoded-type narrowing to SpdxExpression.test.ts:236-240,288-293; decodeEffect to :140,159; schema guards to :174; id deduplication to :323-328; LicenseRef grammar cases to License.test.ts:24-36,57-70,80-85. Numerous current cited lines instead terminate unrelated tests or contain comments. The live Port notes confirm the stale citations.
- failure: The audit trail points to unrelated lines after test edits. The finding challenges the bookkeeping, not the correctness of the law-forced transformations themselves.
- fix: Regenerate the spdx per-class deviation entries and adjusted-upstream-test citations centrally, including native collections, type-safety, tsgo, schema-first, imports and identity records. For hoisted effect-first dispatch, distinguish unchanged upstream tests used as validation from actually adjusted tests. Update README Port notes and ledger together through the deviation codemod, not a fix lane.
- seats: fable-2-5
- reason: This is exclusively recording/repairing citations for forced changes; central codemod ownership supersedes a module lane assignment.

## Rejected

None. Every reported item supplies evidence and a concrete action. The required type-contract defect explicitly shows why green gates miss it; backlog items are retained under the task's reclassification rules, and central bookkeeping is routed to the codemod. Grok's NO FINDINGS is a seat outcome, not a finding or rejection.

REQUIRED: 1  BACKLOG: 8  CODEMOD: 1  REJECTED: 0  GROUPS: 1
