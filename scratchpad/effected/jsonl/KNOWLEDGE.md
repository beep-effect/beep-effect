# jsonl — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/jsonl/CLAUDE.md -->
# CLAUDE.md — @effected/jsonl

Append-only, schema-validated JSONL journals exposed as a definable Effect
service: a pure synchronous core usable from a hook script with no runtime,
under one `Journal` service whose scoped layer watches the file for external
appends and cross-observes another instance over the same path.

**Design doc:** `@./okf/modules/jsonl.md` — load
before changing behavior; it is the contract this package implements and the
entry point to two children:

- `@./okf/interfaces/jsonl-journal.md` — Load when:
  changing the append primitive, atomicity, the publish stage, shutdown
  refusal/drain, or the cooperative-writer process model.
- `@./okf/interfaces/jsonl-slice.md` — Load when: working
  on `Slice`, `query`/`changes`/`projection`, or the read economy.

## Tier: boundary

`effect` is the only peer. **Zero runtime dependencies, zero `@effected/*`
edges.** `FileSystem` is required in `R`; `Path` is not — paths are opaque
strings handed straight to `FileSystem`, and this package never joins,
resolves or splits one. `@effect/platform-node` is a devDependency, for the
integration suite only. Core `PlatformError` passes through every write and
read path **untranslated** rather than being wrapped.

## Module map (one concept per module)

- **`Line`** — the pure, synchronous line layer: `split` (byte-exact offsets,
  CRLF-aware, no phantom trailing empty line), `parseResult` (one line's JSON,
  never throws), `parseAll`, `consumedOffset` and `lastValid` (walk back to the
  last line that parses as JSON). Knows JSON, not envelopes — a malformed
  *envelope* and a malformed *line* stay distinguishable failures one layer up.
- **`LineSlice`** — one candidate line's text plus its **UTF-8 byte** offsets
  (`offset`, `end`, `length`, `terminated`). Every cursor this package hands
  out is in this unit, never `String.length`, because these values persist
  across process restarts as `FileSystem.stream`'s `offset` option.
- **`internal/utf8.ts`** — the UTF-8 byte-length primitive `LineSlice`/`Line`
  build on; not exported.
- **`Envelope`** / **`EnvelopeFrame`** — the envelope layer, in two decode
  stages: `EnvelopeFrame` (a `Schema.Struct`, `data` left as `Schema.Unknown`)
  is stage one and is what every filter reads; stage two
  (`completeResult`, internal) runs the registry's payload schema only for
  frames a `Slice` has already selected. `Envelope.decodeResult` /
  `encodeResult` / `lastValidResult` are the sync primitives; `Envelope.decode`
  / `encode` are one-line `Effect.fromResult` lifts of the same code, so the
  two forms cannot drift. **`Envelope.lastValidResult` — not `Line.lastValid`
  — is the binding definition of "the journal's current state"**: a torn
  *scalar* tail (`42` cut mid-write leaves `4`) parses as valid, different
  JSON, and only the envelope contract (every envelope is an object) catches
  it.
- **`JsonlEvent`** — `JsonlEvent.make(tag, { data, terminal?, reopen? })` and
  the `JsonlEvent.Registry`/`Tag`/`Data`/`TerminalTags`/`ReopenTags` type-level
  helpers a registry's array literal carries. `DataSchema` bounds a payload to
  `Schema.Codec<unknown, unknown, never, never>` — no services in either
  direction — so a schema needing a service fails at **registration**, not at
  some later call site, and the pure core's synchronous codecs stay possible.
- **`Slice`** / `CursoredSlice` — the one filter shape every read surface
  takes: `events?`, `scopes?`, `from?` (inclusive), `to?` (exclusive, so
  adjacent windows tile without double-delivery), plus `cursor?` for resuming.
  `matchesFrame` (`@internal`) takes the **frame**, never a decoded envelope —
  that is the type-level enforcement of filter-before-decode.
- **`JsonlError`** — the eight-tag error taxonomy (below).
- **`Journal`** — the one service, generic over a registry:
  `Journal.Service<Self>()(id, { events })` produces a per-registry class whose
  `.layer(config)` builds a scoped
  `Layer<Self, PlatformError, FileSystem.FileSystem>` — a **missing** journal
  constructs cleanly (decision 10), an **unreadable** one fails typed.
  Exposes `append`, `appendPatch`, `latest` (`SubscriptionRef` of
  `Option<Envelope>`), `quiescent`, `query`, `changes`, `projection`, `create`,
  `remove`. **Bind `.layer(...)`'s result to a const and provide that const** —
  calling it twice mints two independent journals (two semaphores, two hubs,
  two `latest` refs) over the same file, unserialized against each other.
  `JournalShape.hub` is **published but unsupported**: an `@internal` tag is
  decorative on an interface member (API Extractor honours release tags on
  top-level declarations only), so it ships in the `.d.ts` deliberately as the
  seam the read surfaces are built on — not as consumer API.
