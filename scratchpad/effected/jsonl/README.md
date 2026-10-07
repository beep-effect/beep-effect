# JSONL journal lab

An Effect-first adaptation of `@effected/jsonl`. The upstream MIT notice is in
[LICENSE](./LICENSE). Event registries preserve their literal tags, payload
codecs and terminal/reopen flags. `Journal.Service<Self>()` preserves the
caller's service identity. Binary envelope codecs accept the line or envelope
first; their curried form accepts the registry.

```ts
pipe(line, Envelope.decodeResult(events))
pipe(envelope, Envelope.encode(events))
```

Optional configuration and slice keys treat an explicit `undefined` as omission,
as upstream does. `shutdownPublishTimeout` accepts any `Duration.Input` (a
`Duration`, milliseconds or a string such as `"100 millis"`), and the layer
decodes it into a `Duration`.

## Writing, recovery and concurrent readers

Each journal instance serializes its own writes. Before checking terminal state or
deriving an `appendPatch`, it reads completed foreign records that have already
reached the file. Those records enter the same ordered publication stream as local
appends. Patches therefore inherit the current completed snapshot even when the
filesystem watcher has not run yet.

An incomplete physical tail prevents a local append. The operation fails with
`JournalUnterminated` and leaves the bytes unchanged, including when the tail is valid
JSON that lacks its terminating newline. The original writer must complete its
record, or the application must explicitly repair the file while preserving any
bytes it needs for recovery. A failed filesystem write may already have persisted
a prefix; retrying without inspecting that state is unsafe.

Historical reads use a fixed byte interval sampled for that read. They retain
completed history while another process appends, and a cursor inside a line skips
that partial line. Records are emitted in pages; a page widens only when needed
to fit a complete record. Memory use follows page and record size rather than the
entire requested history. An incomplete final record is held for later completion so a
replayed subscription can continue into live changes. A terminated corrupt record
still fails through the typed error channel. Cursors count UTF-8 bytes after one
file-leading BOM, including when the file appears after layer construction.
Completed records must also contain valid UTF-8. Invalid source bytes fail with
`InvalidUtf8`; they are never replaced with characters that would change byte
offsets. An unfinished trailing record remains withheld, including when its final
Unicode character spans separate writes.

Both halves of a cursored `changes` read compare the cursor at-or-after a line's
start offset. A live read whose cursor is beyond EOF therefore delivers nothing
that starts below the cursor, including a line that straddles it. A finite query
beyond EOF returns an empty stream.

Independent writers do not share an instance's semaphore. If the file size after
a write cannot establish the expected position, the operation fails with
`JournalWriteConflict` instead of returning a guessed cursor. Its bytes may already
be on disk. Reconcile the file before deciding whether another write is needed;
do not automatically retry that failure. Subsequent ingestion reads from the last
known boundary. Applications requiring atomic patch transactions across processes
must supply their own shared writer coordination.

Layer configuration is validated before resources are allocated. Invalid capacity
values, and a shutdown timeout that `Duration.fromInput` cannot convert, fail with
`InvalidJournalConfig`; invalid read selections, including negative or fractional
cursors, fail with `InvalidSlice`. Both retain the structured schema failure. An
omitted or `undefined` capacity or shutdown timeout keeps its documented default
(64 and five seconds).

## Focused validation

The port runner (`scratchpad/effected/audit.ts`) owns every gate. Run from the
repository root:

```sh
bun run --cwd scratchpad audit:effected -- audit jsonl
```

Each gate also runs on its own:

```sh
bun run --cwd scratchpad audit:effected -- parity jsonl --strict
bun run --cwd scratchpad audit:effected -- check jsonl
bun run --cwd scratchpad audit:effected -- lint jsonl
bun run --cwd scratchpad audit:effected -- test jsonl --coverage
bun run --cwd scratchpad audit:effected -- docgen jsonl
```

The docgen gate writes `scratchpad/docgen.jsonl.json` from
`scratchpad/docgen.effected.template.json` (git-ignored). Generated Markdown and
compiled examples stay under the ignored `.jsdoc-loop/generated-docs/jsonl/`
directory. Coverage reports land in `coverage/scratchpad-effected/jsonl/`.

The scratchpad Vitest configuration runs marked pure JSDoc fences with the
standard `@effect/doctest` plugin. Filesystem/layer examples remain compile-only.
The repository's `beep docgen doctest verify/mark` discovery currently admits
only `packages/**/src` and `apps/**/src`; a scratchpad filter therefore selects
zero files. The JSONL fences were inspected and marked through the same public
analyzer and verified rewrite functions, then executed through this configuration.
Do not interpret the CLI's empty result as documentation proof.

## Upstream test adaptation

The port inventories upstream commit `af7566a9da2eff169cb74955efcc5ede1e5de9f8`
under `effected/packages/jsonl/__test__` and adapts its contracts
rather than its runner and fixture implementation. Package source uses
`@beep/scratchpad` imports. Effect tests use `it.effect`, scope-owned resources,
public Option/Result/Exit assertions, and deterministic Deferred/fiber/stream
coordination. Pure properties use `it.prop` with Effect Arbitrary and Schema.
The platform integration group supplies the real Node FileSystem layer and
excludes test services so native watch timeouts use the live clock.

