# P0.5 Filesystem Reconnaissance

Status: reconnaissance complete; root review notes below.

Root evidence correction (2026-09-08): the pinned text fixture is **27 bytes**,
including the final LF, with the hash reported below. Earlier 26-byte prose and
slice bounds in this report are incorrect; `sit amet` occupies bytes 18..26
(exclusive end). Root selected a subject-local scoped fixture effect, preserving
all five read/open/stream call sites without an added public path export or asset
packaging changes. The checked-in-asset design below remains a proposal, not the
implemented choice. Fresh main is 663904610c and pins Bun 1.4.2; cached-main tree
equality is historical. See the root publication-base and runtime receipts.

This lane is a bounded, read-only source and conformance map for the eventual
P0.5 `FileSystemConformance` and `@beep/test-utils/MemoryFileSystem` PR.

## Evidence pass 1 — governing scope and actual source topology

Resumed 2026-09-08 under the later `gpt-6-astra` / `xhigh` routing instruction.
The initial report is preserved above. This report is the lane's only write.
Runtime proof, package verification, manifest/lockfile edits, publication worktree
selection, git, Yeet, scanner state, and any disposition of conflicts belong to
the orchestrator. No source or scratchpad deletion is authorized. The orchestrator
reports that cached `origin/main` and this worktree HEAD have identical trees
despite squash history; this lane has not run git to independently verify that.

Source anchors below are one-based and repo-relative unless prefixed `PIN/`.
`PIN/` means `~/.cache/beep/effect-vitest-canon/effect-rc112/`, the supplied
rc.112 snapshot at commit `2600f62f4532026928454dcea8d1c48557b3f942`.
`TU/` means `packages/tooling/test-kit/test-utils/`; `ENGINE` means
`scratchpad/memfs/internal/volume.ts`; `FACADE` means
`scratchpad/memfs/MemoryFileSystem.ts`; `SUITE` means
`PIN/packages/effect/test/FileSystem.test-utils.ts`. Abbreviations do not refer
to invented files.

### Binding decisions and evidence precedence — facts

- Read `SPEC.md:202-258`, including all D1-D14 and especially D8/D9/D10/D14 at
  `244-250`; `PLAN.md:168-185`; `ops/prompts/resource-authoritarian.md:1-97`;
  the shared lane contract; and the new `ops/prompts/p05-recon-contract.md`.
  These paths are within `goals/effect-vitest-canon/`.
- Read `research/2026-09-08-grounding-2.md:315-367` and the filesystem/lifetime
  notes in `research/2026-09-08-grounding-4.md:179-201`. The pinned test suite,
  current engine and current tests provide the operative source facts. No new
  web research was performed; upstream HEAD was not consulted.
- D8 requires the separate P0.5 conformance/promotion PR; D9 permits graduation
  of the MemoryFileSystem test with its module without admitting the rest of
  scratchpad into migration scope. D10 retains Codex CLI/Grok routing. D14's
  narrow conformance exception is already stated in `PLAN.md:170-174` and the
  resource charter `10-18`: each test provides the filesystem layer because
  that layer is the subject. This report does not create an inbox waiver.
- `SPEC.md:204-209` and `PLAN.md:176-180` name a historical
  `scratchpad/MemoryFileSystem/` tree. It is absent in this checkout. The actual
  test imports `@beep/scratchpad/memfs` at
  `scratchpad/test/MemoryFileSystem/MemoryFileSystem.test.ts:1`. There is no
  basis here to reconstruct the historical schema-first directory, infer its
  content from the packet's old line counts, or graduate the entire facade.

### Actual files and boundaries — facts

| Surface | Actual source and anchors | Count / role |
| --- | --- | --- |
| Core engine plus an inspection extension | `ENGINE:1-3031` | 3,031 lines; one implementation file, no sibling helper/role imports |
| Public lab facade | `FACADE:1-1445` | 1,445 lines; core aliases plus optional seed/fault/inspect/sync APIs |
| Lab barrel | `scratchpad/memfs/index.ts:32-46` | 46 lines; 13 named export bindings, 7 value bindings and 6 type-only bindings |
| Package export | `scratchpad/package.json:7-22` | `./memfs` maps to `./memfs/index.ts` at line 13 |
| Memory-specific tests | `scratchpad/test/MemoryFileSystem/MemoryFileSystem.test.ts:1-322` | 322 lines; imports the public lab barrel; conformance remains a TODO at `26-27` |
| Destination package | `TU/package.json:14-20,54-68,79-85` | public wildcard source export, explicit `ConformanceLedger` directory export, blocked top-level internals; existing platform/vitest/effect dependencies |
| Destination root barrel | `TU/src/index.ts:16,23,30,37,44,51` | 6 export-all statements: Entity, FastCheckRuns, Layer, Schema, SqlTest, SystemTemp; no MemoryFileSystem or FileSystemConformance export |

The real core entry points are `FACADE:920` (`make = internal.make`) and
`FACADE:1226` (`layer = internal.layer`). `ENGINE:2765-2792` passes 25 primitive
methods to `FileSystem.make`: access, copy, copyFile, chmod, chown, glob, link,
makeDirectory, makeTempDirectory, makeTempDirectoryScoped, makeTempFile,
makeTempFileScoped, open, readDirectory, readFile, readLink, realPath, remove,
rename, stat, symlink, truncate, utimes, watch, writeFile. Effect derives the
five convenience methods exists/readFileString/writeFileString/stream/sink.
The standard FileSystem service therefore remains the consumer boundary.

The core does not depend on the lab facade. `ENGINE:52-72` imports only
`@beep/identity`, the root `effect` modules (including type-only Cause), and
`effect/Array`, `effect/Predicate`, `effect/Schema`. It imports no Node/Bun
filesystem, no host path service, no `memfs` npm dependency and no other local
role module. The facade adds `@beep/utils/Option` and has exactly one local
import, `./internal/volume.ts` (`FACADE:20-26`). The lab's many other package
dependencies are unrelated to the engine's transitive source closure.

`$ScratchpadId` has two import/create pairs: `ENGINE:52,74` and
`FACADE:20,28`. Core identity use includes the typed invariant error at
`ENGINE:76-78`. The inspection extension uses the same engine identity for
`VolumeEntrySnapshot` at `2861-2874`. Facade identity covers its sync error,
invalid transient count, seed/transient schemas and `Volume` service key;
none of those is needed for the core `make` / `layer` API.

### Optional facade surfaces — facts

