# memfs (lab port of @effected/memfs)

[![npm](https://img.shields.io/npm/v/@effected%2Fmemfs?label=npm&color=cb3837)](https://www.npmjs.com/package/@effected/memfs)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

In-memory implementation of Effect's `FileSystem` service: an isolated virtual POSIX volume — files, directories, symlinks, hard links, open descriptors, temp resources, globbing, watching — behind the standard `FileSystem.FileSystem` key. Provide `MemoryFileSystem.layer` (or `layerWith` a seed) in place of a host-backed filesystem and any program requiring `FileSystem` runs against it unchanged. The same volume is inspectable synchronously, reachable through `node:fs`-shaped sync and promises ports, and injectable with faults.

The founding contract is honest absence: reading a path nothing seeded fails typed with `NotFound` — it never fabricates content.

> **Pre-`1.0.0`.** This package is part of the `@effected/*` kit, built on stable
> Effect v4 (`effect` `^4.0.0`) and still in `0.x` development. Stable Effect
> makes a kit `1.0.0` possible, not automatic. To keep your `effect` and
> `@effect/*` versions on the line the kit is built and tested against, install
> [`@effected/pnpm-plugin-effect`](https://www.npmjs.com/package/@effected/pnpm-plugin-effect).
>
> **Stability: unstable.** This package's API surface is not yet considered
> complete and may change across `0.x` releases. Pin an exact version — even a
> package marked *stable* before `1.0.0` can introduce a breaking change by
> accident, and an exact pin turns that into a type-check error rather than a
> runtime surprise. Full policy: [release strategy](https://github.com/spencerbeggs/effected#release-strategy).

## Install

```bash
npm install --save-dev @effected/memfs effect
```

```bash
pnpm add -D @effected/memfs effect
```

Requires Node.js >=24.11.0. `effect` v4 is a peer dependency; the package itself adds no other runtime dependencies. A dev dependency is the usual placement, since the volume is most often a test double — install it as a regular dependency when a shipped dry-run mode runs a program against it.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

## Seeding

A seed maps absolute paths to entries. Plain `string`/`Uint8Array` values are file contents; the tagged helpers let one literal describe a whole tree — empty directories, symlinks, and initial permission modes:

```ts
import { MemoryFileSystem } from "@effected/memfs";

const Volume = MemoryFileSystem.layerWith({
  "/repo/package.json": `{ "name": "fixture" }`,
  "/repo/tools/build.sh": MemoryFileSystem.file("#!/bin/sh\n", { mode: 0o755 }),
  "/repo/.cache": MemoryFileSystem.directory(),
  "/repo/latest": MemoryFileSystem.symlink("/repo/package.json"),
});
```

Parent directories are created recursively, so a seed only names the paths you care about. The seed is optional everywhere it is accepted: `MemoryFileSystem.layer` is the empty volume, and `layerWith(undefined, options)` sets options on an empty one. A contradictory seed — a file where another entry needs a directory — **dies** inside `layerWith` as a wiring bug; `MemoryFileSystem.makeWith(seed, options)` is the `Effect` form that fails it typed instead.

Seeded entries all take the volume's clock at seed time, so a seed alone cannot express "this file is older than that one". `MemoryFileSystem.file(content, { mtime })` pins an entry's modification time in epoch milliseconds, which is what a test needs to exercise a signature or cache-invalidation scheme that fingerprints a tree by modification time. Two traps come with it: the volume stamps writes from the Effect `Clock`, so under `it.effect` every write lands at the epoch until `TestClock` is advanced, and `FileSystem.utimes` reads a bare number as Unix *seconds*, so pass a `Date` when you mean milliseconds.

Layer memoization is per-build: every `Effect.provide` of a layer value — even the same bound `const` — builds and re-seeds a fresh volume. To share one volume across several effects, run them under a single provide of one composed layer graph (e.g. `Layer.provideMerge` to expose both the service under test and `FileSystem`), or build a [handle](#the-handle) and provide its pinned `layer`. `Layer.fresh`'s only role is giving one consumer *inside* that graph its own volume — across separate provides there is nothing to isolate.

## Options

Every seeded constructor — `makeWith`, `layerWith`, `makeHandle`, `makeSync` — takes one options bag:

| Option | Meaning |
| --- | --- |
| `root` | An absolute directory the seed is rooted at: seed keys become relative to it, `""` addresses the root itself, and the root is created even for an empty seed. Normalized lexically (`/ws/`, `/ws/../ws` and `/ws` are one root). It is a **join base, not a jail**: a key joins it as `path.posix.join` would, so `"../extra-dir/a.ts"` under `root: "/ws/repo"` lands at `/ws/extra-dir/a.ts`. A handle's mutators join relative paths to it too, but unnormalized: `.` and `..` resolve after links are followed, as `writeFileSync` does, so `write("link/../x")` lands beside the link's target. A relative root, or an absolute key alongside a root, is a typed `BadArgument` naming the offending value (`makeSync` throws `EINVAL` with it in the path slot). |
| `caseSensitive` | `true` by default. `false` models a case-insensitive, case-preserving volume — see [Case-insensitive volumes](#case-insensitive-volumes). |
| `faults` | Faults injected into the built `FileSystem` — see [Fault injection](#fault-injection). The seed is written beneath the faults, never through them. |

```ts
const Workspace = MemoryFileSystem.layerWith({ "a.json": "{}", "": MemoryFileSystem.directory() }, { root: "/ws" });
// "/ws/a.json" exists; "/ws" is a directory
```

## Inspecting a volume

Every memory layer — `layer`, `layerWith` and a handle's `layer` — also publishes `MemoryFileSystem.Volume`, a view over the same volume, so a test asserts on what a program *wrote* without routing every assertion back through an `Effect` read. The view is synchronous, read-only and live: it reads the volume's state at call time, so a read after a write observes the write and a removal disappears. The extra service costs nothing where only `FileSystem` is needed — a layer providing more is still assignable to `Layer<FileSystem.FileSystem>`.

```ts
import { MemoryFileSystem } from "@effected/memfs";
import { Effect, FileSystem } from "effect";

const Volume = MemoryFileSystem.layerWith({
  "/repo/package.json": `{ "name": "root" }`,
  "/repo/packages": MemoryFileSystem.directory(),
});

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString("/repo/packages/a.json", "{}");

  const volume = yield* MemoryFileSystem.Volume;
  volume.readDirectory("/repo");
  // ["package.json", "packages"] — names, sorted, not paths
  volume.readDirectory("/repo/packages");
  // ["a.json"] — the write is visible immediately
  volume.isDirectory("/repo/packages");
  // true
  volume.text("/repo/nothing.json");
  // undefined — nothing there, never ""
}).pipe(Effect.provide(Volume));
```

`snapshot()`, `text(path)`, `bytes(path)`, `has(path)` and `paths()` cover file contents; `readDirectory(path)`, `isDirectory(path)`, `mtime(path)`, `readLink(path)` and `lstat(path)` cover structure and timing. All of them are **literal**: a symbolic link is listed by its own name and never followed — not even in the middle of a path — so a link pointing at a directory answers `isDirectory` with `false`, a deliberate divergence from `statSync(p).isDirectory()`, which resolves the link first. A point query costs one lookup per path component; only `snapshot()` and `paths()` walk the tree.

Absence is reported as `undefined` rather than an empty value, and the distinction is the point: `[]` is a genuinely empty directory, `0` is a file modified at the epoch, and a signature built over mtimes must not read an absent file as one modified in 1970.

## The handle

A layer re-seeds per provide, so an assertion that runs *after* the program under test would read a different volume than the one it wrote to. A handle pins the identity: it is every view over ONE volume.

```ts
const handle = yield* MemoryFileSystem.makeHandle({ "/a.txt": "a" });
yield* handle.fileSystem.writeFileString("/b.txt", "b");
handle.volume.paths();
// ["/a.txt", "/b.txt"]
handle.sync.readFile("/b.txt");
// "b"
handle.write("/c/d.txt", "d"); // creates /c
yield* handle.fileSystem.readFileString("/c/d.txt");
// "d"
```

`handle.layer` provides `FileSystem`, `MemoryFileSystem.Volume` and `Path` over that one volume and is stable across provides — two programs provided with it see one volume. `handle.sync` and `handle.promises` are the two read-only ports below, and `write`, `mkdir`, `remove` and `symlink` are synchronous setup mutators that throw node-shaped errors (`code`, `syscall`, and the path *you* passed). A relative mutator path joins `handle.root` — the normalized `options.root`, or `undefined` — or `/` without one; for `symlink` only the link's own path joins, and the target text is stored verbatim:

```ts
const vol = MemoryFileSystem.makeSync({ "a.ts": "x" }, { root: "/r/" });
vol.root;
// "/r"
vol.write("rel.ts", "y"); // lands at /r/rel.ts
vol.symlink("../target/text", "sub/link"); // link at /r/sub/link, target verbatim
```

Seed keys and mutator paths join the root differently, on purpose. A seed key is plain data and joins **lexically**: `"../x"` under `/ws/repo` is `/ws/x`, whatever links exist. A mutator path is a filesystem call and resolves `..` **after following links**, POSIX-style: with `/r/link` pointing at `/elsewhere/dir`, `write("link/../x")` lands at `/elsewhere/x`, exactly as `write("/r/link/../x")` and the host's `writeFileSync` do.

With `options.faults`, `handle.fileSystem` and `handle.layer` are faulted while the view, the ports and the mutators work beneath the faults: they are setup and inspection, not the code under test. `options.faults` is `FileSystem`-scoped and never reaches `handle.sync` or `handle.promises`; to fault the ports, `handle.withFaults({ sync?, promises? })` returns a fresh `{ sync, promises }` pair over the same volume with those faults (same machinery as the port constructors, unknown-key `RangeError` and async rejection included), leaving the handle's own ports untouched.

`MemoryFileSystem.makeSync(seed, options)` builds the same handle **synchronously**, for Promise-style suites that construct their volume at `describe` scope and never touch `Effect`:

```ts
const vol = MemoryFileSystem.makeSync({ "package.json": "{}" }, { root: "/ws-1/repo" });
vol.volume.text("/ws-1/repo/package.json");
// "{}"
vol.sync.exists("/ws-1/repo/package.json");
// true
```

A contradictory seed throws synchronously with node's error shape, carrying the syscall of the failing seed step (`mkdir`, `open`, `symlink`, `chmod`, `utime`); an invalid `root` is `EINVAL` with syscall `seed`, since no node call corresponds to it. The mutators create a missing parent only when it is *absent*, so their failures match the single node call they stand in for: writing under a parent that is a file fails `ENOTDIR` (as `writeFileSync` does), while `mkdir` — recursive, like `mkdirSync(p, { recursive: true })` — over an existing file fails `EEXIST`. `makeSync` runs on the real clock, so its writes do not follow `TestClock`.

## The synchronous port

Some code takes an injected sync filesystem port instead of requiring `FileSystem` — a config-time hook that cannot await is the usual reason. `MemoryFileSystem.syncFileSystem(volume)` (also `handle.sync`) adapts the inspection view to the `node:fs` sync subset those ports ask for: `exists`, `readFile`, `readDirectory`, `isDirectory`, `stat` and `lstat`. A pure function over a volume: no service, no layer, no `Effect`.

```ts
const program = Effect.gen(function* () {
  const { volume } = yield* MemoryFileSystem.makeHandle({
    "/repo/package.json": `{ "name": "root" }`,
    "/repo/packages": MemoryFileSystem.directory(),
  });

  const sync = MemoryFileSystem.syncFileSystem(volume);
  sync.readDirectory("/repo");
  // ["package.json", "packages"]
  sync.readFile("/repo/nothing.json");
  // throws: "ENOENT: no such file or directory, open '/repo/nothing.json'"
});
```

Port members are standalone functions, not methods: pass `sync.readFile` as a callback without binding.

Unlike the inspection view it is built on, the port **follows symbolic links**, because the operations it stands in for are defined in `stat` terms: a link to a directory is a directory, a link is read through to its target, and a dangling link is absent exactly as `existsSync` reports it. Answering literally here would silently drop symlinked package directories from any consumer enumerating a workspace, which is the failure the port most needs to avoid.

Absence throws, because a synchronous non-`Effect` signature has no other failure channel. The thrown error is what the `node:fs` binding would raise — the same `code`, `syscall` and `path`, and node's exact message — so a consumer written against the builtin reads it unchanged: `ENOENT` absent, `ENOTDIR` for a component under a file or for listing a non-directory, `ELOOP` for a link cycle, and `EISDIR` with syscall `read` and *no* `path` for reading a directory as a file, as node reports it. It is never papered over with `""` or `[]`.

The shape is structural, so `@effected/workspaces`' `SyncFileSystem` — and anything else asking for a subset of these operations — is satisfied with neither package importing the other.

A port takes faults too. A handler receives the real arguments and may throw an errno built with `MemoryFileSystem.errno`, return a replacement, or return `undefined` to delegate:

```ts
const sync = MemoryFileSystem.syncFileSystem(volume, {
  faults: {
    readFile: (path) => {
      if (path.endsWith("file.txt")) throw MemoryFileSystem.errno("EACCES", "open", path);
      return undefined;
    },
  },
});
sync.readFile("/r/file.txt");
// throws: code "EACCES", syscall "open"
sync.readFile("/r/dir/inner.txt");
// "x" — other paths delegate
```

This is deliberately not a general escape hatch from the `FileSystem` service. Code that calls `node:fs` directly still does not see the volume; only code that accepts an injected port does. Where the call site can be changed, taking `FileSystem` from the environment remains the better answer, and it buys typed errors and the rest of the service's contract along the way.

## The promises port

`MemoryFileSystem.promisesFileSystem(volume)` (also `handle.promises`) is the async twin — the read-only `node:fs/promises` subset an injected async walker needs: `readdir` (with `withFileTypes`), `stat`, `lstat` and `readFile`, with the sync port's resolution, link-following and errors surfaced as rejections.

```ts
const fsp = MemoryFileSystem.promisesFileSystem(volume);
const dirents = yield* Effect.promise(() => fsp.readdir("/r", { withFileTypes: true }));
const link = dirents.find((d) => d.name === "to-dir");
link?.isSymbolicLink();
// true — dirents are literal, as node's are
link?.isDirectory();
// false
```

`readFile` has node's overloads: without an encoding it resolves the raw bytes (`Uint8Array`), and with `"utf8"`, `"utf-8"` or `{ encoding: "utf8" }` a string. A fault handler that throws synchronously makes the call **reject**, as a real `fs/promises` call does; it never throws at the call site.

## Fault injection

Pass `faults` to a seeded constructor to get a volume whose `FileSystem` misbehaves on cue. Injection is delegate-by-default: only registered methods are intercepted, handlers receive the real call arguments, and a handler that returns `undefined` declines, letting the call reach the volume. The opposite of `FileSystem.layerNoop`'s deny-by-default. `MemoryFileSystem.Volume` inspects the raw volume beneath the faults, so a test can inject a failure and still assert on what actually landed:

```ts
import { MemoryFileSystem } from "@effected/memfs";
import { Effect, FileSystem, PlatformError } from "effect";

const denied = (path: string) =>
  PlatformError.systemError({ _tag: "PermissionDenied", module: "FileSystem", method: "writeFile", pathOrDescriptor: path });

const Volume = MemoryFileSystem.layerWith(
  { "/locked-seed.txt": "seeded" },
  { faults: { writeFile: (path) => (path.startsWith("/locked") ? Effect.fail(denied(path)) : undefined) } },
);

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const volume = yield* MemoryFileSystem.Volume;
  yield* fs.writeFileString("/ok.txt", "ok"); // declines, delegates
  const error = yield* Effect.flip(fs.writeFileString("/locked.txt", "x"));
  error.reason._tag;
  // "PermissionDenied"
  volume.text("/locked.txt");
  // undefined — the faulted write never landed
  volume.text("/locked-seed.txt");
  // "seeded" — the seed is written beneath the faults
}).pipe(Effect.provide(Volume));
```

`MemoryFileSystem.failTimes(n, error)` is a transient fault — fail `n` intercepted calls, then delegate — for exercising retry policies (attempts are counted per execution, so `Effect.retry` outlasts it; the counter is armed once per build). Every method is interceptable, `stream`/`sink`/`watch` included (their handlers return replacement Streams/Sinks; `failTimes` is confined to the Effect-returning methods at the type level), and faults on core methods also propagate into the members derived from them (`access` → `exists`, `readFile` → `readFileString`, `writeFile` → `writeFileString`, `open` → `stream`/`sink`).

`MemoryFileSystem.die(defect)` fails a member as a **defect** instead of a typed `PlatformError`. That distinction matters: a caller's defensive `Effect.catch` absorbs a typed failure and cannot absorb a defect, which is how core's `FileSystem.layerNoop` answers its five `make*` members. A handler returning `Effect.succeed(...)` covers the third, silent-success shape (`layerNoop`'s `exists` → `false`).

Anywhere a fault map is accepted, a factory `(base) => faults` is too. It receives the unfaulted filesystem, so a handler can rewrite its arguments and delegate without re-entering its own fault:

```ts
const fs = yield* MemoryFileSystem.makeWith(
  { "/real.txt": "real" },
  { faults: (base) => ({ readFile: (path) => (path === "/alias.txt" ? base.readFile("/real.txt") : undefined) }) },
);
yield* fs.readFileString("/alias.txt");
// "real"
```

A fault key naming no member — a typo like `readFileSting` — is a wiring bug: it throws a `RangeError` naming the key at construction (a layer build dies), rather than being ignored while the test passes without its fault ever firing.

`MemoryFileSystem.layerFaulty(faults)` and `makeFaulty(base, faults)` apply the same injection to *any* `FileSystem` — the node adapter, a hand-built double — decorating whatever is provided (`layerFaulty` leaves `FileSystem` in `R`). Keys are checked against the target's own enumerable function members, so a class instance with prototype methods must be wrapped in `FileSystem.make({ ... })` first.

## Case-insensitive volumes

`caseSensitive: false` models a case-insensitive, case-preserving volume such as default APFS. The semantics are measured on a real APFS volume, not assumed: a differential suite runs the same cases against the host.

```ts
const { volume } = yield* MemoryFileSystem.makeHandle({ "/Repo/Docs.json": "{}" }, { caseSensitive: false });
volume.text("/repo/docs.JSON");
// "{}" — any spelling finds the stored entry
volume.readDirectory("/repo");
// ["Docs.json"] — listings keep the stored spelling
volume.paths();
// ["/Repo/Docs.json"]
MemoryFileSystem.syncFileSystem(volume).readFile("/repo/docs.json");
// "{}"
```

- Lookups fold in every operation, through symlinked directories too, and a create under a differently-cased name overwrites the stored entry (an exclusive create or `makeDirectory` is `AlreadyExists`).
- A case-only rename (`Dir` → `dir`) rekeys the entry with its children; renaming onto the exact spelling already given (`dir` → `dir` over a stored `Dir`) is a no-op, as on the host.
- Renaming or `copyFile`-ing onto a differently-cased existing entry keeps the destination's stored spelling; `copy` with `overwrite` unlinks and recreates, so it takes the requested one.
- `realPath` keeps the **queried** spelling, as the node adapter's does (it never canonicalizes case); only a link's target text supplies its own.
- `glob` matches case-insensitively and returns stored spellings, and a watch in one spelling sees events in another.

Folding is `toLowerCase` per UTF-16 unit, so a character whose case mapping changes length or is locale-specific (`İ`, `ß`) does not fold as a regex `i` flag would, and names are not Unicode-normalized: APFS treats the NFC and NFD spellings of `é` as one name, this volume does not.

## Permission modes are metadata, never enforced

Modes set by seeding, `chmod`, `makeDirectory` or `writeFile` are recorded faithfully and readable via `stat`, but no operation checks them: the volume models no process identity (no uid/gid/umask), so nothing ever fails `PermissionDenied` on its own — `access` checks existence only. To exercise a permission-failure code path, inject the failure with `options.faults` instead of arranging modes.

## Errors look like the Node adapter's

A test that passes against the volume should pass against `NodeFileSystem.layer` for the same reason, so failures take the shape `@effect/platform-node` gives them. Every failure the real platform would raise carries node's errno as `reason.cause.code`, and the `_tag` is derived from that code by the node adapter's own mapping:

| `cause.code` | `_tag` |
| --- | --- |
| `ENOENT` | `NotFound` |
| `EEXIST` | `AlreadyExists` |
| `EISDIR`, `ENOTDIR`, `ELOOP` | `BadResource` |
| anything else — `EINVAL`, `ENOTEMPTY`, `EBADF`, `EPERM`, `ERR_FS_EISDIR`, `ERR_FS_CP_*` | `Unknown` |

So `readLink` on a regular file fails `Unknown` with `EINVAL`, not `BadResource`; renaming onto a non-empty directory is `Unknown`/`ENOTEMPTY`; removing a directory without `recursive` — even an empty one — is `Unknown`/`ERR_FS_EISDIR`; hard-linking a directory is `Unknown`/`EPERM`; a closed or wrong-mode file handle is `Unknown`/`EBADF`. A NUL byte in a path is a `BadArgument`, and `glob` from a missing or non-directory root matches nothing rather than failing.

Where Linux and macOS disagree, the Linux errno is modelled: `copyFile` from a directory and creating a file at a new `path/` both fail `BadResource`/`EISDIR` (macOS: `Unknown`/`ENOTSUP` and `NotFound`/`ENOENT`). Unlike node's `ErrnoException`, the `cause` carries only `code` (and `path` for a path operation) — no `errno` number, no `syscall` and no `dest` — and `reason.syscall` is never set on an Effect failure; only the ports' and the handle's thrown errors carry `syscall`. A limit of the in-memory model itself (nesting depth, allocation) fails `BadResource` with no `cause`.

Three divergences are deliberate and pinned by the differential test: `copy` without `overwrite` fails `AlreadyExists` where node silently keeps the existing destination, `copy` does not create a missing destination parent, and opening a directory read-only fails at `open` (`BadResource`/`EISDIR`) where node fails at the first read with the same tag. For a two-path operation (`rename`, `copy`, `copyFile`, `link`, `symlink`) node reports the first path as `pathOrDescriptor`, and memfs reports the path the conflict concerns.

## What the volume does not see

memfs implements one thing: Effect's `FileSystem` service. It installs no hooks, patches no module registry and intercepts nothing globally, so the volume is visible to code that *asks for the service* and invisible to everything else. Five boundaries follow, and each is a property of the design rather than a gap to be closed:

- **Direct `node:fs` and `node:fs/promises` calls.** Code that imports the Node builtin reads and writes the real host filesystem, in the same process, while a volume sits unused beside it. No adapter changes that, deliberately: a filesystem-shaped facade would legitimize the bypass and grow a second, weaker sanctioned path. Bring such code under a volume by taking `FileSystem` from the environment, or by having it accept an injected port and passing it `syncFileSystem` or `promisesFileSystem`.
- **Anything a child process does.** A spawned command gets the host filesystem; nothing the parent provided travels across the process boundary. Test the command-running seam with a `ChildProcessSpawner` double, not with a volume.
- **Native-binding IO.** A native module that opens files through its own bindings — SQLite via `@effect/sql-sqlite-node` being the usual case — never touches the service, so a volume does nothing for it. Use an in-memory database (`:memory:`) for that shape of test; it is the right tool, not a workaround.
- **The current working directory.** The volume models no process cwd. Relative paths resolve from the virtual root `/`, so `"tmp/x"` means `/tmp/x` here and something else on a host filesystem. Seed and address paths absolutely, and pass the base directory into code under test rather than letting it read `process.cwd()`, which leaves the volume's model silently.
- **The platform.** memfs virtualizes the filesystem, not the platform: code reading `process.platform` (for example `@effected/xdg`'s `AppDirs`) still branches on the host; see `@effected/xdg`'s Testing section.

## Reading the real disk synchronously: node-sync

`@effected/memfs/node-sync` is the one module in this package that touches the real disk, and the only one importing `node:*` — the main entry imports nothing from it. `NodeSyncFileSystem` is a read-only, synchronous `FileSystem` over `node:fs`'s sync API, for a program that must run under `Effect.runSync` — a config loader called from a synchronous entry point — yet still takes `FileSystem` from context:

```ts
import { NodeSyncFileSystem } from "@effected/memfs/node-sync";
import { Effect, FileSystem } from "effect";

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString("package.json");
});

const text = Effect.runSync(program.pipe(Effect.provide(NodeSyncFileSystem.layer)));
```

The read members (`access`, `exists`, `stat`, `readFile`, `readFileString`, `readDirectory`, `readLink`, `realPath`) agree with `@effect/platform-node`'s `NodeFileSystem` value for value and failure for failure — a differential test holds them to it, down to copying the adapter's quirks (`realPath` keeps the queried case; `readDirectory` reports an invalid path argument as `Unknown` where the other members say `BadArgument`). Every other member — writes, `open` and the streams built on it, `glob`, `watch`, temp files — is a defect, not a typed failure: this filesystem never writes, and a caller that tries has a wiring bug `Effect.catch` must not absorb. `NodeSyncFileSystem.fileSystem` is the same filesystem as a plain value.

## Credits

The engine is a vendored port with attribution of unmerged upstream work, MIT (Effectful Technologies Inc.):

- [Effect-TS/effect#6573](https://github.com/Effect-TS/effect/pull/6573) — `MemoryFileSystem` by lloydrichards, on [fubhy's effect-smol#456 design](https://github.com/Effect-TS/effect-smol/pull/456) (engine, pinned at `c0528bd5`).
- [Effect-TS/effect#6555](https://github.com/Effect-TS/effect/pull/6555) — the parameterized `FileSystem` conformance suite (pinned at `2492ba9d`).

This package is not deprecated. When upstream ships its own `MemoryFileSystem` module in core `effect`, the release that adopts it will deprecate this package in core's favor — the module name matches upstream so that migration is an import-path change.

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/memfs` 0.14.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- scratchpad/effected/memfs/MemoryFileSystem.ts:1 // The public surface over the vendored engine (see internal/volume.ts for the
- scratchpad/effected/memfs/MemoryFileSystem.ts:5 // (errno.ts) — all extensions beyond the vendored port.
- scratchpad/effected/memfs/index.ts:28 * The engine is a vendored port, with attribution, of the `MemoryFileSystem`
- scratchpad/effected/memfs/internal/volume.ts:1 // Ported from Effect-TS/effect PR #6573 "feat: add MemoryFileSystem module"
- scratchpad/effected/memfs/internal/volume.ts:6 // Copyright: Effectful Technologies Inc.
- scratchpad/effected/memfs/internal/volume.ts:7 // License: MIT (https://github.com/Effect-TS/effect/blob/main/LICENSE)

### Added exports

| Export | Facets | Why |
| --- | --- | --- |
| `InvalidFaultCountError` | value, type | Added by review round 1; see the deviations below. |
| `UnknownFaultKeyError` | value, type | Added by review round 1; see the deviations below. |

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — Effect collections, Record/DateTime helpers, tagged constructors and explicit Orders replace native operations while preserving wrapper descriptors, timestamps and ordering (scratchpad/test/memfs/Handle.test.ts:143,161; Ports.test.ts:549,562,572; Volume.test.ts:331,340; VolumePathsOrder.test.ts:6; WatchRecursive.test.ts:69,90).
- **identity-keys** — Watcher object identities become volume-owned ids in MutableHashMap with ordered delivery and independent teardown (scratchpad/test/memfs/WatchRecursive.test.ts:69,90).
- **tagged-errors** — Schema-tagged fault, errno, NodeSync and invariant errors replace native error subclasses, adding NodeErrno tags/errno and public fault-class exports (scratchpad/test/memfs/FaultInjection.test.ts:306; Ports.test.ts:196,204; Handle.test.ts:143,161,302; Exports.test.ts:7,11; module suite scratchpad/test/memfs/**).
- **schema-first** — Executable seed/stat/inode/glob schemas and LiteralKit domains replace handwritten models, and Resolved gains schema-tagged outcomes (module suite scratchpad/test/memfs/**).
- **numeric-domains** — Finite numeric schemas replace unrestricted seed/stat/metadata fields and nominal numeric brands (module suite scratchpad/test/memfs/**).
- **type-safety** — Typed wrappers, schema guards, checked indexing and deliberatelyInvalid replace unsafe casts and assumptions (scratchpad/test/memfs/Constructors.test.ts:123; Ports.test.ts:193,248,339,537; Handle.test.ts:136,295,303; integration/node-sync.int.test.ts:63; module suite scratchpad/test/memfs/**).
- **tsgo-diagnostics** — Diagnostic-forced dual overloads replace direct-only helpers, with explicit absent errno descriptions and typed suite failures (scratchpad/test/memfs/Pipeable.test.ts:12,29,36,50; module suite scratchpad/test/memfs/**).
- **effect-first** — Effect.fn/fnUntraced, Match and canonical Effect/Option composition replace generator wrappers and helper boilerplate (module suite scratchpad/test/memfs/**).
- **effect-imports** — Per-module effect/* imports replace the root effect barrel in source, tests and examples (module suite scratchpad/test/memfs/**).
- **identity-annotations** — IdentityComposer schema/field/error annotations and the Volume service key replace unannotated contracts and the literal upstream key (module suite scratchpad/test/memfs/**).
- **test-environment** — Memfs host-oracle fixtures use TMPDIR=/tmp instead of the host default, preserving the upstream EISDIR assertion on tmpfs (scratchpad/test/memfs/ErrnoParityContract.ts:293; integration/node.int.test.ts (FileSystem errno parity (node), copyFile from a directory)).

### Dependency backlog

None.
