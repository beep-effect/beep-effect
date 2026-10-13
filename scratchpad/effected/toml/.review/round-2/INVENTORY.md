# TOML round-2 inventory

Seats read: `grok.md` (4 findings), `sol.md` (3), and `fable.md` (5; third seat routed to a separate Grok 4.7 medium session). Briefs read: `BRIEF.md` and `BRIEF.grok3.md`; no part subdirectories are present. Twelve seat findings deduplicate to seven records: **5 required, 2 backlog, 0 codemod, 0 rejected; 3 non-overlapping groups**.

Scope and authority: reports name commit `a12bef261998d2ad92153dada46373be06950692`; the live checkout is on `@lab/effected-2`, rather than the requested `@lab/effected`. Classification uses the full current operator revision block, D1–D20, sections 12.4/12.5 and 14, the pinned upstream oracle in the briefs, live source, round-1 inventory, and read-only commit history. The briefs claim S2/S3 green; the explicit instruction for this inventory defers docs, JSDoc, coverage and vitest-canon findings regardless of that claim. Mandatory schema/field/check annotations remain schema-law findings.

Allowlist inventory: the current `standards/effect-laws.allowlist.jsonc` contains **zero** entries whose file starts with `scratchpad/effected/toml/`; therefore there are no new `allow-<n>` records. Round 1's `EFFECTED-TOML-CYCLE-DETECTION` entry and replacement are historical, not a live exception to reassign. Central deviation/Port-notes bookkeeping and repo configuration are outside these groups.

## Required

### r-provenance
- file: scratchpad/effected/toml/internal/semantic.ts:68
- class: schema   severity: required
- standard: D5; standards/effect-laws-v1.md laws 17 and 19; standards/effect-first-development.md EF-12b
- evidence: `Provenance` is the seven-string handwritten union `value | inline | static-array | table-explicit | table-implicit | table-dotted | array-tables`; it types `SemNode.kind` and `makeNode`, and is matched exhaustively in `navigateHeaderPrefix`. No schema owns this named domain. Round-1 `r-match-provenance` repaired dispatch, not this declaration; the green gates do not enforce schema authority for this type alias.
- failure: The semantic engine's named, reused provenance domain has neither a schema-derived type nor canonical identity metadata.
- fix: Define module-local `$I`-annotated `Provenance = LiteralKit([...])` with exactly the seven existing strings and derive `type Provenance = typeof Provenance.Type`. Preserve construction and exhaustive matching; do not add a public export.
- seats: sol-2-1, fable-2-1

### r-table-origin
- file: scratchpad/effected/toml/TomlFormat.ts:420
- class: schema   severity: required
- standard: D5; standards/effect-laws-v1.md laws 17 and 19; standards/effect-first-development.md EF-12b
- evidence: `ResTable.origin` is the handwritten union `root | explicit | implicit | dotted | element`, reused by `mkTable` through `ResTable["origin"]` and read to decide insertion acceptance and key-path rendering. No schema defines it. The green gates do not enforce a schema-derived property domain.
- failure: The formatter's reused origin domain exists only as a type-level literal union and lacks schema authority and identity metadata.
- fix: Add a module-local `$I`-annotated LiteralKit for exactly these five origins and derive `ResTable.origin` from its `.Type`; preserve mutations, origin strings, insertion rules and bytes. Keep the schema private.
- seats: sol-2-2, fable-2-2

### r-format-invariant
- file: scratchpad/effected/toml/TomlFormat.ts:451-456
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 7; .patterns/error-handling.md; D9/D11; section 14; later operator restoration ruling
- evidence: Live `intoTable` filters undefined/value inputs to `None` then calls `O.getOrThrow`; installed `effect/src/Option.ts:1467` implements that with `new Error("getOrThrow called on a None")`. Pinned upstream `TomlFormat.ts:379-390` instead branches on array-table/table and throws `Error("invariant: semantic pass admitted a value where a table was navigated")`. `git log --all --format=%h:%s -- scratchpad/effected/toml/TomlFormat.ts` and the step-2/S1 diffs show diagnostic commit `db5c0f854b` added the missing-element guard and S1 commit `b45c0b463a` replaced both native errors with `TomlFormatInvariantError` while retaining their messages. Round-1 commit `e8323b9e6b` retained that implementation. The later S3 checkpoint `bdca1c58e5` replaced that whole block with the current Option pipeline, dropping the tagged failures; no diagnostic or law in the inspected diffs forces that replacement. The native-runtime gate sees constructors written in scanned source and misses this library-mediated native error, as explained by the seat; its constructor-oriented tests are at `packages/tooling/tool/cli/test/native-runtime.test.ts:161,192`.
- failure: An invariant break now throws an untagged native Error with a different message; an empty array-table also loses the S1 tagged missing-element guard. Normal validated documents do not reach these failures, but the explicit defect contract and forced error carrier regressed.
- fix: Restore the upstream branch structure with the S1 adaptations retained: return the last array-table element after the tagged `missing TOML element` guard, pass table nodes through, and otherwise throw `TomlFormatInvariantError.make({ message: "invariant: semantic pass admitted a value where a table was navigated" })`. Preserve Effect collections and the law-forced tagged carrier; do not restore native Error. Restore any upstream test lines rewritten specifically by this simplification; the inspected `intoTable` hunk changes no test lines. Keep existing valid-document tests intact and run them for validation; no test-file edit or new exported test hook is required.
- seats: grok-2-2
- disposition: This is a wrong change, not a request to record the accepted native-to-tagged conversion. The forced S1 error conversion stays; the later unforced branch replacement is restored.

