# walker — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/walker/CLAUDE.md -->
# @effected/walker

Path traversal: upward (`Walker.ascend` / `ascendWithin` / `firstMatch` /
`findUpward` / `findRoot`) and downward (`descend`, the public glob-file walker). Sixth
migration; the first package extracted from an already-merged sibling rather
than ported from a `*-effect` repo.

**Design doc:** `@./okf/modules/walker.md`

## Tier: boundary

**Boundary tier**: `effect` and `@effected/glob` are the only peers and there
are no runtime dependencies, but walker does IO. `FileSystem` and `Path` arrive
through the `R` channel from `effect` core, so the consumer's platform layer is
the single place POSIX-vs-win32 semantics are chosen. Requiring core services
costs no dependency. The `@effected/glob` peer is mostly type-and-property —
`descend` imports `GlobPattern` as a type and calls `matches()`. The one value
import is `compileAndExpand` (in `Expand.ts`), which calls
`GlobPattern.compileResult` and references `GlobPatternError`; the peer was
already declared, so the dependency graph is unchanged.

Walker needs **no platform package, even in tests** — core's `Path.layer` plus a real in-memory volume from `@effected/memfs` (a devDependency). Do not add `@effect/platform-node`, and do not hand-roll a `FileSystem.layerNoop` tree: `__test__/fixtures.ts` seeds files and symlinks into the volume, and injects the unreadable and vanished directories as `readDirectory` faults — and an unresolvable link as a `realPath` fault — that decline for every other path. The volume owns the parent-directory arithmetic and the symlink semantics `descend` reads, so neither is re-derived in the fixture. The upward suites in `Walker.test.ts` do the same: `findUpward`'s fixtures seed a volume via `MemoryFileSystem.layerWith`, and the denied probe is an `exists` fault on a candidate that is genuinely present — so disarming the fault moves the answer.

`Walker` is a static class with a private constructor, not an `as const`
namespace object — an `as const` object's member types are inferred in the
built `.d.ts` and lose their TSDoc entirely, while a class's `static readonly`
declarations keep it. Call syntax is unaffected (`Walker.ascend(...)`).

## The one absorbing loop

`firstMatch` is the whole algorithm. `findRoot` is a genuine one-line
specialization of it (`firstMatch(dirs, isRoot)` — the candidate expansion is the
identity). `findUpward` first flattens each directory's candidates in
**directory-major** order, then reuses the same loop.

Three properties are load-bearing. Each has a test, and each test has been
watched failing against a deliberately broken implementation:

- **Absorption is per candidate.** A failing probe means "this candidate did not
  match", never "abort the scan". One `EACCES` ancestor must not hide a valid
  root above it. The corollary: not-found and cannot-look are deliberately
  **indistinguishable** to the caller. Discovery is best-effort, and a `None` may
  mean a directory was unreadable rather than empty.
- **Defects propagate.** `firstMatch` uses `Effect.catch`, which catches failures
  and not defects. **Never** change it to `Effect.catchCause`.
- **`firstMatch` short-circuits.** The scan stops at the first match; later
  candidates are never probed. A marker predicate can be expensive —
  `isWorkspaceRoot` reads and parses a `package.json` — so this is not just an
  optimization.

Every upward error channel is `never` — including `ascend`'s, whose two
caller-error guards (`maxDepth`, `stopAt`) are **defects**, not failures. The
one typed error in the package is `descend`'s `DescendError` — see below.

## `descend` — the downward glob-file walker

`descend(pattern, options)` expands a compiled `@effected/glob` `GlobPattern`
under `options.cwd`, returning matching FILE paths relative to `cwd`, POSIX
separators, sorted. The walker is **semantics-free**: dotfile behavior and
every other matching option are carried by the compiled pattern the caller
hands in — never re-derived here.

