# walker — round-2 inventory

Seats read: `grok.md` (no findings), `sol.md` (2 records), `fable.md` (16 records), and their shared `BRIEF.md`. No `part-N` reports exist. All 18 seat records are accounted for; fable-2-16 is split by disposition, and its source-change portion is merged with fable-2-15 by the S3 coverage-refactor root cause.

Reviewed commit: `a12bef261998d2ad92153dada46373be06950692`. Merge performed in the live `@lab/effected-2` checkout (the request names `@lab/effected`); the four walker source/barrel files are unchanged from the reviewed commit. Operator revision, all later rulings, D1–D20, section 12.5 and section 14 govern dispositions. The request's docs/JSDoc/coverage/vitest-canon deferral wins over the brief's S2/S3-green claim.

Counts: **Required 8 · Backlog 9 · Codemod 1 · Rejected 0 · Groups 1**.

Allowlist audit: the live `standards/effect-laws.allowlist.jsonc` has **0** entries for `scratchpad/effected/walker/**`, so there are no `allow-<n>` records. Removed historical entries are not recreated. History was read (including retained pre-squash commits via `git log --all`) to distinguish diagnostic/law-forced changes from unforced S3 rewrites; no compiler scratch copies, tests, coverage or repair commands ran.

Write ownership: `g1` owns the three source files plus `Descend.test.ts`, `Expand.test.ts`, `Walker.test.ts`, `Walker.property.test.ts` and `Expand.property.test.ts`. The shared depth-domain fix and the three-file timeout restoration require one merged group; no file appears in another group. Property files belong to this group for schema-domain expectations as needed, without adding coverage work. README Port notes, ledger, root manifests/lockfiles and all repo configuration are excluded. Future validation must use one vitest at a time with `--maxWorkers=2`; module coverage requires `beep-heavy --slot-only` and is not part of this read-mostly merge.

## Required

### req-1 — Restore the upstream layer-hook timeout limits

- file: scratchpad/test/walker/Descend.test.ts:63; scratchpad/test/walker/Expand.test.ts:46; scratchpad/test/walker/Walker.test.ts:316
- class: test   severity: required
- standard: D9; sections 11.1 and 16; Grilling, 2026-10-09 (later), restore unforced lab changes.
- evidence: sol-2-1 counts 26 added timeout options (15 Descend, 3 Expand, 8 Walker) absent from the pinned oracle. git log --all --format=%h:%s -- each test and git show bdca1c58e5 identify their introduction in the S3 checkpoint, after the step-2/S1 changes. The step-2 commits cef8540629/0da9926be4 and S1 commit 03c27d2a90 do not introduce these options. The diff changes hook limits from the default 10 seconds to 30 seconds; gates do not compare hook limits with upstream.
- failure: Setup/cleanup taking 10–30 seconds can now pass. This is an unforced weakening explicitly prohibited by the port contract, rather than merely a deferred vitest-canon preference.
- fix: Remove all 26 added { timeout: "30 seconds" } layer options from Descend.test.ts, Expand.test.ts and Walker.test.ts, restoring upstream registration arguments and hook limits. Retain law-forced import and API changes and the assertions. Repair any exposed fixture failure within the original limit; do not raise another timeout.
- seats: sol-2-1

### req-2 — Reuse the unreadable-mode LiteralKit

- file: scratchpad/effected/walker/Expand.ts:52; scratchpad/effected/walker/Descend.ts:33
- class: schema   severity: required
- standard: Effect laws 17 and 19; EF-35; D5/D11; round-1 req-6.
- evidence: Descend.ts defines OnUnreadable = LiteralKit(["fail", "skip", "record"]) and OnUnreadableArray = OnUnreadable.pick(["fail", "skip"]); Expand.ts duplicates the same reused domain with S.Literals(["fail", "skip"]). The round-1 schema fix in 5b2233b037 added the duplicate. Assignability and the green gates cannot detect a narrower copied union.
- failure: Two definitions govern the same named mode domain; future kit changes need not reach expansion decoding. This is a concrete schema-law omission, not a request to undo the law-forced schema conversion.
- fix: Export OnUnreadableArray from Descend.ts with the required export documentation, import it in Expand.ts, and use S.optionalKey(OnUnreadableArray) with the existing field annotation. Keep the root barrel unchanged. Any added subpath export bookkeeping belongs to the central codemod.
- seats: fable-2-1

