# xdg — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/xdg/CLAUDE.md -->
# @effected/xdg

XDG Base Directory resolution. Eleventh migration, and the XDG half of the
`xdg-effect` split — the SQLite half is `@effected/store`.

**Design doc:** `@./okf/modules/xdg.md`

## Tier: boundary

`effect`, `@effected/walker` and `@effected/config-file` are the peers; there are
**no runtime dependencies**. IO goes through `effect`-core `FileSystem` and
`Path`, arriving via the `R` channel. Both workspace edges are boundary→boundary,
and tier 2 does not propagate (R3), so xdg's consumers pay nothing for them.

**xdg does NOT depend on `@effected/store`, and must not.** Store is integrated
tier; depending on it would propagate (R2) and drag `@effect/sql-sqlite-node`
into every consumer. That split is the whole reason this package is small. The
glue that wires an `AppDirs` path into a `Store` belongs in `@effected/app`.

Needs **no platform package, even in tests** — core's `Path.layer`, plus a real in-memory volume from `@effected/memfs` (a devDependency) wherever a suite needs filesystem behavior.

## Resolve once, at layer construction

The load-bearing shape decision. `Xdg`'s service shape **is** `XdgPaths`, and
`AppDirs.dirs` is a plain `ResolvedAppDirs` **value**, not an `Effect`. The
environment is fixed when the layer is built, so that is where it is read.

Three consequences, and they are why the design holds together:

- Reading a path cannot fail. The only fallible members are the `ensure*` ones,
  which touch the filesystem.
- `AppDirs.layer`'s error channel is `never`. The one resolution failure — `HOME`
  unset — surfaces on `Xdg.layer` as `XdgEnvError`, before an `AppDirs` exists.
- `XdgConfig.savePath` gets a `never` channel, which is the **only** way it fits
  config-file's `defaultPath?: Effect<string, never, RR>` slot without an
  `orDie`. v3 recomputed all eight env reads on every property access, so this
  did not typecheck without laundering.

## Invariants

- **The five-level precedence** per directory kind: explicit override → XDG env
  var namespaced → native dir (`native: true` only) → `$HOME/<fallbackDir>` →
  `$HOME/.<namespace>`. Rungs 4 and 5 are deliberately **not** the XDG spec's
  per-kind defaults (`~/.config`, `~/.local/share`); that is inherited v3
  behaviour, and a caller wanting spec defaults passes them as `dirs` overrides.
- **The runtime directory has no fallback ladder.** An override, or
  `$XDG_RUNTIME_DIR` namespaced, or nothing. It must be user-owned and mode 0700,
  so inventing a fallback would be a lie — the key is simply absent.
- **`NativeDirs.resolve` returns `Option.none()` on Linux.** XDG *is* the native
  convention there, so the rung is skipped rather than filled with a duplicate of
  the XDG answer. Filling it would shadow the rung below.
- **The platform is a `Context.Reference`, never a global read.** `CurrentPlatform`
  defaults to `process.platform`. This is what makes the darwin/win32 matrix
  testable with no platform IO — do not reintroduce `globalThis.process.platform`
  inside the resolution code, which is what v3 did in two places.
