# jsonl — round-3 merged inventory

Seats read: `grok.md`, `sol.md` (fallback report with `claude-3-*` ids), and
`fable.md` (independent grok-4.7 medium fallback), with adjacent `BRIEF.md` and
`BRIEF.grok3.md`. No `part-N` reports exist. Seven seat findings deduplicate
to **2 required, 2 backlog, 0 codemod, 0 rejected; 1 fix group**.

Reports target `40074bd59e77fbdfad3df92e95ecc2b7f3408b78`. The inspected checkout
is `@lab/effected-2` at `46a7e1fe365b6185d8b6fc46ecd23b9503bc91c8`; its jsonl
source and tests have no diff from the review commit. Classification follows
the entire operator revision block, D1–D20, sections 12.5 and 14, and this
merge task's deferral of docs, JSDoc, coverage and vitest-canon findings. The
briefs' green gates are reported context, not verification run here. Source,
the pinned `af7566a9da2eff169cb74955efcc5ede1e5de9f8` oracle, round-2 closure,
and commit diffs were read; no tests, coverage, diagnostic probes or gates ran.

The live `standards/effect-laws.allowlist.jsonc` has **zero** entries for
`scratchpad/effected/jsonl/**`, so no `allow-<n>` findings are added. File history
(`git log --format=%h:%s -- <file>` and retained history with `--all`) and the
`03bf79d41b` step-2, `e754a7db38` laws and `9ea9b244ac` round-2 diffs confirm
that the plain-record merge and its patch-encoding adapter are law-forced.
Neither required item calls for restoring native prototype construction.

## Required

### grok-3-1

- file: scratchpad/effected/jsonl/Envelope.ts:256
- class: bug   severity: required
- standard: D9, D11; section 14; 2026-10-09 native-runtime ruling. A forced
  representation change must retain valid upstream patch behavior.
- evidence: `patchAst` rebuilds `Union` nodes at line 260 and relaxes a
  `Declaration` only when an immediate encoding target is `Objects` at
  lines 271–275. `Suspend` falls through unchanged at line 295. Consequently
  the declaration behind a root suspension retains its instance gate, and a
  declaration encoding through a union or suspension also misses relaxation.
  `Journal.ts:1127–1128` passes `shallowMerge`'s plain record
  (`internal/merge.ts:149`) into that encoder. Grok reports read-only probes
  showing `InvalidData` for `S.suspend(() => Boxed)`, a union containing that
  suspended class, and a union-wire codec decoded to `S.instanceOf(Boxed)`.
  A suspended-class journal patch leaves the seed file byte-identical. The
  pinned oracle's `src/internal/merge.ts:109` preserves the base prototype,
  and its `src/Envelope.ts:369` encodes the merged instance successfully,
  retaining `keep` and the wire discriminant. Sol and Fable independently
  identify the same missing traversal. Live source confirms these branches;
  the reported probes were not rerun during this merge. Round 2 covered a
  direct class inside a nullable union and a struct-wire `decodeTo` codec,
  rather than these remaining composed shapes.
- failure: A valid partial patch of a root-suspended class, a union member
  behind a suspension, or a class declaration reached from union/suspended
  wire data fails `InvalidData` and appends nothing. Upstream preserves the
  untouched fields and appends a record decoded to the original class.
- fix: Extend `patchAst` lazily through `SchemaAST.Suspend` and structural
  declaration encoding targets containing `Objects`, `Union` or `Suspend`.
  Rebuild a suspension with its annotations, rewritten encoding and context,
  passing `undefined` for checks: the installed `Suspend` constructor rejects
  checks. Memoize rewritten ASTs per codec by original identity, using owned
  traversal state and `===` lookup or an appropriate Effect collection; do
  not introduce the native `Map` suggested in Grok's report. Preserve field
  checks, transformations, scalar declaration encoders and the original-codec
  validation before persistence. Add `Journal.test.ts` regressions for the
  suspended class, suspended union member, union-wire `decodeTo`, and a
  suspended wire target, asserting retained fields, genuine class identity,
  two persisted records and invalid-patch non-writing. Extend
  `EnvelopePatch.test.ts` to pin these codec boundaries and retain its scalar
  declaration cases. Coordinate declaration relaxation with `fable-3-1` so
  composed support does not erase union-member provenance.
- seats: grok-3-1; sol: claude-3-1; fable-3-2

### fable-3-1

- file: scratchpad/effected/jsonl/Envelope.ts:290; scratchpad/effected/jsonl/internal/merge.ts:149
- class: bug   severity: required
- standard: D9, D11; section 14; 2026-10-09 native-runtime ruling. Plain
  transient records are required, but changing the selected payload codec,
  persisted wire form or decoded class is not authorized.
- evidence: `shallowMerge` copies safe own fields into a plain record and
  drops inherited `~effect/Schema/Class/${identifier}` markers. The patched
  declaration's `encodingRun` then accepts every record-like value, regardless
  of its original class. Fable reports a differential case with
  `S.Union([AsNumber, AsString])`: `AsNumber.n` is `S.Finite`, `AsString.n` is
  `S.FiniteFromString`, and only `AsString` owns `extra`. Seed
  `{"n":"1","keep":"a","extra":"z"}` decodes as `AsString`; patch `{ n: 2 }`
  persists `{"n":2,"keep":"a"}` and returns `AsNumber` in the lab. The oracle
  retains the string encoder, `"n":"2"`, `extra` and `AsString`. Live
  `Envelope.ts:290`, `internal/merge.ts:125–152`, installed
  `Schema.ts:getClassSchemaFactory` (instance-or-class-marker predicate), and
  `SchemaAST.ts:parseUnion` (first successful member by default) support that
  mechanism. The pre-write original decoder at `Journal.ts:835` accepts the
  wrong member, so it cannot catch this corruption. The existing nullable
  class and struct-wire codec regressions each have only one accepting class;
  a shared literal discriminant can also hide the defect. No probe was rerun
  during this merge.
