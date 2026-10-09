# memfs — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/memfs/CLAUDE.md -->
# @effected/memfs

In-memory implementation of core Effect's `FileSystem` service: the `MemoryFileSystem` module, providing an isolated virtual POSIX volume behind the standard `FileSystem.FileSystem` key, plus the `@effected/memfs/node-sync` subpath (`NodeSyncFileSystem`, a read-only synchronous `FileSystem` over `node:fs`). The engine (`src/internal/volume.ts`) is a vendored port with attribution of Effect-TS/effect PR #6573 (pinned `c0528bd5`), the conformance suite of PR #6555 (pinned `2492ba9d`).

**Design doc:** `@./okf/modules/memfs.md` — load when changing the engine, the seeding API, the adaptation ledger, or re-vendoring against a newer upstream head.

## Tier: pure — and the zero-edges law

`effect` is the only peer; zero runtime dependencies; the layer's `R` is `never` (the package *provides* `FileSystem`, requiring nothing). **The main entry imports nothing from `node:*`** — only `src/NodeSyncFileSystem.ts` (the `./node-sync` subpath) may, and nothing reachable from `src/index.ts` imports it. Check with an import-specifier grep or a graph walk from `index.ts`, never a bare `node:` grep (it matches prose and the substring in `Inode:`).

**No `@effected/*` edge, ever — runtime, peer, or dev.** Every kit package (including `glob`) may devDepend on this one for tests; any edge back into the kit is a cycle. Consequence: the engine keeps its embedded mini-glob for `fs.glob` — do **not** "deduplicate" it by importing `@effected/glob`.

`@effect/platform-node` is a devDependency confined to the differential-oracle integration test.

## The contracts that must not drift