| Optional surface | Source and entry points | Relationship to core |
| --- | --- | --- |
| Seeding | schemas `FACADE:246-424`; `seedFile`/`seedDirectory`/`seedVolume:530-577`; `makeWith:935-942`; `file:1176-1186`, `directory:1200-1203`, `symlink:1215-1216`; `layerWith:1282-1283` | Builds `internal.make`, then writes through that service; `makeWith` retains typed PlatformError, `layerWith` converts contradictory seed errors to defects |
| Fault injection | schemas/types `437-526`; `armFault`/`wrapFaulty:743-848`; `makeFaulty:961-962`, `layerFaulty:1049-1058`, `layerFaultyWith:1074-1078`, `failTimes:1147-1152` | Decorates any FileSystem; per-build mutable counters are facade-owned; five derived methods are rebuilt over intercepted primitives |
| Inspection | model `78-157,224-227`; `makeVolumeService:608-651`; `Volume:1297-1298`; `makeInspectable:1377-1383`, `makeInspectableWith:1397-1404`; `layerInspectable:1418-1420`, `layerInspectableWith:1439-1442` | Requires the engine's optional live `entries()` bridge; FileSystem and inspection view share exactly one volume |
| Synchronous adapter | model `198-207`; typed sync error `30-38`; `normalizeQueryPath:585-598`, `resolveLinks:665-693`, `makeSyncFileSystem:695-730`; `syncFileSystem:1353-1354` | Four synchronous read/query methods over inspection; not part of Effect FileSystem and not a host escape |

There are six public layer forms in the facade: one core (`layer`) and five
optional (`layerWith`, `layerFaulty`, `layerFaultyWith`, `layerInspectable`,
`layerInspectableWith`). Promoting the latter five is outside P0.5 authority.
The source closure supports extracting the core without them.

### Volume ownership and extraction seam — facts

`ENGINE:2659-2715` creates one Semaphore, watcher set, and captured mutable
`State` per execution. `State` (`167-173`) owns inodes, file descriptors and
next-inode/descriptor/temp counters. `withState`, `mutate` and
`mutateInterruptibly` share the lock; mutation commits state and publishes
events before releasing it (`2690-2705`). `makeReadyVolume:2794-2798` creates
the volume and pre-creates `/tmp`. `make:2824` maps that fresh volume through
`toFileSystem`; `layer:3031` is `Layer.effect(FileSystem.FileSystem, make)`.

The only extra exposure needed by inspection is `Volume.currentState`, the
returned closure at `ENGINE:2709`, and `collectEntrySnapshots:2886-2951`.
`makeInspectable:3002-3005` calls the same `makeReadyVolume` and returns both
`toFileSystem(volume)` and `() => collectEntrySnapshots(volume.currentState())`.
The snapshot schema/type and `InspectableFileSystem` interface occupy the
extension after `make` (`2826-3005`). Their live byte references are copied by
the facade (`608-651`), not by the engine walk. Core operations do not need
that inspection bridge. The exact removal boundary in a new core copy is this
extension plus the inspection-only `currentState` member/return field; the
remaining state and operations stay together.

Core defaults to preserve include relative paths rooted at virtual `/`, `/tmp`
pre-created, uid/gid 0, regular-file mode `0o100644`, directory mode `0o40755`,
symlink mode `0o120777`, first inode/descriptor/temp counters 2/3/1, symlink hop
limit 40 and nesting bound 256 (`ENGINE:84-99`). `access` checks existence and
deliberately ignores permission options (`1881-1884`); permission bits remain
metadata. `open` uses acquire/release (`1870-1873`); scoped temporary directory
and file cleanup remove their owned paths (`2201-2205,2252-2268`). An empty
volume must remain empty except for its documented root and `/tmp` directories.

### Immediate conflict already established — source fact, no disposition

The pinned copy test conditionally asserts that a failed `copy` with
`overwrite: false` identifies the **source** path (`SUITE:180-185`). The lab
engine documents a deliberate change to report the **destination**
(`ENGINE:47-50`), and its memory-specific test explicitly requires the
destination (`scratchpad/test/MemoryFileSystem/MemoryFileSystem.test.ts:132-149`).
These assertions cannot both pass on the same failure value. This is an
inherited contract conflict, not a license to weaken the pinned test, suppress
the error, remove the existing regression, add an option or promote a fault
wrapper. The orchestrator must select and record a resolution before claiming
the unchanged conformance gate is green. Runtime proof remains pending.

## Evidence pass 2 — complete pinned conformance inventory

### Pin verification and totals — facts

Read all 435 lines of `SUITE`. Read-only `wc -l` and `sha256sum` both exited 0:
435 lines, 15,346 bytes, SHA256
`8725010039e5ef2cee8b9b4fbcdb076f4099e8a44fe393a8e032c5fd89808abe`.

The suite contains **21 registered cases**, of which 20 are unconditional and
one is conditionally skipped by `accessOnDirectory === false`. There are
**46 explicit assertion sites**: 7 `expect(...).toEqual`, 21
`expect(...).toBe`, 12 `assert.strictEqual`, and 6 `assert(...)`. Three of
those sites execute only in the copy failure branch and one executes only when
scoped temp-file directory removal is enabled. These are static site counts,
not a runtime claim of 46 assertions executed on every platform. The access
case has no explicit assertion: successful completion of `fs.access` is its
law. Five `Effect.flip` sites additionally require failures, and 13
`Effect.fromOption` sites require successful `readAlloc` results to be `Some`.
There is one `Effect.result` site, in the conditional copy test. No Exit
assertions, property tests, timeouts, retry/flaky tests, or watch cases occur in
this helper.

`testLayer` has precisely the signature in `SUITE:15`:
`<E>(layer: Layer.Layer<Fs.FileSystem, E>, options: TestLayerOptions = {})`.
The input layer has no unsatisfied environment. Both optional flags remain
boolean and retain their upstream semantics:

| Flag | Default / exact branch | Required preservation |
| --- | --- | --- |
| `accessOnDirectory` | true; only literal `false` skips the case (`8-10,57-67`) | Omission and explicit true run writable-directory access. Node, Bun and Memory use the defaults; no new platform-specific disablement is justified. |
| `tempFileScopedRemovesDirectory` | true; directory NotFound assertion executes unless literal `false` (`11-12,86-89`) | The file NotFound assertion always executes. False suppresses only the containing-directory assertion; it does not skip the whole case. |

The Deno call site uses both false values at
`PIN/packages/platform/deno/test/DenoFileSystem.test.ts:5-9`. Deno is not an
additional P0.5 matrix target, but both flags and all branches must survive.

### Every case, assertion and fixture dependency — facts

In the count column, E means `expect`, S means `assert.strictEqual`, and A
means `assert`. Implicit success/failure/Some checks are stated separately.

