# jsonc — round-3 merged inventory

Seats read: `grok.md` (grok-3-1–3), `sol.md` (sol-3-1–2), and `fable.md`
(fable-3-1–7; third-seat route: grok-4.7 medium). Read both adjacent briefs,
`BRIEF.md` and `BRIEF.grok3.md`; there are no part-N reports in this round.
Counts: **Required 5 · Backlog 3 · Codemod 1 · Rejected 0 · Groups 1**.
The codemod record extracts shared bookkeeping from required findings; it is not another code fix.

The briefs identify review commit `a67fdb1f52f7bd981bd8345a5f3ba4ef3bd6cd56`
and the pinned upstream oracle `af7566a9da2eff169cb74955efcc5ede1e5de9f8`.
Merge-time checkout: `@lab/effected-2`, HEAD `976aeecbe0`; no branch switch was made.
The operator revision, all subsequent rulings, D1–D20, §12.5 and §14 were read.
The briefs' green gates are review evidence, not a newly executed proof. S2/S3
findings are deferred under the merge instruction, regardless of the briefs' stage claims.
The live `standards/effect-laws.allowlist.jsonc` contains **zero** entries matching
`scratchpad/effected/jsonc/**`; there are therefore no `allow-<n>` records to add.

Provenance: the current path history is squashed into `7929b1f529`. Retained
history was also read with `git log --all --format=%h:%s -- <file>` and the
relevant diffs. `961aa62cc5` changes already-finite public fields to `S.Natural`,
reuses `JsoncPath` for the error payload, introduces eager zipped equality, and
drops the exact-two-children condition. The jsonc S1 diff `9a47f165dc` repairs
navigation, tests and helper forms; it does not force those changes. The inspected
step-2 commits `6787f85c81` and `03bf79d41b`, and allowlist-removal law commit
`a955556fb3`, contain no jsonc source fix forcing them. The `schemaNumber` rule
requires `S.Finite`, not natural numbers. Oracle casts are never part of a restore:
D15 forces their removal, but does not force rejecting a safely narrowed numeric
property key or accepting an extra property child.

All five required findings own overlapping source files through R2, so `g1`
owns five source files and their five test files. No group assigns root config,
`PORT_LEDGER.json`, README Port notes, or any other central bookkeeping surface.
The visitor's verified upstream-bug deviation must be registered centrally under
§14 before its behavior fix; that coordination is not a worker write assignment.

## Required

### R1 — A mismatch path must remain a typed failure
- file: scratchpad/effected/jsonc/JsoncModifier.ts:54; mismatch construction at :210
- class: bug
- severity: required
- standard: D9, D11, §14; effect-laws-v1 law 7 (typed errors); later ruling on unforced oracle divergence.
- evidence: The error's `path` reuses `JsoncPath`, whose numeric branch is `S.Natural` (`JsoncNode.ts:39,71`). Its Type is still `number`, so negative and fractional inputs reach navigation. On a mismatch, `JsoncModificationError.make` validates them and throws inside `Effect.fn`. Both seats identify `modify('{ "a": 1 }', ["a", -1], 2)`; fable additionally identifies `modify('[1]', [0.5, 'x'], 1)`. The oracle error path accepts numeric segments. `961aa62cc5` replaces an already-lawful `S.Array(S.Union([S.String, S.Finite]))` with `JsoncPath`; the S1 diff does not require that replacement. The existing NoOp test only covers navigation branches that never construct the error.
- failure: A structural mismatch with a finite negative or fractional path segment dies with schema validation instead of failing with `JsoncModificationError`; `Effect.catchTag` cannot catch that defect.
- fix: Restore the error payload's `S.Array(S.Union([S.String, S.Finite]))` independently of the addressing schema. Restore any upstream assertions this payload change rewrote, and add effect-failure regressions for `["a", -1]` and `[0.5, "x"]` checking the original path, expected container and depth. Keep existing NoOp behavior. Central recording of the retained non-finite rejection belongs to C1.
- seats: grok-3-1, fable-3-1

