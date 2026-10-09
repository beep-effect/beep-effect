# walker (lab port of @effected/walker)

[![npm](https://img.shields.io/npm/v/@effected%2Fwalker?label=npm&color=cb3837)](https://www.npmjs.com/package/@effected/walker)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

Path traversal as Effect primitives. `Walker.ascend` gives you the directory chain from a starting path to the filesystem root; `Walker.findUpward` returns the nearest existing file among per-directory candidates; `Walker.findRoot` returns the nearest directory a marker predicate accepts. Every probe absorbs its own failure, so a single unreadable ancestor cannot hide a valid `.git` or `pnpm-workspace.yaml` above it. Going the other way, `descend` expands a compiled [`@effected/glob`](https://www.npmjs.com/package/@effected/glob) pattern under a directory into the matching file paths — sorted, symlink-safe, and typed about unreadable subtrees instead of silently swallowing them. `FileSystem` and `Path` arrive from `effect` core, so no platform package is pulled in — not even in tests.

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

## Why @effected/walker

Walking up a directory tree looks like four lines of code until you meet the edges, and the edges are where the hand-rolled version quietly gets it wrong. If a probe on one ancestor fails — an `EACCES` on a directory you had no business reading anyway — the naive loop propagates that error and the whole search fails, so an unreadable directory hides the workspace root sitting one level above it. Walker absorbs each probe individually: a failed probe means "this candidate did not match", never "abort the scan". Every upward error channel is `never` as a result, and the trade is stated up front rather than discovered later — not-found and cannot-look are deliberately indistinguishable, because discovery is best-effort. The downward walk makes the opposite call on purpose: an unreadable subtree during glob expansion fails typed by default, because "no matches there" would be a wrong answer dressed as an empty one.

The other edges get the same treatment. Absorption uses `Effect.catch`, which catches failures and not defects, so a predicate that *throws* is still programmer error and still surfaces. `findUpward` scans directory-major — every candidate in the nearest directory is exhausted before ascending — so a distant ancestor's `.apprc` can never beat a nearer `config/.apprc`. `maxDepth` must be a positive integer: `NaN`, `2.5` and `0` are defects rather than a silently empty chain, which is the failure mode that looks exactly like "nothing found". And `start` is required — walker never reads `process.cwd()` on your behalf.

## Install

```bash
npm install @effected/walker effect
```

```bash
pnpm add @effected/walker effect
```

Requires Node.js >=24.11.0. `effect` v4 and `@effected/glob` are peer dependencies — walker has no runtime dependencies of its own, and the glob peer is consumed as types plus `matches()` calls only.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

`Path` and `FileSystem` come from `effect` core, not from a platform package, so a consumer provides them once at the edge (`@effect/platform-node` on Node, `@effect/platform-bun` on Bun) and a test provides core's `Path.layer` plus an in-memory volume from `@effected/memfs` — no platform package installed.

## Quick start

Ascend from a directory, then look for a file in each rung of the chain:

```ts
import { Walker } from "@effected/walker";
import { NodeFileSystem, NodePath } from "@effect/platform-node";
import { Effect, Layer, Option, Path } from "effect";

const findConfig = Effect.gen(function* () {
  const path = yield* Path.Path;
  const dirs = yield* Walker.ascend(process.cwd());
  return yield* Walker.findUpward(dirs, (dir) => [path.join(dir, ".apprc")]);
});

const PlatformLive = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

Effect.runPromise(findConfig.pipe(Effect.provide(PlatformLive))).then((found) => console.log(Option.getOrNull(found)));
// the path of the nearest ".apprc" at or above the cwd, e.g. "/home/you/project/.apprc"
// null when no ancestor had one — or when the one that did could not be read
```

`findRoot` is the same loop over the directories themselves, with a marker predicate instead of a filename:

```ts
import { Walker } from "@effected/walker";
import { Effect, FileSystem, Path } from "effect";

const findGitRoot = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dirs = yield* Walker.ascend(process.cwd());
  return yield* Walker.findRoot(dirs, (dir) => fs.exists(path.join(dir, ".git")));
});
// Effect<Option<string>, never, FileSystem | Path> — the predicate's failures are absorbed per directory
```

The predicate can be expensive — reading and parsing a `package.json` to decide whether a directory is a workspace root, say — because the scan short-circuits at the first match and never probes the rest.

## Features

The upward walk lives on the `Walker` class as statics; the downward walk is two free-standing functions. Import them side by side — there is no `Walker.descend`:

```ts
import { Walker, compileAndExpand, descend } from "@effected/walker";
```

- `Walker.ascend(start, options?)` — the directory chain from `start` toward the filesystem root, nearest first. `stopAt` halts the ascent inclusively — it must be absolute, and is matched in normalized form, so a trailing separator or a `.`/`..` segment still stops where it names; a relative ceiling is a defect rather than being resolved against the working directory, exactly as an invalid `maxDepth` is. `maxDepth` (default 256) caps the chain. Lexical, not physical: `Path.dirname` does not resolve symlinks, so ascending out of a symlinked directory follows the path you were given.
- `Walker.ascendWithin(start, ceiling, options?)` — `ascend` bounded by a physical ceiling, passed as an `Option<string>` so an unbounded walk is only ever asked for explicitly (`Option.none()` behaves exactly like `ascend(start)`, the answer outside any repository): it stops at the nearest directory whose real path is the ceiling's real path. Reach for it when the ceiling resolves symlinks — `Git.repoRoot` does — because `ascend`'s lexical `stopAt` never matches such a ceiling from a start reached through a symlink (every macOS tmpdir, any symlinked checkout), and the ascent runs to the filesystem root. The chain stays lexical; a ceiling the chain already spells costs no I/O, and an ancestor whose `realPath` fails is absorbed as "not the ceiling".
- `Walker.firstMatch(candidates, predicate)` — the first candidate the predicate accepts. Absorbs each predicate failure individually and short-circuits at the first match.
- `Walker.findUpward(dirs, candidatesFor)` — the first existing path, directory-major: every candidate in the nearest directory is tried before ascending.
- `Walker.findRoot(dirs, isRoot)` — the nearest directory a marker predicate accepts. `firstMatch` where the candidate expansion is the identity.
- `descend(pattern, options)` — the file paths a compiled `@effected/glob` pattern selects under `cwd`, POSIX separators, sorted. `onUnreadable` decides what an unreadable directory mid-walk means: `"fail"` (the default) raises a typed `DescendError`, `"skip"` continues past it and forgets it, and `"record"` continues past it and returns a `DescendResult` — `{ matches, unreadable }`, where each `UnreadableDirectory` carries the directory's `cwd`-relative `path` and the `PlatformError` it failed with, so a report never has to re-read the directory to learn why. The walk base records as `path: ""`, and a directory that vanished mid-walk (`NotFound`) is a benign race, never recorded. `followSymlinks` (default `false`) decides symlinked directories: by default they are never entered (cycle safety); under `true` they are descended under `@actions/glob`'s `traversalChain` cycle guard — a directory is a cycle only when its real path is already an ancestor of the current branch, so link loops terminate while two sibling links resolving to the same target both enumerate; a link whose real path cannot be resolved is never entered, and that failure follows `onUnreadable` exactly as an unreadable directory does — matching `@actions/glob`'s default `followSymbolicLinks: true` (Node's recursive `readdir` also follows links, but keeps no traversal chain and recurses without bound on a loop).
- `compileAndExpand(pattern, options)` — `descend` from a glob **string**: compiles it with `@effected/glob` (`options.glob`) and expands it, failing typed with `GlobExpansionError` when the pattern does not compile.

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/walker` 0.15.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- Vendored-engine notices: none found in source headers.

### Added exports

None.

### Deviations

None.

### Dependency backlog

None.