### req-3 — Model the reused positive-integer depth constraint once

- file: scratchpad/effected/walker/Walker.ts:86,101; scratchpad/effected/walker/Descend.ts:334; scratchpad/effected/walker/Expand.ts:50
- class: schema   severity: required
- standard: Effect law 17; EF-6/35; D5/D11; D9 predicate parity.
- evidence: Both traversals reject !Number.isInteger(maxDepth) || maxDepth < 1, while AscendOptions and CompileAndExpandOptions use optional S.Finite. The seat probe decodes 0 and -2.5 successfully, then the traversal dies. 5b2233b037 introduced the option schemas as a forced schema-first fix but left their domain constraint outside them. S.Int rejects 2 ** 53, which upstream Number.isInteger accepts.
- failure: Decoded/generated option values need not satisfy the named, reused depth domain; two independent guards remain its source of truth. Green round-trip tests and tsgo do not enforce that domain.
- fix: Define an identity-annotated DepthCap schema in Walker.ts using S.Finite, a >= 1 check and an annotated Number.isInteger check (identifier/title/description); expose it to Descend.ts and Expand.ts. Use it for both maxDepth schema fields and S.is(DepthCap) for both operation guards, preserving existing defect messages and default 256. Retain acceptance of integers above the safe-integer range; do not silently substitute S.Int. Keep DescendError.limit as S.Finite, since limit 0 is supported. Retain invalid-depth operation tests and add schema/domain parity checks in the existing test files. Export/deviation records are central.
- seats: fable-2-2

### req-4 — Use Option for internal traversal absence

- file: scratchpad/effected/walker/Walker.ts:124,129,178-179
- class: effect-idiom   severity: required
- standard: EF-2/5; D5/D11; round-1 req-5.
- evidence: ascend creates an internal string | undefined ceiling and consumes ceiling !== undefined. ascendToPhysical uses dirs.at(-1) and another undefined check. Descend already received Option boundary conversion for the same class. Green gates do not detect these domain absence sentinels.
- failure: The boundary representation continues into domain traversal instead of becoming Option, contrary to EF-2.
- fix: Convert stopAt with O.fromNullishOr and O.map(path.resolve), and consume the normalized ceiling with O.exists. Import effect/Array and use O.exists(A.last(dirs), ...) for the physical-ceiling fast path. Preserve lexical results, normalized comparison and failure/defect behavior; retain the existing Walker oracle assertions.
- seats: fable-2-3

### req-5 — Lift the compile Result into the Effect error channel

- file: scratchpad/effected/walker/Expand.ts:218-224
- class: effect-idiom   severity: required
- standard: EF-22b; D5/D11; Effect law 21.
- evidence: compileAndExpand branches on Result.isFailure, returns a yieldable GlobExpansionError for compile failure, then separately maps descend failure. The sibling glob compile lifts compileResult with Effect.fromResult; the installed API supports that bridge. No invalid Result is yielded, so tsgo cannot flag this manual boundary folding.
- failure: The Result boundary is folded by hand rather than lifted as required by EF-22b; the two stages duplicate the error adaptation.
- fix: Lift GlobPattern.compileResult(pattern, options.glob) through Effect.fromResult, flatMap to descend, and mapError once to GlobExpansionError.make({ pattern, cause }). Preserve the current Effect.fn span, stage values and original causes. Retain all compile/descent failure assertions in Expand.test.ts.
- seats: fable-2-4

### req-6 — Use equivalent Effect collection and optional-effect helpers