### r-offset-metadata
- file: scratchpad/effected/toml/TomlDateTime.ts:238
- class: schema   severity: required
- standard: Operator step 4; D5; standards/effect-first-development.md EF-12
- evidence: `offsetMinutes` is bare `S.Int.check(S.isBetween({ minimum: -1439, maximum: 1439 }))`. All shared date/time fields at lines 49–61 have field descriptions, and the class has `$I.annote`, but this separately declared field has no `annotateKey`. Green compilation/docgen does not establish field-annotation completeness. Round-1 `r-metadata-model` covered shared fields rather than this remaining site.
- failure: The exported offset field lacks the mandatory schema metadata explaining its signed units, bounds and zero-offset representation.
- fix: Add meaningful `annotateKey({ description: ... })` describing signed UTC offset minutes, range -1439 through 1439 and zero rendering as `Z`. Retain the integer and range constraints.
- seats: grok-2-1, sol-2-3, fable-2-3

### r-range-check-metadata
- file: scratchpad/effected/toml/TomlDateTime.ts:49-61
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 18; standards/effect-first-development.md EF-12c
- evidence: The `year`, `month`, `day`, `hour`, `minute`, `second` and `nanosecond` fields each pass only bounds to `S.isBetween`, without identifier/title/description annotations. Their schemas and checks are reused through `dateFields`/`timeFields` across the datetime classes. Field descriptions do not annotate the checks themselves; round-1 `r-calendar-check` supplied metadata only for `isRealCalendarDate`. The green gates do not require filter-annotation completeness.
- failure: Reused domain range checks lack the check metadata required by law 18, independently of their field descriptions.
- fix: Pass meaningful `identifier`, `title` and `description` annotations to all seven shared `S.isBetween` calls, deriving identifiers from `$I`. Preserve each bound, the field descriptions and `isRealCalendarDate`.
- seats: fable-2-4

## Backlog

### b-description-links
- file: scratchpad/effected/toml/TomlDiagnostic.ts:197; scratchpad/effected/toml/TomlDocument.ts:94
- class: jsdoc   severity: backlog
- standard: Section 10.2; round-1 b-description-links; explicit S2 deferral for this inventory
- evidence: Live schema description strings contain literal `(TomlErrorCode:type)` and `(TomlExpression:type)`. The corresponding JSDoc bodies already use legal `{@link (X:type)}` forms. Docgen does not validate these plain description strings; this is the still-open round-1 prose cleanup, deduplicated across both round-2 seats.
- failure: Schema descriptions render declaration-reference syntax as plain text.
- fix: Replace these two tokens with plain `TomlErrorCode` and `TomlExpression` in the schema descriptions; preserve legal JSDoc links.
- seats: grok-2-3, fable-2-5
- disposition: Docs/JSDoc work is backlog under the explicit merge instruction, despite the briefs' S2-green claim.

### b-oracle-runs
- file: scratchpad/test/toml/oracle.property.test.ts:300,312,324
- class: test   severity: backlog
- standard: D10; @beep/fc-runs; explicit S3 deferral; D11
- evidence: `ORACLE_CHECK_OPTIONS` is `{ runs: 250, seed: 20260710 }` and is used by both differential properties. Unlike the other property suites, this site bypasses `fcRuns`; the helper at `packages/tooling/test-kit/fc-runs/src/FastCheckRuns.ts:148-165` uses the inline run count as a floor beneath `BEEP_FC_NUM_RUNS`. This is the remaining run-floor portion of round-1 b-properties, not a new behavioral bug.
- failure: `BEEP_FC_NUM_RUNS` cannot raise these differential properties above 250 runs through the canonical helper.
- fix: Import `fcRuns` from `@beep/fc-runs` and use `{ ...fcRuns(250), seed: 20260710 }`, retaining the explicit replayable seed and both oracle properties.
- seats: grok-2-4
- disposition: Property/canon configuration is S3 work; no law violation, type failure, bug or performance evidence makes it required under D11 here.

## Handled by the deviation codemod

None. No round-2 finding asks only to record a law-forced change. Historical round-1 codemod records are not re-imported. The formatter finding concerns a regression in the change itself; its required repair preserves the forced tagged-error carrier, and any resulting deviation bookkeeping remains centrally owned.

## Rejected

None. Every distinct seat finding provides evidence and a concrete fix; no retained finding contradicts an operator ruling or merely repeats a property already enforced by a green gate. Duplicate seat records are merged above rather than counted as rejections.

Group ownership: `g1` owns only `internal/semantic.ts`; `g2` owns only `TomlFormat.ts` and both formatter findings; `g3` owns only `TomlDateTime.ts` and both metadata findings. No required fix identified here needs to edit a test file: existing module tests are validation inputs, so each group's `tests` array is empty. All groups stay within the allowed TOML source surface and below the six-source-file limit. No README Port notes, ledger or repo-level configuration edits are assigned.

REQUIRED: 5  BACKLOG: 2  CODEMOD: 0  REJECTED: 0  GROUPS: 3