- **Honest absence (the #249 contract)**: any read/stat/open-without-create of an unseeded path fails typed `NotFound`. Nothing may fabricate content — the package exists because a hand stub answering `""` caused a real silent-changeset-drop bug.
- **Typed errors always**: malformed input is `badArgument`/`systemError`, never a defect; the only `Effect.die` sites are inherited internal-invariant violations.
- **Deltas from the pinned upstream live in the design doc's adaptation ledger** (watch honors `recursive`; depth guards at `MAX_NESTING_DEPTH = 256`; seeding API; `access` options documented as ignored). Anything else diverging from `c0528bd5` is drift, not design.
- **Errno fidelity (ledger entry 10)**: every failure the real platform raises is built by `errnoError(method, path, code)` (in `internal/errno.ts`, shared by the engine, the ports and node-sync) from the errno node reports; the `_tag` is derived from the code by the node adapter's own mapping and the code rides on `cause.code`. Never hand-pick a tag at a new site — name the errno, and add the case to `__test__/ErrnoParityContract.ts`, which runs against both implementations.
- **Never edit the attribution/license notice text** in the ported file headers.
- **Ledger entry 9 (0.5.0)**: `VolumeEntrySnapshot` carries `mtime`, and `collectEntrySnapshots` now emits the **root** entry — released 0.4.0 answered `has("/") === false`.

## The public surface

- **Constructors (8).** `make` / `layer` (the upstream mirror; empty volume). `makeWith` / `layerWith(seed?, options?)` with `options = { root?, caseSensitive?, faults? }`. `root` is a JOIN BASE, not a jail (dogfood round 2 reversed the Task 3 jail): a relative key normalizes lexically and may land outside it; only a relative root or an absolute key alongside a root is rejected, naming the value. `makeHandle` (inside `Effect`) and `makeSync` (at describe scope) return a `MemoryFileSystemHandle`: `fileSystem`, `volume`, a `layer` pinned to that one volume (FileSystem + Volume + Path, stable across provides), the `sync` and `promises` ports, `root`, `withFaults({ sync?, promises? })` (faulted ports over the same volume — `options.faults` is FileSystem-scoped and never reaches the handle's ports), and setup mutators that join a relative path to `root` (or `/`; a symlink's target text stays verbatim) UNNORMALIZED — `..` resolves after links are followed, unlike a seed key's lexical join — and report the caller's path in errors. `makeFaulty` / `layerFaulty` decorate ANY `FileSystem`. Removed and never to return: `layerFaultyWith`, `layerInspectable(With)`, `makeInspectable(With)`, `MemoryFileSystemInspectable`.
- **Every memory layer publishes `MemoryFileSystem.Volume`** beside `FileSystem` (a layer providing more is still assignable to `Layer<FileSystem>` — ROut is contravariant). Under `options.faults` the service is faulted while `Volume`, the ports and the handle's mutators see the raw volume; the seed is written beneath the faults.
- **One build path**: `buildHandle` in the facade (engine → seed through the raw fs → view → optional `wrapFaulty`). Internals: `internal/seed.ts`, `view.ts`, `ports.ts`, `faults.ts`, `errno.ts`, and the engine `volume.ts`.

## The sync view and the ports

`MemoryFileSystemVolume` answers `readDirectory`, `isDirectory`, `mtime`, `readLink` and `lstat` besides the content members. They are **literal** — a symlink pointing at a directory is not one, and links are never followed, not even mid-path — and honestly absent: `undefined` for nothing there, because `[]` and `0` are real answers a signature must not conflate with absence. Point queries go through the engine's O(depth) `lookup` (a fenced kit extension); only `snapshot`/`paths` walk the tree.

`syncFileSystem(volume)` (six members: `exists`, `readFile`, `readDirectory`, `isDirectory`, `stat`, `lstat`) and `promisesFileSystem(volume)` (`readdir` with `withFileTypes`, `stat`, `lstat`, `readFile` with node's overloads — bytes without an encoding, a string with one) adapt that view to `node:fs` shapes for code that takes an injected port. The ports **follow symlinks** even though the view under them is literal — their operations are `stat`-defined, and answering literally silently drops symlinked package directories from a workspace enumeration (the regression review caught on #445). Absence **throws** (or rejects) node's exact error — `code`, `syscall`, `path` and message, pinned against real `node:fs` in `integration/ports.int.test.ts`; a `read` EISDIR carries no path, as node's does. They satisfy `@effected/workspaces`' `SyncFileSystem` **structurally, with no import in either direction: the zero-edges law above is intact** — never "finish the wiring" by adding one. Not a general escape hatch either: code calling `node:fs` directly still does not see the volume.

Two mtime traps. `file(content, { mtime })` seeds through a `Date`, because `FileSystem.utimes` reads a bare number as Unix **seconds** while the option is milliseconds. And writes stamp the Effect `Clock`, so under `it.effect` every written entry reads as `0` until `TestClock` advances.

## Case folding (ledger entry 11)

`caseSensitive: false` models a case-insensitive, case-preserving volume. Every rule was **measured on the host first** (`__test__/CaseInsensitiveContract.ts`, run against APFS by `integration/case-insensitive.int.test.ts`, which skips on a case-sensitive host) — never assume one:

- Folding lives in the engine's `lookupEntry` only; every mutation of an existing entry keys on the STORED name.
- `realPath` and watch paths keep the QUERIED spelling (the node adapter wraps the JS `fs.realpath`, which never canonicalizes); only a link's target text supplies its own.
- Rename and `copyFile` onto a folded-equal entry keep the destination's stored spelling; `copy` (async `fs.cp`, unlink-then-create) takes the requested one — re-probe with async `cp`, never `cpSync`, which differs. A case-only rename rekeys the entry with its children; a byte-identical rename is a no-op.
- `glob` folds and returns stored names; watch matching compares folded paths.
- Limits: `toLowerCase` per UTF-16 unit (`İ`, `ß`), no NFC/NFD normalization.

## node-sync

`NodeSyncFileSystem` (`./node-sync`) is read-only and synchronous: its read members agree with `@effect/platform-node`'s `NodeFileSystem` value for value and failure for failure (`integration/node-sync.int.test.ts`), including the adapter's quirks — the JS `realpathSync` (never `.native`), and `readDirectory` reporting argument errors as `Unknown`/`ERR_*` where every other member says `BadArgument`. Do not "fix" either. Every non-read member is a DEFECT (`FileSystem.makeNoop` fails typed instead, so it is not spread). `NodeSyncFileSystem.fileSystem` is a value, not an `Effect`.

## Layer discipline

`layerWith(seed, options)` and `layerFaulty(faults)` are parameterized factories — fresh reference per call: bind to a `const`. **Layer memoization is per-build, not per-value** (downstream item 6, 2026-08-16): every `Effect.provide` of a layer value — even the same bound `const` — builds and re-seeds a fresh volume (and re-arms `failTimes` counters). Sharing one volume across effects requires ONE provide of one composed layer graph, or a handle's pinned `layer`; `Layer.fresh`'s only role is opting a consumer *inside* that graph back out into its own volume. Never describe the old "one layer value = one shared volume" framing — it produced silent false greens downstream.

## Fault injection (kit extension)

`options.faults` on a seeded constructor, or `makeFaulty(base, faults)` / `layerFaulty(faults)` over any `FileSystem`, wrap delegate-by-default: handlers get the real call arguments and return a replacement (an Effect; a Stream/Sink for `stream`/`sink`/`watch`) or `undefined` (delegate); `failTimes(n, err)` is the transient form, confined to the Effect-returning methods at the type level and counted per execution (so `Effect.retry` attempts consume failures). The wrapper rebuilds through `FileSystem.make`, so faults on core methods propagate into derived members (`access` → `exists`, `readFile` → `readFileString`, `writeFile` → `writeFileString`, `open` → `stream`/`sink`) — and every function-valued member, the lazy trio included, is also directly interceptable. `die(defect)` is the defect arm (what `layerNoop` does to its `make*` members; `Effect.catch` cannot absorb it), and every wrapper also accepts a `(base) => faults` factory whose `base` is the unfaulted filesystem, run once per build. **An unknown fault key throws `RangeError` at construction** (checked against the target's own enumerable function members, so a class instance with prototype methods must be wrapped in `FileSystem.make` first); a promises-port handler that throws synchronously rejects. Modes are metadata, never enforced — fault injection is the sanctioned way to simulate permission failures.

## Testing and building

Tests in `__test__/`, `@effect/vitest`, `assert.*` never `expect`. Three layers:

- **Contracts run against both implementations** — each `*Contract.ts` suite runs against memfs AND the real disk (`integration/*.int.test.ts`, the differential oracle): the adapted #6555 `FileSystemContract`, `ErrnoParityContract`, and `CaseInsensitiveContract` (host run skips on a case-sensitive volume). `integration/ports.int.test.ts` and `node-sync.int.test.ts` diff the ports and node-sync against `node:fs` / `NodeFileSystem` directly. If memfs and the host disagree, memfs is wrong.
- **The upstream-ported** `MemoryFileSystem.test.ts` — its body stays upstream's.
- **Kit suites, one per feature**: `Constructors`, `Seeding`, `HonestAbsence`, `Volume`, `Handle`, `Ports`, `FaultInjection`, `WatchRecursive`, `CaseInsensitive`; shared helpers (`thrown`, `denied`, `collectWatch`, `firstEvent`) live in `__test__/helpers.ts`.

A new behaviour starts RED, and its fix is mutation-checked: revert the fix and watch a test fail. A new case-folding rule is proved on the host before memfs implements it.

```bash
pnpm vitest run --project @effected/memfs   # from the repo root
pnpm build --filter @effected/memfs
```

Never run `node savvy.build.ts --target prod` directly. `savvy.build.ts` carries the narrow `_base` suppression — never widen it. `package.json` stays `"private": true`.


---
<!-- okf/modules/memfs.md -->
---
type: Module
title: "@effected/memfs"
description: An in-memory implementation of core Effect's FileSystem service — an isolated virtual POSIX volume the kit's tests use as their filesystem double.
status: stable
kind: package
resource: ../../packages/memfs
layer: L1
tags:
  - testing
  - architecture
sources:
  - id: package-json
    resource: ../../packages/memfs/package.json
  - id: claude-md
    resource: ../../packages/memfs/CLAUDE.md
  - id: volume-internal
    resource: ../../packages/memfs/src/internal/volume.ts
  - id: memory-filesystem
    resource: ../../packages/memfs/src/MemoryFileSystem.ts
generated:
  by: "okfit/claude-code"
  at: 2026-10-01T14:11:47Z
  body_sha256: 522749f07160ad72f495733e32583596fe8ae9a84c0ffd8e30b293f953a987ba
---

# @effected/memfs

`@effected/memfs` is an in-memory implementation of core Effect's
`FileSystem` service: an isolated virtual POSIX volume — files,
directories, symlinks, hard links, open descriptors, temp resources,
globbing, watching — behind the standard `FileSystem.FileSystem` key, so
any program or test that requires `FileSystem` in `R` runs against it
unchanged. It exists because core ships only `FileSystem.layerNoop`,
which is deny-by-default, so every hand stub encodes only what its
author remembered; one such stub answered an unarranged read with `""`
instead of failing and caused a silent-changeset-drop bug downstream
(effected#249).

The founding contract is **honest absence**: a read of a path nothing
seeded fails typed (`SystemError` reason `NotFound`), never fabricates
content. It recurs three times in this design — in the service, in the
[volume inspection view](#volume-inspection), and in
[the ports](#the-ports) — and each recurrence is
deliberate.

## The vendored port

The engine is a port with attribution of two unmerged upstream
contributions, pinned by SHA:

- **Engine**: Effect-TS/effect PR #6573 "feat: add MemoryFileSystem
  module" by lloydrichards, built on fubhy's design in effect-smol PR
  #456. Pinned head `c0528bd5cf12154aa95a7ceec243fd2045876853`. MIT,
  Effectful Technologies Inc.[^volume-internal]
- **Conformance suite**: Effect-TS/effect PR #6555 "test: add file
  system test suite" (`FileSystemTest.ts`, a contract suite
  parameterized over any `Layer<FileSystem, unknown>`), same author.
  Pinned head `2492ba9df1c0fd25a2119aace82dafb2b7b8e77c`.

Vendored rather than waited-for because both PRs sat unmerged for months
with neither queued, and the kit needed the capability immediately.
**Sunset clause**: the release in which core's `effect` ships a
`MemoryFileSystem` module, this package is deprecated in favor of it —
the module name `MemoryFileSystem` deliberately mirrors upstream so the
migration is an import-path change. **`node-sync` needs re-homing, not
deletion**: it is not a memory filesystem, and its read-only sync
contract is independent of the engine.

The pins are the anti-drift record: re-evaluating against a newer
upstream head is a deliberate re-vendor with this document updated,
never an in-place edit. Every deliberate delta is listed in
[the adaptation ledger](#adaptation-ledger); anything else diverging
from `c0528bd5` is drift, not design.

## Tier and dependencies: a pure main entry plus one boundary subpath, with a zero-@effected-edges law

**Pure main entry, one boundary subpath.** The package stays pure tier: `effect` is its only peer, zero runtime dependencies, zero `@effected/*` edges. The `./node-sync` subpath (`src/NodeSyncFileSystem.ts`) is the single module allowed to import `node:*`, following the `@effected/workspaces/node-sync` precedent, and nothing reachable from `src/index.ts` imports it. Verify with an import-specifier grep or a module-graph walk — a bare `node:` grep is vacuous, since it matches prose and the substring in `Inode:`.

The main entry performs no host IO — the volume is immutable in-memory
state (a `HashMap`-backed inode table) behind a one-permit semaphore —
and it *provides* `FileSystem` rather than requiring anything: the
layer's `R` is `never`. `effect` is the only peer; zero runtime
dependencies.[^package-json]

**No `@effected/*` edge, ever — runtime, peer or dev.** The package's
whole purpose is to be the filesystem double every kit package's tests
consume as a devDependency, `@effected/glob` included. Any edge from
`memfs` back into the kit creates the cycle this law exists to prevent.
Its one structural consequence: the engine keeps the upstream mini-glob
(brace expansion, character classes, globstar) for the `FileSystem.glob`
member — a deliberate duplication of capability `@effected/glob` also
ships. Do not "deduplicate" by importing `@effected/glob`; the
duplication is the price of the law, and the mini-glob serves only
`fs.glob`, never a public matching API. See
[the zero-edges decision](../decisions/memfs-zero-effected-edges.md) for
the full reasoning, including why no other candidate host package
worked.

`@effect/platform-node` is a devDependency only, confined to the
differential-oracle integration tests.

## Public surface

Two entry points. The main entry, `MemoryFileSystem`, provides core's
`FileSystem` service and is pure — it imports nothing from `node:*`. The
`./node-sync` subpath, `NodeSyncFileSystem`, is the one boundary module
(see [node-sync](#node-sync-the-boundary-subpath)).

Eight constructors, all in the main entry:

- `make` / `layer` — a fresh empty volume, as an `Effect` and a `Layer`
  (fresh per build). The upstream mirror; the ported engine's own `make`.
- `makeWith(seed?, options?)` / `layerWith(seed?, options?)` — a fresh
  volume pre-populated from a `path → MemoryFileSystemSeedEntry` record;
  parents are created recursively, then each entry applied in the
  record's key order. The seed is optional.
- `makeHandle(seed?, options?)` — an `Effect<MemoryFileSystemHandle,
  PlatformError>`; `makeSync(seed?, options?)` — the same handle built
  synchronously, throwing node-shaped errors.
- `makeFaulty(base, faults)` / `layerFaulty(faults)` — decorators over
  **any** `FileSystem`, not only this package's. `layerFaulty` is
  `Layer<FileSystem, never, FileSystem>`.

`options` is `{ root?, caseSensitive?, faults? }`. `root` is a lexical
**join base, not a jail**: a seed key joins it as `path.posix.join` does,
so a `..` key may normalize outside the root. A relative root, or an
absolute key alongside a root, is still a typed `BadArgument`. Seed-key
errors name the offending key or root; `makeSync` throws `EINVAL` with
that key in the path slot (`EINVAL: invalid argument, seed '/abs.txt'`),
not an empty one. `faults` faults the `FileSystem` service only, never the
handle's ports. One internal
`buildHandle(seed, options)` serves `makeWith`, `layer`, `layerWith`,
`makeHandle` and `makeSync`; the seed is written through the **raw**
filesystem, beneath any faults, so a fault can never break seeding. The
layer forms are parameterized factories: bind the result to a `const`. A
contradictory seed dies in the layer forms (wiring-bug posture); the
`make` forms keep seeding failures typed.

**`Volume` is always published.** Every memory layer (`layer`,
`layerWith`, `handle.layer`) provides `FileSystem | MemoryFileSystemVolume`.
Under `faults`, `Volume` inspects the raw volume, not the faulted
service. Consumers that compose two memory layers with `Layer.merge` get
two `Volume`s and the last wins — as `FileSystem` already behaves.

Helpers: `file`, `directory`, `symlink` (seed entries), `failTimes`,
`die`, `errno(code, syscall, path?)` and the `Volume` key.

### Seed entries

A seed value is a `MemoryFileSystemSeedEntry`: plain `string |
Uint8Array` contents, or one of three tagged entries built by statics —
`file(content, { mode?, mtime? })`, `directory({ mode? })`,
`symlink(target)`. One literal describes a whole tree: files (mode
`0o644` default), empty directories (`0o755` default; `directory()` is
the only way a seed expresses one) and symbolic links whose target is
stored verbatim and may dangle. A directory's mode is applied by a
post-`makeDirectory` `chmod`, so it lands even when the directory was
created implicitly as a parent.

`file`'s `mtime` pins a modification time in epoch milliseconds; without
it every entry takes the volume's clock at seed time. Two unit traps sit
around this, recorded in [ledger entry 9](#adaptation-ledger). `root`
seeds beneath a directory other than `/`.

### The handle

`makeHandle` / `makeSync` return a `MemoryFileSystemHandle`: `fileSystem`,
`volume`, `layer` (FileSystem + Volume + `Path`, pinned to one volume and
stable across provides), `sync`, `promises`, `root` (the normalized
`options.root`, or `undefined`), `withFaults` and the mutators `write`,
`mkdir`, `remove`, `symlink`. The mutators throw node-shaped errors and
create a parent only when it is absent.

- **`withFaults({ sync?, promises? })`** returns `{ sync, promises }` —
  faulted ports over the same volume, through the same machinery as
  `syncFileSystem` / `promisesFileSystem` (unknown-key `RangeError`,
  async rejection of a synchronous throw). The handle's own `sync` and
  `promises` stay unfaulted.
- **Mutators join a relative path to `root`, or to `/` without one.** The
  joined path reaches the engine **unnormalized**, so `..` resolves after
  following links, POSIX-style, as node does (host-pinned: `link/../x`
  lands beside the link's target, not beside the link). Seed keys stay
  lexical — the one place the two differ. An absolute path is passed
  through unchanged. `symlink` joins only the link path; its target text is
  stored verbatim. Errors report the caller's own path.
- **The parent check uses the port's `lstat`**, which follows intermediate
  links but not the final component, so a dangling or looping parent link
  fails `ENOENT` or `ELOOP` like node rather than being `mkdir`'d over.

**Assertion timing chooses the
family:** the layer forms serve tests that resolve `Volume` and assert
*inside* the provided effect; when assertions run *after* it, build the
handle once, wrap `handle.fileSystem` in `Layer.succeed`, and assert on
`handle.volume` — a layer form builds and re-seeds a fresh volume per
provide, and a post-run assertion would read a volume nobody wrote to.

### Fault injection

A delegate-by-default wrapper. Faults arrive as `options.faults` on any
seeded constructor, or through `makeFaulty` / `layerFaulty` over an
arbitrary base:

- `failTimes(times, error)` — the first `times` intercepted calls fail,
  then delegation resumes. Armed per build; throws `RangeError` on a
  negative or non-integer count.
- `die(defect)` — fails the member as a **defect**, the arm
  `FileSystem.layerNoop` uses for its `make*` members. A caller's
  defensive `Effect.catch` absorbs a typed fault and cannot absorb a
  defect. Lazy members take their own type (`Stream.die`, `Sink.die`).
- `MemoryFileSystemFaultsFactory` — `(base) => faults`, where `base` is
  the **unfaulted** filesystem, so a handler can rewrite arguments and
  delegate without re-entering its own fault.

Design decisions worth keeping:

- **`undefined` delegates**, and unregistered methods are never
  intercepted — the inverse of `layerNoop`'s deny-by-default.
- **Handlers receive the real call arguments**, so a fault keys on one
  specific call.
- **Faults are type-constrained to each method's channel**: an injected
  failure must be a genuine `PlatformError`; `die` is the one deliberate
  exit.
- **Unknown fault keys throw `RangeError`** naming the key, at
  construction (`makeFaulty`, the ports) or layer build (`options.faults`
  dies). Keys must be *own enumerable function members* of the target, so
  a class instance with prototype methods must be wrapped in
  `FileSystem.make` first. A typo used to be silently ignored — a green
  test proving nothing.
- **Every function-valued member is interceptable**: the wrapper rebuilds
  through `FileSystem.make` (a fault on a core method propagates into the
  derived ones) and re-intercepts the derived members on top, so a fault
  on `readFileString` is not discarded by re-derivation.
- **Effect-returning methods dispatch per execution** through
  `Effect.suspend`, so `Effect.retry` re-consults the handler; `watch`,
  `stream` and `sink` are handler-form and consulted at invocation.
- **`failTimes` counters arm per build**; `Layer.fresh` re-arms. Under
  `@effect/vitest`'s `layer(...)` one build serves the suite, so a
  `failTimes` there is consumed by whichever test runs first.

### Volume inspection

A synchronous, read-only view of the volume the `FileSystem` writes to,
so a test asserts on what a program *wrote* without an `Effect` read.

- `MemoryFileSystem.Volume` — the context key,
  `Context.Service("@effected/memfs/MemoryFileSystemVolume")` in function
  form, deliberately copying `FileSystem.FileSystem`'s own key pattern so
  the sunset clause stays an import-path change.
- `MemoryFileSystemVolume` — `snapshot()`, `text`, `bytes`, `has`,
  `paths`, `readDirectory`, `isDirectory`, `mtime`, `readLink` and
  `lstat`. Pure sync functions over the live state at call time, never a
  copy taken at build. Returned byte arrays are defensive copies.
- **Point queries are O(depth)**, answered by the engine's
  [`lookupLiteral`](#adaptation-ledger); only `snapshot`/`paths` walk the
  tree. Port path resolution and `readdir({ withFileTypes })` used to
  snapshot the whole tree per component.

Semantics, documented rather than incidental:

- **Regular files only** in `snapshot`/`paths`; `paths()` is exactly
  `snapshot()`'s key set, sorted lexicographically.
- **Symlinks are never followed anywhere in the view — not even
  mid-path.** `has` sees the link itself; `text`/`bytes` answer
  `undefined` for it; `isDirectory` is literal (a link to a directory is
  `false`), a deliberate divergence from `statSync(p).isDirectory()`.
  `readLink` and `lstat` are the literal probes.
- **Hard links fan out**: one entry per directory entry.
- **Query paths normalize lexically only** (`//`, `.`, `..`, relative
  paths from `/`); normalization never touches the volume.
- **Absence is always `undefined`, never a plausible empty value** —
  `""` only ever means a genuinely empty file; `readDirectory` answers
  `undefined` rather than `[]`, `mtime` `undefined` rather than `0`.
- **`has("/tmp")` is `true` on an unseeded volume**: the engine
  pre-creates it.

### The ports

Two adapters over the view, for consumer code that accepts an
**injected** port rather than `FileSystem`. Neither is a service, layer
or `Effect`; both take `(volume, { faults? })`.

- `syncFileSystem(volume)` — `exists`, `readFile`, `readDirectory`,
  `isDirectory`, `stat`, `lstat`.
- `promisesFileSystem(volume)` — `readdir` (with `withFileTypes`), `stat`,
  `lstat` and `readFile` with node's overloads: a `Uint8Array` without an
  encoding, a `string` with `"utf8"`, `"utf-8"` or `{ encoding }`.
  A handler that throws synchronously **rejects**.

Shared contract:

- **Structural, importing nothing.** `syncFileSystem` satisfies
  `@effected/workspaces`'s `SyncFileSystem` because the shapes agree; the
  zero-edges law forced the route and it serves anything asking for those
  operations.
- **Absence throws or rejects node's exact error**, message included
  (`"<CODE>: <description>, <syscall> '<path>'"`); a descriptor syscall
  (`read` of a directory) carries no path, as node's does. Answering `""`
  or `[]` would be the effected#249 fabrication in a new costume. Honest
  absence's third home.
- **They follow symbolic links, and the view underneath does not.** A
  port stands in for `stat`-defined operations, so a link to a directory
  IS a directory and a dangling link is absent. A literal port would make
  symlinked package directories invisible to workspace enumeration.
  Resolution is per component with an `ELOOP`-style hop cap.
- **Standalone members are unbound-safe.**
- **Not an escape hatch from the service.** Code calling `node:fs`
  directly still does not see the volume. See
  [provenance and refusals](#provenance-and-refusals).

### Case-insensitive volumes

`caseSensitive: false` folds every name lookup the way APFS does. Ledger
entry 11 holds the engine rules; the limits are stated here so a test
does not over-trust it. Folding is `toLowerCase` **per UTF-16 unit**, so
characters whose case mapping changes length or is locale-specific (`İ`
U+0130, `ß`/`ẞ`) do not fold as a regex `i` flag would, and there is
**no NFC/NFD normalization** — APFS treats them as one name, memfs does
not. Listings, `paths()` and `snapshot()` keep stored spellings.

### node-sync: the boundary subpath

`@effected/memfs/node-sync` exports `NodeSyncFileSystem.fileSystem` (a
`FileSystem` **value**, not an Effect; renamed from `make` before any
release) and `NodeSyncFileSystem.layer`.

- The read members — `access`/`exists`, `stat`, `readFile`/`readFileString`,
  `readDirectory` (including `recursive`), `readLink`, `realPath` — run on
  synchronous `node:fs`, so they work under `Effect.runSync`. They agree
  with `@effect/platform-node`'s `NodeFileSystem` value for value and
  failure for failure.
- Adapter quirks are copied on purpose: JS `realpathSync`, never
  `.native`; `readDirectory` argument errors are `Unknown` /
  `ERR_INVALID_ARG_*` while every other member says `BadArgument`; a
  non-string `readFile` path fails `Unknown` / `ERR_INVALID_ARG_TYPE`
  without calling `readFileSync`, which would read the number as a file
  descriptor. Do not "fix" them.
- Every other member is a **defect** — `FileSystem.makeNoop` fails typed
  instead of dying, so it is not spread.
- **Proof is a differential, not `ErrnoParityContract`**:
  `integration/node-sync.int.test.ts` runs 67 cases (NUL and non-string
  arguments included) against `@effect/platform-node`. It does not run
  `errnoSuite`, which includes write cases that would die against a
  read-only adapter; an earlier design's claim that it does was wrong.

## What the volume does not see

See [what the volume does not see](../limitations/memfs-what-the-volume-does-not-see.md)
for the full limitation this bounds.

## Internals

The internal engine lives in `src/internal/volume.ts` (adapted from
upstream's `internal/memoryFileSystem.ts`); `src/MemoryFileSystem.ts` is
the facade carrying the kit extensions; `src/index.ts` is the only
re-exporting module.

## Behavioral contracts

- **Honest absence** — the effected#249 contract: reading, statting or
  opening (without a create flag) any unseeded path fails typed with
  reason `NotFound`; nothing in the package can fabricate content for a
  path nothing arranged.
- **Error normalization**: every failure is core's `PlatformError` —
  `systemError` with a truthful `_tag`/`method`/`pathOrDescriptor`, or
  `badArgument` for malformed caller input. Malformed input never
  defects. The only `Effect.die` sites are genuine internal-invariant
  violations inherited from upstream.
- **Errno fidelity with the node adapter** ([ledger entry 10](#adaptation-ledger)):
  every failure the real platform raises carries node's errno as
  `reason.cause.code`, and the `_tag` is derived from that code by the
  switch `@effect/platform-node`'s `handleErrnoException` uses —
  `ENOENT` → `NotFound`, `EEXIST` → `AlreadyExists`,
  `EISDIR`/`ENOTDIR`/`ELOOP` → `BadResource`, anything else → `Unknown`.
  A site names the errno node raises, never a tag, so tag parity holds
  by construction. Unlike node's `ErrnoException`, the `cause` carries
  only `code` (and `path` for a path operation) — no `errno` number, no
  `syscall`, no `dest` — and `reason.syscall` is never set on an Effect
  failure; only the synchronous port's thrown errors carry `syscall`.
  Where Linux and macOS
  disagree, the Linux errno is modelled. Limits of the in-memory model
  (nesting depth, allocation, position range) fail `BadResource` with no
  `cause`: no real errno corresponds to them.
- **Isolation**: each `make`/layer *build* is one volume. Layer
  memoization is per-build, not per-value: every `Effect.provide` of a
  layer value — even the same bound `const` — builds and re-seeds a
  fresh volume (and re-arms `failTimes` counters). Sharing one volume
  across several effects requires one provide of one composed layer
  graph; `Layer.fresh`'s only role is opting a consumer *inside* that
  graph back out into its own volume. Under `@effect/vitest`,
  `layer(...)` memoizes one build for the whole suite, so a `failTimes`
  fault declared there is consumed by whichever test runs first and
  later tests silently see it exhausted.
- **Modes are metadata, never enforced.** Modes set by seeding, `chmod`,
  `makeDirectory` or `writeFile` are recorded faithfully and readable
  via `stat`, but no operation checks them: the volume models no
  process identity (no uid/gid/umask), so nothing ever fails
  `PermissionDenied` on its own — a write to a `0o444` file succeeds.
  This is intended rather than a gap: modeling process identity is a
  large feature that fault injection replaces more cheaply, and
  injecting the failure is the sanctioned way to exercise a
  permission-failure path. `access` ignoring its `readable`/`writable`/`ok`
  options is the same contract, not a separate quirk.
- **POSIX semantics** as the vendored engine defines them: bounded
  symlink traversal (40, exceeding → typed `BadResource`), root-clamped
  `..` (no escape), unlink-while-open keeps the inode until the last
  descriptor closes, no hard links to directories, relative paths
  resolve from `/` (the `FileSystem` contract has no cwd).

## Adaptation ledger

Deliberate deltas from the pinned upstream. Every delta is also recorded
in the engine file's port-notes header; this document is the
authoritative list.

1. **`watch` honors `options?.recursive`.** Upstream's adapter ignores
   the `WatchOptions` parameter and infers recursion from the target
   being a directory; the `FileSystem` interface passes the option, so
   the port honors it.
2. **Recursion surfaces are depth-guarded.** Upstream recurses unbounded
   in `containsDirectory`, `collectInodePaths`, `cloneInode`,
   `detachEntry`, `validateCopyDirectoryContents` and
   `findBraceExpansion`; a pathological tree would stack-overflow as a
   defect. Guarded at `MAX_NESTING_DEPTH = 256`,[^volume-internal]
   failing typed, guard-consistent with the format packages' own
   [input-hardening standards](../conventions/input-hardening-standards.md).
3. **The seeding API** (`makeWith`/`layerWith`/`makeHandle`/`makeSync` and the
   `MemoryFileSystemSeedEntry` union) is a kit extension; upstream has
   none.
4. **`access` ignores its `readable`/`writable`/`ok` options** —
   inherited upstream posture, since there is no virtual process
   identity; kept, and stated as the general mode-non-enforcement
   contract rather than an `access`-local footnote.
5. **Mechanical adaptations**: relative `../X.ts` imports → `"effect"`
   package imports with `.js` extensions, house formatting, TSDoc
   release tags, `assert.*` in tests.
6. **Upstream bug fixed** (worth reporting on PR #6573): `copy` with
   `overwrite: false` onto an existing destination reported the
   *source* path on its `AlreadyExists` error while every sibling
   conflict arm reports the destination; the port reports the
   destination, and the vendored contract suite's conditional assertion
   is adjusted to match (the node adapter never enters that branch —
   node's `fs.cp` with `force: false` silently preserves the
   destination).
7. **The fault-injection API** (`makeFaulty`/`layerFaulty`/`options.faults`/`failTimes`/`die`)
   is a kit extension; upstream has none. It lives in the facade, never
   in the ported engine — it wraps *any* `FileSystem`, so re-vendoring
   the engine cannot disturb it, and it is the piece that would need
   re-homing (not deleting) if the sunset clause fires.
8. **Volume-inspection hooks** — the one kit extension that does reach
   into the ported engine, in clearly fenced blocks — three here, with entries 11 and 12 adding more (the
   attribution header itself is untouched):
   - `Volume.currentState()` — a synchronous read of the committed
     state. Safe because the engine's `State` is immutable and each
     transition swaps the reference under the volume's one-permit lock:
     a sync read observes one consistent state and can never see a
     half-applied transition.
   - `make` re-expressed as `makeReadyVolume` (build + pre-create
     `/tmp`) composed with `toFileSystem(volume)`, so the handle
     derives both halves from one volume. The exported name
     and type are identical — a re-vendor re-applies the split, it does
     not fight it.
   - `VolumeEntrySnapshot` + `collectEntrySnapshots` (an iterative
     sorted DFS over the inode tree, matching the port's iterative-walker
     posture and its depth discipline) and the internal
     `InspectableFileSystem` (its `makeInspectable` constructor was later
     removed; see entry 12). The public view is built on top; the engine
     exposes no interpretation of its own.
9. **Entry modification time on the inspection snapshot** —
   `VolumeEntrySnapshot` carries an `mtime` field (epoch milliseconds),
   populated in `collectEntrySnapshots` from the inode's `mtime:
   DateTime.Utc` via `DateTime.toEpochMillis`. The engine tracked mtime
   all along and `stat` already reported it, so nothing new is computed
   and no transition changes — only the snapshot carries what the inode
   already held. `collectEntrySnapshots` also emits the **root** entry
   itself: a walk reporting only descendants leaves `/` in no snapshot,
   and `has("/")` then answers `false` for a directory that always
   exists. Emitting it from real inode state — rather than synthesizing
   a stand-in in the facade, which would have had no honest `mtime` to
   report — makes `has`/`isDirectory`/`readDirectory`/`mtime` uniform for
   `/`; `snapshot`/`paths` filter on `data` and are unaffected, and the
   facade's `readDirectory` excludes the queried path itself so `/` does
   not list itself as an empty-named child.

   Two unit traps sit around this, recorded because each silently
   produces wrong *times* rather than an error. First, the seed option
   is epoch milliseconds while `FileSystem.utimes` reads a bare `number`
   as Unix seconds (matching `fs.utimesSync`), so seeding converts
   through a `Date` — passing the number through multiplies every seeded
   time by 1000. Second, the volume stamps writes from the Effect
   `Clock`, which is what makes mtime drivable with `TestClock` — and is
   also why every write under `it.effect` reads as `0` unless the clock
   is advanced, so a seeded time appears to be in the future.

10. **Errno fidelity** — engine errors are built by `errnoError`
    from a node errno code, with the tag derived by node's own mapping
    and the code carried on an `Error` cause (`code`, `path`). The
    upstream engine hand-picked tags, and code tested against it
    misread the real adapter: `readLink` on a regular file failed
    `BadResource` where node fails `Unknown`/`EINVAL`, which
    `@effected/workspaces`' `binProvenance` had to tolerate both ways.
    An audit ran every failure site against both implementations and
    against raw `node:fs` on macOS and Linux (node 24, Docker). The
    per-site mapping, with the platform splits:

    | Operation | Before | After (= node) | Platform notes |
    | --- | --- | --- | --- |
    | `readLink` on a non-link | `BadResource` | `Unknown` `EINVAL` | |
    | `remove` a directory without `recursive` (empty, non-empty, `force`, trailing slash) | `BadResource`, or success when empty | `Unknown` `ERR_FS_EISDIR` | node's `fs.rm` refuses every directory |
    | `makeDirectory` beneath a file (plain or recursive) | `AlreadyExists` | `BadResource` `ENOTDIR` | |
    | `makeDirectory("/")` | `BadResource` | `AlreadyExists` `EEXIST`; recursive succeeds | |
    | `rename` a directory into itself | `BadResource` | `Unknown` `EINVAL` | |
    | `rename` onto a non-empty directory | `BadResource` | `Unknown` `ENOTEMPTY` | errno 66 macOS, 39 Linux; the code is the same |
    | `rename`/`copyFile`/`link`/`symlink` other kind conflicts | `BadResource` | `BadResource` + `ENOTDIR`/`EISDIR` | a file onto `dir/` is `ENOTDIR` on Linux, `EISDIR` on macOS; `EISDIR` modelled |
    | `link` to a directory | `PermissionDenied` | `Unknown` `EPERM` | |
    | `copy` onto itself or its own hard link | success no-op, or `AlreadyExists`/`BadResource` | `Unknown` `ERR_FS_CP_EINVAL` | checked before `overwrite` |
    | `copy` into itself | `BadResource` | `Unknown` `ERR_FS_CP_EINVAL` | |
    | `copy` kind mismatch (top-level or nested, any `overwrite`) | `AlreadyExists`/`BadResource` | `Unknown` `ERR_FS_CP_DIR_TO_NON_DIR`/`ERR_FS_CP_NON_DIR_TO_DIR` | |
    | handle ops on a closed handle, or `read`/`write` on the wrong mode | `BadResource` | `Unknown` `EBADF` | |
    | `truncate` a read-only handle | `BadResource` | `Unknown` `EINVAL` | `ftruncate` is `EINVAL` on both platforms |
    | NUL byte in a path | `NotFound`/`BadResource` | `BadArgument` | node validates before any syscall |
    | trailing slash on an existing directory | `BadResource` | addressed as the directory (so `rename dir/`, `remove dir/ recursive` succeed) | |
    | trailing slash on a missing path | `BadResource` | `NotFound` `ENOENT`; creating a file there `BadResource` `EISDIR`; renaming a file there `BadResource` `ENOTDIR` | Linux modelled; macOS reports `ENOENT` for the last two |
    | `copyFile` from a directory | `BadResource` | `BadResource` `EISDIR` | Linux modelled; macOS `Unknown` `ENOTSUP` |
    | `glob` from a missing, non-directory or looping root | `NotFound`/`BadResource` | success, `[]` | |
    | `truncate` to a negative length (path or handle) | `BadArgument` | success, clamped to 0 | |
    | `utimes` failures | method `utimes` | method `utime` | the node adapter's method name |
    | every other errno site (`ENOENT`, `EEXIST`, `ENOTDIR`, `EISDIR`, `ELOOP`) | tag already right, no cause | same tag, plus `cause.code` | |

    Kept divergences, pinned by the differential suite rather than
    disclaimed: `copy` without `overwrite` fails `AlreadyExists` where
    `fs.cp` silently keeps the destination and merges into an existing
    directory; `copy` does not create a missing destination parent;
    a read-only `open` of a directory fails at `open` where node fails
    at the first `read`/`readAlloc` with the same tag and code; a
    two-path operation reports the path the conflict concerns where
    the node adapter always reports its first argument; `description`
    stays set where node's is undefined. The upstream memory-specific
    test pinning `truncate(-1)` as `BadArgument` was amended, since
    node clamps it.

    **The errno move.** `errnoError`, `ErrnoException`, `errnoTag` (the
    node adapter's `handleErrnoException` switch, case for case),
    `errnoMessages` and `nodeErrno` left `volume.ts` for
    `src/internal/errno.ts`; the engine, both ports, the handle and
    `NodeSyncFileSystem` all import them. `errnoCodeForTag` became
    `fallbackErrnoForTag` — it is **not** the inverse of `errnoTag`, which
    is many-to-one. `nodeErrno` produces node's exact message, and
    `MemoryFileSystemErrnoError.path` is optional because a descriptor
    syscall carries none. `integration/ports.int.test.ts` pins message and
    path equality against real `node:fs`.

11. **Case folding** — a fenced `KIT EXTENSION (case folding — adaptation
    ledger entry 11)` in `volume.ts`, plus one port-notes header line; the
    attribution text is untouched. `State.caseSensitive` is fixed at build.
    `lookupEntry(state, dir, name)` returns `[storedKey, inode]`, trying an
    exact match then (when not case-sensitive) a `toLowerCase` scan;
    `findEntry` derives from it, and every former exact-name check uses the
    folded one. Every mutation of an *existing* entry keys on the **stored**
    name. Rules, each measured on a case-insensitive APFS host:
    - **`realPath` keeps the queried spelling**, because the real adapter
      wraps JS `fs.realpath`, which walks lexically and never canonicalizes
      case (unlike `realpathSync.native`). Only a link's target text
      supplies its own spelling.
    - **`rename`**: the no-op guard compares the queried source leaf (a
      byte-identical rename keeps the stored spelling); a case-only rename
      rekeys the same inode under the requested name with children attached;
      a replace-rename onto a folded-equal entry keeps the destination's
      **stored** spelling.
    - **Spelling asymmetry**: `copyFile` onto a folded-equal entry keeps the
      stored spelling; `copy` with `overwrite` onto a folded-equal file takes
      the **requested** spelling (async `fs.cp` unlinks then creates); `copy`
      merging into a folded-equal directory keeps the directory's stored
      name while a replaced child takes the source spelling. Probe with async
      `fs/promises`; `cpSync` differs.
    - **`glob`** folds per token (a character class accepts either case) and
      returns stored names; the v4 option is `root`.
    - **Watch** compares folded paths when not case-sensitive; the delivered
      event keeps its own spelling. No host oracle exists, because
      `fs.watch` on macOS is nondeterministic — memfs tests pin it.
    - **Limits**: `toLowerCase` only, per UTF-16 unit (`İ`, `ß`/`ẞ` do not
      fold as a regex `i` flag would), and no NFC/NFD normalization.
    - **Proof**: `CaseInsensitiveContract.ts` (21 cases) runs against the
      host via `integration/case-insensitive.int.test.ts` (skipped on a
      case-sensitive tmpdir, so Linux CI runs only the memfs side) and
      against memfs via `CaseInsensitive.test.ts`.

12. **Inspection lookup** — a fenced `KIT EXTENSION (inspection lookup)`
    in `volume.ts`: `lookupLiteral(state, components)` walks components
    through `lookupEntry` (so it folds for free), never follows a symlink
    even mid-path, and is O(depth). `InspectableFileSystem` gains
    `lookup(path)` and `list(path)`; its `caseSensitive` field is gone
    because folding lives only in the engine. `internal/view.ts` answers
    point queries through it. The kit-only `internal.makeInspectable`
    export was removed; the ported `make` and `layer` are unchanged.
13. **Recursive `makeDirectory` through an unresolvable link** (#891) — a
    fenced `KIT EXTENSION (errno fidelity — adaptation ledger entry 13)`
    in `makeDirectory`. When a path component exists but does not resolve
    (a dangling or looping symbolic link), the engine failed
    `AlreadyExists` `EEXIST`; node's recursive mkdir answers the `EEXIST`
    with a `stat` and reports why that failed. Probed on macOS (node 26)
    and Linux (node 26, Docker), identical on both except the
    trailing-slash row:

    | `makeDirectory(path, { recursive: true })` where the component is | Before | After (= node adapter) |
    | --- | --- | --- |
    | a dangling link, final | `AlreadyExists` `EEXIST` | `NotFound` `ENOENT` |
    | a dangling link, earlier in the path | `AlreadyExists` `EEXIST` | `BadResource` `ENOTDIR` |
    | a dangling link named `link/` | `AlreadyExists` `EEXIST` | `NotFound` `ENOENT` (Linux modelled; macOS creates the link's target and succeeds) |
    | a symlink loop, final or earlier | `AlreadyExists` `EEXIST` | `BadResource` `ELOOP` |

    The earlier-in-path dangling row is the node adapter's, not
    `mkdirSync`'s: the adapter calls callback `fs.mkdir`, whose async
    walk reports `ENOTDIR` where `mkdirSync` reports `ENOENT` on both
    platforms. The ELOOP row needs no rewrite for the earlier case —
    the deeper mkdir syscall raises it directly. Without `recursive`
    nothing changed: a link as the final component is `EEXIST`, and a
    dangling link earlier in the path is `ENOENT`. Links to a file or a
    directory already agreed (`EEXIST` / `ENOTDIR`, and success through
    a directory link); all of these are pinned in
    `ErrnoParityContract.ts`.

    The handle needed two follow-ups in the facade, in the same fence.
    Its `mkdir` stands in for `mkdirSync`, not the adapter, so a
    dangling link earlier in the path is rewritten from the engine's
    `ENOTDIR` to `ENOENT` (the first unresolvable component answering
    `ENOENT` can only be a dangling link). And `ensureParent`, behind
    `write`/`symlink`, used to swallow only the `EEXIST` the engine
    raised over such a link; it now swallows any errno-backed mkdir
    failure, because the call that follows walks the same component and
    reports node's own errno and syscall. `integration/ports.int.test.ts`
    pins the handle's `mkdir` against real `mkdirSync`.

## Superseded: opt-in `Volume`, no type widening

An earlier design published `Volume` only from a doubled family of
`…Inspectable` constructors, so that `layer`, `layerWith` and
`layerFaulty*` stayed typed `Layer<FileSystem>`, pinned by a test. That
is **superseded** (breaking change, approved under "breaking changes
allowed where they improve DX"). Every memory layer now publishes `Volume`
and is typed `Layer<FileSystem | MemoryFileSystemVolume>`. The opt-in axis
doubled every constructor for a benefit — annotation stability — that
variance already gives: `Layer`'s `ROut` is contravariant, so a wider
layer is still assignable to `Layer<FileSystem>` and existing annotations
compile. `Constructors.test.ts` pins that assignability; the no-widening
test was deleted as superseded.

Migration from the removed names: `layerFaultyWith(seed, faults, o)` →
`layerWith(seed, { ...o, faults })`; `layerInspectable[With]` → `layer` /
`layerWith`; `makeInspectable[With]` → `makeHandle`; the
`MemoryFileSystemInspectable` type → `MemoryFileSystemHandle`.
`promises.readFile(path)` now resolves a `Uint8Array`, as node's does.

## Provenance and refusals

The kit extensions above are not speculative API design — every one was
requested with a blocked call site by a downstream consumer or an
internal one. The refusals matter as much as the extensions, because
each is a standing decision rather than an unexplored corner:

- **An `fs.promises`-shaped facade was declined** and reshaped into
  [the ports](#the-ports). Reading the downstream call sites found that
  the shape actually wanted was the sync port `@effected/workspaces`
  already defines; neither side saw that from where it was standing. The
  refusal targeted a facade that legitimizes bypassing injection — code
  importing `node:fs/promises` still does not see the volume, and no
  adapter changes that. A **read-only adapter for an injected async port**
  (`promisesFileSystem`) is the class of call site the refusal itself said
  a port serves, so it shipped: an adapter for injected ports is in scope;
  a replacement for direct `node:fs` imports is not.
- **A trailing-slash seed key meaning an empty directory was declined**
  (#887 §8). `directory()` already expresses an empty directory, and
  key-syntax magic is what plain-data fixture tables trip over.
- **`seedFromDirectory` was withdrawn by the consumer** that asked for
  it, once its own survey found the only on-disk fixtures were
  subprocess-e2e trees a volume can never serve, and that every other
  fixture is composed inline as literals with no directory to seed
  from. It stays an [open question](#open-questions).
- **A lock module was declined as out of scope**: it is a cross-process
  lock exercised by two spawned processes, and a per-process volume
  gives a second process nothing to contend on.
- **Mode enforcement was declined** in favor of fault injection, as the
  behavioral contracts above record.

Downstream deliberately keeps some suites on real tmpdirs, where the
point is the kernel *enforcing* a mode — that is the honest boundary of
what fault injection substitutes for.

## In-kit adoption

The kit packages consuming the volume in tests are `walker`,
`tsconfig-json`, `xdg` (`AppDirs`), `workspaces`, `templates`, `npm` and
`github-actions`'s runner-file doubles. Each migration off a hand-rolled
`FileSystem.layerNoop` double was mutation-checked rather than declared
done on a green suite — see
[memfs over layerNoop](../decisions/memfs-over-layernoop.md) for the
general discipline and
[the testing standards](../conventions/testing-standards.md) for how
this generalizes across the kit.

The migration surfaced real defects, which is the whole return on it:

- `tsconfig-json`'s documented file-only divergence — it probes with
  `exists`, which is directory-true, where `tsc` uses a file-only
  `fileExists` — was invisible because map membership made directories
  not exist. A test asserting `None` had been passing for the wrong
  reason. Against the volume the directory exists, the divergence is
  observable, and the test now pins it.
- A second `tsconfig-json` fixture had seeded a file *and* a directory
  at one path, a contradiction only map membership permits, and had
  been silently skipping its test.
- `templates` requires `FileSystem` but deliberately not `Path`, so it
  cannot create a parent directory — meaning "the caller guarantees the
  directory exists" was an untested precondition. The `Map` accepted
  writes into directories that did not exist; the volume refuses them.
- `github-actions`'s runner-file doubles were re-implementing append
  (`flag: "a"`) by string concatenation — filesystem behavior
  hand-modelled inside the test of something else.

The pattern in all four: a stub agreed with the code under test because
the same person wrote both, and the agreement read as a passing test.

**`@effected/jsonl` is deliberately not a consumer.** Its
`__test__/helpers/memfs.ts` is a control harness, not storage: a write
gate with a vacuity guard, deterministic watch emission, a synchronous
`unlink`. Migrating it would trade determinism for storage it does not
need. The name collision is unfortunate and the distinction is the
point — a double that exists to control *timing* is a different
artifact from one that exists to hold *bytes*, and only the second is
this package's job.

Not yet migrated: `schemastore`, `app`, `xdg`'s `XdgConfig` suite, and
`jsonl`'s storage half.

## Test strategy: the differential oracle

Eight layers of proof, largest first:

1. **The vendored contract suite** (PR #6555's `FileSystemTest.ts`,
   adapted to house style) run against `MemoryFileSystem.layer`. It
   asserts `reason._tag`/`method`/`pathOrDescriptor` per operation, so
   it *is* the error-normalization oracle.
2. **The same suite against the real filesystem**: an integration test
   running the identical suite over `@effect/platform-node`'s
   `FileSystem` layer. Memory and disk passing one suite is the
   differential proof the port matches real semantics on this catalog
   pin — the same differential-oracle discipline named in
   [the testing standards](../conventions/testing-standards.md), with
   the platform layer as the reference implementation.
3. **Memory-specific and kit tests**: the upstream adapter tests
   (isolation, concurrent appends, watch events, hard-link fan-out,
   metadata) plus the seeding API, the honest-`NotFound` effected#249
   contract, per-build isolation and the watch-recursive adaptation.
4. **Fault-injection tests**: the chmod-relock scenario over a real
   recursing tree; empty-map passthrough and unregistered-method
   delegation; path-keyed faults; direct-fault coverage of every derived
   member, proving none is silently bypassed by the re-derivation,
   alongside core-to-derived propagation; `watch` replacement *and*
   delegation; `failTimes` under `Effect.retry`, its per-build re-arm
   across two provides of one bound `const`, and `RangeError` on bad
   counts; `die` surviving a caller's `Effect.catch`; factories receiving
   the unfaulted base and running once per build; and `@ts-expect-error`
   tests pinning the type enforcement.
5. **Errno-parity suite** (`__test__/ErrnoParityContract.ts`, kit-owned
   so the vendored suite stays unedited): one case per disputed failure
   from [ledger entry 10](#adaptation-ledger), run against both the
   volume and the node adapter, asserting `_tag`, `method` and
   `cause.code`. Platform-split cases carry `{ linux, darwin }`
   expectations (memfs asserts Linux; the node run asserts its host),
   and kept divergences carry `{ memory, node }` so a change on either
   side fails. Every fix was mutation-checked against it.
6. **Case-folding contract** (`CaseInsensitiveContract.ts`, 21 cases) run
   against the host and memfs, as ledger entry 11 records.
7. **node-sync differential**: 67 cases against `@effect/platform-node`
   (`integration/node-sync.int.test.ts`); it is **not** proved by
   `ErrnoParityContract`, whose write cases would die against a read-only
   adapter.
8. **Volume-inspection tests**: the pairing invariant (a write through
   `FileSystem` is immediately visible to `Volume`, a removal
   likewise); per-build isolation across two provides; `Volume` published from every layer with `Layer<FileSystem>` assignability; seed parity across every entry kind; honest absence plus
   the `""` round-trip that distinguishes an empty file from an absent
   one; lexical query normalization; the defensive-copy mutation
   attempt; composition under fault injection via `Layer.provideMerge`;
   `/` answered as a real directory rather than a hole in the walk;
   `undefined` distinguished from `[]` and from `0`; and the ports throwing or rejecting node's exact error where the view
   answers `undefined`.

The contract suite roots every path it touches under
`makeTempDirectoryScoped({ prefix: "effect-filesystem-test-" })` with no
`directory` option, so the node oracle runs confined to the host's
`os.tmpdir()` and never touches the repository tree.

## Attribution

The house pattern: `src/internal/volume.ts` opens with a "Ported
from … / Copyright … / License: MIT / Port notes:" header naming both
PRs, both pinned SHAs, both authors (lloydrichards; fubhy for the
effect-smol#456 design), and the adaptation ledger in
brief.[^volume-internal] The adapted test suite carries the same header
for PR #6555. The README credits both PRs. Never edit the notice text.
Effect is MIT (Effectful Technologies Inc.), compatible with the kit's
MIT license.

## Open questions

- **`seedFromDirectory`** — building a seed by reading a real directory
  tree. Unbuilt, and deliberately not built on the one consumer that
  asked, since that consumer withdrew it. It needs a downstream with
  real on-disk fixture trees whose code under test does not spawn, and
  no such consumer has appeared. An `Effect`-returning form requiring
  `FileSystem` in `R` would satisfy the withdrawn ask; nothing has
  asked for a synchronous one.
- Whether a published `layerTest` should default to a fresh seeded
  volume instead of hard-providing `FileSystem.layerNoop`. Two follow-up
  requests carry the same question, owned by their own packages rather
  than this one, and both should be answered the same way — the shape
  of the answer is a kit convention, not a per-package taste.
- **A whole-volume case-insensitive mode** (effected issue 874) is
  closed: it is built as `caseSensitive: false`
  ([ledger entry 11](#adaptation-ledger)). The fault-factory
  member-by-member workaround is no longer the answer.

## Testing and build

Tests live in `__test__/`, use `@effect/vitest`, and assert with
`assert.*` — never `expect`, per
[the testing standards](../conventions/testing-standards.md). Never run
`node savvy.build.ts --target prod` directly. `savvy.build.ts` carries
the narrow `_base` suppression documented in
[the API Extractor gotcha](../gotchas/api-extractor-forgotten-export-on-class-factories.md)
— never widen it. `package.json` stays `"private": true`.

[^package-json]: `packages/memfs/package.json` — `effect` as the only
    peer dependency, no runtime dependencies.
[^volume-internal]: `packages/memfs/src/internal/volume.ts:1-59` — the
    attribution header and `MAX_NESTING_DEPTH = 256`.