| # | Exact upstream case and span in SUITE | Assertions and behavior to retain | Explicit sites | Fixture/resources |
| --- | --- | --- | --- | --- |
| 1 | `readFile`, `21-27` | Read bytes through the provided FS; TextDecoder; trimmed text equals `lorem ipsum dolar sit amet` (the `dolar` spelling is intentional). | 1E | `${__dirname}/fixtures/text.txt`, readFile |
| 2 | `makeTempDirectory`, `29-40` | Directory type inside an inner scope AND still Directory after that scope closes. | 2E | unscoped temp directory; deliberate short scope |
| 3 | `makeTempDirectoryScoped`, `42-55` | Directory inside short scope; after close, flipped stat must fail with reason tag NotFound. | 1E + 1A | scoped temp directory; post-close stat |
| 4 | `access on a writable directory`, `57-67` | `fs.access(dir, { writable: true })` completes; case skipped only by first flag false. | 0 | scoped temp directory |
| 5 | `makeTempFileScoped cleans up`, `69-91` | A separator index > 0 (supports `/` and `\\`); parent Directory while file scope is open; after inner close, file stat fails NotFound; parent stat also fails NotFound unless second flag false. | 1E + 3A | outer scoped root; inner scoped temp file created with `{ directory: root }` |
| 6 | `truncate`, `93-108` | Read back `hello world` before; default path truncate; read back empty string after. | 2E | unscoped temp file; TextEncoder/TextDecoder |
| 7 | `writeFile with r+ overwrites without truncating`, `110-119` | Start `abcdef`, overwrite `xy` with flag r+, expect `xycdef`. | 1S | unscoped temp file |
| 8 | `writeFile with empty data honors the flag`, `121-133` | Default empty write truncates `abc` to empty; empty r+ write leaves `abc`. Both halves retained. | 2S | unscoped temp file |
| 9 | `writeFile with r rejects writes`, `135-146` | Flipped write must fail; reason is not BadArgument; reason method is writeFile; pathOrDescriptor equals path; file remains empty. No new exact system-error tag requirement. | 3S + 1A | unscoped empty temp file |
| 10 | `writeFile with a appends`, `148-157` | `abc` then `def` with flag a gives `abcdef`. | 1S | unscoped temp file |
| 11 | `writeFile with wx exclusively creates`, `159-169` | First wx writes `first`; second wx must fail via flip; file still equals `first`. Upstream does not check that error's exact tag. | 1S | unscoped temp directory + `file.txt` |
| 12 | `copy with overwrite false preserves an existing destination`, `171-189` | Source and destination contain their different original strings. On Failure only: AlreadyExists, method copy, pathOrDescriptor SOURCE. Success without overwrite is permitted by upstream. Both contents asserted after either result. | 4S + 1A | unscoped temp root, `source.txt`, `destination.txt` |
| 13 | `should track the cursor position when reading`, `191-235` | readAlloc(5) → `lorem`; seek +7 current then readAlloc(5) → `dolar`; seek +1 current then readAlloc(8) → `sit amet`; seek 0 start then readAlloc(11) → `lorem ipsum`; stream offset 6, bytesToRead 5 collected/joined → `ipsum`. | 5E | text fixture open + stream; four Some requirements; scoped descriptor |
| 14 | `should read from a backwards seek`, `237-259` | readAlloc(5) → `lorem`; seek -3 current; readAlloc(3) → `rem`. | 2E | same fixture; two Some requirements; scoped descriptor |
| 15 | `should read sequentially without an intervening seek`, `261-282` | readAlloc(5) → `lorem`, immediately readAlloc(6) → ` ipsum`. | 2E | same fixture; two Some requirements; scoped descriptor |
| 16 | `should track the cursor position when writing`, `284-311` | Three writes give `lorem ipsum dolor sit amet`; seek -4 current and write `hello world` gives `lorem ipsum dolor sit hello world`; seek 6 start and write `blabl` gives `lorem blabl dolor sit hello world`. | 3E | scoped temp file, w+ descriptor |
| 17 | `should maintain a read cursor in append mode`, `313-347` | Write foo, seek 0 start, append bar; content `foobar`; read 3 → `foo`; append baz; content `foobarbaz`; read 6 → `barbaz`. Writes append even after seek and preserve the independent read cursor. | 4E | scoped temp file, a+ descriptor; two Some requirements |
| 18 | `should restore the read cursor after an append write`, `349-375` | Write foo, seek 0 start; read 1 → `f`; append bar; next read 2 → `oo`. | 2E | scoped temp file, a+ descriptor; two Some requirements |
| 19 | `should keep the current cursor if truncating doesn't affect it`, `377-394` | Write 25-byte text, seek 6 start, descriptor truncate(11); seek 0 current returns Fs.Size(6). | 1E | scoped temp file, w+ descriptor |
| 20 | `should update the current cursor if truncating affects it`, `396-412` | Write same text, truncate descriptor to 11 from cursor at end; seek 0 current returns Fs.Size(11). | 1E | scoped temp file, w+ descriptor |
| 21 | `should read from the clamped cursor after truncating`, `414-434` | Write `abcdefghij`, descriptor truncate(5), append `xyz` through fs.writeFile with flag a; descriptor readAlloc(3) gives `xyz`. | 1E | scoped temp file, w+ descriptor; one Some requirement |

Resource call-site totals provide a second completeness check: three direct
`makeTempDirectory()` calls (`34,162,174`), three
`makeTempDirectoryScoped()` sites (`48,63,73`), five unscoped
`makeTempFile()` sites (`96,113,124,138,151`), and seven
`makeTempFileScoped()` sites (`77,290,319,354,382,401,419`). Totals are
**3 / 3 / 5 / 7**.
There are nine direct open calls (three read fixture opens, six writable temp
opens) and one stream call. These are syntax counts; every registered case
acquires the FileSystem service separately through the supplied layer.

### Scope port — facts and proposal

There are **14** upstream `Effect.scoped` occurrences. Preserve **three**
shorter lifetimes whose closure is the subject:

- `SUITE:33-37`: the unscoped directory must survive an inner scope.
- `SUITE:46-52`: the scoped directory must disappear before the NotFound check.
- `SUITE:76-83`: the scoped file and, by default, its private containing
  directory must disappear before `84-88`; the enclosing root is still alive.

The other **11** scopes are wrappers: writable access (`62-65`), the outer
temp-file-cleanup root (`72-90`), and the nine descriptor-body wrappers ending
at `233,257,280,309,345,373,392,410,432`. No assertions follow their closure
that depend on it. Under public `it.effect`, remove those wrappers while
retaining scoped acquisition calls and all assertions. The runner supplies
the test-body scope (`PIN/packages/vitest/src/internal/internal.ts:355-357`);
the explicit layer provider has its own build scope
(`PIN/packages/effect/src/internal/layer.ts:8-22`).

Proposed registration is public `it.effect(name, bodyProvidedWithLayer)`;
use `it.effect.skipIf(options.accessOnDirectory === false)` for the one
conditional registration (public type `PIN/packages/vitest/src/index.ts:57`,
runtime `internal/internal.ts:109-110`). Keep the upstream generic layer and
two-flag options signature. A private provider typed with `Fs.FileSystem |
Scope.Scope` may be needed after removing wrappers; the old runPromise helper's
`R = Fs.FileSystem` annotation cannot simply be retained when body scopes are
now supplied by `it.effect`. Do not add another runner, public scope option or
P0e dependency to solve that local typing issue.

