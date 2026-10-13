# semver — round-2 merged inventory

Seats read: `grok.md` (0 findings), `sol.md` (3), `fable.md` (8), and their shared `BRIEF.md`; no `part-N` reports exist. Review commit: `a12bef261998d2ad92153dada46373be06950692`. Oracle: the brief's pinned `af7566a9da2eff169cb74955efcc5ede1e5de9f8` semver package.

**REQUIRED: 4  BACKLOG: 4  CODEMOD: 0  REJECTED: 0  GROUPS: 2**

Eleven seat records merge into eight defects/dispositions. The entire top operator revision block, including the 2026-10-09 rulings and later grilling, D1–D20, sections 12.4/12.5 and 14, and the inventory task's explicit overrides govern this merge. Documentation, JSDoc and vitest-canon work stays backlog under that task's deferral, irrespective of the brief/report claims about S2/S3 completion. No gates or tests were rerun; runtime probe results below are seat evidence, supplemented by read-only source and commit-diff inspection.

The checkout is on `@lab/effected-2`, rather than the requested `@lab/effected`; it was left untouched. Its semver source/test surface has no committed differences from the review commit. The current native-runtime allowlist contains **zero entries for `scratchpad/effected/semver/**`**, so there are no `allow-<n>` findings. Law-forced ledger/README Port-notes bookkeeping remains central; those surfaces are absent from required groups. No source, tests, ledger, config or Port notes were edited by this merge.

`g1` owns `Range.ts`, `internal/desugar.ts`, `Range.test.ts`, `VersionCache.test.ts` and `internal/desugar.coverage.test.ts`. Shared public Range regressions connect its three findings. `g2` owns `SemVer.ts` and `SemVer.test.ts`. Each source and test file belongs to exactly one group; neither group exceeds six source files.

## Required

### sol-2-1 — Wildcard-major tilde and caret ranges gain an incorrect upper bound

- file: scratchpad/effected/semver/internal/desugar.ts:56; same defect at :92
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); the module promises node-semver range semantics.
- evidence: Both seats report differential probes showing `~*`, `~x`, `^*` and `^x` produce `>=0.0.0 <1.0.0-0` in lab and pinned upstream and reject `2.0.0`; node-semver produces `*` and accepts it. Direct inspection confirms both helpers replace a null major with zero before selecting the upper bound. Installed `node_modules/semver/classes/range.js` handles a wildcard major with an empty comparator in both `replaceTilde` and `replaceCaret`. The green suite explicitly expects the wrong ceiling at desugar.coverage.test.ts:14,18; this is a demonstrated gate miss, not a coverage-floor finding.
- failure: Matching, filtering, maximum selection and cache resolution exclude every stable version at or above `1.0.0` from ranges whose wildcard major imposes no such ceiling.
- fix: Handle `p.major === null` first in both helpers and return the ordinary stable wildcard comparator `>=0.0.0`. Correct the two existing expectations in internal/desugar.coverage.test.ts; add public Range.parse/membership/filter regressions for all four spellings, including stable versions above zero and prerelease exclusion, plus VersionCache.resolveString regressions in VersionCache.test.ts. Preserve diagnostic-forced dual signatures and all unaffected oracle assertions. The orchestrator handles the verified upstream-bug record centrally.
- seats: sol-2-1; fable-2-2

### sol-2-2 — Strict comparisons against a full wildcard become match-all ranges

- file: scratchpad/effected/semver/internal/desugar.ts:169
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); node-semver X-range operator semantics.
- evidence: Both seats report `>*`, `>x`, `<*` and `<x` normalize to `>=0.0.0` in lab and pinned upstream and accept `2.0.0`, while node-semver returns `<0.0.0-0` and accepts nothing. The lab's null-major branch ignores `operator`; installed node-semver range.js:431–437 explicitly returns the unsatisfiable comparator for strict `<`/`>`. desugar.coverage.test.ts:43 asserts the permissive result for every operator, proving the green tests miss this semantic bug. The upstream comment confirms inheritance, but supplies no spec justification for an exception to the advertised dialect.
- failure: Public matching/filtering and VersionCache.resolveString select versions from constraints that should match no version.
- fix: Return `<0.0.0-0` when a null major has operator `<` or `>`; retain `>=0.0.0` for null, `=`, `>=` and `<=`. Split the existing internal/desugar.coverage.test.ts assertion by operator. Add Range.test.ts matching/filter regressions for all four spellings and stable/prerelease inputs, plus VersionCache.test.ts resolution failures. Preserve the existing dual overloads and safe operator domain; do not restore upstream casts. The orchestrator handles the verified upstream-bug record centrally.
- seats: sol-2-2; fable-2-3