### R2 — Restore the finite public numeric domains
- file: scratchpad/effected/jsonc/JsoncEdit.ts:43,162,206; scratchpad/effected/jsonc/JsoncNode.ts:177–180; scratchpad/effected/jsonc/Jsonc.ts:88–91; scratchpad/effected/jsonc/JsoncVisitor.ts:27; scratchpad/effected/jsonc/JsoncModifier.ts:56
- class: schema
- severity: required
- standard: D9, D11, §14; later ruling on unforced oracle divergence; `schemaNumber` (TS377098); round-2 R4's finite-input restoration.
- evidence: The oracle public span, position and depth fields use `Schema.Number`. `961aa62cc5` changes already-finite lab fields to `S.Natural`; no inspected S1/step-2/law diff forces rejection of finite negatives, fractions or unsafe integers. `JsoncEdit.make({ offset: -1, length: 0, content: "" })` and a fractional-offset edit fail construction in the lab, while the oracle constructs them and applies JavaScript substring semantics. The lab test at `JsoncEdit.test.ts:17` explicitly pins negative rejection; `JsoncNode.test.ts:68` pins it for node offsets. Generated parser/formatter values do not expose this domain difference to the green gate. The overlap error must also accept the finite offsets of edits it reports.
- failure: Public constructors and decoders reject finite values accepted upstream before the operation can apply its existing behavior. An overlap involving such edits can also fail error construction if only the edit schema is widened.
- fix: Restore `S.Finite` for JsoncRange.offset/length, JsoncEdit.offset/length, JsoncEditOverlapError.lower/upper, JsoncNode.offset/length/optional colonOffset, JsoncParseErrorDetail.offset/length/line/character, visitor Span.offset/length, and JsoncModificationError.depth. Preserve optionality and defaults. Restore the upstream shape and any upstream test lines rewritten to require natural numbers; retarget the lab's negative-rejection pins to accept finite negatives/fractions and reject only non-finite values. Add direct constructor/decode checks for the listed public shapes and finite-overlap reporting. This record concerns position/depth fields; the separate error-path reuse defect is R1. Central recording of lawful `S.Finite` replacements belongs to C1.
- seats: grok-3-2, fable-3-4

### R3 — Preserve hand-built property arity and numeric keys
- file: scratchpad/effected/jsonc/JsoncNode.ts:351–357,414–421,462–464
- class: bug
- severity: required
- standard: D9, D11, D15, §14; later ruling on unforced oracle divergence.
- evidence: The oracle evaluates an object property only when its children array has exactly two elements; a numeric head value becomes a string property key during the store, and buildPath appends the original numeric value. The live lab checks only for child index 1 and filters every key through `P.isString`, although node.value is `S.Unknown` and children have no arity restriction. `961aa62cc5` deletes the exact-two-children guard. Earlier lab code already narrowed keys to remove unsafe oracle assertions; that law-forced removal does not require dropping a numeric key that can be narrowed safely to the existing `string | number` path type.
- failure: A hand-built three-child property is included instead of skipped. A two-child property with a numeric key is dropped from `toValue`, and `pathAt` omits its numeric path segment. Parser-only trees hide both differences from existing gates.
- fix: Restore the upstream exact-two-children shape in object evaluation and the valid numeric-key behavior without copying the oracle's `as string` assertions: safely narrow string/number heads, coerce a numeric object key to its property-key string for evaluation, and append its original numeric value in buildPath. Keep string-segment find comparisons strict and preserve the own-data-property protection for `__proto__`. Restore any upstream test lines rewritten for these changes and add hand-built two-child numeric-key and three-child property regressions in JsoncNode.test.ts. The report's blanket suggestion to append arbitrary unknown values is not the fix: D15 and the public path type still bind.
- seats: grok-3-3

### R4 — Array equality must short-circuit before later getters
- file: scratchpad/effected/jsonc/Jsonc.ts:396
- class: bug
- severity: required
- standard: D9, D11, §14; later ruling on unforced oracle divergence.
- evidence: Sol reports a read-only differential probe of `equalsValue("[1,2]", value)` with value[0] = 9 and an accessor at index 1: upstream returns false with zero getter reads; the lab reads the getter once. A throwing getter makes only the lab throw. Fable independently traces `A.zip` eagerly reading all pairs before `A.every` compares them. `961aa62cc5` introduces that eager composition; the upstream indexed comparison already short-circuits. No gate checks these caller-owned accessor effects.
- failure: An already unequal array executes later caller code and may throw instead of returning false, including in nested arrays.
- fix: Restore the upstream indexed, immediate-return comparison behavior, retaining the existing nesting guard and lawful types. Restore any upstream equality assertions rewritten by this change, and add counting and throwing later-getter regressions to Jsonc.test.ts, including nested arrays. A mismatch at an earlier index must produce false with zero later reads.
- seats: sol-3-1, fable-3-2

### R5 — Visitor recovery must terminate at a mismatched brace
- file: scratchpad/effected/jsonc/JsoncVisitor.ts:316
- class: bug
- severity: required
- standard: D11; D9 and §14's verified `upstream-bug` exception.
- evidence: Sol reports bounded read-only probes in both lab and pinned oracle: `[}`, `{"a":[}`, and `[1,}` exhaust event limits while alternating errors at the same closing-brace offset. Fable independently traces visitValue leaving CloseBrace unconsumed (:247) and visitArray stopping only at CloseBracket or EOF (:316). Neither entrySeparator nor visitValue advances that brace, so the loop has no progress. This is a verified inherited bug, not a proposed undocumented port preference.
- failure: Fully collecting a visitor stream for a finite malformed document never completes and accumulates error events; a nested array can prevent its enclosing object from recovering.
- fix: Stop the array loop on CloseBrace as well as CloseBracket/EOF, then let closeContainer emit CloseBracketExpected while leaving the brace available to the enclosing object. Add terminating full-collection regressions for all three reproducers in JsoncVisitor.test.ts, with a bounded completion safeguard and checks for finite error events and enclosing-object recovery. Retain existing valid-input and malformed-input assertions. The orchestrator owns the §14 upstream-bug record before this behavior change; workers edit only the assigned source and test.
- seats: sol-3-2, fable-3-3