- **A namespace is one path component.** Empty, or containing `/` or `\`, or
  `..` — all are **defects** at layer construction, not typed errors. It can only
  come from code, and `namespace: "../.."` would resolve the app's directories
  outside `$HOME`.
- **Every join goes through `Path.Path`**, never string interpolation. v3 built
  every path with `${home}/Library/...`, which emits forward slashes on Windows.

`XdgConfig` is a static class with a private constructor, not an `as const`
namespace object — an `as const` object's member types are inferred in the
built `.d.ts` and lose their TSDoc entirely, while a class's `static readonly`
declarations keep it. Call syntax is unaffected (`XdgConfig.resolver(...)`).

## Absorption is per candidate — the one real bug fixed

`XdgConfig.resolver` searches the whole config search path (`~/.config/<ns>`,
then each `$XDG_CONFIG_DIRS` entry) through **`Walker.firstMatch`**. v3 wrapped
its whole resolver in one `Effect.catchAll(() => Option.none())`, which absorbs
at the wrong granularity: an `EACCES` on the first candidate aborted the probe
and hid a perfectly readable config behind it.

Both the absorption and the ordering are pinned by tests that have been **watched
failing** against the v3 shape. Do not replace `Walker.firstMatch` with a local
loop plus a trailing `catch`.

`$XDG_CONFIG_DIRS` / `$XDG_DATA_DIRS` are modeled here for the first time — v3
ignored the search-path half of the spec entirely. Without them `firstMatch`
would be a one-element loop and the walker edge would be ceremony.

## Testing and building

51 tests in `__test__/`, `@effect/vitest`, `assert.*` — never `expect`.

```bash
pnpm vitest run packages/xdg
pnpm build --filter @effected/xdg   # from the repo root
```

- The environment is driven with
  `ConfigProvider.layer(ConfigProvider.fromUnknown({...}))`. Never mutate
  `process.env`.
- The platform is pinned with `Layer.succeed(CurrentPlatform, "win32")`.
- **The `AppDirs` suite runs on `@effected/memfs` with a delegate-by-default `makeDirectory` spy.** The handler records the path and returns `undefined`, so the directory is really created rather than merely observed, and the suite still asserts *which* directories were made, in which order.
- **Never record eagerly.** `AppDirs` builds its `ensure*` effects once, at layer construction, so a recorder that pushes in the stub body counts four directories that were never created and every assertion measures construction instead of execution. A fault handler is consulted when the method is *called*, so the property now comes free where the old `layerNoop` stub needed an explicit `Effect.suspend` — the trap still waits for any recorder written by hand.
- **The `XdgConfig` suite runs on `@effected/memfs` too**, with an `exists` fault handler that records each probe and raises `PermissionDenied` on the `denied` paths. Denied paths are SEEDED, so the fault is load-bearing — disarmed, the probe would find them — and file bodies are seeded explicitly (`files`); an unseeded read fails `NotFound` rather than answering a canned body.
- `savvy.build.ts` carries the **narrow** `_base` suppression. Never widen it.
- Never run `node savvy.build.ts --target prod` directly.


---
<!-- okf/modules/xdg.md -->
---
type: Module
title: xdg
description: XDG Base Directory resolution -- turning the environment into namespaced, precedence-ordered application directories and a config-file resolver chain, with no database and no runtime dependencies.
status: stable
kind: package
resource: ../../packages/xdg
layer: L1
tags:
  - architecture
sources:
  - id: xdg-package-json
    resource: ../../packages/xdg/package.json
  - id: xdg-claude-md
    resource: ../../packages/xdg/CLAUDE.md
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 15fba8ccf7420cd8a9871e584992b6b9751359f65de8bba2b877ff774435dc9e
---

# xdg

## Purpose and tier

`@effected/xdg` is XDG Base Directory resolution. Its one job is to turn
the environment into paths: read the XDG Base Directory environment, map
it onto a platform, namespace it for an application, create the
directories on demand, and expose that as a config-file resolver chain.
No database, no cache, no format parsing.

**Boundary tier** — see [the library-tier glossary
entry](../glossary/library-tier.md). IO happens exclusively through
`effect` core's `FileSystem` and `Path`, arriving via the `R` channel
from the consumer's platform layer, so there is no `@effect/platform`
peer and no platform-node devDependency even in
tests.[^xdg-package-json] `peerDependencies` is `effect`,
`@effected/walker` and `@effected/config-file`; there are **no runtime
dependencies**. Both workspace edges are boundary→boundary and therefore
non-propagating: `walker` depends on nothing, keeping the graph acyclic,
and `config-file` is a peer rather than a regular dependency because the
bridge exposes config-file's types in xdg's own public signatures, so a
single copy in a consumer's graph is load-bearing.

xdg **does not depend on** [store](store.md), and must not — see
[xdg does not depend on store](../decisions/xdg-does-not-depend-on-store.md).

## Module layout

Module-per-concept, four files under `src/`: `Xdg.ts` (the environment),
`NativeDirs.ts` (the pure platform map), `AppDirs.ts` (namespace,
precedence, creation) and `XdgConfig.ts` (the config-file bridge). Import
direction is a DAG: `Xdg.ts` depends on nothing, `NativeDirs.ts` and
`AppDirs.ts` build on it, `XdgConfig.ts` builds on `AppDirs.ts`. There is
no `internal/` directory — there is no engine here, only
resolution.[^xdg-claude-md]

## Public surface

### Xdg — the environment

- **The service's shape IS the resolved paths.** The environment does
  not change during a process, so resolution happens once, at layer
  construction, and the service is the resolved value rather than an
  effect that computes one — the whole downstream chain is infallible as
  a result.
- `Schema.optionalKey` models an absent XDG variable as an absent key,
  read with a `??` fallback — no `Option` in the model.
- The **system search paths** are modeled too, not just the per-user home
  variables: the colon-separated `XDG_CONFIG_DIRS` and `XDG_DATA_DIRS`
  with their spec defaults. Modeling the search-path half of the spec is
  what makes [the walker edge](#where-walker-fits) load-bearing rather
  than decorative.
- **The platform is injected, never read from a global.**
  `CurrentPlatform` is a `Context.Reference` whose default reads
  `process.platform` once, so production is unchanged while a test pins
  macOS or Windows with a one-line `Layer.succeed`.

A missing `HOME` is the only environment failure; everything else is
optional by construction. `layerFrom` supplies explicit paths and is the
test layer.

### NativeDirs — the pure platform map

- **darwin** — config, data and state under
  `~/Library/Application Support/<ns>`; cache under `~/Library/Caches/<ns>`.
- **win32** — config and data under `%APPDATA%/<ns>`; cache and state
  under `%LOCALAPPDATA%`, falling back to the standard
  `AppData/Roaming`/`AppData/Local` locations under home when those
  variables are absent.
- **everything else** — `Option.none()`. On Linux, XDG is the native
  convention, so returning `none` lets the precedence ladder skip the
  rung cleanly rather than duplicating the XDG answer.

`NativeDirs.resolve` is pure — no IO, no env, no clock — joined through
`Path.Path` so a win32 `Path` layer produces win32 separators.

### AppDirs — namespace, precedence, creation

Resolution happens once, at layer construction, so reading a path cannot
fail — it is a `string`. The layer's error channel is `never`; the one
failure that could hide behind it, a missing `HOME`, surfaces on the
`Xdg` layer instead, before an `AppDirs` exists. That infallible channel
is also the only way the config-file save path fits config-file's
`defaultPath` slot without an `orDie`.

The **five-level precedence** per directory kind:

1. an explicit per-kind override;
2. the XDG environment variable, namespaced;
3. the native directory, when native mode is on and the platform has one;
4. a single dot-directory under `$HOME` that all four kinds collapse to;
5. `$HOME/.<namespace>`.

Rungs 4 and 5 are **not** the XDG spec's per-kind defaults — a caller
wanting spec defaults passes them as per-kind overrides. Native mode
defaults **off**, because creating a native directory commits an
application to a location; the `ensure*` operations `mkdir -p` and
return the path, with the runtime one `Option`-returning since a runtime
directory exists only when the environment says so.

### XdgConfig — the config-file bridge

Statics on a concept class: a config-search-path resolver, a
native-directory resolver and a save path. The primary resolver searches
the whole XDG config search path — the app's own config directory, then
each system config directory, namespaced, in that order — placed ahead
of the native resolver so an existing `~/.config/<app>` still beats the
native directory. Both resolvers get a `never` error channel from walker
rather than a hand-rolled `catchAll`.

Deliberately not present: preset ladders and format-coupled factories
(that composition belongs in [app](app.md)), and a central error union
(each error lives with the concept that raises it).

## Where walker fits

Walker earns its edge in the one place xdg does a search: the config
resolver builds the ordered candidate list from the app's config search
path and hands it to `Walker.firstMatch`. That single call buys
per-candidate absorption (a permission failure on a system config
directory must not hide a readable `~/.config`), short-circuiting (the
first hit wins), and defect propagation (`firstMatch` uses `Effect.catch`,
not `catchCause`). The native resolver has exactly one candidate but goes
through `firstMatch` too, for the absorption contract. Nothing in xdg
ascends a directory chain — its candidates come from the environment, not
the tree — so [walker](walker.md)'s `ascend` and `findRoot` go unused
here.

## Errors

Two `Schema.TaggedError` types, one per fallible concept, each carrying
its underlying failure structurally in a `cause: Schema.Defect()` field:
an environment error naming the missing variable, and a
directory-creation error carrying the failing kind as a literal union
plus the path. `PlatformError` is wrapped, never leaked. Nothing is
`orDie`d — "the cache directory could not be created" is an expected,
recoverable boundary failure. Wiring errors are construction defects: an
empty namespace, or one containing a path separator, dies at layer
construction, because a namespace with a separator could silently escape
the app's directory.

## Observability

Named spans on every public fallible boundary, uniformly — the `ensure*`
set. Path reads are property accesses on a value and are unspanned; the
two resolvers have a `never` channel by contract and carry no spans; the
platform map is pure. No metrics, no logging, no
`@effect/opentelemetry` — telemetry-agnostic.

## Testing

Suites in `__test__/`, one per concept module, with suite-boundary
`layer(...)` blocks. The platform matrix is tested with **no platform IO
at all**: because the platform is a `Context.Reference` and the native
map is pure, a suite pins darwin/win32/linux behaviour by providing the
reference at the group boundary and asserting on strings. `AppDirs`'
filesystem behaviour runs on a real in-memory volume
([`@effected/memfs`](memfs.md), a devDependency) with `makeDirectory`
intercepted by a delegate-by-default spy: the handler records the path
and returns `undefined`, so the directory is genuinely created rather
than merely observed. **Never record eagerly** — `AppDirs` builds its
`ensure*` effects once, at layer construction, so a stub that records in
its body counts directories that were never created; a fault handler
consulted when the method is called gets the property for free.
`XdgConfig`'s suites stay on a core-only `layerNoop` double, since the
resolvers touch the filesystem only through existence probes.

## Hardening

Not a parser — no recursion, no untrusted text, no nesting cap, no
numeric option. The namespace is a path component, validated as one: an
empty namespace or one containing a separator is rejected at layer
construction as a defect. Every join goes through `Path.Path`, never
string interpolation. Absorption is per candidate, not per resolver.
Defects propagate — xdg adds no `catchCause` anywhere.

## Build

`savvy.build.ts` carries the standard narrow `{ messageId:
"ae-forgotten-export", pattern: "_base" }` suppression. Both workspace
peers mean xdg needs the `prepare` script — see
[the package manifest and scaffold convention](../conventions/package-manifest-and-scaffold.md#cross-package-build-dependencies)
— since the peers link at their built output and must be built before
xdg's own tests can resolve them in a fresh checkout. Gate on a
zero-warning `dist/prod/issues.json` via `pnpm build --filter
@effected/xdg`.

[^xdg-package-json]: `packages/xdg/package.json` — `peerDependencies`
    lists `effect`, `@effected/walker` and `@effected/config-file`; no
    `dependencies` block.
[^xdg-claude-md]: `packages/xdg/CLAUDE.md` — module layout and the
    resolve-once-at-construction design.