- failure: A partial patch of an ambiguous class union can select an earlier
  member's encoder, silently discard fields, change the wire representation
  and return an instance of the wrong class. This is distinct from the missing
  suspension/composition traversal in `grok-3-1`.
- fix: Preserve the decoded base's class provenance on the transient plain
  merge and use it to admit only the originating class declaration. A concrete
  route is to collect its schema-class markers from the base prototype chain
  with the already-used `Reflect.getPrototypeOf` traversal, carry those markers
  as own metadata on the transient record, and require the corresponding
  marker in the relaxed class `encodingRun`; otherwise delegate to
  `ast.encodingRun ?? ast.run`. Derive metadata from the decoded base, keep
  patch fields from overriding it, and exclude it from payload field encoding
  and persisted JSON. Retain the plain prototype, forbidden-key filtering,
  inherited-setter protection, normal checks and non-class transformation
  behavior; do not restore `Object.create` or `Object.defineProperty`.
  In `Journal.test.ts`, pin both member orders for the number/string class
  union, untouched `extra`, the string wire encoding, `instanceof AsString`,
  and invalid patches leaving the file unchanged. In `merge.test.ts`, retarget
  the direct class-merge assertion to check payload fields separately from
  internal provenance, and pin that provenance without weakening the existing
  pollution and setter assertions. Extend `EnvelopePatch.test.ts` for class
  branch selection while retaining non-class declaration behavior.
- seats: fable-3-1

## Backlog

### grok-3-2

- file: scratchpad/effected/jsonl/Envelope.ts:298
- class: perf   severity: backlog
- standard: D11 performance evidence rule: a required optimization needs a
  measured upstream regression or an algorithmic-class improvement.
- evidence: `encodeResultWith` at line 315 calls `patchCodec(found.value.data)`
  for every patch; `patchCodec` constructs a rewritten AST and invokes a new
  `S.encodeUnknownResult` compilation path. Both Grok and Sol identify repeated
  schema work despite the journal's owned registry remaining fixed. Neither
  report supplies a measurement or an algorithmic-class improvement.
- failure: Patch appends repeat AST construction and encoder compilation
  proportional to payload-schema size. The unmeasured constant-factor cost
  does not satisfy D11's required-performance threshold.
- fix: After the correctness fixes, construct or lazily retain one patched
  codec/encoder per event on the owned registry and reuse it in
  `encodeResultWith`. Measure before promoting this optimization to required;
  keep state owned rather than introducing a global or native weak cache.
- seats: grok-3-2; sol: claude-3-2

### claude-3-3

- file: scratchpad/effected/jsonl/Journal.ts:960; scratchpad/effected/jsonl/README.md:491
- class: docs   severity: backlog
- standard: section 14, guarantees must describe the implemented deviation;
  current merge instruction defers documentation findings. Central ledger and
  README Port-notes edits are excluded from fix-group ownership.
- evidence: The paging handle is pinned and its `dev:ino` checked once at
  `Journal.ts:929–946`. `internal/tail.ts:314` detects a truncation only when
  a page is shorter than requested. An in-place `O_TRUNC` rewrite that regrows
  beyond the next requested page before that read preserves the inode and
  supplies a full-length page. The implementation has no per-page mutation
  check. README Deviation 13 at lines 491–530 claims a truncation beneath a
  historical read fails typed; that statement omits the truncate/refill race.
- failure: The documented guarantee overstates detection: historical reads
  can emit old pages followed by rewritten pages without `JournalResync` if
  regrowth completes between page reads. The finding requests accurate wording,
  rather than supplying a concrete runtime fix for that race.
- fix: Route a documentation correction to the central deviation owner:
  describe rename-over pinning and short-page shrink detection precisely, and
  state the in-place truncate/refill limitation. Narrow the corresponding
  `Journal.ts` comment during the documentation wave. Do not assign hand-edits
  to README Port notes or `scratchpad/effected/PORT_LEDGER.json`; reason:
  **outside the port's write surface**. A runtime consistency guarantee needs
  a separately evidenced design, not an assumed size/mtime check.
- seats: sol: claude-3-3

## Handled by the deviation codemod

None of the seven seat findings merely asks to record a law-forced change.
The existing registry ownership, dropped freezing, service statics and
plain-record merge remain centrally owned native-runtime bookkeeping. The
required findings demonstrate defects in the encoding behavior itself and
therefore stay required. The inaccurate guarantee in `claude-3-3` is a
documentation correction, not a request merely to record a forced change.
No ledger, added-export or README Port-notes write is assigned.

## Rejected

None. Duplicate seat findings are merged, not rejected. Each retained record
has evidence and a concrete fix, and neither required bug is enforced by the
reported green gates: existing regressions omit these payload shapes and the
wrong-member output passes the original decoder. The merged suspension fix
corrects Grok's native-`Map` suggestion and Sol's suggestion to retain checks
on `Suspend`; those implementation details are not separate findings.

`required.json` assigns both required findings to g1, which owns `Envelope.ts`
and `internal/merge.ts`, plus `Journal.test.ts`, `EnvelopePatch.test.ts` and
`merge.test.ts`. Shared source/test ownership requires this single group.
It has two source files, below the six-source limit, and no overlapping files.
No repo configuration, root manifest, lockfile, ledger or Port notes is a
required write surface. Round 3 is final: this is a final-fix-wave handoff,
not authorization for a fourth review.