## Backlog

### B1 — Formatter documentation overpromises totality
- file: scratchpad/effected/jsonc/JsoncFormatter.ts:6,25,65
- class: jsdoc
- severity: backlog
- standard: JSDoc documentation law; merge instruction deferring docs/JSDoc until S2/S3.
- evidence: The module/class prose says the statics are pure and total, but format constructs JsoncFormattingOptions, and JsoncFormatter.test.ts:152 pins synchronous rejection of NaN and infinities. README deviation 13 already acknowledges that behavior. The two statics omit corresponding throws documentation.
- failure: Hover documentation promises a function cannot throw for an input its options constructor rejects.
- fix: During S2, qualify totality to finite widths and document the synchronous non-finite-tabSize constructor failure on format and formatToString. This is a concrete prose correctness issue, but the merge instruction makes it backlog rather than a round-3 required fix.
- seats: fable-3-5

### B2 — Measure default-options and codec construction cost
- file: scratchpad/effected/jsonc/Jsonc.ts:353,630,648
- class: perf
- severity: backlog
- standard: D11 (required performance needs measured regression or an algorithmic-class win).
- evidence: stringifyResult constructs a stateful S.fromJsonString codec and an encoder per call; omitted options construct default schema instances. The seat gives no upstream timing, allocation measurement or asymptotic improvement. The codec rewrite is already an accepted law-forced deviation, so restoring direct JSON.stringify would contradict its recorded cause.
- failure: Potential constant-factor overhead only; no demonstrated behavioral difference or required performance regression.
- fix: Hoist immutable default parse/stringify options where safe, then benchmark a reusable codec design against upstream before changing per-call replacer state. Preserve the schema JSON codec and caller isolation.
- seats: fable-3-6

### B3 — Measure per-property descriptor overhead
- file: scratchpad/effected/jsonc/internal/parser.ts:448; scratchpad/effected/jsonc/JsoncNode.ts:467
- class: perf
- severity: backlog
- standard: D11 (required performance needs measured regression or an algorithmic-class win).
- evidence: The lab defines every parsed/evaluated object member through Object.defineProperty; the oracle assigns ordinary keys and uses a descriptor for __proto__. The seat explicitly states the resulting data properties match, and provides no measurement or change in algorithmic class. This performance-only claim supplies no additional demonstrated contract defect; R3 separately retains the concrete AST defects.
- failure: Possible unmeasured constant-factor descriptor allocation and call overhead for wide objects.
- fix: Benchmark wide-object parsing/evaluation against the pinned oracle; if worthwhile, restrict the descriptor path to __proto__ and use the ordinary-key store elsewhere while preserving own-data-property semantics. Coordinate any eventual JsoncNode change with its then-current owner.
- seats: fable-3-7

## Handled by the deviation codemod

### C1 — Record the law-forced finite-number remainder centrally
- file: scratchpad/effected/jsonc/JsoncModifier.ts:54,56; scratchpad/effected/jsonc/JsoncEdit.ts:43,162,206; scratchpad/effected/jsonc/JsoncNode.ts:177–180; scratchpad/effected/jsonc/Jsonc.ts:88–91; scratchpad/effected/jsonc/JsoncVisitor.ts:27
- class: schema
- severity: codemod (not required)
- standard: Later operator ruling: one deviation entry per module per systemic class, generated centrally; `schemaNumber` / TS377098.
- evidence: Grok and fable append requests to record the retained non-finite rejection after restoring finite path/position inputs. The diagnostic requires S.Finite; README deviations 9 and 13 already cover that class at other sites. Recording it site-by-site is specifically superseded by the per-module, per-class codemod ruling.
- failure: The systematic lawful rejection needs complete central provenance; this is bookkeeping, separate from the incorrect extra narrowing fixed by R1/R2.
- fix: The orchestrator's deviation codemod consolidates the jsonc schemaNumber class, listing all affected sites and adjusted upstream/lab tests after R1/R2. Do not assign PORT_LEDGER.json or README Port notes to g1, do not restore S.Number, and do not hand-author per-site deviation entries.
- seats: grok-3-1, grok-3-2, fable-3-1, fable-3-4

## Rejected

None. Duplicate seat reports are merged into their contributing records, not counted
as rejected findings. Required records keep the demonstrated contract defects while
excluding unsafe oracle casts and central bookkeeping from worker fixes.