| Upstream suite | Adapted coverage |
| --- | --- |
| `Envelope.test.ts` | Registry immutability, frame selection, timestamp/scope semantics, typed failures, hostile keys, deep payloads, walk-back, void encoding, lazy serialization failures and both dual forms. |
| `EnvelopeTypes.test.ts` | Original facade tests retain tag/payload correlation, Self identity, lifecycle literal types and filtered-read narrowing; compile-negative cases also cover the exact optional `AppendOptions` scope, while configuration and slice keys accept an explicit `undefined`, as upstream. |
| `Line.test.ts` | UTF-8 widths, lone surrogates, LF/CRLF, blank lines, scalar/object parsing, interior corruption, byte offsets and torn-tail recovery. |
| `LineProperty.test.ts` | Byte-length oracle, byte-range tiling, no dropped nonblank lines, consumed offset, last successful parse, append/truncation laws and totality. |
| `JsonlError.test.ts` | Every error message, unterminated-tail distinction, envelope versus payload failure, and circular cause safety. |
| `merge.test.ts` | Shallow replacement, hostile keys on both sides, inherited setters, class prototypes and incompatible/non-record bases. |
| `Journal.test.ts` | Missing/create/remove lifecycle, TestClock timestamp, complete writes/latest, terminal/reopen, concurrent patches, optional/class payload retention, oversized/torn/BOM seeds, layer identity and bounded shutdown. |
| `ReadSurfaces.test.ts` | Cursor boundaries, time windows, selection before payload decoding, live end, replay/projection, bounded reads and an append forced into the replay/live seam. |
| `Watcher.test.ts` | Local/external order, chunked Unicode, incomplete external writes, truncation/replacement, missing-file activation and the arming-window catch-up. |
| `integration/Journal.int.test.ts` | Real concurrent appends, a cooperating foreign writer, reopening/BOM offsets and two layers observing the same file. |
| `MemFsHelper.test.ts`, `helpers/memfs.ts` | Not copied: these test upstream's private filesystem. The port uses `@beep/test-utils/MemoryFileSystem`; its narrow read barrier suspends before sampling, exercising the bounded-read regression directly. |

The selected tests consolidate overlapping upstream cases. They do not claim
Windows platform execution, exhaustive watch-backend fault injection, or a full
port of upstream's Queue consumption examples, which primarily exercise Effect
Queue strategies. These are coverage limits, not unsupported production APIs.

The replacement test also pins a startup regression: identity must be initialized
alongside the seeded cursor, before the watcher's first catch-up. Otherwise a
same-size or larger replacement during startup can be mistaken for an append.

The focused suite includes behavior, property, integration, and runnable documentation
tests. Its coverage command enforces 100% statements, branches, functions, and lines
for every TypeScript module, including `internal/`. The coverage run selects behavior
tests so documentation examples do not inflate the covered paths. The unfiltered
command separately runs the documentation examples. Reports are written under
`coverage/scratchpad-effected/jsonl/`. Error messages initialize after schema fields, because Bun
can inspect `Error.message` during base construction, before a derived getter's
dependencies exist. The error-message and malformed-input cases cover this path.

## Runtime boundaries

The source has no type assertions, non-null assertions, explicit `any`, native
Map/Set constructors, or direct JSON parsing/stringifying. Four reviewed native
operations remain in the central allowlist: weak registry lifetime, registry
freezing, service-constructor augmentation, and prototype-preserving safe merge.

The focused tsconfig includes all JSONL tests. Package verification provides
package documentation proof; scratchpad has no registered package audit. Neither
that command nor the focused check establishes that unrelated scratchpad labs
pass a full package typecheck.

The bounded `docgen:local` preflight has an inherited metadata-parser limitation,
verified with `bun run docgen:local -- --package @beep/scratchpad`:
it exits before generation with errors such as `JournalReadError missing @example`.
`JsDocAnalysis.ts` requires literal `@example` tags even though the
canonical documentation law and generator use titled Example sections and exempt
pure type declarations. This limitation also exists on the current base. Dedicated
docgen, runtime examples, and package docgen remain the independent proof; do not
add forbidden legacy tags or weaken `enforceExamples` to satisfy that preflight.

## Port notes

### Attribution

