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

Optional configuration and slice keys accept omission, not explicit `undefined`.
`shutdownPublishTimeout` accepts an Effect `Duration` value.

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

A live read whose cursor is beyond the sampled EOF starts from that EOF and
receives later appends. A finite query beyond EOF returns an empty stream.

Independent writers do not share an instance's semaphore. If the file size after
a write cannot establish the expected position, the operation fails with
`JournalWriteConflict` instead of returning a guessed cursor. Its bytes may already
be on disk. Reconcile the file before deciding whether another write is needed;
do not automatically retry that failure. Subsequent ingestion reads from the last
known boundary. Applications requiring atomic patch transactions across processes
must supply their own shared writer coordination.

Layer configuration is validated before resources are allocated. Invalid capacity
values fail with `InvalidJournalConfig`; invalid read selections, including negative
or fractional cursors, fail with `InvalidSlice`. Both retain the structured schema
failure. Omitted capacity and shutdown timeout keep their documented defaults.

## Focused validation

Run these from the repository root:

```sh
bun run --cwd scratchpad audit:jsonl
```

The manifest also exposes each check independently:

```sh
bun run --cwd scratchpad check:jsonl
bun run --cwd scratchpad lint:jsonl
bun run --cwd scratchpad test:jsonl
bun run --cwd scratchpad coverage:jsonl
bun run --cwd scratchpad docgen:jsonl
```

Dedicated module documentation uses `scratchpad/docgen.jsonl.json`. Its paths
are relative to the scratchpad package directory.
Generated Markdown and compiled examples stay under the ignored
`.jsdoc-loop/generated-docs/jsonl/` directory. The source glob only includes the
JSONL module. No unrelated ontology aliases or generated manifest scripts are
needed.

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
| `EnvelopeTypes.test.ts` | Original facade tests retain tag/payload correlation, Self identity, lifecycle literal types and filtered-read narrowing; compile-negative cases also cover exact optional keys. |
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
`coverage/scratchpad-jsonl/`. Error messages initialize after schema fields, because Bun
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