- **`internal/merge.ts`** — `appendPatch`'s **shallow** merge, ported from
  `@effected/config-file`'s `internal/deepMerge.ts` recipe minus the
  recursion. Same prototype-pollution discipline: `Object.defineProperty`
  only, never assignment or `Object.assign`, `__proto__`/`constructor`/
  `prototype` filtered from both sides. `canMerge` is **asymmetric** (unlike
  config-file's symmetric version): the patch is a caller-supplied partial
  literal even when the base is a decoded `Schema.Class` instance, so a
  same-prototype requirement would reject the case that matters most.
- **`internal/tail.ts`** — bounded-window file reads (`readTail`,
  `readTailUntil`, `readRangeText`, `probeBomBytes`): the mechanism that keeps
  **`latest` and the `lastValid`-backed reads** costing the size of the answer,
  not the age of the journal. Never exported. **`query` and the replay half of
  `changes` are NOT window-bounded as built** — `Journal`'s `readFrom` reads its
  whole requested region (`cursor` to end of file) in one allocation and buffers
  the matches, so an unsliced `query()` over a large journal does hold it in
  memory. That is stated in the TSDoc rather than implied away; paging it is
  spencerbeggs/effected#233, not a claim the package currently makes.

## The envelope contract

Every line: `{"at":"...","event":"...","scope"?:"...","data":...}`. `at` is
**service-assigned** from the Effect `Clock` at append time — never
caller-supplied — so `TestClock` controls it exactly and two writers never
disagree about ordering. `scope` is a partition key with no further semantics.
`data` is required on the wire; a `Schema.Void` payload still emits
`"data":null` (`JSON.stringify` drops `undefined`-valued keys, and JSON has no
`undefined` — `null` is its spelling of absence), so the frame always decodes
a `data` key.

## The cooperative-writer contract

One `writeAll` of a complete, `\n`-terminated line per append, to a handle
opened `{ flag: "a" }` (`O_APPEND`). That single-write discipline **is** the
contract other writers must honor; there is no advisory lock. A torn tail (a
writer caught mid-write) is tolerated: the unterminated fragment is walked
over and the offset holds until the line completes. Truncation or replacement
underneath a reader is **not** repaired — it fails typed as `JournalResync`
(`reason: "truncated" | "replaced"`), because silently resyncing from zero
would paper over a real operational fault. **"Last valid line" always means
the last valid *envelope*, never merely the last valid JSON** — see
`Envelope.lastValidResult` above.

## The error taxonomy (eight tags)

`MalformedLine`, `UnknownEvent`, `InvalidData`, `UnserializableData`,
`TerminalViolation`, `JournalClosed`, `JournalNotFound`, `JournalResync`. Every
tag names a distinct recovery; causes (a `SchemaError`, a `JSON.stringify`
throw) are carried **structurally**, never stringified — `error.issue` and
`error.cause` keep their shape. `PlatformError` is deliberately **not** a
member: IO failures pass through untranslated. `JournalClosed` (scope closing,
a lifecycle fact) and `TerminalViolation` (a terminal tag reached, a
reversible state) are separate tags because their recoveries share nothing.
`JournalResync` is one tag with a `reason` field, not two tags, because
truncation and replacement share the same recovery.

## Testing

`@effect/vitest`, `assert.*` — **never** `expect`. Tests live in `__test__/`
(never co-located in `src/`); integration tests live under
`__test__/integration/` and are the only suite that provides a real platform
layer (`@effect/platform-node`, temp dirs via `makeTempDirectoryScoped`). The
flagship integration test is two `Journal` layers over one file
cross-observing each other's appends through the watcher.

```bash
pnpm vitest run packages/jsonl        # from the repo root
pnpm build --filter @effected/jsonl   # from the repo root
```

Four operational facts that cost real debugging time and are recorded here so
the next session does not rediscover them:

- **Filter with `--project @effected/jsonl` from the repo root, or use the
  vitest-agent MCP `run_tests` tool.** From inside the package vitest does not
  load the root config: `--project` fails with `No projects matched the
  filter` and a positional filter finds no test files.
- **Exit codes lie; only the `Tests:` summary line (or the MCP's structured
  `run_tests` result) is evidence.** A subset run skips the suite's global
  coverage thresholds (the plugin prints `Coverage thresholds skipped:
  partial run`); a test
  that hangs past its timeout can crash the reporter process itself rather
  than reporting a clean failure — and never a grep for `✗`/`FAIL` in console
  output: the format varies by reporter, so a killed mutant reads as a
  survivor.
- **A stale `issues.json` looks identical to a fresh one on `warnings`/
  `errors`.** The tell is the `suppressed` count: this package's prod build
  suppresses exactly 10 `ae-forgotten-export` entries (one `_base` symbol per
  `Schema.Class`/`Schema.TaggedError` factory). A lower count on a build
  you did not just run cold is a stale artifact, not a clean one — force a
  rebuild (`rm -rf dist .turbo && pnpm build --filter @effected/jsonl --force`)
  before trusting it.
- **A consumer under `TestClock` must advance the clock for the shutdown
  drain to fire.** Scope close's finalizer bounds its wait on the publish
  chain with `Effect.timeout` (`shutdownPublishTimeout`, default five
  seconds); under a virtual clock that timeout never elapses on its own; a
  test exercising graceful shutdown must `TestClock.adjust` past the bound or
  the finalizer hangs for the real wall-clock duration instead.

## Build

`savvy.build.ts` carries the narrow `{ messageId: "ae-forgotten-export",
pattern: "_base" }` suppression for the synthesized `Schema.Class` /
`Schema.TaggedError` heritage types. **Never widen it** — an internal type
named on a public signature is a different symbol and stays un-masked.

Gate on `pnpm build --filter @effected/jsonl`, never the raw
`node savvy.build.ts` script, and read `dist/prod/issues.json` rather than
console output.


---
<!-- okf/modules/jsonl.md -->
---
type: Module
title: "@effected/jsonl"
description: Append-only, schema-validated JSONL journals exposed as a definable Effect service — the file as a live object, not a text format.
status: stable
kind: package
resource: ../../packages/jsonl
layer: L1
tags:
  - architecture
generated:
  by: "okfit/claude-code"
  at: 2026-09-30T16:41:19Z
  body_sha256: 1cf2130c954da4654c63883ae0d254924c157a9ee56790dbcbbf57f57a35159a
---

# `@effected/jsonl`

`@effected/jsonl` is append-only, schema-validated JSONL journals exposed as
a definable Effect service: a pure synchronous core usable from a hook
script with no runtime, under one `Journal` service whose scoped layer
watches the file for external appends and cross-observes another instance
over the same path.

## Motivation: the token economy as an API contract

The subject is not the JSONL format — one JSON value per line is a
two-sentence specification. The subject is the file as a live object: a
journal that only ever grows, whose current state is its last valid line,
that several processes read while one writes, whose tail may be torn
mid-append, and that readers want a small filtered slice of rather than the
whole of.

The pressure is AI applications. A JSONL journal is the natural state
format for an agent-adjacent system — human-readable, `jq`-able, greppable,
append-only, diffable in git — and the naive way to consume one is to read
the file and hand it to a model. That is exactly wrong: the whole history
enters the context window to answer a question about the last line, and the
cost grows with the age of the file rather than with the size of the
question. The design goal that follows is stated as an API property rather
than an optimization: **every read surface takes a filter, and filtering
happens on envelope fields.** A consumer that wants "the current state of
mailbox A" pays for the tail of the file, not its history; a consumer
sharing a journal with a noisy neighbour pays nothing for the neighbour's
lines. That is why the [`Slice` vocabulary](../interfaces/jsonl-slice.md) is
the *same* vocabulary on every read surface rather than a convenience on
one of them.

## Kit positioning

**Boundary tier.** `FileSystem` is required in `R`, and `Path` deliberately
is not: the package takes journal paths as given and never joins, resolves
or normalizes one, so requiring `Path` would charge every consumer for a
service it does not use. The one sanctioned piece of path arithmetic —
deriving an activation-watch directory from the journal path — is
separator-agnostic string work on a comparison-and-watch-target only, and
buys no `Path` requirement (see the [journal
interface](../interfaces/jsonl-journal.md#the-watcher-and-activation)).

It owns no IO backend and never imports `node:*`. Zero external runtime
dependencies and zero `@effected/*` edges: the envelope is Effect Schema
over `JSON.parse`, which core already provides.

It is not a format package: `jsonc`, `yaml` and `toml` are pure-tier
parse/edit/format packages whose subject is text and whose obligation is
the [fidelity obligation](../decisions/format-fidelity-obligation.md) — a
round trip must preserve every byte of meaning the author wrote. None of
that applies here. JSONL's grammar is "a JSON value, a newline"; there are
no comments to preserve, no styles to round-trip, no edit model. The
interesting content is ordering, tail semantics, watchers and concurrent
writers — properties of a file, not of a grammar. The closest kin in the
kit is `@effected/config-file`: a pure core under one opinionated service,
where the opinion — there codec × resolver × strategy, here the envelope —
is what makes the package worth having.

Core's `effect/eventlog` was declined as a foundation:
it is a replication-oriented event-sourcing system (MessagePack-encoded
entries, encryption, SQL-backed journals, remote sync, session auth) — the
right goals for a distributed event log and the wrong goals for a file a
human greps, a hook reads with `jq`, and git diffs in a pull request. What
is borrowed from it is the shape of an event definition: a tag plus a
payload schema, defined once and collected into a group.

## The envelope contract

The one opinion the package imposes: every line is an envelope, and the
payload lives under `data`.

```json
{"at":"2026-08-03T17:04:11.912Z","event":"mail-received","scope":"silk-runtime-action","data":{"round":7}}
```

| Field | Required | Meaning |
| --- | --- | --- |
| `at` | yes | UTC timestamp, assigned by the service at append time from the Effect `Clock`, so `TestClock` controls it in tests. A caller-supplied timestamp would make ordering a lie the moment two writers disagree about the clock. |
| `event` | yes | The string tag: the discriminant of the derived envelope union and the primary filter key. |
| `scope` | no | A partition key with no further semantics — which mailbox, which loop, which run. Cheap to filter on because it sits on the envelope. |
| `data` | yes | The payload, validated by the schema registered for `event`. Never absent; a payload-less event encodes as `null`. |

Consumers declare their events (`JsonlEvent.make`, with `terminal` and
`reopen` markings — `packages/jsonl/src/JsonlEvent.ts`), and the package
derives the union from the registry, so the discriminated union a consumer
reads is exactly the set it declared with no hand-written union to drift.
An unrecognized `event` tag on read is a typed error, never a defect: a
file written by an older or newer version of the same application is
hostile input in the technical sense.

A payload schema may not require services: payload schemas are bounded to a
codec whose decoding and encoding service slots are `never`. This is a
contract, not an implementation detail — it is what makes the pure
synchronous core reachable at all, since the sync `Result`-returning codecs
demand `never` in both slots (a sync function has nowhere to get a service
from). Admitting a service-requiring payload would mean a runtime-free
reader — a `PreToolUse` hook reading one line — could no longer work, and
the failure would land on the consumer's call site rather than on the
library at registration; forbidding it structurally moves the error to
`JsonlEvent.make`, where it is legible.

"Derived discriminated union" needs to be precise about where: the
derivation is at the type level, and the runtime read path is a two-stage
decode. A `Schema.Union` value over full envelopes cannot be the read path,
because discriminating a union decodes `data` eagerly for every line —
inverting the filter-before-decode guarantee while the types still look
right. So the envelope frame decodes first, with `data` left as an
undecoded `unknown` — the frame is what slice filtering reads, and
filtering on `event`, `scope` and `at` never touches the payload — and the
registered payload schema applies on demand, looked up by the frame's tag,
only to the lines a slice selected.

No depth guard ships on the frame decode, deliberately: the frame is
depth-independent by construction (payload passes through untraversed,
pinned by a pathologically deep test), and V8's `JSON.parse` is iterative,
so a deeply nested line does not blow the stack on the way in. A consumer's
own recursive payload schema still makes stage-two decode depth
input-driven, and that risk is deliberately not second-guessed. Where depth
independence stops is a property in its own right: a hostile deep payload
aimed at a known tag pays full decode cost on selection, which is the
intended trade, since you pay only for the lines you selected.

`data` is required; `scope` is optional, and the two are not symmetric:
`JSON.stringify` silently drops keys whose value is `undefined`, so a
`data` field that somehow encoded to `undefined` would emit a frame missing
its required key and be unroundtrippable. Use a void schema for
payload-less events, and a nullable schema where absence must be
representable within the payload.

The envelope is what makes a torn tail detectable: an envelope is always a
JSON object, and every strict prefix of an object text is invalid JSON, so
a half-written envelope always fails to parse and the walk-back always
finds it. A journal of bare scalars has no such property — `42` torn
mid-write is `4`, a perfectly valid line with a silently wrong value. This
is why "the last valid line" always means the last valid *envelope*, never
merely the last valid JSON, throughout the package, and why a generic
"any line schema" reader stays internal: exposing it would make the
envelope optional, and an optional envelope is not a contract.

## Module layout

Module-per-concept, no barrels, no namespace objects. See `packages/jsonl/src/`:

- **The pure core**, synchronous and `Result`-based per the [sync-primitive
  policy](../conventions/sync-primitive-policy.md): `Line.ts` and
  `LineSlice.ts` (split text into candidate lines, parse one, walk back to
  the last valid one, keep byte-offset bookkeeping), plus `Envelope.ts` and
  `JsonlEvent.ts` (event definitions, the registry, the frame schema, the
  derived union type, and the sync decode/encode primitives — each `Effect`
  form defined in terms of its sync twin so the two cannot diverge).
- **The service**: `Journal.ts` — see the [journal
  interface](../interfaces/jsonl-journal.md).
- **The errors**: `JsonlError.ts` — an eight-tag taxonomy (`MalformedLine`,
  `UnknownEvent`, `InvalidData`, `UnserializableData`, `TerminalViolation`,
  `JournalClosed`, `JournalNotFound`, `JournalResync`), each tag naming a
  distinct recovery a caller would actually make, with core `PlatformError`
  passed through rather than wrapped. Two distinctions are load-bearing:
  shutdown refusal (`JournalClosed`) is a lifecycle condition — the service
  is going away, the recovery is a new layer — while a terminal-event
  refusal (`TerminalViolation`) is a journal-state condition — the recovery
  is an event declared `reopen` — and a truncation-or-replacement breach
  (`JournalResync`) is its own tag because its recovery, discard all
  cursor-derived state and re-read from zero, matches nothing else.

Every offset the package emits is a UTF-8 byte offset, never a UTF-16
index, because these values are cursors into a file: they feed the offset
read and get persisted across process restarts. A `String.length`-derived
offset is correct only for ASCII journals and is the single most likely bug
in the line module.

`Envelope` and `JsonlEvent` land as a merged `interface` plus `const`, not
as static classes, because each name is shared with a same-file generic
interface, and merging a class into one of those is a compile error. The
accepted cost is that an object literal's member types are inferred in the
built `.d.ts` and lose their TSDoc, and a bare `{@link}` to either name is
ambiguous and needs the variable-selector form.

## The service is a factory, not a generic key

See [the factory decision](../decisions/jsonl-service-is-a-factory.md) for
the full rationale. In brief: `Journal` cannot be a `Context.Service`
generic over the registry, because `Context.Service` binds a concrete shape
at declaration and the resulting key cannot be parameterized at retrieval.
The kit's answer, already established in `@effected/config-file`, is a
per-registry service-class factory plus a layer-returning function:

```ts
class MailJournal extends Journal.Service<MailJournal>()("dogfood/MailJournal", { events: MailEvents }) {}

// Bind the layer ONCE, at module scope, and provide this const everywhere.
export const layer = MailJournal.layer({ path });
```

The const-binding hazard is inherited with the pattern: layers memoize by
reference, so calling the layer function at each provide site mints two
independent journal instances over one file, each with its own semaphore,
watcher and hub — the appends are no longer serialized against each other,
the in-process version of the bug the cooperative-writer rules exist to
prevent. The library's side is a TSDoc warning and a test; the consumer's
side is the one-line rule above.

## Observability

Per the kit's observability standard: named `Effect.fn` spans on the public
fallible boundaries only — append, query open, watcher resync — and nothing
else. A span per decoded line would cost more than the decode itself. The
library stays telemetry-agnostic; applications compose OpenTelemetry at the
edge.

## Testing

`@effect/vitest`, `assert.*`, never `expect`, tests in
`packages/jsonl/__test__/`, integration under `__test__/integration/`.

Property tests cover line splitting and corrupt tails; the generators must
emit torn final lines, embedded newlines inside string payloads, and lines
that are valid JSON but not valid envelopes, because those are the three
shapes a real journal produces. `TestClock` drives `at` stamping, so
timestamp assertions are exact rather than approximate. Two type-level
guarantees are tested as types, not behaviour: a payload schema requiring
services is a compile error at registration, and a slice's event list
narrows the element type — a runtime-only test would pass while either was
broken. Integration tests run the watcher against real temporary
directories and are the only tests that provide a platform layer (`@effect/platform-node`);
watcher behaviour that does not need a real filesystem runs over an
`@effected/memfs` volume whose `watch` is replaced, through a faults factory,
by a manually driven stream (with `open` wrapped for write and read gates),
so those assertions are deterministic and timer-free while storage, `stat`
identity and `O_APPEND` stay memfs's own. Three concurrency and ordering tests are structurally
incapable of testing what they appear to test unless arranged carefully;
see [what the concurrency tests must
arrange](../interfaces/jsonl-journal.md#what-the-concurrency-tests-must-actually-arrange).

## Non-goals

- Rotation, compaction and retention. Append-only history is the point of
  the format, and a package that rotates has quietly become a log shipper.
- Any binary or encrypted encoding — human-readable and `jq`-able is a
  requirement, not a default.
- A general event-sourcing framework; core's `eventlog` occupies that
  space.
- Locking, leases or any coordination protocol between writers beyond the
  documented one-write-per-line discipline.
- Querying by anything other than envelope fields. A payload-content query
  would force a payload decode per line and dismantle the filtering
  guarantee the package is built on.

See the [journal interface](../interfaces/jsonl-journal.md), the [slice
interface](../interfaces/jsonl-slice.md) and the [journal-wide terminal
semantics limitation](../limitations/jsonl-terminal-semantics-journal-wide.md)
for the write half, the read half and the one known limitation,
respectively.


---
<!-- okf/interfaces/jsonl-journal.md -->
---
type: Interface
title: "@effected/jsonl journal service"
description: The write half of @effected/jsonl — append, atomicity, publish ordering, shutdown, and the cooperative-writer process model with its watcher.
status: stable
kind: api
resource: ../../packages/jsonl/src/Journal.ts
tags:
  - architecture
generated:
  by: "okfit/claude-code"
  at: 2026-09-30T16:41:19Z
  body_sha256: 8ef0cd60ff92a72dc498d2cfe0c80f4ca75fe77b772c2552a880f23320081f03
verified:
  - by: human:spencer
    at: 2026-09-24T00:11:37.064Z
---

# `@effected/jsonl` journal service

The journal service is the write half of the [jsonl module](../modules/jsonl.md):
the operations, the write critical section and the ordering that hangs off
it, lifecycle and shutdown, and the process model that lets several
cooperating writers share one file. What it guarantees is the property
every reader depends on — an appended line is complete, validated against
its event's schema, ordered against every other writer's, and observable to
them once it lands.

The service is one class per registry (see the [factory
decision](../decisions/jsonl-service-is-a-factory.md)); its layer takes a
config of a path plus three optionals — the activation-watch directory, the
hub capacity, and the shutdown drain bound — and its lifecycle is scoped.
The layer's error channel is `PlatformError`: a missing journal constructs
cleanly, an unreadable one fails typed.

## Operations

- **`append`** validates against the event's registered schema, encodes,
  then writes the complete line to a handle opened for append, under the
  terms in [the append primitive](#the-append-primitive-and-what-atomicity-actually-means).
  In-process concurrency is serialized by a one-permit semaphore. Appending
  after a terminal event fails typed unless the appended event is declared
  `reopen`, and appending to a journal that does not exist fails typed — an
  append never creates the file.
- **`appendPatch`** is inherit-and-patch: read the last valid envelope,
  merge the patch over its payload, validate the result, append. The whole
  read-merge-validate-append sequence is atomic under the append permit,
  not merely the write — it is a read-modify-write, and with the read
  outside the lock, two patches to different fields of one snapshot produce
  a deterministic lost update, the second silently reverting the first.
  That is inherit-and-patch's exact use case, so a narrower lock would have
  been wrong precisely where the operation is used most. The merge guard is
  asymmetric — both sides must be record-like and the patch must not bring
  a conflicting prototype (plain, null-prototype or the base's own) — forced
  by the primary use case: a caller's partial patch is a plain object
  literal even when the base is a schema-class instance, so
  `@effected/config-file`'s symmetric guard (both sides record-like and
  sharing a prototype) would reject the main case here. Outside that
  domain — cross-prototype, scalar, array or void bases — the patch
  replaces rather than merges, and a partial patch against such a base
  fails typed naming the missing keys.
- **`latest`** is a subscribable observable (`SubscriptionRef<Option<Envelope>>`)
  of the current last valid envelope, plus a quiescent signal once a
  terminal event is the tail. Watching state is the common case, and making
  it a ref rather than a fold is what keeps the common case one line. It is
  served by a bounded tail read (see the [slice
  interface](jsonl-slice.md#the-bounded-tail-read-is-the-sanctioned-cheap-read)),
  never a whole-file read. The quiescent signal is derived from `latest`
  rather than being a second piece of state, because a separate ref could
  drift out of agreement with it and a derivation cannot.
- **`create` / `remove`** are explicit file lifecycle, so "the journal does
  not exist yet" is a decision the consumer makes rather than a side effect
  of the first append.

No sidecar index ships. A linear scan is the honest answer: an index is a
second source of truth that an external writer — which the process model
explicitly permits — can invalidate without notice, and reconciling it
correctly is a larger problem than the one the package is solving. If scan
cost ever bites, the fix is a cursor the consumer persists, which the API
already hands out.

## The append primitive, and what atomicity actually means

The naive claim — "one `writeAll` is one `write(2)`" — is false. `File.writeAll`
recurses on partial writes, so it can issue more than one syscall for one
line; `File.write` is the single syscall, but it returns a byte count and
may short-write, which would tear a line just as surely. No API guarantees
one syscall per line.

The corrected position: the primitive is `writeAll` on a handle opened for
append. Atomicity is an OS property of `O_APPEND` writes to a regular file
at reasonable line sizes, not an API guarantee — under `O_APPEND` the
kernel makes the offset-seek and the write one operation, so concurrent
appenders cannot overwrite each other. What remains is a short write — a
signal interrupting the call, a filesystem limit, a full disk — after which
the loop's next iteration writes the remainder as a separate operation
another writer can interleave with. There is no byte threshold below which
this is impossible (`PIPE_BUF` is a pipe concept and does not govern
regular files). The line-size caveat is part of the contract: the larger a
journal line, the more opportunity a short write has to split it. A failure
from the loop is never silently ignored — `writeAll` reports no byte count,
so it either wrote the whole buffer or failed — and any `PlatformError` out
of an append surfaces typed and is treated as a possibly-torn tail that
readers walk back over.

## The publish stage sits outside the write critical section

The obvious implementation deadlocks by construction: a suspending hub
publish inside the append critical section, plus one stalled subscriber,
wedges every writer, and then wedges scope close too, because the
finalizer waits to drain the very permit the suspended publish holds. Four
pins resolve it:

1. The write critical section covers the file write and the ref updates
   only; a suspending hub publish never sits inside it.
2. Publish order equals write order, preserved by a dedicated ordering
   stage whose slot is acquired *under* the write permit and executed
   *outside* it — order is a property of acquisition, not of execution.
3. Backpressure is unchanged: an append completes only once the hub has
   accepted its envelope, so a slow subscriber's pressure lands visibly on
   appenders rather than as a silent drop.
4. The terminal-drain at shutdown is bounded, with the limit stated
   honestly: a subscriber that keeps consuming observes stream end, one
   that never consumes again cannot observe completion through a channel it
   refuses to read, and — the point of bounding it — does not hold scope
   close hostage.

The ordering stage is a chained-`Deferred` baton: each append, while
holding the write permit, links a fresh `Deferred` onto a chain (linking is
non-suspending and O(1), the entire reason it is legal inside the critical
section), releases the permit, awaits its predecessor, publishes, and
passes the baton on via `ensuring`. A second semaphore acquired under the
write permit was considered and rejected: when contended it suspends inside
the critical section, reintroducing the deadlock through a smaller door.

**A residual TOCTOU is named honestly rather than hidden.** An external
write landing between our write and our size probe has three demonstrated
consequences: our own line's reported offset is wrong by the length of the
external write, so every cursor derived from it is off by that much; the
interleaved external line is silently dropped, because advancing the
consumed offset to our computed end skips straight past it; and our own
line is published twice, because the next gap decode re-covers the region
our append already published. The window is genuinely tiny (between two
syscalls, both under the write permit), so this is a rare interleaving
rather than a routine one. Prevention is impossible lock-free — `O_APPEND`
gives the writer no way to learn where its bytes landed, so nothing short of
an advisory lock (which the process model rejects, and which a shell
script's `>>` would not honor anyway) makes the write-and-locate pair
atomic. Detection is possible lock-free — a read-back verification would
catch all three, at one extra read per append — and is declined on cost,
because the append path is the latency-sensitive one.

The finalizer captures the publish-chain tail under the write permit — a
consistent snapshot, since the baton is only mutated under that permit —
and awaits it within the same bounded interruptible region before
publishing the end signal, so every append that *completed* is delivered
before the terminal end-of-stream.

## Shutdown: refusal and drain are two mechanisms

A `Latch` cannot refuse — awaiting one suspends with no failure channel, so
a closed latch would make a late append hang, the opposite of the intended
behaviour. The split: refusal is an explicit closed flag, checked *before*
the append semaphore is taken, failing typed (checking before the permit
matters — a late append must not queue behind a draining flush only to be
refused after waiting); drain is the latch's half, and the finalizer awaits
in-flight work before publishing the end signal that completes subscriber
streams, so the last accepted append is on disk and visible to subscribers
before the streams end. The drain bound is configurable and `Clock`-based,
so under a `TestClock` it fires only if the clock is advanced — a consumer
must `TestClock.adjust` past the bound or the finalizer hangs for the real
wall-clock duration.

## Process model: cooperative writers, always watching

The decision: instances of the same application cooperate under shared
rules, and the service always watches the file. Not single-writer-only
(real precedents already violate that), and not multi-writer locking (which
buys correctness against arbitrary writers at a cost this file format does
not justify). External appends are a fact of JSONL life — a shell script, a
second server, a human with `>>` — so the service watches for the life of
the layer scope and tracks the byte offset of everything it has decoded.
Its own appends advance that offset directly; on external growth it reads
from the offset, decodes the new lines, and feeds them into the same hub,
the same `latest` and the same projections, so a subscriber cannot tell a
local append from an external one.

A torn tail is tolerated, because the envelope makes it detectable — a
writer caught mid-write leaves a partial line, the walk-back skips it, and
the offset holds until the line completes. Truncation or replacement is a
contract violation, surfaced not repaired: if the file shrinks or is
replaced, the service raises a typed resync error rather than silently
reconciling an inconsistency it cannot reason about, and the recovery is
uniform — discard cursor-derived state and re-read from zero. No advisory
locks: the contract other writers must honor is one write of a complete
line, to a handle opened for append, keeping lines small enough that a
short write is unlikely to split them — a discipline, not an enforced
guarantee.

Replacement is detected by inode identity (device and inode captured at
watcher activation, compared on each poke), which catches a
same-size-or-larger replacement a size check structurally cannot see.
Truncation is a size below the consumed offset. The honest limit: the
inode is optional in the platform's stat, so where it is unreported only
truncation is caught.

## A leading BOM is stripped at the service boundary, not in the core

A journal written by a BOM-emitting tool would otherwise have its first
line permanently malformed for every reader, forever. The service's read
boundary strips a single leading BOM, explicitly and at the byte level — it
does not get this from `FileSystem.readFileString`, whose silent strip
would silently desynchronize every offset the package hands out, since
journal reads are offset-based. The pure core does not strip; it stays
byte-honest and reports what it was given. Offsets are logical post-BOM on
every path — tail reads, full scans, the append cursor seeded at
construction — determined once, from the start of the file, never inferred
from a window's position, since a bounded tail window does not begin at the
file start and cannot tell you whether the file opened with a BOM. Exactly
one leading BOM is stripped; a BOM code point anywhere else in the file is
content.

## The watcher and activation

A missing journal is a legal state: layer construction never fails on a
missing journal file, since a consumer must be able to wire its layer
graph before deciding to create the file — that is "missing", not
"unreadable," and construction *can* fail typed on a journal that is
present but unreadable, since a permissions fault is a real fault about a
real file. The watcher activates once the file exists, and the watch is
armed *before* the catch-up read: the invariant is "no window in which the
file can grow while nothing is watching and nothing will re-read." The
other order (ingest, then arm) leaves an unguarded sub-5ms window in which
a written line is invisible until some later filesystem event triggers a
re-read — measured at 1.5s of undelivered staleness in one probe, arriving
only when the *next* append's event fired.

The ordering is achieved by scheduling, not synchronization, because the
platform watch exposes no registration signal to wait on: the
implementation forks the watch consumer and yields a tuned number of times
before running the catch-up read, and the invariant is guarded by a
deterministic arming-window test rather than trusted as timing folklore.
Ingest runs under its own one-permit semaphore, deliberately separate from
the write permit, so a slow catch-up read of a large file cannot block
latency-sensitive appends.

A parent-directory watch was assumed as the activation mechanism, then
falsified by a probe: on the installed node backend, a directory watch
reports both file creation and append as removal, and the event's path is a
bare relative basename that resolves against the process working directory
rather than the watched one — an upstream defect. Four constraints bind
activation as a result: never branch on the event tag (any directory event
whose path basename matches the journal filename is an untyped poke
meaning "go re-stat yourself"); never use the event's path to open or read
anything, on any watch; re-arm the file watch after a resync, since node
watchers follow the inode and a replaced file leaves the old watch attached
to nothing; and the directory watch is activation-only and must end once
the file exists, since a non-recursive directory watch does not reliably
report a child file's content appends.

The package does not use core's `WatchBackend`: it calls `watch` through
the `FileSystem` service, so the deterministic test seam is the
`watch` member of the test filesystem (an `@effected/memfs` volume with
`watch` faulted to a manually driven stream) and its before-watch hook — this is what
covers offset bookkeeping, the re-arm path and the resync path without
racing a real filesystem or sleeping. `WatchBackend` remains this design's
named upgrade for synchronous registration, considered and deferred rather
than used.

## What the concurrency tests must actually arrange

Three of this package's tests are structurally incapable of testing what
they appear to test unless arranged deliberately:

- **A hub with no subscribers accepts every publish immediately.** A stall
  or deadlock test therefore proves nothing unless it holds a real
  subscription that is at capacity; without one there is no backpressure to
  observe and the test is green by construction.
- **The completed-appends-precede-the-end test needs three appends.** With
  two, the hub's FIFO ordering of blocked publishers drains the pending
  publish and the direct end signal in the right order by accident, and the
  mutant survives. A third makes the end signal register *between*
  baton-chained publishers, the only arrangement that can observe the
  violation.
- **A prototype-pollution test must sit directly on the merge primitive,
  never downstream of a schema boundary.** Placed downstream, the hijacked
  object is transient, so the observable output is always clean while the
  hazard is real.

The arming-window test earns a place beside them: its write must land
*after* construction, inside the window itself; placed before construction,
the seeding read covers it and the test passes against the very bug it
exists for.


---
<!-- okf/interfaces/jsonl-slice.md -->
---
type: Interface
title: "@effected/jsonl read surfaces"
description: Slice, the one filter shape every read surface takes; the consumption model built on it; and the read economy that motivates the whole package.
status: stable
kind: api
resource: ../../packages/jsonl/src/Slice.ts
tags:
  - architecture
  - performance
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: cd784c7d451cdcdbd6779963f76d4818e69ba7850d48c135549e8286a8cdc1ab
verified:
  - by: human:spencer
    at: 2026-09-24T00:11:38.223Z
---

# `@effected/jsonl` read surfaces

The read surfaces are the read half of the [jsonl module](../modules/jsonl.md):
`Slice`, the one filter vocabulary every read takes; the consumption model
built on it — a live stream, a finite query, a resumable cursor and a fold;
and the read economy that motivates the whole package. The append path, the
write lock and the watcher that makes a live stream live belong to the
[journal interface](jsonl-journal.md); what stays here is what a reader may
ask for and what that question costs.

## Slice: the shared read vocabulary

`Slice` (`packages/jsonl/src/Slice.ts`) is one filter shape — events,
scopes, and a time range, plus a byte-offset cursor where resumption
applies — used by every read surface:

| Surface | Shape | Use |
| --- | --- | --- |
| `changes(slice?)` | live `Stream` | Subscribe to one writer's events and not another's. |
| `changes` with a cursor | replay then tail | Resume from a persisted cursor and continue live through the same filter — one seam, not two APIs. |
| `query` | finite `Stream` | Historical read with the same shape as the live one. |
| `projection` | folded state | A per-scope state machine over a shared file: the fold only ever sees its own slice. |

Three properties make this more than a convenience. Filtering happens on
envelope fields, so a neighbour's payload is never decoded on your behalf
(precisely, see [what filter-before-decode
guarantees](#what-filter-before-decode-actually-guarantees)). Typed
narrowing: naming events narrows the stream's element type to those
envelope variants, so a projection over a slice is exhaustively checkable.
And one vocabulary means one thing to learn — a consumer who can express a
subscription can express a query and a projection without translating.

Both range axes are half-open, for tiling: the lower bound is inclusive,
the upper bound exclusive, so adjacent windows tile without
double-delivery — timestamp collisions are not exotic here, since at
millisecond resolution they are common and under `TestClock` several
appends routinely share an identical stamp, so a closed upper bound would
double-deliver constantly in exactly the tests meant to prove correctness.
A cursor compares at-or-after against a line's start offset, so a consumer
that persists the last processed envelope's *end* offset resumes with
exactly the unprocessed remainder — no replay of the line it already
handled, no gap.

### What "filter before decode" actually guarantees

The headline property needs stating honestly, because the structural
guarantee holds on some paths and not others. On the disk paths — the
historical read, and the replay half of a resumed subscription — payload
decode is structurally unreachable for a line the slice does not match:
the frame decodes, the filter runs on envelope fields, and a non-matching
line's payload schema is never invoked. On the live path, the hub carries
fully-decoded envelopes, deliberately: the writer decodes its own line
once, because a frame-carrying hub would instead push payload decode into
*every* subscriber, strictly worse the moment there is more than one.

The property, stated so it is true on every path: a consumer never pays for
a neighbour's payload on any read it performs; a writer pays once for its
own line; and each process pays at most once per line entering it through
the live path.

## Consumption model

`Stream` is the single canonical return type of every slice surface. A
default queue surface was considered and rejected: it would force one
buffering policy on every consumer, when the right policy is a property of
the consumer and not of the journal (a dashboard wants latest-wins, an
auditor wants lossless); it loses stream composition and typed completion,
since quiescence would arrive as a sentinel in the error channel rather
than as the end of a stream; and it drops the typed-narrowing property,
since the combinators that make an event filter narrow the element type
are stream combinators. Queue-style consumption remains one line away
through core interop, with the consumer choosing the buffering policy —
for example converting to a sliding-strategy queue for a latest-wins
display.

The journal's internal hub is bounded with backpressure. The journal never
drops an envelope on behalf of a slow subscriber: slowness propagates to
the producer side, where it is visible, rather than being resolved by a
silent gap in somebody's subscription. A consumer that genuinely prefers
dropping to waiting expresses that in its own queue strategy.

### Quiescence is a published end-of-stream, not a hub shutdown

Two properties this design leans on do not fall out of a plain hub. A
stream over a raw hub has no termination signal — it runs until
interrupted. A hub *shutdown* interrupts subscribers, which is exactly the
tear a graceful-shutdown rule forbids, and an interrupted subscriber is
indistinguishable from a crashed one. So the hub carries `Take` chunks,
end-of-stream is published as an `Exit`, and subscriber streams are built
with a take-aware stream constructor that interprets that exit as the end.
Quiescence and graceful shutdown then arrive at every subscriber as a
normal, typed stream end.

A derived requirement is pinned: subscribing to an already-quiescent
journal must terminate, not hang — a done-exit published before a
subscriber attached is invisible to that subscriber, since a hub has no
replay. Termination is per-subscriber, not a hub-wide replay: a
subscription ends its own stream on seeing a terminal envelope, taken from
the *unfiltered* stream so that a slice which excludes the terminal event
still ends rather than hanging forever on a journal that is over; and a
quiescent check at subscribe time ends the stream immediately for a late
subscriber. Replaying the terminal exit was rejected, since it would
duplicate envelopes for live subscribers, and a hub-wide exit would
permanently end already-attached subscribers, making `reopen` unrepresentable
for them. One pin: a subscriber whose slice matches the terminal event
receives it, then ends — termination must not swallow the envelope that
caused it.

## The read economy

### The bounded tail read is the sanctioned cheap read

There is a real tension between a pure core that takes whole text and the
token-economy contract: a hook that reads the entire journal to answer
"what is the last line" has paid for exactly the history the package
promised it could skip. The sanctioned recipe: probe the size, then read
the last N bytes through the offset read; decode from a newline boundary,
discarding the first partial line in the window unless the window starts at
offset 0; walk back from the end to the last valid envelope; and if no
valid envelope is in the window, widen it and retry — a journal whose last
line is longer than the initial window is not an error, it is a bigger
window. Every offset the recipe reports is logical post-BOM, matching every
other offset the package emits.

The service's own current-state surface and every last-valid-line read use
this bounded tail recipe, never a whole-file read — a constraint on the
service, not a suggestion to the consumer. The runtime-free reader claim is
qualified accordingly: "needs no runtime" is unconditional, but "is cheap"
holds only through this recipe.

### The historical read is cursor-bounded, not window-bounded

Only the current-state and last-valid-line reads are window-bounded. The
historical read behind `query` and behind the replay half of a resumed
subscription reads its requested region in one allocation, bounded by the
file size rather than by any window, and buffers matching envelopes before
emitting, so the stream it returns is fed from a materialized batch rather
than produced incrementally. Its only bound is the cursor: a consumer
resuming from a persisted offset pays for the remainder, and a cursor-less
query over a large journal pays for the whole file.

The consequence, without softening: "no operation ever holds the file in
memory" is not a property this package has. The token-economy contract
holds for the surfaces it was measured on — current state, the hook path,
and any read carrying a cursor — and a cursor-less historical read is the
exception rather than a rounding error in the claim. A paged historical
read (emitting per window, carrying an unterminated tail across the window
boundary) is a known fix that is not built.