D5 does not permit collapsing error payload assertions to a tag-only check.
Use public `@effect/vitest/utils` where Option/Result values are directly
asserted. The 13 `Effect.fromOption` conversions are real failure behavior;
retaining them already preserves their Some requirements. If rewriting them
to `assertSome`, preserve both the Some requirement and decoded payload
assertion. The conditional copy Failure arm must remain conditional; an
unconditional `assertFailure(result, ...)` would reject the success/no-overwrite
outcome that the pin permits. Plain strings, numbers, types and bigint cursor
values may continue to use `expect`/strict equality. The pin contains zero
Exit assertions to migrate.

## Evidence pass 3 — fixture, reuse and bounded promotion design

### The fixture dependency — facts

There is **one external fixture path**, referenced at **five call sites** in
**four cases**: `SUITE:24` (readFile), `197,226` (open and stream), `242`
(backwards seek), and `266` (sequential reads). All five use the same
`${__dirname}/fixtures/text.txt`. No other checked-in fixture, environment
variable, mock, host helper, network resource or local helper import appears
in the suite. TextEncoder/TextDecoder and Math/string operations are intrinsic
utilities; paths for the other 17 cases come from the subject filesystem.

The supplied cache contains only `FileSystem.test-utils.ts` under
`PIN/packages/effect/test/`. Its own `fixtures/text.txt` is **missing**. Two
available files at the same pin supply the required text:

- `PIN/packages/platform/node/test/fixtures/text.txt:1`
- `PIN/packages/platform/deno/test/fixtures/text.txt:1`

Both are exactly **26 bytes**, UTF-8 `lorem ipsum dolar sit amet\n`, with SHA256
`d3f5f9d07a3d20fe04b3e2793429fc2bae16e9ca915d1a094477602853fc8afa`.
`sha256sum` and `od` verified equality, spelling and the terminal LF. These
bytes satisfy every tested slice: `0..4 = lorem`, `6..10 = ipsum`,
`12..16 = dolar`, `18..25(exclusive) = sit amet`. The missing effect-package
fixture's historical bytes have not been independently recovered; do not
claim its hash is known. The available pinned fixtures provide a local,
source-grounded arrangement without web research.

### Fixture arrangement — recommended proposal

Keep a checked-in 26-byte fixture for Node/Bun and embed exactly those bytes
as the Memory conformance fixture value. This requires no seed/fault/inspect
facade and no new `TestLayerOptions` fields.

Recommended package asset: `TU/src/FileSystemConformance/fixtures/text.txt`.
The public `TU/src/FileSystemConformance.ts` can resolve that asset relative
to its own module URL, using `fileURLToPath(new URL(..., import.meta.url))`.
URL-to-path conversion performs no host filesystem read. A small exported
`readFileFixturePath` constant is proposed so the test can import the same
locator from `@beep/test-utils/FileSystemConformance`; it is fixed fixture
metadata, not a configurable option or a memory-filesystem capability.
This avoids test imports into `../src` or private internals and avoids a
working-directory-dependent fixture path. This one support export and the
asset layout are a proposal for the implementing owner, not current APIs.

All five original reads/open/stream calls must use that single locator.
The Node/Bun cases read the real checked-in asset through the provided
FileSystem. They do not arrange it by calling writeFile in the read test.

For Memory only, the conformance test owns one local preparation layer:

1. During each layer build, execute `MemoryFileSystem.make` to obtain a new
   core service. Do not run it once at module load and wrap the shared result
   in `Layer.succeed`.
2. Create the fixture's parent directories in that service and write the
   exact 26 bytes using its ordinary `makeDirectory` / `writeFile` methods.
   An absolute host-looking path is just an ordinary key in the virtual
   POSIX volume; never fall back to a Node/Bun service for absent paths.
3. Return that same service from `Layer.effect(FileSystem.FileSystem, ...)`.
   Keep preparation failures in its typed `PlatformError` channel; the
   generic `E` in `testLayer` already supports them. Do not use a fault
   wrapper, `orDie` convenience seed layer or additional public constructor.
4. Pass that preparation layer to `testLayer` with omitted options. Each
   test's prescribed `Effect.provide(layer)` builds a fresh populated volume.
   All 21 cases run against it. The 17 memory-specific tests continue to use
   the ordinary empty core layer, including their starts-empty regression.

Memory fixture preparation has **zero runtime host reads/writes**: the only
input is the pinned literal and the locator string. Loader/config reads by
Vitest are separate from the FileSystem subject; they do not authorize a
host escape in the service. Do not seed only once in a `beforeAll`: subsequent
per-test layer builds would then be empty. Do not preinstall the fixture in
the core default `make` or `layer`: that would change the empty-volume API.
Do not replace readFile/open/stream with canned returns or skip those cases.

Root must ensure the text asset is present for both the source layout and
the emitted dist layout if this conformance module is packaged. The current
`TU/package.json:7-12` file allowlist contains only TypeScript/JavaScript/map
patterns, so it does not by itself include `.txt`. An owner-controlled asset
copy/include is a real requirement, not proof supplied by passing source
aliases. No manifest/build/config changes were made by this lane.

### Reuse search — facts

Live targeted searches covered `packages/**/src/**`, package `src/index.ts`
barrels, `TU/src`, and executable imports in apps/packages/infra/scratchpad.
There are **zero existing package-source implementations or public barrels**
for `MemoryFileSystem` or `FileSystemConformance`. The only executable
`@beep/scratchpad/memfs` import found is the memory-specific test at line 1.
The six examples in `scratchpad/schemastore/SchemaFile.ts:479` and
`SchemaPipeline.ts:414,458,526,586,633` are documentation, not runtime
adoption. The engine/facade's own documentation is not an external consumer.