### sol-2-3 — Reused component and identifier schemas/checks lack metadata

- file: scratchpad/effected/semver/SemVer.ts:74; related building blocks at :83 and :89
- class: schema   severity: required
- standard: D5; standards/effect-first-development.md EF-12/EF-12c; standards/effect-laws-v1.md laws 17–18.
- evidence: Both seats' AST probes find missing schema metadata on nonNegativeInteger, prereleaseIdentifier and buildIdentifier, and missing identifier/title/description on reused numeric/pattern checks. Source confirms bare S.Finite.check(S.isInt(), S.isBetween(...)), an unannotated prerelease union and an unannotated build pattern. Owning-class and annotateKey field metadata do not annotate these reusable blocks. Existing SemVer.test.ts round-1 metadata assertions exercise only ExactVersionString/PinnableVersionString and their filters, so the green gates demonstrably leave this gap.
- failure: Named, reused domain constraints and check blocks remain anonymous in introspection and violate the schema metadata laws. This is a missing implementation requirement, not merely a request to record an already-correct identity change.
- fix: Give all three building blocks composer-derived identifier/title/description metadata and give their reused integer, range and identifier-pattern check blocks the metadata required by law 18, using the installed Effect API. Preserve S.Finite, all predicates and accepted inputs. Add focused schema/check AST metadata assertions beside the round-1 regressions in SemVer.test.ts, preserving validation assertions and retargeting existing JSON Schema definition lookups only where the new identities require it. Extension of the identity-annotations deviation record remains central codemod work.
- seats: sol-2-3; fable-2-4

### fable-2-1 — Intersection projects already-correct prerelease bounds unnecessarily

- file: scratchpad/effected/semver/Range.ts:821; affected example at :417
- class: bug   severity: required
- standard: D9 and section 14 (formatted bytes and stored comparator shape are observable); the later operator ruling requires restoration of divergence no law, diagnostic or verified bug forces.
- evidence: Fable reports `^1.0.0` intersected with `>=1.5.0` prints `>=1.0.0 <2.0.0 >=1.5.0` in lab versus `>=1.0.0 <2.0.0-0 >=1.5.0` upstream; tilde intersections similarly lose `-0`. Inspection of the pinned oracle confirms the latter example and direct comparator concatenation. Lab intersectSets projects whenever a mentioned tuple is not admitted by both operands, even if prereleaseWitness(merged, tuple) is none. For the `2.0.0` tuple, `<2.0.0-0` already rejects its least prerelease. File history and diffs locate this projection in cb8b9525b1 (`effected-port S4`, round-1 membership repair); d3ae047218 (step 2), 03bf79d41b (law fixes) and ef28967535 (S1) do not force this additional formatting/storage divergence. Later 41af328ed2 changes empty-set admission, not this projection condition.
- failure: The round-1 fix unnecessarily changes formatted bytes and stored prerelease arrays for intersections whose original merged comparator set was already correct. This exceeds the verified membership bug's scope.
- fix: Return [merged] when every mentioned tuple is either admitted by both operands or has no prerelease witness in merged; retain the stable/permitted split when a disallowed tuple actually has a witness. Restore the upstream comparator shape and the upstream formatted example `>=1.0.0 <2.0.0-0 >=1.5.0` in Range.ts. Add Range.test.ts regressions for exact caret/tilde formatting and retained [0] upper-bound prereleases, preserving the existing `1.0.0-beta` rejection and membership-conjunction assertions. No upstream Range.test.ts assertion was rewritten by cb8b9525b1, so there is no additional rewritten oracle test line to restore. The orchestrator narrows the existing upstream-bug record centrally.
- seats: fable-2-1

## Backlog

### fable-2-5 — The cache suite adds an unsupported layer timeout