- file: scratchpad/effected/walker/Descend.ts:346-350,489-490; scratchpad/effected/walker/Walker.ts:185,210-211
- class: effect-idiom   severity: required
- standard: EF-5; Effect law 21; D5/D11.
- evidence: fable-2-12 identifies stat -> map(Some) -> orElseSucceed(None), native ancestors.includes and spread append, candidates.push(...candidatesFor(dir)), and dirs.slice/dirs.indexOf. These source sites survive the green gates; their semantic equivalence to Effect.option, A.contains/A.append, A.flatMap and A.findFirstIndex/A.take is not enforced by the syntactic terse-effect patterns.
- failure: Concrete source helper omissions remain under EF-5 and law 21. Promote the cited idiom violations from the seat backlog; no performance regression or new traversal design is claimed.
- fix: Use Effect.option over the mapped fs.stat type, A.contains/A.append for branch-local ancestors, A.flatMap(dirs, candidatesFor) for candidate enumeration, and Option-aware A.findFirstIndex plus A.take for the physical-hit prefix. Preserve === string membership, per-branch cycle safety, insertion order and inclusive prefix length. Do not apply a global visited set or change the upstream parentReal fallback restored by req-8. Retain the existing cycle, sibling-link, candidate-order and physical-ceiling tests.
- seats: fable-2-12

### req-7 — Model and exhaustively match the expansion-stage domain

- file: scratchpad/effected/walker/Expand.ts:135-136
- class: schema   severity: required
- standard: Effect laws 17/19; EF-7/13/35; D5/D11.
- evidence: The stage getter spells "compile" | "descend" and chooses with a _tag ternary over S.Union([GlobPatternError, DescendError]); its named phase domain has no reusable schema or exhaustive match. Green gates check types and coverage, not named literal-domain modeling.
- failure: The finite domain matched by stage is outside the schema model, and the fallback would silently classify any additional cause as descend. Promote this concrete schema/idiom omission from the seat backlog.
- fix: Define an identity-annotated internal ExpansionStage LiteralKit(["compile", "descend"]), derive the getter type from it, and compute the stage with an exhaustive tagged matcher (Match.tagsExhaustive or schema-derived match). Keep the exact returned strings and current public barrel; retain both stage assertions in Expand.test.ts.
- seats: fable-2-14

### req-8 — Restore the unforced S3 queue and ancestor-fallback rewrites

- file: scratchpad/effected/walker/Descend.ts:429-430,485
- class: law   severity: required
- standard: D9; Grilling, 2026-10-09 (later), unforced changes must restore upstream shape and rewritten upstream test lines.
- evidence: The pinned oracle Descend.ts:306-308 uses the head-index loop and undefined-frame guard; :363 uses ancestors[last] ?? frame.absolute. git log --format=%h:%s and git log --all locate step-2/S1 and S3 provenance. The inspected step-2 commits 7f67982f77/cef8540629/0da9926be4/03bf79d41b and S1 03c27d2a90 retain those shapes; round-1 5b2233b037 also retains them. git show 7aae242a6e changes only these two source shapes to array iteration and O.getOrThrow(A.last(...)) during S3 coverage work. The S3 checkpoint describes source edits as unreachable-branch simplifications, with no diagnostic, law or verified upstream bug forcing these walker rewrites.
- failure: Coverage-only refactoring diverges from the oracle without an allowed D9 cause. The changed ancestor fallback would additionally die if the chain were empty. The absence of a reachable empty-chain case does not authorize retaining an unforced shape.
- fix: Restore the oracle head-index worklist loop, frame lookup/undefined guard and accompanying queue comment, plus frame.ancestors[frame.ancestors.length - 1] ?? frame.absolute. Keep the surrounding forced schema, Option probe, sorted-result and collection changes. Restore any upstream test lines altered specifically to accommodate these two rewrites; the inspected S3 diff shows none, so no test weakening or deletion is authorized. Do not replace the fallback with another structural refactor or add coverage-ignore comments. Treat any resulting coverage-policy conflict as deferred coverage work.
- seats: fable-2-15; fable-2-16 (source-change evidence and restore alternative)

## Backlog

### backlog-1 — Normalize JSDoc continuation indentation

- file: scratchpad/effected/walker/Descend.ts:60,153-162; scratchpad/effected/walker/Expand.ts; scratchpad/effected/walker/Walker.ts
- class: docs   severity: backlog
- standard: Section 10.2; .patterns/jsdoc-documentation.md; merger instruction defers docs/JSDoc.
- evidence: The seat counts 228/110/84 bare-column-0 continuation lines in Descend/Expand/Walker; nested members and oracle use indented continuation lines. Docgen tolerates the layout.
- failure: Comment formatting obscures prose diffs; this is deferred documentation work, not a required source fix.
- fix: Re-indent top-level and field JSDoc continuation lines mechanically, with no prose or runtime change.
- seats: fable-2-5