| Existing candidate | Actual role / anchors | Reuse judgment |
| --- | --- | --- |
| `@beep/test-utils/Layer` | `TU/src/Layer.ts:34-37`, re-exported at `TU/src/index.ts:30` | `provideScopedLayer` already builds a layer and provides its context inside a scope. No new shared layer wrapper is needed. For the exact P0.5 adaptation, direct public `Effect.provide` is simpler and matches PLAN. |
| `@beep/test-utils/SystemTemp` | `TU/src/SystemTemp.ts:8-9,57,85`, barrel `index.ts:51` | Host platform/env temporary-root selection, not an in-memory volume or a fixture seed mechanism. Do not substitute it for the conformance API's default temp calls. |
| `@beep/test-utils/ConformanceLedger` | `TU/src/ConformanceLedger/index.ts:8-11` | Validates package-owned ledger artifacts. It is not a FileSystem behavioral testLayer and should not become a new P0.5 dependency. Its explicit directory export/blocked descendant pattern is a useful topology precedent. |
| `@beep/utils/FileSystem` | `packages/foundation/modeling/utils/src/FileSystem.ts:1-10,43-50,313,467`; namespace barrel `src/index.ts:151` | Synchronous host Node helpers and a wait helper; cannot supply the memory core. Importing them for Memory fixture setup would escape the subject. |
| ts-morph `InMemoryFileSystemHost` / `useInMemoryFileSystem` | e.g. `packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.command-surface.ts:17,594`; `CreatePackage/internal/IdentityRegistration.ts:295,309` | Compiler project filesystem, not Effect's FileSystem service; similarly named search hits do not implement this closure. |
| `effect/FileSystem.make` | `PIN/packages/effect/src/FileSystem.ts:686-755` | Reuse for deriving exists, string IO, stream and sink. Keep the core primitive map instead of reimplementing those five convenience members. |
| `effect/FileSystem.layerNoop` | same pinned file `825-954` | A stub service, not a stateful POSIX volume; cannot replace core implementation/conformance. |
| `$TestUtilsId` | `packages/foundation/modeling/identity/src/packages.ts:550`; root public barrel re-exports packages | Existing registered identity; promotion needs no new identity domain/package dependency. |
| `@effect/vitest` / `@effect/vitest/utils` | pin `packages/vitest/src/index.ts:147-157,248`; `src/utils.ts:257,289` | Public test registration and Option/Result helpers already cover P0.5. |

The current engine uses branded identifiers, interfaces and `Data.taggedEnum`
for inode variants (`ENGINE:105-145`), with a schema-tagged invariant error.
It is not the vanished `S.Class`/`LiteralKit` rewrite described by the packet.
Do not claim that old implementation's schema conformance for this source.
Any standards work needed in the later package handoff must be attributed to
the actual extracted code and preserve behavior; it is not permission for a
facade-sized redesign in this report.

### Exact core closure — recommended proposal

The irreducible implementation closure is **one engine file plus the two
public constructors**. A bounded publication layout consistent with PLAN's
directory target consists of three TypeScript files:

| Proposed destination (none created here) | Exact source to carry | Public responsibility |
| --- | --- | --- |
| `TU/src/MemoryFileSystem/internal/memoryFileSystem.ts` | `ENGINE:1-2824` and `3007-3031`, excluding inspection-only interface comment/member `182-186` and returned field `2709`; retain all ordinary filesystem operations and their supporting models/functions | Private engine, `make` and `layer`; replace `$ScratchpadId.create("memfs/internal/volume")` with `$TestUtilsId.create("MemoryFileSystem/internal/memoryFileSystem")`; retain MIT provenance/notice |
| `TU/src/MemoryFileSystem/MemoryFileSystem.ts` | Core alias behavior only from `FACADE:917-920,1218-1226`, expressed as the public module's named `make` and `layer` exports, with fresh-volume/default/error documentation | Public effect helper module; no optional facade members or facade imports |
| `TU/src/MemoryFileSystem/index.ts` | Curated re-export of only `make` and `layer` | Public `@beep/test-utils/MemoryFileSystem` barrel |

The source spans total 2,849 candidate engine lines before the six
inspection-only lines are omitted (**2,843**), attribution/docs are updated,
and any approved conformance repair is applied. This is a provenance span
count, not a prediction of final formatted line count. There is no need to
copy the 1,445-line facade or the 180-line inspection extension
(`ENGINE:2826-3005`). The private error schema is still required; removing
inspection does not remove the core's `effect/Schema` / identity dependency.

`make` keeps type `Effect.Effect<FileSystem.FileSystem>` and `layer` keeps
`Layer.Layer<FileSystem.FileSystem>`. Ordinary operation errors remain typed
PlatformError: constructor helpers `ENGINE:240-261`, error method/path
preservation `689-709`, invalid size checks `2019-2023`, and bounded recursion
are carried intact. The invariant error (`76-78`, used at `1539,1561`) and
scoped-finalizer defect behavior are not interchangeable with user-operation
typed failures. Core `MemoryFile` methods such as `stat` and `sync` remain
part of the standard descriptor API (`1780-1787`); excluding the optional
four-method facade `syncFileSystem` does not remove descriptor sync.

The only workspace dependency required by this engine is `@beep/identity`;
the only external runtime package is `effect`. Both already occur in
`TU/package.json:56,66`. The public conformance helper adds the already
declared `@effect/vitest` (`65`); Node/Bun test entry points use already
declared `@effect/platform-node` / `@effect/platform-bun` (`59-60`). No npm
`memfs`, scratchpad runtime dependency, seed schema library or P0e runner
dependency is needed. Root will verify declarations against its refreshed
publication base and own any manifest/lockfile change.

The directory public subpath needs an explicit source/dist mapping plus a
blocked descendant mapping like the existing ConformanceLedger entry
(`TU/package.json:17-18,82-83`). The existing `./* -> ./src/*.ts` mapping
cannot by itself resolve `./MemoryFileSystem` to `./src/MemoryFileSystem/index.ts`.
The generated Vitest aliases may also require the corresponding owner-managed
sync: `vitest.shared.ts:5,69-106` consumes them, while `tsconfig.json:67-70`
has only the current root/wildcard test-utils entries and `2010-2012` explicitly
handles ConformanceLedger. This is a source-export wiring requirement, not
authorization for this lane to edit configuration or run a generator.

Freshness is preserved by retaining the lazy `Effect.gen` allocation and
`Layer.effect` identity. Independent top-level named `it.layer` blocks create
separate memo maps/scopes by default (`PIN/packages/vitest/src/internal/internal.ts:241-247`),
so the same exported layer value builds one new volume per block. Tests
within one block share that volume. Nested blocks fork/reuse the parent memo
map (`270-276`); simply nesting the same layer is not proof of a new volume.
Where nested independence is intended, give the child a fresh layer identity
(for example `Layer.fresh` at that child boundary) and assert isolation.
Do not turn `layer` into a globally built service or promise. Do not imply
per-test freshness inside a shared block. The conformance exception keeps
per-test provides; ordinary consumers keep D14's `it.layer` rule.

## Evidence pass 4 — memory regressions, API compatibility and invocation map

### Existing memory test preservation — facts

The current 322-line file has **17 `it.effect` cases**, **3 named top-level
`it.layer` blocks**, **1 local `watchEvents` helper**, and **44 explicit
assertion sites** (29 strictEqual, 7 isTrue, 3 isFalse, 5 deepStrictEqual).
Conditional branches and the invalid-size loop make runtime assertion counts
different from these site counts. All 17 cases use only core FileSystem
behavior; none calls a seed, fault, inspection or sync facade member.