- A literal pattern (no magic, not negated) fast-paths to one stat; missing is
  zero matches. A magic pattern walks from `enumerationPrefix`; a **negated**
  pattern walks from `cwd` itself (its matches can land outside the inner
  pattern's prefix); a missing base directory is an **empty result**, not an
  error. A pattern that lexically climbs above `cwd` via `..` segments is
  zero matches, refused before any filesystem access — the walk never reads
  outside its documented root lexically, and physically only while
  `followSymlinks` is off (under it a link targeting outside `cwd` IS
  descended, as `@actions/glob` follows links out of the tree).
- Only files match. A symlink counts when it stat-resolves to a file (`stat`
  follows links, as node's does); a symlinked **directory is never descended**
  by default (cycle safety, detected by a `readLink` success-probe), unless
  `followSymlinks: true` opts in — then links are entered under
  `@actions/glob`'s per-branch `traversalChain` guard: each `DescendFrame`
  carries its branch's ancestor real paths, and a directory is a cycle only
  when its real path is already an ancestor of the branch it sits on. The
  guard is per-branch, never walk-global — two sibling links to one target
  BOTH enumerate (a global visited set silently dropped the second, and a
  test pins that it does not). Only the base and each link pay a
  `FileSystem.realPath`; a plain directory's real path is its parent's plus
  its name. A link whose `realPath` fails is never entered, and the failure
  goes through `onUnreadable` like a failed `readDirectory` (NotFound stays
  the silent benign race). Dangling = no match either way.
- Unreadable directory mid-walk: `onUnreadable: "fail"` (default) fails typed
  as `DescendError` — the OPPOSITE of the upward per-probe absorption, because
  a swallowed subtree in a downward enumeration is silently missing
  membership. `"skip"` absorbs and continues. `"record"` absorbs and resolves
  to a `DescendResult { matches, unreadable }` instead of a bare array, where
  each `UnreadableDirectory` is `{ path, cause }` — the absorbed
  `readDirectory` (or, for a link under `followSymlinks`, `realPath`)
  `PlatformError` travels with the entry, so a caller that
  must report WHY never re-reads the directory. The walk base records as
  `path: ""`. A NotFound mid-walk is a benign vanished-directory race and
  reads as empty in every mode — it is never recorded.
- Depth past `maxDepth` (default 256) is a typed `depthExceeded` failure,
  never a truncation; an invalid `maxDepth` is a **defect**, exactly
  `ascend`'s guard.
- The descent is a worklist dequeued by head index (never `Array.shift()`),
  and a pattern that cannot match below one level (`crossesSegments` false and
  not negated) reads a single level and never descends.
- `prune` suppresses **directories only** — a FILE named `.git` (a submodule
  or worktree gitlink) stays matchable.

## Invariants

- `ascend` is **lexical, not physical**: `Path.dirname` does not resolve
  symlinks, so ascending out of a symlinked directory follows the given path.
  Correct for config discovery. A **physical** ceiling (`Git.repoRoot`'s answer)
  never matches `stopAt` from a symlinked start; that is `Walker.ascendWithin`,
  a separate static so `ascend`'s `R` stays `Path` alone →
  `okf/decisions/physical-ceiling-is-a-separate-static.md` — Load when:
  touching `stopAt`, `ascendWithin`, or bounding a walk by a repository root.
- `ascend` is a bounded `for` loop, not recursion. It terminates at `dirname`'s
  root fixpoint; `maxDepth` (default 256) guards a pathological `Path`.
- `stopAt` must be **absolute** and is compared in **normalized** form
  (`path.resolve` on both sides), not by raw string equality; it stays
  **inclusive**. Raw equality made the ceiling fail **open**: an unnormalized
  ceiling matched nothing and the ascent ran to the filesystem root with no
  error to notice it by. Normalization is idempotent, so a caller that resolves
  first is unaffected. Both sides go through `resolve` — normalizing only the
  ceiling would desynchronize it from an unnormalized chain element (`/a/b/.`
  names `/a/b`).
- A **relative** `stopAt` is a **defect** (`Effect.die`), exactly as an invalid
  `maxDepth` is, and is never resolved against `process.cwd()`. Resolving one
  would let the same ceiling name different directories in a hook, a CLI and a
  test runner — the fail-open class again, through a different door. This is
  why `ascend` reads `process.cwd()` nowhere. Absoluteness is judged by the
  injected `Path`, so win32 accepts `C:\repo`. Only the **ceiling** is
  constrained: a relative `start` still ascends to the relative root, and a test
  pins that the rejection was not over-applied to `start`.
- **Never "upgrade" the `stopAt` guard to a typed error.** `@effected/config-file`'s
  resolver contract absorbs every typed failure into `Option.none()`, so a typed
  rejection would be swallowed there and re-emerge as a clean-looking "no config
  found" — the silent wrong answer the guard exists to prevent. `Effect.catch`
  does not catch defects, so only a defect survives that absorption. A test
  reconstructs the absorbing caller and pins it. This is the same
  failure-vs-defect line as `maxDepth`: malformed input fails typed, a
  statically-wrong caller option dies.
- Normalization governs the **comparison only** — the returned chain stays the
  lexical one derived from `start`, because rewriting it would break the
  lexical contract for every caller that passes no `stopAt` at all.
- `maxDepth` must be a **positive integer**. Anything else — `< 1`, `NaN`, or a
  non-integer like `2.5` — is a **defect** (`Effect.die`), never a silently-empty
  chain. The guard is `!Number.isInteger(maxDepth) || maxDepth < 1`, because
  `NaN < 1` and `2.5 < 1` are both `false`.
- `findUpward` is **directory-major**: every candidate in the nearest directory is
  exhausted before ascending. A candidate-major interleave would let a distant
  ancestor's `.apprc` beat a nearer `config/.apprc`.
- `start` is required. Walker never reads `process.cwd()`.

## Build

`savvy.build.ts` carries the one narrow `_base` suppression
(`{ messageId: "ae-forgotten-export", pattern: "_base" }`) for the synthesized
base of the `DescendError` class factory. Never widen it.

Never run `node savvy.build.ts --target prod` directly.


---
<!-- okf/modules/walker.md -->
---
type: Module
title: walker
description: Path traversal as a small, testable library -- upward ascent to a marker via an absorbing search, and downward glob-file expansion with a fail-typed error posture, sharing no state and no error contract between the two directions.
status: stable
kind: package
resource: ../../packages/walker
layer: L1
tags:
  - architecture
sources:
  - id: walker-package-json
    resource: ../../packages/walker/package.json
  - id: walker-claude-md
    resource: ../../packages/walker/CLAUDE.md
generated:
  by: "okfit/claude-code"
  at: 2026-09-29T06:16:45Z
  body_sha256: 1ba613bb7d2f79897bf2e1e47e1fe55a57fc14c46430a47764437626686b2d80
---

# walker

## Scope and tier

`@effected/walker` is path traversal as a small, testable library, in two
directions. **Upward**: ascend a directory chain toward the filesystem
root and return the first candidate satisfying a predicate. **Downward**:
expand a compiled glob pattern under a directory and return the matching
files. A third module, `Expand.ts`, owns the compile-plus-expand recipe
over the downward walk.

The upward walk is the repository's **one absorbing traversal loop** —
[config-file](config-file.md), [xdg](xdg.md) and `@effected/workspaces`
all discover files through it.

**Boundary tier** — see [the library-tier glossary
entry](../glossary/library-tier.md). `peerDependencies` is `effect` and
`@effected/glob`; there are **no runtime dependencies**.[^walker-package-json]
`FileSystem` and `Path` arrive via the `R` channel from the consumer's
platform layer, so a win32-versus-POSIX choice is made exactly once, at
the consumer's edge. The `@effected/glob` edge is asymmetric across the
two modules: `descend` alone is type-and-property only — it imports
`GlobPattern` as a type and reads its metadata getters and `matches()` —
so a consumer importing only `descend` pulls no matching engine.
`compileAndExpand` value-imports glob's compiler, because owning the
compile step is the whole point of that module.

Walker defines no `Context.Service` of its own. Pattern-to-matcher stays
[glob](glob.md)'s job: walker is semantics-free about matching, reading
only the compiled pattern's metadata and calling `matches`. Downward
enumeration lives here because it had nowhere else to live — glob is a
pure matching engine with no walker, and "files matching a glob under a
directory" is the gap `descend` fills.

## Module layout

Two directions and one recipe: `Walker.ts` (upward), `Descend.ts`
(downward) and `Expand.ts` (the recipe), plus the re-export-only
`index.ts`.[^walker-claude-md] `descend` and `compileAndExpand` are bare
functions, not statics on the `Walker` class, because they are different
algorithms with a different error posture and folding either in would
imply they share `Walker`'s `never`-channel contract. `Walker` itself is
a static class with a private constructor, not an `as const` object, so
its `static readonly` declarations keep their TSDoc in the built
declaration file. A start directory is always required everywhere in the
package — walker never reads `process.cwd()`, because a traversal
library that silently defaults to the process working directory cannot
be tested or reasoned about.

## firstMatch is the whole algorithm

"Find the first candidate satisfying an absorbing predicate" **is** the
whole algorithm; everything else is candidate generation. `firstMatch` is
the single primitive, and the two named operations layer over it:
`findRoot` is a one-line specialization (candidates are the directories
themselves, the predicate is a marker test), and `findUpward` first
**flattens** each directory's candidates into one directory-major list
before handing that to `firstMatch` — the flattening is the ordering
invariant, since every candidate in the nearest directory is exhausted
before the scan ascends, so a distant ancestor's marker can never beat a
nearer directory's. Per-probe absorption lives in exactly one place,
`firstMatch`, and the scan short-circuits — later candidates are never
probed, which matters because a marker predicate can be expensive (a
workspace-root test reads and parses a `package.json`).

## The ascend ceiling fails closed

A `stopAt` ceiling is compared in **resolved form on both sides** and
stays **inclusive**. Raw string equality was a fail-open bug: an
unnormalized ceiling matched nothing, so the ascent ran to the filesystem
root — the unbounded walk the option exists to prevent — with no error
to notice it by. Both sides go through `resolve`, because normalizing
only the ceiling would desynchronize it from an unnormalized chain
element. Normalization governs the comparison only — the returned chain
stays the lexical one derived from the start.

A relative ceiling is a **defect**, not a typed failure, and is never
resolved against `process.cwd()` — see
[the ascend ceiling fails closed](../decisions/ascend-ceiling-fails-closed.md)
for the full reasoning. Only the ceiling is constrained: a relative start
still ascends to the relative root, and absoluteness is judged by the
injected `Path`, so a win32 layer accepts `C:\repo`.

## A physical ceiling is ascendWithin

`stopAt` is lexical, so it never matches a symlink-resolved ceiling —
`Git.repoRoot`'s answer is one — from a start reached through a symlink
(every macOS tmpdir), and the ascent runs to the filesystem root.
`Walker.ascendWithin(start, ceiling, options?)` is the physical form: the
same lexical chain, stopped at the nearest ancestor whose `realPath`
equals the ceiling's, inclusive. A ceiling the chain already spells costs
no I/O, a failed ancestor probe is absorbed as "not the ceiling", a
relative ceiling dies, and `Option.none()` is exactly `ascend(start)`.
It is a separate static taking an `Option`, not a mode of `stopAt`, so
`ascend`'s `R` stays `Path` alone — see [the physical-ceiling
Decision](../decisions/physical-ceiling-is-a-separate-static.md).

## The downward walk (descend)

A worklist, not a recursion — it cannot overflow the stack — dequeued by
a head index rather than `Array.shift()`, which re-indexes the whole
array on every dequeue. What earns a filesystem read is decided by the
pattern's metadata:

- A literal pattern — no magic, not negated — never walks at all: one
  stat decides.
- A pattern that cannot match below one level never descends, reading a
  single level instead.
- A negated pattern walks from `cwd` and always deep-walks: the
  enumeration prefix is computed from the inner pattern, but matching
  inverts, so its matches can land arbitrarily deep and outside the
  prefix.
- Patterns never escape `cwd` lexically: a pattern that climbs above the
  root via `..` segments is zero matches, refused before any filesystem
  access. Physically the walk stays under `cwd` only while `followSymlinks`
  is off — under it a link targeting outside `cwd` is descended, as
  `@actions/glob` follows links out of the tree.

Zero matches is a normal glob answer, not an error. Only files match — a
symlink counts when it stat-resolves to a file, a dangling symlink does
not, and a symlinked directory is never descended by default (cycle
safety). `followSymlinks: true` enters links under `@actions/glob`'s
per-branch `traversalChain` guard: each worklist frame carries its
branch's ancestor real paths, a directory whose real path is already an
ancestor of its own branch is a cycle and is skipped, and two sibling
links to one target both enumerate — the guard is never walk-global. Only
the base and each link pay a `realPath` (a plain directory's is its
parent's plus its name); a link whose `realPath` fails is never entered,
and that failure follows `onUnreadable` like a failed `readDirectory`, with
`NotFound` the silent benign race. `CacheKey.matchingFiles` in
`github-actions` opts in for runner `hashFiles()` parity.
Output is sorted by cwd-relative POSIX path, since an unsorted
enumeration is a reproducibility hazard for every downstream consumer
that hashes or diffs it.

## compileAndExpand — the recipe seam

`descend` answers "which files match this compiled pattern"; `Expand.ts`
answers "which files match this pattern source" — compile, fold the
compile error, expand, fold the descend error — a seam that was small
enough that every consumer wrote it, and wrote it differently, once
producing a real bug: two divergent dotfile semantics with nothing making
the divergence visible.

Three decisions carry the design: the glob options are **required, not
optional**, so every call site states its dialect in its own source
rather than inheriting a silent default; **one error, both causes
intact** — the expansion error carries the underlying compile or descend
error in `cause` rather than flattening it to a string, with a derived
stage getter; and `FileSystem` and `Path` stay in `R` deliberately, even
though hand-providing them is the friction this recipe otherwise removes
— `FileSystem` cannot be provided internally without breaking testability
against a fixture tree.

## Wiring: services via R, not parameters

`Path` and `FileSystem` arrive via the `R` channel, never as function
parameters, for two reasons: `Path.Path` is branded, so a structural
duck type cannot satisfy it, and `effect` core ships only a POSIX
`Path.layer` — whether traversal uses POSIX or win32 semantics is chosen
exactly once, by the consumer's platform layer at the edge.

## Errors

**The two directions have deliberately opposite error postures.**
Absorption is a claim about what a failed read *means*, and the meaning
inverts with direction.

- **Upward: every channel is `never`.** Probe failures are absorbed per
  candidate inside `firstMatch` — not-found and cannot-look are
  deliberately indistinguishable, since discovery is best-effort.
  Defects propagate (`firstMatch` uses `Effect.catch`, not `catchCause`).
  A non-positive-integer depth cap and a relative ceiling are both
  defects, never typed failures.
- **Downward: `DescendError`.** `descend` fails typed and must not
  inherit the upward absorption posture: a swallowed subtree downward is
  silently missing membership dressed as an empty result, and every
  consumer acting on it — publishing, hashing, change detection — acts
  on a quietly wrong set. Unreadable directories fail by default; a skip
  mode exists for callers who explicitly want best-effort, and a third
  mode, `onUnreadable: "record"`, resolves to `DescendResult { matches,
  unreadable }` carrying the absorbed `PlatformError` per unreadable
  directory. Depth exhaustion is a typed failure, never a silent
  truncation. `NotFound` mid-walk is never recorded — it is the same
  benign vanished-directory race in every mode.

## Hardening

Walker parses nothing and has no recursion over untrusted text.
`ascend` is a bounded `for` loop, not recursion, terminating at
`Path.dirname`'s fixpoint at the root, with the depth cap guarding a
pathological `Path` implementation. `ascend` is **lexical, not
physical** — `Path.dirname` does not resolve symlinks, so ascending out
of a symlinked directory follows the given path, which is correct for
config discovery; only `ascendWithin`'s stopping test touches the
filesystem, and never its chain. `firstMatch` stays interruptible, yielding per
candidate. Candidates materialize up front, bounded by the depth cap
times the subpath count.

## Consumer relationship

[config-file](config-file.md)'s walking resolvers and [xdg](xdg.md)'s
config resolver build their candidate lists and hand them to walker's
upward primitives, inheriting the `never` channel and per-candidate
absorption from walker's type rather than from wrapper prose. Marker
predicates `yield*` the `FileSystem`/`Path` services, so their error
channel is typed rather than `unknown`.

## Testing

Suites in `__test__/`, one per concept module, with the descend suite's
in-memory trees factored into `fixtures.ts`. Walker needs no platform
package, even for `descend` — tests provide core's `Path.layer` (POSIX)
plus a real in-memory volume from [`@effected/memfs`](memfs.md), a
devDependency; the volume owns the symlink-follow and readLink semantics
`descend` reads, so nothing is re-derived by hand. The unreadable-ancestor
and vanished-directory cases are injected as `readDirectory` faults that
decline for every other path.

Pinned invariants: per-candidate absorption; the `catch`-not-`catchCause`
defect boundary; that an unreadable ancestor cannot hide a valid root
above it; that the ceiling is inclusive and stops at the ancestor it
*names* rather than the string it is spelled with; that a relative
ceiling dies and survives the absorbing config-file caller reconstructed
in the suite; that `ascendWithin` stops at a physical ceiling reached
through a symlink and matches `ascend` under `Option.none()`; and that
nearer directories win.

## Build

`savvy.build.ts` carries the one narrow `{ messageId:
"ae-forgotten-export", pattern: "_base" }` suppression for the
synthesized base of the `DescendError` class factory. Gate on a
zero-warning `dist/prod/issues.json` via `pnpm build --filter
@effected/walker`.

[^walker-package-json]: `packages/walker/package.json` —
    `peerDependencies` lists `@effected/glob` and `effect`; no
    `dependencies` block.
[^walker-claude-md]: `packages/walker/CLAUDE.md` — the module layout and
    the `firstMatch` absorbing-loop design.


---
<!-- okf/decisions/physical-ceiling-is-a-separate-static.md -->
---
type: Decision
title: A physical ascend ceiling is a separate static taking an Option, not a realpath mode of stopAt
description: Walker.ascendWithin bounds the upward walk by a symlink-resolved ceiling as its own static, so ascend's R stays Path alone, and takes the ceiling as an Option so a stray undefined cannot request an unbounded walk.
status: stable
tags:
  - architecture
sources:
  - id: walker-source
    resource: ../../packages/walker/src/Walker.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-29T06:16:45Z
  body_sha256: be6b99169429f34acc758c0fe7a6e4386fc9335811974401e0aaa2d15976b89f
verified:
  - by: human:spencer
    at: 2026-09-29T06:17:45Z
---

# A physical ascend ceiling is a separate static taking an Option, not a realpath mode of stopAt

## Context

`Walker.ascend`'s `stopAt` is compared lexically, in resolved form on
both sides ([the ascend ceiling fails
closed](ascend-ceiling-fails-closed.md)). `Git.repoRoot` answers a
**physical** path — git resolves symlinks — so when the start directory
is reached through a symlink (every macOS tmpdir: `/var` is
`/private/var`; any symlinked checkout) the lexical chain never spells
git's root, the ceiling never matches, and the ascent runs to the
filesystem root: the same fail-open class the earlier Decision closed,
through a different door. The need surfaced in the vitest-agent
`git-common-dir` dogfood loop, whose config walk-up is bounded by the git
root.[^walker-source]

## Decision

The physical ceiling is a separate static, `Walker.ascendWithin(start,
ceiling, options?)`, and `ascend` is unchanged. It yields `ascend`'s
lexical chain and changes only the stopping test: the nearest ancestor
whose `realPath` equals the ceiling's `realPath`, inclusive. A ceiling
the chain already spells stops with no I/O; a failed `realPath` probe on
an ancestor is absorbed as "not the ceiling", and an unresolvable ceiling
leaves the lexical answer standing. A present relative ceiling dies, for
the reasons the earlier Decision gives.

The ceiling is an `Option<string>`, not `string | undefined`.
`Option.none()` is exactly `ascend(start)` — the natural answer outside
any repository, spelled `Walker.ascendWithin(start, yield*
Effect.option(git.repoRoot(start)))` — and it is the only way to ask for
an unbounded walk, so an accidentally-undefined ceiling cannot become one.

## Alternatives rejected

- **Make `stopAt` compare by realpath.** Rejected: it adds `FileSystem`
  to `ascend`'s `R`, breaking every caller that provides only `Path` —
  [config-file](../modules/config-file.md)'s resolvers among them — for a
  guarantee only callers holding a physical ceiling need.
- **Take the ceiling as `string | undefined`.** Rejected: a stray
  `undefined` from an unwired lookup would silently request the unbounded
  walk the ceiling exists to prevent.
- **Canonicalize the ceiling in `@effected/git`.** Rejected there for the
  mirror reason: it would add `FileSystem` to `Git.layer`'s `R`. Git
  already returns the physical path; the walker side is where the chain
  meets it.

## Consequences

`AscendOptions.stopAt`'s TSDoc warns that it is lexical and points at
`ascendWithin`; [walker](../modules/walker.md) and
[git](../modules/git.md) state the pairing from both sides. Never fold
the physical test back into `stopAt` without first moving every
`Path`-only caller.

[^walker-source]: `packages/walker/src/Walker.ts` — `ascendWithin` and
    its private `ascendToPhysical`, plus the `AscendOptions.stopAt`
    TSDoc warning.