### backlog-2 — Correct the failure-absorption combinator in carried prose

- file: scratchpad/effected/walker/Walker.ts:337; scratchpad/effected/walker/README.md:10
- class: jsdoc   severity: backlog
- standard: Section 10.1; round-1 backlog-1; merger instruction defers docs/JSDoc.
- evidence: The getter documentation and README name Effect.catch, but firstMatch at Walker.ts:194 uses Effect.orElseSucceed. This is a surviving prose mismatch, regardless of the brief claiming S2 green.
- failure: Readers see the wrong combinator name; failure-only recovery remains correct.
- fix: Change those two references to Effect.orElseSucceed and retain the warning that catchCause would absorb defects. Do not edit README Port notes.
- seats: fable-2-6

### backlog-3 — Replace self-derived Exit expectations during canon work

- file: scratchpad/test/walker/Walker.test.ts:100,110,179,186,193,282,503; scratchpad/test/walker/Descend.test.ts:152,161,170
- class: test   severity: backlog
- standard: EV006; .patterns/testing-patterns.md; merger instruction defers vitest-canon.
- evidence: Ten assertExitFailure calls pass the actual cause back as expected; bdca1c58e5 shows these assertion rewrites and loss of the relative-ceiling failure message. They still prove Failure, as upstream did; Cause.hasDies checks already remain at applicable sites.
- failure: The assertions misleadingly suggest independent cause equality and lose useful diagnostics. No demonstrated loss of an upstream cause assertion makes this a required bug.
- fix: During canon work use assertTrue(Exit.isFailure(exit)) with useful shape-specific messages and appropriate independent Cause.hasDies checks; preserve every upstream failure/defect assertion.
- seats: fable-2-7

### backlog-4 — Use Effect helpers in deferred test cleanup

- file: scratchpad/test/walker/Walker.property.test.ts:21; scratchpad/test/walker/Walker.test.ts:293,300
- class: law   severity: backlog
- standard: EF-5; round-1 backlog-7; merger instruction defers S3 test work.
- evidence: The property test uses Array.from(...).join("/"); FsWith/FsDenying use Object.fromEntries(present.map(...)). The native-runtime detector excludes tests, so a green gate does not establish helper compliance at these sites.
- failure: Test examples retain native helpers. This belongs to the deferred test-idiom/S3 cleanup rather than the required runtime wave.
- fix: Use A.join(A.makeBy(depth, ...), "/") and R.fromEntries(A.map(present, ...)); keep fixture seeds, fault injection and oracle assertions unchanged.
- seats: fable-2-8

### backlog-5 — Cover the curried descend overloads

- file: scratchpad/effected/walker/Descend.ts:585-590; scratchpad/test/walker/Descend.test.ts
- class: test   severity: backlog
- standard: D10; section 11.3; merger instruction defers coverage.
- evidence: No test calls descend(options)(pattern). The seat probe confirms both arities work, while the dual implementation lives outside this source file and is invisible to its 100 percent coverage. cef8540629 introduced curried overloads during step 2, and 03c27d2a90 simplified their wrapper during S1: the addition was diagnostic-forced, not unforced.
- failure: A supported diagnostic-forced overload lacks an executable parity contract. This is a coverage gap, not evidence that its implementation is wrong.
- fix: Add one existing-file it.effect test comparing curried and data-first record and array results during coverage work. Retain the forced overloads; central deviation bookkeeping remains outside the repair groups.
- seats: fable-2-9

### backlog-6 — Add optional-field parity protection for expansion options

- file: scratchpad/effected/walker/Expand.ts:48-53; scratchpad/effected/walker/Descend.ts:62-122
- class: type-safety   severity: backlog
- standard: EF-33; D15 permits satisfies; D11 requires an actual violation/defect.
- evidence: CompileAndExpandOptions currently spells every DescendOptions field and glob; upstream used interface inheritance. 5b2233b037 converted it to a schema under the schema-first requirement. The proposed satisfies check catches hypothetical future omissions, not a missing field today.
- failure: Future optional-field drift is possible; no current assignability bug, unsafe assertion, diagnostic or duplicated type model is demonstrated. Keep this robustness proposal outside required work.
- fix: Consider a field-key satisfies assertion or schema-derived shared fields that preserve all current optionality, exclusions and encodings. Do not restore the diagnostic/law-forced schema to an interface.
- seats: fable-2-10