| Current test anchor | Case / category that graduates with the core |
| --- | --- |
| `31-36` | First independent block writes and reads `/shared.txt`. |
| `40-44` | Second independent block starts without `/shared.txt`. |
| `50-65` | Dot, dot-dot and repeated separator path normalization. |
| `67-79` | Rename/remove final symlink itself while retaining target bytes. |
| `81-92` | Ordinary writes follow a final symlink; readLink and realPath semantics. |
| `94-106` | remove with force false fails NotFound and preserves the missing path payload. |
| `108-118` | Exclusive creation rejects a dangling symlink; link target and absence unchanged. |
| `120-130` | Renaming one hard link over the other leaves both names/content intact. |
| `132-150` | Copy conflict reports destination and preserves content; conflicts with pinned SUITE:185. |
| `153-176` | Two concurrent descriptor appends preserve both bytes in either order; exactly one exclusive create succeeds and one fails. |
| `178-198` | Invalid size/position mutations fail without changing bytes; loop covers -1, 1.5 and MAX_SAFE_INTEGER + 1; error tag/method assertions preserved. |
| `200-217` | Metadata permissions, uid/gid, numeric utimes in seconds and TestClock; access succeeds without virtual user enforcement. |
| `219-230` | Glob does not traverse directory symlinks. |
| `232-246` | Copy beyond nesting bound fails typed BadResource/method copy without destination creation. |
| `248-273` | Six normalized committed Create/Update/Remove events including rename. |
| `275-288` | A write through one hard link publishes an update through another current hard-link path. |
| `290-321` | Nonrecursive watch filters nested changes, recursive watch includes them; both event lists retained. |

All anchors in this table are in
`scratchpad/test/MemoryFileSystem/MemoryFileSystem.test.ts`. `watchEvents:9-24`
uses the provided service's watch stream, `Stream.take`, `runCollect`, a
child fiber started immediately, the supplied mutation, and Fiber.join.
There is no host fixture, OS timing wait, live clock or platform watcher
helper to migrate. The three memory watch cases remain memory semantics;
the three native watcher cases in
`PIN/packages/platform/node-shared/test/NodeFileSystem.test.ts:47-98` are
separate platform lifecycle tests and are outside the 21-case helper.

The third block currently shares its volume and TestClock; the metadata case
sets TestClock time at line 203. Other cases use distinct named paths, but
the block is not per-test isolated. Preserve both explicit independent-block
regressions and document this sharing; no per-test layer rebuild or arbitrary
clock option is implied by this mapping. D5 corrections to direct Result or
Option assertions should retain payload checks, not merely test an outer tag.

### Pinned/current API checks — facts

Installed package metadata confirms Effect, platform-bun,
platform-node-shared and @effect/vitest at `4.0.0-rc.112`, and Vitest at
`4.1.11` (`node_modules/<package>/package.json:3-4`). Root's supplied runtime
versions are Node `v24.20.0` and PATH-selected Bun `1.4.1`; no runtime test was
run by this reconnaissance lane.

Read-only byte comparisons establish:

| Source compared (pin and installed src) | Identical SHA256 |
| --- | --- |
| `packages/effect/src/FileSystem.ts` ↔ `node_modules/effect/src/FileSystem.ts` | `ace43cfd791f76d2362542cee2dbb6b6ee41de1b2375859a0dfbf8eed2dee933` |
| `packages/platform/bun/src/BunFileSystem.ts` ↔ `node_modules/@effect/platform-bun/src/BunFileSystem.ts` | `b8fb8a56e438b7af6c2de6bd0d90b7625ab916fb26eed49d55d681160f82e2bb` |

`Fs.Size` exists at pinned/current `FileSystem.ts:408,435,466`: a branded
bigint with number/bigint input. `File.seek`, `read`, `readAlloc`, and
`truncate` retain the signatures at `1040-1047` used by
`ENGINE:1790-1866` and all pinned cursor cases. Do not port the newer
upstream HEAD ByteSize/numeric-read API or omit Size assertions based on
grounding-2's drift warning. No missing-Size API incompatibility exists in
these files at rc.112. This is source agreement, not a typecheck/runtime pass.

Both platform entry points alias the same implementation:

- `PIN/packages/platform/node/src/NodeFileSystem.ts:11-21`
- `PIN/packages/platform/bun/src/BunFileSystem.ts:10-20`

Each exports `NodeFileSystem.layer` from `@effect/platform-node-shared`.
That implementation imports `node:crypto`, `node:fs`, `node:os`, `node:path`
and its own error helper (`PIN/packages/platform/node-shared/src/NodeFileSystem.ts:12-26`),
with no Bun-specific builtin. Thus **BunFileSystem can execute under Node as
well as Bun at this pin**. Running it under Node exercises the alias, while
running under Bun exercises Bun's implementation of those Node APIs. Do not
infer that every module in platform-bun is Node-compatible from this one file.

Immediate source incompatibilities/obstacles, with attribution:

| Issue | Attribution / source | Required owner action |
| --- | --- | --- |
| Copy error path conflict | Inherited behavior conflict. `ENGINE:1352-1356` explicitly returns AlreadyExists with `toPath`; `SUITE:185` requires `source` in its Failure branch; existing memory regression requires destination. | Record and resolve before green conformance is claimed. Current source cannot satisfy both assertions without an approved contract/implementation change. |
| Missing fixed fixture in the cache and in a fresh memory volume | Snapshot extraction/environment gap (`SUITE:24,197,226,242,266`). Ordinary core make installs only `/tmp`. | Supply the local pinned bytes as described above, retaining all four cases. |
| Nonexistent promoted subpath | Expected before promotion; public wildcard cannot resolve proposed directory barrel. | Add explicit owner-controlled exports/alias wiring after pre-promotion proof. |
| Wrapper removal exposes Scope in test-body requirements | Required adaptation of `SUITE:16` helper typing after deleting only redundant wrappers. | Let public it.effect satisfy Scope; keep layer input requirements unchanged. |

Node's copy calls `NFS.cp` with `force: options?.overwrite ?? false`,
`preserveTimestamps: options?.preserveTimestamps ?? false` and recursive true
(`PIN/packages/platform/node-shared/src/NodeFileSystem.ts:57-68`). It does not
force a Failure branch for an existing destination. Therefore the port must
retain the pinned conditional failure assertions and both content assertions.
It cannot make the conflict disappear by requiring every backend to throw or
by requiring every backend to succeed. Bun's actual branch and error payload
remain runtime questions for Root.

### Invocation matrix — proposed proof, not executed

Use Vitest under the named runtime, with public @effect/vitest registration.
`bun test` is not the requested runner. No package-wide or coverage command
is part of this lane. All matrix entries use both conformance option defaults.

| Runtime | NodeFileSystem public subpath | BunFileSystem public subpath | Memory core |
| --- | --- | --- | --- |
| Node v24.20.0 | Primary Node platform leg, 21 cases | Valid alias cross-check, 21 cases; same shared implementation | 21 cases with a fresh fixture-prepared volume per test; 17 empty-volume memory regressions separately |
| Bun 1.4.1 | Valid Node-API compatibility cross-check, 21 cases | Primary Bun runtime leg, 21 cases | 21 cases plus the same 17 memory regressions to check runtime portability |