- Upstream package: `@effected/jsonl` 0.9.0 (version from upstream
  `packages/jsonl/package.json`; a private package), by C. Spencer Beggs.
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` of the `effected`
  monorepo (local reference clone `~/YeeBois/references/effect/effected`,
  read-only).
- License: MIT. [LICENSE](./LICENSE) is a byte-identical copy of the upstream
  file.
- Vendored notices: none. Upstream ships no third-party engine. Its only
  provenance header, in `src/internal/merge.ts`, says the file ports the
  `internal/deepMerge.ts` recipe from `@effected/config-file`, which has the same
  author, repository and license.

### Added exports

The export census (`audit:effected -- parity jsonl --strict`) reports 29
expected, 37 actual and 8 added names. Every upstream name is still exported, as
the same kind or as a value and type where upstream had one of them.

| Export | Facets | Why |
| --- | --- | --- |
| `ByteCount` | value, type | Non-negative integer schema for UTF-8 offsets, lengths and sizes (Deviation 7). |
| `EnvelopeInput` | type | Type of each event's `input` codec and of `Envelope.input`. The encoders accept the same shape with `scope?: string \| undefined`, as upstream's encoder does. |
| `InvalidJournalConfig` | value, type | Typed layer-configuration failure carrying the schema issue (Deviations 14 and 15). |
| `InvalidSlice` | value, type | Typed read-selection failure carrying the schema issue (Deviation 16). |
| `InvalidUtf8` | value, type | Strict UTF-8 decoding failure (Deviation 9). |
| `JournalUnterminated` | value, type | Append refusal over an unterminated suffix (Deviation 1). |
| `JournalWriteConflict` | value, type | Append placement unknown after post-write growth (Deviation 8). |
| `JournalResyncReason` | value, type | `LiteralKit` for `"truncated"` and `"replaced"` (`law:19`). |
| `AppendOptions` | type → value, type | Schema-first options struct. |
| `JournalConfig` | type → value, type | Schema decoded at layer construction. |
| `Slice`, `CursoredSlice` | type → value, type | Schema factories that validate read selections. |
| `JsonlError` | type → value, type | Tagged-union schema with guards; 13 members. |
| `EnvelopeFrame` | value → value, type | Type alias of the frame schema. |

Members added inside existing exports: `Envelope.input`, `Envelope.schema`, the
`input` and `envelope` codecs on every `JsonlEvent` definition,
`LineSlice.rebase` and `Line.isBlank`.

API-shape changes that are not behaviour deviations:

- Envelope codecs take the value first, with a curried registry-first form.
  This breaks upstream's call shape: a registry-first two-argument call such as
  `Envelope.decodeResult(events, line)` or `Envelope.encode(events, envelope)`
  does not type-check, and an untyped caller gets its arguments swapped, because
  the two-argument form reads the value first. Write
  `Envelope.decodeResult(line, events)` or `pipe(line, Envelope.decodeResult(events))`.
- `Line` is a const object of functions instead of a class with statics, so
  `new Line()` and `instanceof Line` no longer work.
- The `AppendOptions` schema types `scope` as an exact optional key, so a typed
  `{ scope: undefined }` does not compile, although upstream's interface admits
  it. At runtime `append` omits an undefined scope, as upstream does.
- Internal modules (not package exports, marked `@internal`): `internal/tail.ts`
  adds `readRangeWindow`, `SampledRange` and `readSampledWindow` (the
  pinned-handle pager of Deviation 13, with a round-trip property at
  `scratchpad/test/jsonl/Properties.test.ts:291`) and declares `TailWindow` as an
  `S.Class`. Upstream's internal `readRangeText` and `isPlainRecord` have no lab
  counterpart.

### Deviations

Each entry gives the lab test that pins it, upstream behaviour, lab behaviour
and the reason, in the section 14 format of `scratchpad/EFFECTED_PORT_GOAL.md`.
A reason is `law:<id>` or `upstream-bug:<evidence>`. Numbered laws come from
`standards/effect-laws-v1.md`, `EF-*` laws from
`standards/effect-first-development.md`, and `D*` from the port goal's locked
decisions. Upstream behaviour was reproduced by running the same scenario
against upstream source at the commit above and against this port. Probe
numbers name those side-by-side scripts from the wave-0 deviation review
(`NN-<name>.ts`, each with its `.out`). Test paths are relative to
`scratchpad/test/jsonl/`, upstream paths to `effected/packages/jsonl/`, and
`jsonl-journal.md` and `jsonl-slice.md` are upstream's `okf/interfaces/`
concepts.

1. **Append refuses an unterminated suffix.**
   - Test: `Journal.regressions.test.ts:81` (tails `{`, `4` and a complete
     record without its LF), `:321` (the prefix left by our own failed write),
     `:558` (a split multibyte suffix; pins the logical `{ offset, end }` span).
     Extends upstream `__test__/Watcher.test.ts:224`; no upstream test appends
     over a torn tail.
   - Upstream: writes the new line after the fragment, fusing both into one
     physical line that starts at 84. The returned offset points inside that
     line (85 for the one-byte tails, 167 for the LF-less envelope), and every
     later `query()` fails `MalformedLine` at 84, so the appended record can
     never be read back.
   - Lab: fails `JournalUnterminated { offset, end }`, the logical span of the
     suffix, and leaves the file byte-identical. `query()` still returns the
     completed history.
   - Reason: `upstream-bug:` probe 01 reproduces the fused line and the
     in-line cursor. Upstream `CLAUDE.md` requires one `writeAll` of a complete,
     LF-terminated line per append, and `jsonl-journal.md` says a torn tail is
     tolerated.

2. **Reads withhold an unterminated final line.**
   - Test: `Watcher.test.ts:69` (a query during a torn external tail returns
     the completed history), `Journal.regressions.test.ts:237` (a seeded
     LF-less terminal leaves `quiescent` false until its LF lands), `:631` (an
     invalid UTF-8 suffix is withheld until its LF). Extends upstream
     `__test__/Journal.test.ts:351`.
   - Upstream: a torn object prefix makes `query()` fail `MalformedLine`
     ("unterminated final line at byte offset 84") and ends a cursor replay, so
     that subscriber never sees the completed record. A complete envelope that
     lacks its LF is emitted by `query()`, seeds `latest` with
     `terminated: false`, and, when terminal, makes `quiescent` true before the
     writer finishes. This is upstream's stated design: the `MalformedLine` TSDoc
     (`src/JsonlError.ts:23`) calls an unterminated tail the expected steady
     state of a live journal, which reads report through the typed channel, and
     `Line.lastValid` accepts a parseable unterminated final line
     (`__test__/Line.test.ts:327`).
   - Lab: on the journal's read and seed paths an unterminated suffix is never
     a committed record. `query` and the replay return only LF-terminated
     records, `latest` and `quiescent` follow the last terminated record, and
     the `changes()` stream delivers the record from its live tail once the LF
     lands. The pure `Line` layer is unchanged, and upstream `__test__/Line.test.ts:327` still
     holds.
   - Reason: `upstream-bug:` (a) probe 04: a cursor replay dies on bytes that
     upstream's own ingest (`decodeRange`) tolerates, so whether a subscriber
     survives depends on timing; (b) a record that `query()` and `latest`
     report as present (probe 05: the LF-less envelope at
     `[84, 167, terminated: false]`) turns into a `MalformedLine` hole once the
     next append fuses it (probe 01, third tail); (c) `jsonl-journal.md` says a
     torn tail is tolerated, and upstream `CLAUDE.md` says the offset holds
     until the line completes.

3. **The seed cursor stops at the last complete record.**
   - Test: `Journal.regressions.test.ts:280` (growth after the seed read
     reaches `latest`), `:237` (a seeded torn record, completed by its writer,
     reaches a cursor reader; in the Unicode case the reader, not `latest`,
     tells record 1 from record 2). Extends upstream
     `__test__/Watcher.test.ts:224`.
   - Upstream: after the seed read, layer construction sets the consumed cursor
     from the stat EOF (`src/Journal.ts:930`), inside a half-written foreign
     record. When the writer completes it, the remainder decodes as a malformed
     fragment and is skipped: `latest` stays at record 1 and subscribers never
     receive record 2.
   - Lab: the consumed cursor starts at the end of the last complete seeded
     record, so the completed record is ingested, published and becomes
     `latest`.
   - Reason: `upstream-bug:` probe 04 (a local append after completion
     publishes `[3]` upstream and `[2, 3]` in the lab) and probe 28 (the `:280`
     scenario: upstream `latest` stays at round 1 permanently). Upstream
     `CLAUDE.md` says the offset holds until the line completes.

4. **File identity is sampled at construction.**
   - Test: `Journal.regressions.test.ts:413` (the file is replaced during the
     seed read, a stricter window than the probe's post-build one; a live reader
     fails `JournalResync { reason: "replaced" }` and later appends land on the
     current file). Extends upstream `__test__/Watcher.test.ts:271`.
   - Upstream: records identity (`dev:ino`) at watcher activation, as
     `jsonl-journal.md` describes. A larger replacement that lands between layer
     build and the first catch-up is ingested as growth: the subscriber receives
     only record 8 (at offset 91, or 88 when the original had a BOM), record 7 is
     dropped, and no `JournalResync` is raised.
   - Lab: moves identity capture to construction on purpose, before the seed
     read, so the same replacement fails live subscribers with
     `JournalResync { reason: "replaced", expected: 84, actual: 182 }`.
   - Reason: `upstream-bug:` probe 03b shows record 7 dropped without a signal.
     `jsonl-journal.md` requires a shrink or replacement to raise a typed resync
     rather than reconcile silently.

5. **Append reads completed foreign records first.**
   - Test: `Journal.regressions.test.ts:17` (the patch derives from the foreign
     snapshot), `:35` (an append after a foreign terminal fails
     `TerminalViolation`, writes nothing, publishes the terminal and sets
     `quiescent`), `:58` (an invalid patch still publishes the foreign record to
     subscribers; that it also becomes `latest` is shown only by probe 02).
     Extends upstream `__test__/Journal.test.ts:235` and `:276`.
   - Upstream: `append` and `appendPatch` read the in-memory `latest`, which
     lags a completed foreign record the watcher has not ingested yet.
     `appendPatch` merges onto the stale base (`{ round: 11, label: "old" }`,
     losing the foreign label); an append after a foreign terminal succeeds and
     leaves the file as `ended, noted` with `quiescent` false; a failing append
     publishes nothing.
   - Lab: under the write permit, the append first ingests completed foreign
     records, then derives or checks. The patch inherits the foreign snapshot
     (`label: "foreign"`), an append after a terminal fails `TerminalViolation`
     with no bytes written, and foreign records are published even when the
     append fails.
   - Reason: `upstream-bug:` probe 02. `jsonl-journal.md` says `appendPatch`
     runs its read-merge-validate-append sequence atomically under the append
     permit, and that appending after a terminal event fails typed.
   - Note: ingestion runs under the write permit instead of upstream's separate
     ingest permit, with one catch-up read per local append. Probes 02, 06 and
     16 show no output difference, so the change costs latency only. It does
     reverse the `jsonl-journal.md` rationale for a separate permit: a slow
     catch-up read of a large file can now delay an append.

6. **Append surfaces truncation and replacement.**
   - Test: `Journal.regressions.test.ts:396` (an append after a BOM'd file is
     replaced by an empty one fails `JournalResync { reason: "replaced",
     actual: 0 }`, and the next append lands at offset 0),
     `Journal.edges.test.ts:293` (an append after remove-and-recreate fails
     `JournalResync`), `JournalDeviations.test.ts:209` (with the watcher stopped,
     an append after a truncation fails `JournalResync`, logged with
     `reason: "truncated"`). Extends upstream `__test__/Watcher.test.ts:250`.
   - Upstream: when a local append is the next operation after a truncation, it
     succeeds at offset 0 and no `JournalResync` is ever raised. After a BOM'd
     journal is replaced by an empty file, the append returns offset −3.
   - Lab: the append reconciles first and fails `JournalResync` (probe 03:
     truncated, expected 168, actual 0), publishes the same failure to
     subscribers, and resets to the current file; the next append succeeds at
     offset 0. Publication to subscribers on the append path is shown by probes
     03 and 03b, not by a test. When the watcher sees the change first (probe 03,
     rename-over then append), both sides behave the same.
   - Reason: `upstream-bug:` probes 03 and 03b. Upstream `CLAUDE.md` says
     truncation or replacement beneath a reader fails typed as `JournalResync`,
     and −3 is not a valid byte cursor.

7. **Byte counts are never negative.**
   - Test: `Journal.regressions.test.ts:396` (`actual: 0` for a BOM'd file
     replaced by an empty one), `Helpers.test.ts:263` (`ByteCount`, `LineSlice`
     and `TailWindow` byte fields reject −1, 1.5, NaN and Infinity), `:280` (a
     stale BOM probe on a shrunken file yields a zero-size window),
     `ErrorDeviations.test.ts:198` (`JournalResync.expected` and `actual` reject
     −3 and 1.5; the control at `:202` accepts 0). Extends upstream
     `__test__/JsonlError.test.ts:84`.
   - Upstream: a BOM'd journal truncated to zero bytes reports
     `JournalResync { expected: 84, actual: -3 }`, and `LineSlice` and
     `JournalResync` construct with negative or fractional numbers.
   - Lab: the BOM is re-probed after a shrink or replacement (`actual: 0`).
     Offsets, lengths and sizes are `ByteCount`, so negative or fractional values
     fail at construction. The watcher-driven truncation-to-zero case is shown by
     probe 03 only.
   - Reason: `upstream-bug:` probes 03 (`actual: -3`), 03b (append offset −3)
     and 14 (constructors accept −3). `law:17` models the constraint as the named
     `ByteCount` schema.

8. **Post-write growth fails typed.**
   - Test: `Journal.regressions.test.ts:181`. No upstream test; the race is
     named only in `jsonl-journal.md`.
   - Upstream: a foreign record lands between our `writeAll` and our `fstat`.
     The append reports offset 87 for a line at 0, publishes our line twice
     (`[0, 84]` and `[87, 171]`) and never publishes the foreign record.
   - Lab: fails `JournalWriteConflict { expected: 84, actual: 171 }`. The bytes
     may be on disk, and the consumed cursor stays at the known boundary. The
     next append publishes rounds 1, 2 and 3 in file order with contiguous
     offsets.
   - Reason: `upstream-bug:` probe 06 reproduces all three consequences that
     `jsonl-journal.md` lists under "A residual TOCTOU". Upstream declines
     detection because a read-back costs one extra read per append. The lab
     check adds no read: it compares the size from the `fstat` that upstream
     already performs on its own handle with the expected end
     (`actual !== state.size + bytes.length`).

9. **UTF-8 is decoded strictly.**
   - Test: `Journal.regressions.test.ts:486` (layer construction), `:495`
     (`query` and `append`), `:514` (a live subscriber), `Helpers.test.ts:189`
     (range and tail reads). No upstream test.
   - Upstream: invalid bytes decode to U+FFFD. The payload changes silently and
     every later offset is inflated (record 3 is reported at 167 but sits at
     165), so `query({ cursor: 167 })` skips record 3.
   - Lab: decoding is fatal. Layer construction, `query`, `append` and live
     subscribers fail `InvalidUtf8 { path, offset }`, and the file is not
     modified. `offset` is the physical start of the decoded range, not the
     position of the bad byte.
   - Reason: `upstream-bug:` probe 08. Offsets are persisted UTF-8 byte cursors
     (upstream `LineSlice` TSDoc), and lossy decoding breaks that
     correspondence.

10. **A BOM that appears after construction stays logical.**
    - Test: `Journal.regressions.test.ts:171`. Extends upstream
      `__test__/Journal.test.ts:732`.
    - Upstream: probes the BOM only at construction. When a missing journal
      later appears with a BOM, `append` returns 87 for a record that `query()`
      reports at 84, and `query({ cursor: 87 })` reports it at 87. `query()`
      reports 84 only because the default `TextDecoder` strips the BOM while the
      recorded BOM width is still 0.
    - Lab: re-probes the BOM for each read and reconciliation. `append` and
      `query` both report 84.
    - Reason: `upstream-bug:` probe 07. `jsonl-journal.md` says offsets are
      logical post-BOM on every path.

11. **A non-leading U+FEFF is content.**
    - Test: `JournalDeviations.test.ts:43` (`query()` and `query({ cursor })` at
      a U+FEFF-led line both fail `MalformedLine` at its offset), `:58`
      (ingestion skips a foreign U+FEFF-led record, and the next local append
      keeps its physical offset), `Helpers.test.ts:155` (window and range text
      keep a leading U+FEFF). Extends upstream `__test__/Journal.test.ts:379`.
    - Upstream: the default `TextDecoder` strips a U+FEFF at the start of every
      decoded window or range. `query({ cursor: 84 })` at a U+FEFF-led line
      decodes it and reports record 3 at 168 (physically 171), while `query()`
      fails `MalformedLine` at 84. A foreign U+FEFF-led record is published with
      end 171 although the next record starts at 174.
    - Lab: decoding uses `ignoreBOM`, so the line is `MalformedLine` on every
      read path, ingestion skips it, and offsets tile.
    - Reason: `upstream-bug:` probe 17. `jsonl-journal.md` says a BOM code point
      anywhere other than the start of the file is content.

12. **Historical reads use one sampled range.**
    - Test: `Journal.regressions.test.ts:133` (an append injected between
      sampling and reading moves neither end of `query` or the replay, with and
      without a BOM). Extends upstream `__test__/ReadSurfaces.test.ts:110`.
    - Upstream: `readFrom` stats, then `readTail` stats again and reads the last
      N bytes of the new size. An append between the two shifts the window:
      `query({ cursor: 0 })` returns `[2, 3]` instead of `[1, 2]`, and
      `query({ cursor: 84 })` returns `[3]` instead of `[2]`.
    - Lab: samples one `[cursor, EOF)` byte interval per read and returns
      `[1, 2]` and `[2]`. The interval is fixed against appends; Deviation 13
      covers replacement and truncation during the read.
    - Reason: `upstream-bug:` probe 09. `jsonl-slice.md` promises a resumed
      consumer exactly the unprocessed remainder, with no gap.

13. **A paged historical read pins the sampled file; a truncation beneath it
    fails typed.**
    - Test: `JournalDeviations.test.ts:242` (a `query` truncated mid-read emits
      a contiguous prefix of rounds, then fails `JournalResync { reason:
      "truncated", expected: <sampled size>, actual: 0 }`), `:267` (the replay
      half of `changes({ cursor })` fails the same way), `:284` (a file renamed
      over the path mid-read: the query returns all 300 sampled records, as
      upstream does), `:304` (a replacement between sampling and opening fails
      `JournalResync { reason: "replaced" }`). No upstream test changes a file
      beneath a read.
    - Upstream: `readFrom` reads the whole sampled region in one allocation and
      buffers the matches. A truncation or replacement after sampling still
      returns every sampled record (probe 26: 2000 old records), and an unsliced
      `query()` holds the whole journal in memory.
    - Lab: samples the range, opens the file once, checks that handle's
      `dev:ino` against the sample, and reads every page through that handle
      (`internal/tail.ts` `readSampledWindow`). Memory follows page and record
      size. A replacement cannot reach the pinned handle, so the read returns the
      sampled history. A page shorter than the sample fails `JournalResync`
      (truncated; `actual` is the handle size minus the sampled BOM) after the
      earlier pages were emitted (probe 26 rerun: 97 records, then
      `JournalResync`).
    - Reason: `upstream-bug:` upstream names the whole-region read as an open
      defect (upstream `CLAUDE.md:94` and the `query` TSDoc at
      `src/Journal.ts:141`, spencerbeggs/effected#233). Paging fixes the memory
      bound but cannot return bytes a truncation removed, so the lab fails typed.
      Before the handle was pinned, the paged read ended early without an error
      after a truncation and spliced 1903 new records after 97 old ones after a
      rename-over (probe 26).

14. **Capacity is a positive integer.**
    - Test: `Journal.regressions.test.ts:102` (0, −1, 1.5, NaN and Infinity each
      fail with the `InvalidJournalConfig` tag). No upstream test.
    - Upstream: capacity 0 or −1 dies during layer build with an untyped defect
      ("Cannot construct PubSub with capacity of 0"), although the layer's error
      channel is `PlatformError`; 1.5, NaN and Infinity are accepted.
    - Lab: all five fail `InvalidJournalConfig` before any resource is
      allocated, because the configuration is decoded before the engine is
      built. The test pins the tag, not the carried schema issue.
    - Reason: `law:7` (typed errors), `law:EF-3` (decode input at the boundary)
      and `law:17` (capacity is the named `JournalCapacity` schema).
      `upstream-bug:` probe 11 shows capacity 0 escaping as a defect.

15. **A shutdown timeout that Effect cannot convert fails at construction.**
    - Test: `JournalDeviations.test.ts:151` (`"1e3 seconds"`, `[1e300, 0]` and
      `{ seconds: 1e300, nanoseconds: 1 }` each fail `InvalidJournalConfig`),
      `:163` (property: a generated `Duration.Input` builds a journal exactly
      when `Duration.fromInput` converts it). No upstream test.
    - Upstream: accepts these values, which its `Duration.Input` type admits
      (`"1e3 seconds"` fits the number-and-unit template; the tuple and object
      are well shaped). It builds the journal and appends, then dies when the
      scope closes, because the shutdown finalizer throws
      `Invalid Input: 1e3 seconds` or `RangeError: Not an integer`.
    - Lab: decodes `shutdownPublishTimeout` into a `Duration` while decoding the
      configuration, so an unconvertible input fails `InvalidJournalConfig`
      before any resource is allocated. Every convertible `Duration.Input`
      (`100`, `"100 millis"`, a `Duration`) is accepted, as upstream accepts it
      (`JournalDeviations.test.ts:120`).
    - Reason: `upstream-bug:` probe 29 (`29-unconvertible-timeout`): a value the
      configuration type admits escapes as a defect from a scope finalizer,
      after the journal has been used, instead of failing the typed layer
      channel. The decode is an `S.decodeTo` with a `SchemaTransformation`
      (`law:13`).

16. **Read selections are decoded.**
    - Test: `Journal.regressions.test.ts:113` (cursor −1, 1.5, NaN and Infinity
      fail `InvalidSlice` on `query`, `changes` and `projection`),
      `JournalDeviations.test.ts:192` (an untyped `from: "2026-01-01"` fails
      `InvalidSlice` on all three), `Helpers.test.ts:56` (the slice schemas
      reject −1 and 1.5). No upstream test.
    - Upstream: cursor −1 replays everything; 1.5 and NaN die with
      `RangeError: Not an integer`; Infinity returns nothing; an untyped `from`
      string matches every record.
    - Lab: `query`, `changes` and `projection` fail `InvalidSlice` with the
      schema issue before a subscription or file read. Explicit `undefined` keys
      select what omitted keys select, as upstream.
    - Reason: `law:7` and `law:EF-3`. `upstream-bug:` probe 12 shows `RangeError`
      defects escaping the typed channel.

17. **Append validates the round trip before writing.**
    - Test: `Journal.edges.test.ts:120` (a lossy `S.Uint8Array` payload fails
      `InvalidData` with no bytes written and `latest` empty),
      `Envelope.test.ts:258` (`Envelope.encodeResult` rejects an untyped
      `scope: 42` with `InvalidData` for its event). Extends upstream
      `__test__/Envelope.test.ts:328`.
    - Upstream: `append` writes the encoded line and only then decodes it
      (`src/Journal.ts:519` to `:566`). When the decode fails (an `S.Uint8Array`
      payload, or `scope: 42` from an untyped caller), the append fails
      `InvalidData`, but the line stays on disk and every later `query()` fails
      at it. `Envelope.encodeResult` emits `"scope":42`, which its own
      `decodeResult` rejects.
    - Lab: `append` encodes and decodes the line before opening the file, so it
      fails `InvalidData` with zero bytes written. `Envelope.encodeResult`
      checks the scope after the payload and the timestamp, which keep
      upstream's order, and rejects `scope: 42`.
    - Reason: `upstream-bug:` probes 13 and 19. Upstream corrupts its own
      journal (a later `query()` fails `InvalidData` at offset 81) and encodes
      frames its own decoder rejects.

18. **`UnserializableData` carries the schema codec failure.**
    - Test: `Envelope.test.ts:206` (bigint and circular payloads: the `cause` is
      a `SchemaError` whose message is "Expected a JSON-serializable value", and
      the full error message is pinned). Adjusts upstream
      `__test__/Envelope.test.ts:379` and `:387`, which assert
      `cause instanceOf TypeError`.
    - Upstream: `cause` is the `TypeError` that `JSON.stringify` throws, and the
      message detail names BigInt, the cycle, or the throwing getter's own
      message.
    - Lab: `cause` is the `SchemaError` from `S.fromJsonString(S.Unknown)`, and
      the message detail is "Expected a JSON-serializable value". This is the
      only `JsonlError` message text that differs from upstream for the same
      input.
    - Reason: `law:EF-19` (JSON goes through schema codecs, never
      `JSON.stringify`) and `law:EF-3`.

19. **Envelope Effect forms are lazy.**
    - Test: `EnvelopeDeviations.test.ts:151` (a payload mutated after
      `Envelope.encode` is built, in both the direct and the piped form, is
      emitted with its run-time value), `:163` (a throwing getter on an
      `S.Struct` payload: building the Effect does not throw, and running it
      dies). Upstream `__test__/Envelope.test.ts:454` (encode agrees with
      `encodeResult`) still holds.
    - Upstream: `Envelope.encode` and `decode` evaluate their `Result` when the
      Effect is built. A payload mutated afterwards is ignored, and an `S.Struct`
      payload with a throwing getter throws at construction, outside any fiber.
    - Lab: `Effect.fn` evaluates when the Effect runs. The run-time value is
      emitted, and the same getter dies inside the fiber.
    - Reason: `law:22` and `law:EF-14` (Effect-returning functions use
      `Effect.fn`). `upstream-bug:` probe 23 reproduces the construction-time
      throw that upstream's own test calls a trap
      (`__test__/Envelope.test.ts:398`: merely building the Effect must be
      safe).

20. **A file that vanishes during the seed is a missing journal.**
    - Test: `Journal.edges.test.ts:227`. No upstream test.
    - Upstream: when the file disappears after the existence check, the seed
      read's `JournalNotFound` is caught but the following `stat` is not
      (`src/Journal.ts:929` and `:930`), so layer construction fails
      `PlatformError` (`NotFound`, method `stat`).
    - Lab: constructs a missing journal: `latest` is empty, `append` fails
      `JournalNotFound`, and after `create` an append lands at offset 0.
    - Reason: `upstream-bug:` probe 21. `jsonl-journal.md` says layer
      construction never fails on a missing journal file, and upstream's own
      comment allows the file to vanish between the check and the read.

21. **Error names carry the lab identity.**
    - Test: `ErrorDeviations.test.ts:82`.
    - Upstream: `name`, `String(error)` and the first line of `Cause.pretty` use
      the tag: `MalformedLine: JSONL malformed line at byte offset 12`.
    - Lab: they use the `$ScratchpadId` identity:
      `@beep/scratchpad/effected/jsonl/JsonlError/MalformedLine: JSONL malformed line at byte offset 12`.
      `_tag` and the message text are unchanged.
    - Reason: `law:D5` (`$ScratchpadId` identity on every exported error) and
      `law:EF-12`. The identifier-keyed error declaration of
      `.patterns/error-handling.md` makes the identifier the error name.

22. **`message` is an own field.**
    - Test: `ErrorDeviations.test.ts:186` (for both `MalformedLine` branches,
      both `InvalidData` branches and every other member: `message` is an own
      field, the prototype declares no `message` accessor, and the text is
      exact), `:177` (the table covers every `JsonlError` case, so a new member
      fails until it is pinned).
    - Upstream: `message` is a prototype getter. `Object.keys(error)` is
      `["_tag"]`, and `JSON.stringify(error)` has no `message` key.
    - Lab: `message` is an own enumerable field, initialized after the schema
      fields. It appears in `Object.keys` and in `JSON.stringify(error)`. Given
      the same fields, the text matches upstream (Deviation 18 aside).
    - Reason: `upstream-bug:` probes 25b, 25c and 29
      (`29-d25-bun-prepare-stack-members`). Under Bun 1.4.2 with an
      `Error.prepareStackTrace` hook that reads `message` (the shape source-map
      and reporter hooks take), Bun runs the hook during base construction.
      Upstream's getter-based `MalformedLine`, `UnknownEvent` and `InvalidData`
      then throw at construction (`undefined is not an object` while evaluating
      `this.line.terminated`, `this.line.offset` or `fa._tag`); all 13 lab
      members construct. Upstream's own `__test__/JsonlError.test.ts` header
      names this hazard: a `message` that throws inside a reporter makes the
      failure unreadable. Node 24 runs the hook lazily (probe 25c), so the Node
      vitest gate cannot reproduce the throw. The Bun evidence is advisory under
      D16, and the Node test pins the shape. Without the hook both sides render
      identical messages. One cosmetic residue remains: under the hook, the stack
      head of the lab's three line-carrying members shows the hook's prefix with
      an empty message, because Bun runs the hook before the own field is
      assigned; nothing throws. This departs from the `override get message()`
      pattern in `.patterns/error-handling.md`.

23. **Resync and watcher shutdown are logged.**
    - Test: `JournalDeviations.test.ts:209` (a capturing logger records exactly
      two WARN lines, in order, with their annotations).
    - Upstream: silent. `JournalResync` is only published to the hub, and the
      watcher supervisor stops re-arming without a signal.
    - Lab: `Effect.logWarning` emits "Journal watcher stopped after immediate
      completions" with `{ path, rearms }` and "Journal source requires
      resynchronization" with `{ path, reason, expected, actual }`.
    - Reason: `law:EF-15` (effects are observable through logs and annotations
      on key workflows).

Restored to upstream during the retrofit (these earlier lab deviations had no
allowed cause and were reverted; each test now pins upstream's behaviour):

- **Future live cursor.** `changes({ cursor })` compares the cursor at-or-after
  a line's start on both halves, as `jsonl-slice.md` specifies, instead of
  clamping it to the sampled EOF (`Journal.regressions.test.ts:608`; probe 10
  rerun matches upstream).
- **Explicit `undefined`.** `JournalConfig`, `Slice` and `CursoredSlice` keys and
  the `Envelope.encode` and `encodeResult` scope treat an explicit `undefined` as
  omission (`Properties.test.ts:319`, `JournalDeviations.test.ts:75` and `:93`,
  `EnvelopeDeviations.test.ts:182`, `Envelope.test.ts:270`; probes 11 and 12
  rerun identical). The remaining type-level difference, the exact optional
  `AppendOptions` scope, is listed under Added exports.
- **`shutdownPublishTimeout` input.** Every convertible `Duration.Input` is
  accepted again (`JournalDeviations.test.ts:120`). Only the unconvertible case
  remains (Deviation 15).
- **`InvalidData` issue paths.** Payload failures are rooted at `data` again, and
  an invalid encoder timestamp carries no path; messages match upstream
  (`EnvelopeDeviations.test.ts:44`, `:82`, `:91`, `:136`; probe 29
  `29-envelope-issue-paths`: 24 cases, byte-identical apart from Deviation 17's
  scope check).
- **Error constructor defaults.** `UnknownEvent.known` and `InvalidData.event`
  are required again (`ErrorDeviations.test.ts:46`, `:55`, `:64`, `:72`).

### Dependency backlog

None. Upstream has zero runtime dependencies (`effect` is its only peer). At
runtime the port imports only `effect` and the workspace packages
`@beep/identity`, `@beep/schema` and `@beep/utils`. Tests use
`@beep/test-utils/MemoryFileSystem` instead of `@effected/memfs` (D14) and
`@beep/fc-runs` for property run counts, and the integration group uses
`@effect/platform-node`, which scratchpad already depends on.
