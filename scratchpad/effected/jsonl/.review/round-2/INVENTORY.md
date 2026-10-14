# jsonl — round-2 merged inventory

Seats read: `grok.md` (grok), `sol.md` (sol), and `fable.md` (independent
grok-4.7 medium fallback seat), with adjacent `BRIEF.md` and `BRIEF.grok3.md`.
There are no `part-N` reports. Six seat findings become five records after
deduplicating the short-read defect: **4 required, 1 backlog, 0 codemod,
0 rejected; 3 non-overlapping fix groups**.

Reports target `a67fdb1f52f7bd981bd8345a5f3ba4ef3bd6cd56`; the inspected checkout
is `@lab/effected-2` at `c74682a8c0e4ee1fe69147c3be153f7a3ce9ec68`. Evidence was
checked against live source, the pinned `af7566a9da2eff169cb74955efcc5ede1e5de9f8`
oracle, round-1 closure, and file history, including the retained pre-squash
commits via `git log --all`. The brief's green-gate claims are seat context,
not a new gate run. No tests, coverage, diagnostic probes, or gate commands ran
during this merge.

The full operator revision block, D1–D20, sections 12.5 and 14, and the later
2026-10-09 rulings govern classification. The live native-runtime allowlist has
**zero** `scratchpad/effected/jsonl/**` entries, so there are no `allow-<n>`
findings to add. The four historical entries were removed by `e754a7db38`
(`effected-port laws`); their completed replacements are not re-raised.

## Required

### grok-2-1

- file: scratchpad/effected/jsonl/internal/tail.ts:137
- class: bug   severity: required
- standard: D9, D11; section 14; retained real-torn-tail deviations 1 and 8.
- evidence: `readBytes` at `internal/tail.ts:91–100` returns only bytes obtained
  before EOF, but `windowOf` assigns `size: from + length - bomBytes` using the
  request. Fable's concrete case is a file containing `42\n` read with length
  100: text is `42\n`, start is 0, size is 100, and the complete-line advance is
  3. `Journal.ts:682–697` therefore builds `JournalUnterminated` with end 100.
  Reconcile assigns `consumed = range.advanced` at `Journal.ts:777`, and append
  refuses the supposed torn tail at `Journal.ts:825`. A subsequent stable stat
  can equal the advanced cursor and miss the shrink. `readSampledWindow` at
  `internal/tail.ts:315–322` already detects short pages independently. The
  oracle's range reader decodes actual bytes without this requested-end check.
  Existing `Helpers.test.ts:107–118` checks short-read text but not size; the
  full-read suffix case at `Helpers.test.ts:211–215` correctly keeps size 4.
- failure: A newline-aligned short read after reconcile's stat is reported as
  an unterminated suffix ending beyond the bytes actually read. Append fails
  with the wrong error, and the advanced cursor can hide the subsequent shrink
  without publishing `JournalResync`.
- fix: Set `TailWindow.size` to `from + bytes.length - bomBytes`. Remove the
  now-unused requested-length parameter from `windowOf` and its local callers
  if necessary. Keep the size of fully read, withheld unterminated suffixes.
  In `Helpers.test.ts`, pin newline-aligned EOF, BOM-relative size, and the
  unchanged full-read torn suffix. In `Journal.regressions.test.ts`, pin the
  stat/read truncation race and the post-write `JournalWriteConflict` size
  check. This fixes a bug in the deviation; it is not a request to record one.
- seats: grok-2-1, fable-2-2

### sol-2-1

- file: scratchpad/effected/jsonl/Envelope.ts:255
- class: bug   severity: required
- standard: D9, D11; section 14; 2026-10-09 native-runtime ruling.
- evidence: Sol reports two read-only differential probes against the pinned
  oracle: a payload `S.Union([Payload, S.Null])` with class fields `n` and `keep`,
  and a `S.Struct(...).pipe(S.decodeTo(S.instanceOf(Payload), ...))` codec.
  Both implementations load seed `{ n: 1, keep: "a" }`. On
  `appendPatch("x", { n: 2 })`, upstream succeeds with a `Payload` containing
  `{ n: 2, keep: "a" }` and two records; the lab fails `InvalidData` and retains
  only the seed. Live `patchCodec` at `Envelope.ts:255–263` only substitutes
  structural fields for a callable Declaration; composed codecs retain an
  encoder requiring an instance. The `e754a7db38` law diff introduced this
  adapter with the forced plain-record merge. Round-1 R4 only restored the
  direct-class patch case, not these composed cases.
- failure: The plain transient merge cannot pass a class-bearing union or
  transformed class encoder, so valid partial patches that preserve untouched
  class fields stop working. The forced representation change does not
  authorize this additional regression.
- fix: Extend structural patch encoding through class-bearing union members
  and codec transformations, preserving checks and transformation behavior.
  Validate the encoded envelope through the original registered codec before
  persistence, retaining genuine decoded class instances. Add nullable-class
  and transformed-class `appendPatch` regressions to `Journal.test.ts`, asserting
  retained fields, class identity, and the second persisted record. Keep invalid
  patches rejected before writing. Do not restore native prototype construction.
- seats: sol-2-1

### fable-2-1

- file: scratchpad/effected/jsonl/internal/utf8.ts:37
- class: perf   severity: required
- standard: D11 algorithmic-class evidence; D9; later 2026-10-09 ruling to
  restore unforced departures from the upstream shape.