Minimum named backend coverage is Node-on-Node, Bun-on-Bun and Memory on a
chosen supported runtime: **63 conformance executions**, plus the **17**
existing memory cases. Running all three backend registrations under each
runtime gives **126 conformance executions**, plus **34** memory-specific
executions, **160 total** across two processes. These are expected counts
with zero option skips; Root must report actual collected/passed/failed/skipped
counts and attribute every failure. Two Node registrations that alias one
implementation do not count as proof of Bun runtime behavior.

Before promotion, a Root-owned temporary conformance entry point can import
`{ MemoryFileSystem } from "@beep/scratchpad/memfs"` and pass its prepared core
to the public FileSystemConformance helper. This loads the lab facade module
but invokes only `make`/`layer`; it is evidence against the actual current
engine and does not authorize shipping optional facade exports. Keep this
pre-promotion harness out of the final test-utils package so no reverse
dependency on scratchpad is introduced: scratchpad already depends on
test-utils (`scratchpad/package.json:62`).

The existing memory test can be targeted from `scratchpad/` using the existing
test-utils config (Root to execute and confirm collection):

```sh
node ../node_modules/vitest/vitest.mjs run \
  --config ../packages/tooling/test-kit/test-utils/vitest.config.ts \
  test/MemoryFileSystem/MemoryFileSystem.test.ts --pool=threads
```

The same direct invocation with PATH-selected `bun` in place of `node` is
the Bun variant. Root's temporary conformance entry point can be included in
that scoped run once it exists. The repo-root projects list
(`vitest.config.ts:10-17`) excludes scratchpad, so passing the lab file to
the root workspace run without selecting an appropriate root/config is not
proof that it was collected. Package/shared config includes
`test/**/*.test.{ts,tsx}` (`vitest.shared.ts:138`); Root must inspect counts.

After promotion, the two test files must import package source only through
public aliases:

```ts
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem"
import { readFileFixturePath, testLayer } from "@beep/test-utils/FileSystemConformance"
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem"
import { describe, it } from "@effect/vitest"
// Option/Result assertion helpers come from @effect/vitest/utils when needed.
```

The locator export above is the proposed fixture arrangement, not an existing
symbol. Local test helper/fixture imports may be relative; imports into
`../src`, the new engine's internals, the pinned cache or scratchpad may not
remain in the promoted test-utils tests. Use the direct subpaths so the core
does not acquire any dependency on the instrumented test runner.

Proposed focused commands from Root's selected publication checkout's
`packages/tooling/test-kit/test-utils/` directory, after the files exist:

```sh
node ../../../../node_modules/vitest/vitest.mjs run --config vitest.config.ts \
  test/FileSystemConformance.test.ts \
  test/MemoryFileSystem/MemoryFileSystem.test.ts --pool=threads

bun ../../../../node_modules/vitest/vitest.mjs run --config vitest.config.ts \
  test/FileSystemConformance.test.ts \
  test/MemoryFileSystem/MemoryFileSystem.test.ts --pool=threads
```

No global timeout, pool, skip, floor or configuration mutation is implied by
these focused CLI selections. They are proposals, not receipts. Node/Bun
unscoped temp API cases intentionally allocate resources that survive the
inner scope; do not replace those calls with scoped variants to tidy a run.
Root owns containment/cleanup of any native temp artifacts and the later
package/hosted acceptance required by PLAN.

## Evidence pass 5 — independent PR cut and handoff

### Attribution and notices — facts and required preservation

The full cached `PIN/LICENSE:1-21` is MIT, with
`Copyright (c) 2023 Effectful Technologies Inc` at line 3. The permission
condition at `12-13` requires retaining the copyright and permission notice
in copies or substantial portions. `SUITE` has no inline license header;
its absence does not eliminate the tree's notice. `TU/package.json:6`
currently says Apache-2.0; that package metadata is not a substitute for
retaining the copied MIT notice.

For the 435-line conformance port, include the complete cached MIT text in a
file-level comment, with attribution to Effect-TS/effect,
`packages/effect/test/FileSystem.test-utils.ts`, rc.112 commit
`2600f62f4532026928454dcea8d1c48557b3f942`, and the verified source hash.
Record the adaptation in titled `**Details**`/`**Example**` documentation per
the repo law. An inline complete notice travels with source and declarations
more reliably than a newly added notice file excluded by package file rules;
Root must ensure emitted/distributed code retains the notice too. Do not
borrow SQL's different contributor copyright string.

The engine has separate provenance: `ENGINE:16-50` identifies PR #6573,
head `c0528bd5cf12154aa95a7ceec243fd2045876853`, lloydrichards, fubhy's
effect-smol PR #456 design, Effectful Technologies Inc and MIT. Preserve
that attribution and the applicable full MIT permission/warranty text when
extracting. Do not describe this engine as an upstream rc.112 module: rc.112
is the conformance/API reference, while c0528bd5 is the engine header's
stated origin. This lane has not compared the current engine to that old PR
tree. The existing header's missing adaptation-ledger pointer and mutable
main license link are insufficient as the sole durable provenance for a
promotion; the new source should retain the verified local adaptation notes
and a packaged full notice. No web fetch was needed for this source map.

### Minimal dependency-independent PR — recommendation

The P0.5 PR should carry only the conformance helper, core engine, fixture,
and their direct tests/public wiring. It must not import
`@beep/test-utils/Vitest`, `TU/src/Vitest.errors.ts`,
`TU/src/internal/VitestInstrumentation.ts`, or
`TU/src/internal/VitestRuntime.ts`. The current `TU/src/Vitest.ts:9-11,43`
depends on that runtime and re-exports the instrumented `it`; this belongs
to P0e/P0g and is unnecessary for this cut. The six current root-barrel
exports do not need an unrelated rewrite to publish the two explicit
filesystem subpaths.

The proposed cut has **7 new/copied files** before any owner-required
generated wiring or focused regressions:

| File group | Count | Proposed files |
| --- | --- | --- |
| Core public/implementation closure | 3 | `TU/src/MemoryFileSystem/index.ts`, `MemoryFileSystem.ts`, `internal/memoryFileSystem.ts` within that directory, as mapped above |
| Conformance port | 1 | `TU/src/FileSystemConformance.ts` with testLayer, exact TestLayerOptions, fixed fixture locator, all 21 cases and MIT notice |
| Pinned fixture asset | 1 | `TU/src/FileSystemConformance/fixtures/text.txt`, the verified 26-byte pinned text |
| Direct tests | 2 | `TU/test/FileSystemConformance.test.ts` registering Node/Bun/Memory; `TU/test/MemoryFileSystem/MemoryFileSystem.test.ts` preserving all 17 current memory cases |