### backlog-7 — Consider non-throwing JSON quotation and codec consolidation

- file: scratchpad/effected/walker/Descend.ts:263-264; scratchpad/effected/walker/Expand.ts:162; scratchpad/effected/walker/Walker.ts:17
- class: effect-idiom   severity: backlog
- standard: EF-19; Effect law 21; D11.
- evidence: The getters use Result.getOrThrowWith(encodeJsonString(string), identity); the seat explicitly establishes that encoding a string cannot fail. 5b2233b037 introduced these codecs to replace native JSON.stringify under EF-19. All three modules encode the same JsonString schema.
- failure: The nominal throw path is impossible for the declared input domain, and repeated local codecs do not demonstrate a defect or a prohibited native JSON call. Optional consolidation/fallback preferences do not justify restoring law-forced JSON.stringify.
- fix: Consider a non-throwing getter codec adapter using Result.getOrElse with an explicit total-domain explanation, or shared quotation if useful; preserve exact JSON-quoted message bytes. No required new helper/file is assigned.
- seats: fable-2-11

### backlog-8 — Consider immutable prune lookup representation

- file: scratchpad/effected/walker/Descend.ts:339,466
- class: effect-idiom   severity: backlog
- standard: D5 explicitly permits HashSet and MutableHashSet; EF-5; D11.
- evidence: prune is built with MutableHashSet.fromIterable and only read with MutableHashSet.has. git show 03c27d2a90 establishes the S1 law-forced replacement of native Set. The existing representation is one of D5's authorized Effect collections.
- failure: Immutability could express intent more clearly, but no mutation bug, violated standard or measured regression is shown.
- fix: Optionally use HashSet.fromIterable/HashSet.has without changing membership or traversal. Do not revert the forced native-runtime replacement.
- seats: fable-2-13

### backlog-9 — Keep queue documentation aligned after restoration

- file: scratchpad/effected/walker/Descend.ts:546-547
- class: docs   severity: backlog
- standard: Section 10.1; merger instruction defers docs/JSDoc.
- evidence: fable-2-16 identifies prose saying head-index dequeue while 7aae242a6e changed the loop to array iteration. Its source-restore alternative is merged with fable-2-15 in req-8, which restores the documented mechanism.
- failure: The current prose/code mismatch is documentation work; req-8 should remove the mismatch without rewriting the carried paragraph.
- fix: After req-8, verify that the existing head-index description and restored comment agree. Retain the paragraph if they do; do not rewrite it to bless the unforced S3 loop.
- seats: fable-2-16 (documentation portion)

## Handled by the deviation codemod

### codemod-1 — Record added runtime schema exports centrally

- file: scratchpad/effected/walker/README.md:95; scratchpad/effected/walker/index.ts:22-27
- class: docs   severity: backlog
- standard: D2/D9; Grilling, 2026-10-09 (later), central per-module/per-class codemod and exportsAdded.
- evidence: sol-2-2 observes Added exports: None although DescendResult, UnreadableDirectory, CompileAndExpandOptions and AscendOptions gain runtime values while retaining upstream type exports. git show 5b2233b037 grounds the law-forced schema conversion. The report only requests its export inventory record, not a correction to the runtime values.
- failure: Added-export bookkeeping is incomplete; the operator explicitly owns this centrally rather than as a required walker repair.
- fix: The central codemod records the four added value exports in exportsAdded and the generated Added exports notes, retaining their upstream type exports. It also accounts for any helpers newly exported by required fixes. Assign no PORT_LEDGER.json or README Port-notes edit to a repair group.
- seats: sol-2-2

## Rejected

None. Every reported finding has evidence and a concrete fix; discretionary and deferred items are classified above rather than discarded. No report requires a repo-level repair outside the allowed write surface.