- evidence: The live implementation is `encoder.encode(text).length`, which
  allocates a temporary byte buffer of Θ(n) size. The pinned oracle
  `src/internal/utf8.ts:21–44` counts UTF-16 units with O(1) auxiliary space,
  including surrogate pairs and lone surrogates. Call sites include
  `Line.ts:180`, `Journal.ts:683`, and `Journal.ts:969`. File history attributes
  the allocation rewrite to `94a176ae09`; its diff replaces a working
  `Str.charCodeAt`/Option counting loop with TextEncoder. The earlier
  `96c076a952` diff already used law-compliant String helpers. The step-2
  `03bf79d41b` and laws `e754a7db38` diffs do not force a change in this file.
  The comment about per-unit Option allocation is a tradeoff argument, not a
  diagnostic or law requiring a buffer. Round-1 R3 concerned byte-array copying
  in `internal/tail.ts`, a separate site.
- failure: Every line/window length measurement allocates and discards a
  buffer proportional to encoded input size, increasing peak auxiliary space
  from O(1) to Θ(n). Semantic tests cannot detect this allocation regression.
- fix: Restore the oracle's in-place counting control flow and surrogate
  handling, keeping required Effect String/Option helper substitutions rather
  than adding forbidden native helper calls. Remove the shared encoder from
  this leaf. Retain the TextEncoder differential property and explicit surrogate
  cases in `Line.test.ts`; restore any oracle assertion lines displaced by this
  rewrite. No full-input temporary array or byte buffer may be introduced.
- seats: fable-2-1

### fable-2-3

- file: scratchpad/test/jsonl/Line.test.ts:153; scratchpad/test/jsonl/Envelope.test.ts:89
- class: test   severity: required
- standard: D9; later 2026-10-09 operator ruling: restore unforced upstream
  shapes and the upstream test lines they rewrote.
- evidence: The pinned oracle uses depth `200_000` in
  `__test__/Line.test.ts:206–217` and `__test__/Envelope.test.ts:116–121`; the lab
  uses `Str.repeat(20000)` in both cases. The adapted tests appear in
  `2ee20104af` and `b5f3d6d6b9` with the smaller depth already present.
  `git log --all -G '20000|200_000|200000'` identifies that history; inspection
  of step-2 `03bf79d41b`, S1/W0 `4c40c613ca`, and laws `e754a7db38` shows no
  diagnostic- or law-forced depth reduction. By contrast, replacing the oracle's
  native JSON fixture operations and `as unknown` is forced by
  `standards/effect-first-development.md:104` and D15. Those substitutions do
  not require reducing the input by a factor of ten.
- failure: The lab narrows the oracle's pathological-depth contract without
  an allowed cause. Fable classified this as backlog for lack of a shown
  runtime bug; the later operator ruling explicitly requires restoring these
  unforced test changes. This is parity restoration, not a request for more
  coverage or vitest-canon migration.
- fix: Restore depth `200_000` in both tests and their original deep-parse and
  frame-boundary assertions. Restore the upstream fixture setup and assertion
  sequence wherever not law-forced; express required JSON operations through
  schema codecs and omit the forbidden cast. Preserve the law-required fixture
  substitutions rather than blindly copying native `JSON.parse`/`JSON.stringify`
  or `as unknown`. A demonstrated codec/engine diagnostic must be attributed
  before changing this oracle input; no such evidence is in the reports or
  inspected diffs.
- seats: fable-2-3

## Backlog

### sol-2-2

- file: scratchpad/effected/jsonl/README.md:145
- class: docs   severity: backlog
- standard: D11; current merge instruction deferring docs, JSDoc, coverage,
  and vitest-canon findings; 2026-10-09 native-runtime ruling.
- evidence: README lines 145–147 still describe four live allowlisted
  operations. The live allowlist contains no jsonl entries, and the
  `e754a7db38` laws diff implements owned registry state, a service subclass,
  and structural patch encoding. The ledger's native-runtime deviation records
  their removal. This stale authored paragraph is separate from Port-notes
  deviation bookkeeping.
- failure: The runtime-boundary documentation describes exceptions and
  ownership behavior that the implementation no longer has.
- fix: During the documentation wave, replace those obsolete sentences with
  the current owned registry, service subclass, and structural patch approach.
  Do not hand-edit Port notes or the central ledger.
- seats: sol-2-2

## Handled by the deviation codemod

None of the seat findings merely asks to record a law-forced change. The
completed native-runtime changes and required JSON/cast fixture substitutions
remain centrally owned bookkeeping; no restore of those forced substitutions
is assigned. `sol-2-1` remains required because it demonstrates a defect in the
change itself. No ledger or README Port-notes write surface is assigned.

## Rejected

None. `grok-2-1` and `fable-2-2` are merged under `grok-2-1`, not counted as a
rejection. Every retained record has evidence and a concrete fix. The runtime
and allocation defects are outside what the cited green gates prove; the depth
restoration addresses an unforced parity change rather than a gate-enforced
syntax rule.

Group ownership is defined in `required.json`: g1 owns `internal/tail.ts` and
the helper/reconcile regression tests; g2 owns `Envelope.ts` and `Journal.test.ts`;
g3 owns `internal/utf8.ts`, `Line.test.ts`, and `Envelope.test.ts`. Each group
owns one source file. No source or test file appears in more than one group.