Existing-file edits are confined to Root's necessary public export,
asset-distribution and generated alias wiring, plus manifest/lockfile handling
if the refreshed base requires it. The current dependencies already cover
the source imports. This is not a proposal to drag P0e's entire package diff,
scanner, baseline, docs corrections or runner implementation into P0.5.
The fixture locator is the only suggested extra support export; neither
the conformance signature nor the Memory API needs a seed/fault/inspect/sync
option. If the implementing owner chooses a smaller equivalent fixture
locator arrangement, it must still satisfy the five same-path reads and
public test import boundary with zero Memory host IO.

### Promotion sequence and gates — recommendation

1. Root refreshes main, selects/creates the isolated publication worktree,
   and verifies its package/source context. Its confirmed cached tree equality
   is useful context, not a lane-authorized git action or proof of future main.
   The implementing owner loads the repo's required architecture,
   schema-first/Effect-first and JSDoc guidance before creating/touching the
   proposed source roles. No such role was created in this reconnaissance.
2. Port the exact pinned conformance helper and fixed fixture arrangement
   using public @effect/vitest. Preserve the 21 cases, 46 explicit assertion
   sites/categories, 13 Some requirements, five flipped failure requirements,
   both option flags/defaults, and the three purposeful short scopes. Removing
   wrapper scopes and changing assertion spelling must not reduce behavior.
3. Root runs Node/Bun/current-lab-Memory conformance using a temporary
   pre-promotion import boundary. Capture failures honestly. The source-path
   versus destination-path copy contradiction must be resolved explicitly;
   it is presently a blocker to an unchanged green promotion, not a task
   for a silent test adjustment in the port. Preserve the existing memory
   regression until Root gives an exact approved resolution.
4. Once the conformance gate for the agreed contract is green, copy the
   minimal core closure into the destination with `$TestUtilsId`, full notices
   and public docs; exclude the identified inspection extension and all
   optional facade surfaces. Copy/graduate the memory test through the new
   public alias. Leave the lab source and lab test in place because scratchpad
   deletion has not been approved.
5. Re-run the same matrix against the promoted public module, including the
   17 memory regressions, to prove extraction did not change the implementation.
   Confirm counts, per-build fixture freshness, independent named-block volume
   identity, scoped cleanup, exported module resolution and fixture distribution.
   Record the D8 conformance exception through the orchestrator's normal
   decision/finding process; this lane writes no waiver or scanner state.
6. Root owns package verification, manifest/lockfile review, publication,
   hosted checks and Yeet monitor closeout under `PLAN.md:182-185`. A passing
   focused suite is supporting proof and does not replace that gate. P0.5
   can ship independently of P0e's later P0g instrumented runner. No other
   package starts using MemoryFileSystem in this PR.

No seed/fault/inspect/sync demand is established by these tests. P1 evidence
and explicit scope are required before those surfaces are reconsidered.
Their current ability to make setup convenient is not evidence for promotion.
Leaving lab copies temporarily is the approved boundary; consolidating or
deleting them belongs to a later explicit decision.

### Remaining unknowns and exact owner questions

| Unknown | Evidence already available | What Root must establish |
| --- | --- | --- |
| Copy contract resolution | Pin source-path assertion and current destination-path regression are mutually incompatible on Failure. | Which exact source/test contract change is authorized while preserving D8's conformance gate and the regression's intent? This report grants no exception. |
| Runtime outcomes | Source/API map, hashes and expected case counts only. | Node/Bun/Memory exits and assertion results, including Bun cp behavior and fixture setup. |
| Promotion/public packaging correctness | Explicit directory export needed; current file allowlist excludes txt. | Source and built subpath resolution, included fixture at both layouts, and retained MIT notice in distributed artifacts. |
| Final publication base | Root reports cached main tree equals worktree HEAD. | Fresh main and exact selected publication checkout, owned by Root. |
| Exact absent effect-package fixture bytes | Two identical pinned platform fixtures, 26-byte source-grounded arrangement; effect fixture itself absent from extract. | Only if byte-for-byte historical fixture identity beyond the tested content becomes necessary, obtain its local immutable artifact or route the exact recovery question through Grok. It does not require weakening any test. |

No web work is requested to finish this reconnaissance. If Root requires
recovery of the unavailable original fixture rather than the available pinned
platform fixture, the exact research question is: “At Effect-TS/effect commit
2600f62f4532026928454dcea8d1c48557b3f942, what are the exact bytes and SHA256 of
packages/effect/test/fixtures/text.txt, and does that path exist as a file or
symlink in the tree?” Root retains the Grok route for that question.

### Read-only provenance and handoff status

Source hashes captured during this lane:

| Current worktree source | SHA256 |
| --- | --- |
| `scratchpad/memfs/MemoryFileSystem.ts` | `0602e3ab19dcd5339436f53621f43e3a28e30368191c3d6cc3194e9aedb06600` |
| `scratchpad/memfs/internal/volume.ts` | `06db3607f02b7a5434914a6179b5914910c6eb5ee5a1373b872216bdeea6d30f` |
| `scratchpad/memfs/index.ts` | `e7ff0ee2159946b2647c06637eeee1f6a6440fa40f55bdf243f56ad9595765ff` |
| `scratchpad/test/MemoryFileSystem/MemoryFileSystem.test.ts` | `8854f8286f63808e4a15183aa8a9d9fe50521edba39b5a2bdfc3d38223ea8bb3` |

These four files total **4,844 lines**. Recheck their hashes before applying
the extraction spans because other writers may change the worktree. Current
line/hash evidence supersedes the packet's old 224/2,882-line descriptions.

Executed work was document/source reading, targeted source/barrel searches,
graph discovery, line/assertion counts and SHA256/byte inspection, plus
progressive edits to this report only. No git, agent, scanner, inbox,
package/audit/coverage, source-edit, configuration, dependency, promotion,
deletion or web operation was performed. Source lookup misses (the first
top-level ops path and one incorrectly resolved shared-config path) were
corrected by reading the existing packet/root paths; they establish no
product failure. A broad Bun-path search in the initial process was
unnecessary; the resumed lane used the supplied runtime facts and did not
repeat it. No unresolved tool handle was resumed.

**Handoff status: source reconnaissance complete.** Conformance,
implementation, packaging, package verification and publication remain Root's
work. The initial “in progress” line is the preserved first draft status,
not a claim that this handoff has already implemented or verified P0.5.

Graph discovery receipt: three calls across the original/resumed lane;
reported savings total approximately 33,336 tokens (13,329 + 20,007; the
first call returned no savings estimate). Source claims above were checked
against the actual checkout/cache rather than accepted from ranked graph hits.

Final read-only cross-check: all four current source hashes and the pinned
435-line suite hash still match the tables above. Independent temp/open
call counts reproduced 3/3/5/7/9. The final public-barrel/manifest search had
zero MemoryFileSystem/FileSystemConformance matches (ripgrep exit 1 for no
matches), confirming that neither proposed promoted module was mistaken for
an existing public export. This report was reviewed for inventory completeness
and fact/proposal/unknown separation; no test execution is represented by that
review.