- file: scratchpad/test/semver/VersionCache.test.ts:17; default-valued option at VersionCache.coverage.test.ts:9
- class: test   severity: backlog
- standard: EFFECTED_PORT_GOAL.md sections 11.1/11.3 and 16; effect-vitest-canon SPEC D6; the inventory task explicitly defers vitest-canon findings.
- evidence: The oracle uses layer(VersionCache.layer) with no timeout option; the lab adds `{ timeout: "30 seconds" }`. Commit inspection attributes this addition to bdca1c58e5, the S3 canon checkpoint, rather than 41af328ed2 as the seat states. The installed adapter maps the option through Duration.toMillis into its beforeAll hook; the seat identifies Vitest's default as ten seconds. The layer constructs local Ref state and has no external acquisition. VersionCache.coverage.test.ts separately specifies ten seconds.
- failure: A local shared-layer suite acquires a longer timeout without a demonstrated root cause; the coverage suite also repeats a default-valued option.
- fix: During vitest-canon work, restore layer(VersionCache.layer) in VersionCache.test.ts and drop the redundant option from it.layer(VersionCache.layer) in VersionCache.coverage.test.ts. Investigate any resulting failure at its cause. Any proposed global timeout/config change belongs in backlog with reason "outside the port's write surface"; it is not a semver group assignment.
- seats: fable-2-5
- disposition: Reclassified from required to backlog by the task's explicit vitest-canon deferral; this does not approve timeout increases.

### fable-2-6 — README overstates codec/parse diagnostic agreement

- file: scratchpad/effected/semver/Range.ts:142; documentation claim at scratchpad/effected/semver/README.md:147
- class: docs   severity: backlog
- standard: D4; section 14; the inventory task's documentation deferral.
- evidence: Fable reports parseResult("^9007199254740991.0.0") returns InvalidRangeError with `Invalid range expression: "^9007199254740991.0.0"`, while FromString decoding yields `Expected an integer` at the normalized upper-bound major. The round-1 source diff confirms parseResult maps normalized schema failure to InvalidRangeError; FromString retains class-validation issues. The README promises the same message.
- failure: Validity agrees, but overflowing sugar produces different diagnostics through the two entry points, contradicting the documentation claim.
- fix: Narrow README.md:147's same-message claim to grammar failures and describe normalized model-validation failures accurately. Prefer this documentation correction over introducing an otherwise-unrequired runtime error-message change. Any amendment to Port notes remains central bookkeeping.
- seats: fable-2-6
- disposition: Documentation backlog; no demonstrated validity or typed-failure regression requires a runtime fix.

### fable-2-7 — README misstates errors and lab dependencies

- file: scratchpad/effected/semver/README.md:168; related claims at :4, :14, :135–145
- class: docs   severity: backlog
- standard: D4 and section 10.1; the inventory task's documentation deferral.
- evidence: The README says seven tagged errors and omits SemVerBumpOverflowError from its table, although there are eight. It describes every failure as routed through Effect.catchTag, while bump operations throw synchronously. Its zero-runtime-dependencies/Effect-only claims omit the lab's @beep/identity and @beep/schema imports. This provides fresh evidence beyond the earlier README backlog item, regardless of the reported S2 completion.
- failure: User documentation misrepresents the current error surface, error-delivery mechanism and runtime dependency posture.
- fix: Add the SemVerBumpOverflowError row with component/cause and synchronous-throw behavior, correct the error count and routing claim, and name the two Beep lab dependencies in the introductory dependency prose. Leave README Port notes and ledger deviation/export recording to the central codemod.
- seats: fable-2-7
- disposition: Documentation backlog.

### fable-2-8 — Public bump methods omit synchronous overflow documentation

- file: scratchpad/effected/semver/SemVer.ts:1257; other methods at :1279, :1301 and :1338
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md conditional throws/Gotchas guidance; the inventory task's JSDoc deferral.
- evidence: major, minor, patch and prerelease call overflow(), which throws SemVerBumpOverflowError. Their doc blocks and the SemVerBump class block do not describe this synchronous throw; return signatures cannot express it. Docgen success does not detect the semantic omission.
- failure: Callers lack documentation of synchronous failures at the public bump API.
- fix: In JSDoc work, document SemVerBumpOverflowError and the safe-integer overflow conditions at the four methods, using conditional @throws tags in the canonical order or a clear class-level Gotchas explanation that covers them.
- seats: fable-2-8
- disposition: JSDoc backlog, even though the seat shows docgen missed the omission.

## Handled by the deviation codemod

None: no round-2 record only asks to record a law-forced change. The schema metadata defect itself remains required as sol-2-3. Its requested extension of identity-annotations bookkeeping is central per-module/per-class work, not a separate required finding. Report clauses asking for PORT_LEDGER.json or README Port-notes updates are excluded from worker assignments; verified upstream-bug recording stays with the orchestrator.

## Rejected

None: every deduplicated record contains concrete evidence and a fix. The required schema/semantic findings demonstrate gaps the reported green gates miss. Duplicate seat records contribute evidence and ids to their merged defect, rather than becoming rejected findings. Grok reports no findings.

REQUIRED: 4  BACKLOG: 4  CODEMOD: 0  REJECTED: 0  GROUPS: 2
