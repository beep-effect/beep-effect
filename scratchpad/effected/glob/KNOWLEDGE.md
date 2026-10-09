# glob — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/glob/CLAUDE.md -->
# @effected/glob

Full-fidelity glob matching as Effect schemas: the complete minimatch dialect
compiled to pure string predicates. Seventh migration. 12 `src/` files
(10 engine + 2 facade), 6 test files, 134 tests.

**Tier: pure.** Peer-depends on `effect` only. Zero runtime deps, no IO, no
services. The `minimatch` devDependency is the **test oracle only** — pinned
exactly to the ported version (10.2.5) and imported only under `__test__/`.
Never add it to `dependencies`; never let it drift from the vendored version.

**Design doc:** `@./okf/modules/glob.md` — load when
changing the public API, the dialect, the error set, or the hardening story.

## Engine/facade split

`src/internal/` is a **vendored engine** ported with attribution: minimatch
10.2.5 (BlueOak-1.0.0, Isaac Z. Schlueter), brace-expansion 5.0.7 and
balanced-match 4.0.4 (MIT, Julian Gruber). Every ported file carries its
license header — **never edit the notice text**; the two MIT files carry the
full permission notice as license compliance.

The split is a **cycle firewall** (`noImportCycles` is error-level): the
engine throws raw `GuardExceeded` records (`internal/limits.ts`) at compile
time and never imports the facade; only `GlobPattern.ts`/`GlobSet.ts`
materialize them into the typed `GlobPatternError`. Upstream let `ast.ts` and
`index.ts` import each other's types circularly — the shared types live in
`internal/types.ts` instead.

## Hardening invariant

Malformed or hostile input fails through the typed `E` channel — never a
defect, never `RangeError: Maximum call stack size exceeded`, never a hang.
`matches()` is **total**: every compile-time guard throws before an instance
exists; nothing throws at match time.

Upstream guards **preserved**: the 64KB `MAX_PATTERN_LENGTH`; brace-expansion's
`EXPANSION_MAX` budget, the `{a},b}` for-loop rewrite and lazy `post`
evaluation (both load-bearing DoS fixes); the CVE-2022-3517 ReDoS-safe brace
pre-check regex; `maxExtglobRecursion` (default 2, over-nesting **degrades to
literal**, never errors); `maxGlobstarRecursion` (default 200, exceeding it is
upstream's deliberate **false negative** — never converted to an error).

New guards **added**, all at `MAX_NESTING_DEPTH = 256` (`internal/limits.ts`):

1. `braceExpansion.ts` `expand_` — comma-bearing nesting depth.
2. `braceExpansion.ts` `parseCommaParts` — sequential comma-group chains
   (upstream recursed unbounded; >256 groups now fail typed).
3. `ast.ts` `#parseAST` — a **structural backstop** counting every descent.
   This fixes a real upstream hole: coalescible extglob types recurse with
   `depthAdd = 0`, so stock minimatch 10.2.5 **stack-overflows at default
   options** on `"@(".repeat(20000) + "a" + ")".repeat(20000)` (~60KB, under
   its own length cap; verified 2026-07-09). Know this before touching ast.ts.
4. `ast.ts` `toRegExpSource` ↔ `#partsToRegExp`, `#flatten`, `clone`/`copyIn`
   — depth counters on the remaining AST recursion surfaces.

`balancedMatch.ts` is fully **iterative — no guard; do not add one**. Budget
exhaustion **throws typed** (`ExpansionBudgetExceeded`) where upstream
silently truncated — silent truncation silently changes match semantics.
NaN/non-integer caps die as `TypeError` defects via `assertCap` (wiring bugs,
not input).

## The two behavioral deviations from upstream

1. **No ambient environment detection**: `platform` is an explicit option
   defaulting to `"posix"`; `process.platform` is never read. Win32 handling
   (UNC, drive letters, backslash splitting) is kept behind the option.
2. **Typed budget exhaustion** instead of silent truncation (above).

Plus the workspaces-inherited mandate: **`**` is real** — `packages/**`
matches `packages/a/b` (glob-core's issue-#62 rewrite is not carried forward).

## Public surface

- `GlobPattern` — schema class; validity check = **compilability under default
  options** on every construction path (`make`, `new`, decode, `FromString`).
  Options refine matching; they never admit defaults-rejected patterns.
  Compiled engine cached in a non-encoded private field, pre-warmed by
  `compile`, lazy otherwise.
- **The sync `Result` form is the primitive; the `Effect` form derives from
  it.** `GlobPattern.compileResult` and `GlobSet.compileResult` hold the
  compilation; each `compile` twin is `Effect.fromResult(...)` behind its
  existing span and adds nothing else — the span is the whole reason the
  `Effect` form exists. Never re-derive compilation on the `Effect` side. Kit
  convention — `@./okf/conventions/sync-primitive-policy.md` and
  `@./okf/decisions/sync-form-named-result.md`. `compile`/`GlobSet.compile` carry the only `Effect.fn`
  spans; `matches` and the getters are span-free.
- `GlobPatternOptions` — full minimatch surface, schema-validated; invalid
  options throw at `make` (defect). `braceExpandMax` is bounded `[1, 100_000]`
  — caps tighten, never raise (keeps the defaults-compilability invariant).
- `GlobPatternError` — `pattern`/`reason`/`limit`/`actual`. Uses
  `Schema.Literals([...])` for the reason union: the v3 variadic
  `Schema.Literal(a, b, c)` **silently ignores arguments after the first** in
  beta.94.
- `GlobSet` — include/exclude SET semantics (leading `!` = exclusion filter,
  distinct from minimatch whole-pattern negation — both exist on purpose).
  Classifies **per expanded brace alternative**. Pins default options; no
  options surface.

## Testing and building

Tests in `__test__/`, `@effect/vitest`, `assert.*` never `expect`. The
compliance gate (`compliance.test.ts` + `hostility.test.ts`) runs against the
raw engine: a 130-row fixture table asserting expected AND oracle agreement on
every row, oracle property tests, and the hostile-input suite. **If the engine
disagrees with the oracle, fix the engine, never the expectation** — except
the two documented deviations. Oracle calls map `platform: "posix"` →
`"linux"` (upstream's Platform type has no posix member; linux is behaviorally
identical and immune to ambient drift).

```bash
pnpm vitest run --project @effected/glob   # this package's tests, from the repo root
pnpm build --filter @effected/glob         # dev + prod, from the repo root
```

Never run `node savvy.build.ts --target prod` directly. `savvy.build.ts`
carries one narrow suppression `{ messageId: "ae-forgotten-export", pattern:
"_base" }` for the four synthesized class heritage symbols — **never widen
it**. `package.json` stays `"private": true`.

## Open questions (design-doc OPEN items)

- **The enumeration contract is materially de-risked, not closed.**
  `enumerationPrefix`/`crossesSegments` have now held unmodified under three
  independent consumers — `@effected/workspaces`' enumerator (shipped; the
  "when that package ports" caveat this item used to carry is spent),
  `@effected/walker`'s `descend`, and `@effected/github-actions`' cache
  search-root derivation, the last under real filesystem enumeration. What
  remains open is narrower: **no dedicated conformance run against a reference
  enumerator** has been performed, so nothing asserts case-by-case agreement
  with `@actions/glob` or another reference implementation. See
  `@./okf/modules/glob.md`.
- Both getters are computed under default options; their `matchBase`/win32
  interaction stays undefined (documented for default-options patterns only).


---
<!-- okf/modules/glob.md -->
---
type: Module
title: glob
description: Full-fidelity glob matching as pure string-to-predicate Effect Schema compilation, vendoring the complete minimatch dialect.
status: stable
kind: package
resource: ../../packages/glob
tags:
  - dx
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: e455653ed4287cb95e3ca64e1e475c2de2e73ebaee15f4a21e4c768a2b85f97a
---

# glob

## Purpose

`@effected/glob` is glob matching as pure string→predicate compilation. Its engine is a full-fidelity vendored port of minimatch, brace-expansion and balanced-match, pinned to the versions this repo's lockfile resolves, each ported file carrying its upstream attribution and license header — those notices are never edited, since the MIT files carry the full permission notice as license compliance. See [glob is a full-fidelity vendored port](../decisions/glob-full-fidelity-port.md) for why the whole dialect ships rather than a call-site-scoped subset.

## Tier and dependency posture

[Pure tier](../glossary/library-tier.md): `effect` is the only peer, with zero runtime dependencies, no services, no layers, and no `R` anywhere. It vendors its engine because of the kit's dependency policy — pure and boundary packages take no external runtime dependency — not because it lacks IO; under the [tier taxonomy](../glossary/library-tier.md), pure is a dependency statement, not an IO one, and glob also happens to do no IO, but that is incidental to its tier. The `minimatch` devDependency is the **test oracle only**, pinned exactly to the ported version and imported only under `__test__/`; it must never move to `dependencies` and must never drift from the vendored version.

## `**` is real

`packages/**` matches `packages/a/b`. The trailing-`/**`-to-`/*` rewrite some glob implementations carry is deliberately **not** reintroduced: it silently misses nested matches. The consumer-side cost — an enumerator must do a bounded recursive descent instead of a single-level directory read — is exactly what the `crossesSegments` metadata (below) exists to drive.

## Module layout

Two concept modules plus the vendored engine: `GlobPattern.ts` (single-pattern compilation, matching, metadata, options, and the error) and `GlobSet.ts` (multi-pattern include/exclude sets). `internal/` holds the vendored engine plus `limits.ts` (the zero-dependency leaf holding every numeric cap and the raw guard signal) and `types.ts` (an engine leaf that breaks the upstream AST/index type cycle `noImportCycles` forbids). The split is a cycle firewall: the engine throws raw guard records at compile time and never imports the facade, and only the two facade modules materialize them into the typed error.

## GlobPattern

A `Schema.Class` with one encoded field, the pattern source; the compiled matcher is cached in a non-encoded private instance field, since private indexes live outside the schema and are never encoded. Every construction path — `make`, `new`, decode, `FromString` — validates **compilability under default options** via a schema check, so a `GlobPattern` value is always defaults-compilable; options refine matching but never admit a defaults-rejected pattern. `matches` is **total**: pure, with no error channel, and every compile-time guard fires before an instance exists, so nothing throws at match time.

**`Result` is the primitive.** `compileResult` holds the compilation, and `compile` is `Effect.fromResult` over it behind the named span — the span is the whole reason the `Effect` form exists, per the [sync primitive policy](../conventions/sync-primitive-policy.md). Compilation is pure, synchronous and `R = never`, so a synchronous host must not be made to build a runtime to compile a pattern.

A `FromString` transformation schema exists for embedding patterns in config schemas; its decode failures surface as `SchemaError`. `escape` and `unescape` statics support building patterns from user-supplied literals. `GlobPatternOptions` exposes minimatch's full options surface, schema-validated. **Invalid options are a developer wiring error and raise a defect** at construction; the typed channel stays reserved for malformed *patterns*. `braceExpandMax` is schema-bounded rather than a bare positive integer, because it is the one cap that can produce a compile-time typed failure — bounding it above by the stock budget guarantees permissive options can never admit a pattern the defaults check would reject; caps tighten, never raise. The error is a `Schema.TaggedError` carrying the pattern, a `reason` literal union, and structured limit/actual fields; malformed input is never a defect, and extglob over-nesting does not add a reason (it degrades to literal matching, matching upstream).

**Not a duplication of core.** `effect` ships `FileSystem.glob`, a filesystem-*scanning* glob; this package is deliberately a pure string→predicate matcher with no IO, which is exactly why the kit can point it at non-file candidates — `git ls-tree` entries, package names. Consumers wanting scan-plus-match against a real filesystem should reach for core's `FileSystem.glob` instead.

### The enumeration metadata

`enumerationPrefix` (the longest literal directory prefix) and `crossesSegments` (whether the pattern can match more than one level below that prefix — true iff it contains `**` or a `/` after the first magic segment) are API with no upstream analogue, designed for the enumerator contract; a substring-to-last-`/` prefix is wrong once `**` is real. Both are computed under default options, and their interaction with `matchBase` or windows modes stays defined only for default-options patterns.

`enumerationPrefix` is meaningful for **non-negated** patterns only: it is computed from the *inner* pattern, but a negated pattern's `matches` inverts, matching everything the inner pattern does not — and those matches can land outside the prefix. A negated pattern's walk must therefore ignore the prefix entirely and deep-walk from the root unconditionally, regardless of `crossesSegments`.

The contract has held under three independent consumers unmodified — `workspaces`' enumerator, `walker`'s `descend`, and `github-actions`' cache-path search-root derivation, the last under real filesystem enumeration with round-trip and real-runner coverage. What remains open: no dedicated conformance run against a reference enumerator (`@actions/glob` or similar) has been performed, so the enumeration semantics are materially de-risked, not closed.

## GlobSet

A `Schema.Class` over an array of pattern strings with **set** semantics: a leading `!` marks an exclusion, and a candidate matches when some include matches and no exclude does. `compileResult` is the primitive here too, with `compile` derived from it exactly as on `GlobPattern`. Structural accessors serve the enumerator: deduped non-magic includes, magic includes, excludes, and an exclusion predicate. `GlobSet` pins default options internally and takes **no options surface** — it is the drift-free contract, deliberately distinct from minimatch's whole-match `!` negation, which applies at the single-pattern level. Classification is pinned **per expanded alternative**, so a braced pattern expanding to both a literal and a wildcard contributes each alternative to its own bucket.

## Hardening

Upstream already carries substantial DoS hardening, **preserved** in the port: the 64KB pattern-length cap at every entry; brace-expansion's output budget, its recursion-to-loop rewrite, and lazy tail evaluation; and the ReDoS-safe brace pre-check regex mitigating CVE-2022-3517. Two upstream guards are kept as **authorities**, not tightened: extglob recursion (over-nesting degrades to literal and does not error) and globstar recursion (exceeding it is upstream's deliberate false-negative "correctness for security" trade) — both are invariants, so `matches` stays total.

New depth guards at the shared nesting cap cover the remaining AST and brace-expansion recursion. `balancedMatch.ts` is fully iterative — no stack surface, no guard, and none should be added. One upstream hole is closed: coalescible nested extglobs recurse with a zero depth increment in stock minimatch, so it stack-overflows at default options on a roughly 60KB adoption chain that sits under its own length cap; the vendored AST parser adds a structural depth backstop counting every descent and failing typed, guarding that surface independently of the extglob recursion option. Cap defaults live in `internal/limits.ts`. Three caps are caller-settable options, validated by the options schema so an invalid value is rejected as a wiring defect before any guard sees it; the internal-only caps follow the [walker](walker.md) `maxDepth` rule — a NaN or non-integer reaching a guard can only come from code, is programmer error, and dies as a defect. Malformed input at every surface exits through the typed error, never a defect, never a hang.

## Observability

Named `Effect.fn` spans on the public fallible boundaries only — the two `compile` statics; the span is the *entire* content of those wrappers, the engine having moved down to the `*Result` primitives. `matches` is infallible and hot, so it is span-free. No metrics; telemetry-agnostic.

## Testing

`@effect/vitest`, `it.effect`, `assert.*` — never `expect`; tests in `__test__/`. No platform packages, no mock layers (no `R`), no `TestClock`. The engine is tested below the facade as well as through the public surface, in three families: a compliance fixture table asserting expected result *and* oracle agreement on every row; oracle property tests generating over the full dialect against the real `minimatch` package, asserting the vendored engine agrees modulo the two documented deviations (if the engine disagrees with the oracle, fix the engine, never the expectation); and a hostility suite — oversized patterns, expansion bombs, deep brace nesting, extglob adoption chains, long globstar chains, deep comma-part chains — each failing through the typed error with the right reason, never a stack overflow, OOM or hang, plus the NaN and non-integer cap defect guards.

## Consumer contract

Glob itself does **no** enumeration — pure string→predicate only, and that is a load-bearing boundary. `workspaces` consumes it at three points: dependency matching expressed over `GlobPattern` (so `workspaces` carries no `minimatch` runtime dependency), the `packages:` enumerator expressed over `GlobSet` (a literals fast path, wildcards driving directory reads from `enumerationPrefix`, and `crossesSegments` triggering the bounded descent that makes `**` real end to end), and at-ref discovery matching the same compiled set against `git ls-tree` entries. `walker` is the second consumer and the first outside `workspaces`: its `descend` uses glob type-and-property only — a type-level import, the metadata getters, and `matches` — so the boundary holds in the other direction too, since the walker that does the IO takes no value dependency on the matcher that does none. `walker`'s `compileAndExpand` does value-import `compileResult` and the error to own the compile-plus-expand seam, and `compileResult` being the primitive is what makes that seam cheap: `walker` folds a `Result` in place instead of crossing an `Effect` boundary twice to reach the same engine.

## Build

Scaffolded from a pure sibling, with model paths under `website/lib/models/glob`. The class factories mean `savvy.build.ts` carries the narrow `_base` API Extractor suppression; never widen it. No `prepare` script: glob is a pure leaf with no workspace dependencies.


---
<!-- okf/conventions/sync-primitive-policy.md -->
---
type: Convention
title: Sync-primitive policy
description: A pure kit boundary exposes the sync form as its primitive; the Effect form is derived from it and adds only the tracing span.
status: stable
stale_after: 2027-03-13T00:00:00Z
tags:
  - architecture
  - dx
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: eec01eebdbcaf466a5ea059f81c63f1681b34db30f4edc8258c69a023b580168
---

# Sync-primitive policy

**Pure computation exposes the sync form as the primitive; the `Effect` form
is derived from it and adds only the tracing span.** This applies to every
pure boundary in the kit, not only the format packages where it was first
noticed — it is the generalized form of the [format-package
convention](format-package-convention.md)'s return-type decision.

## Scope test

A surface is in scope when it is a public boundary that returns `Effect` with
`R = never`, has no async step and does no IO — i.e. the `Effect` wrapper
carries nothing but a span and the error channel.

For those, the `Effect` is a tax: it forces `Effect.runSync` on every
synchronous consumer, and synchronous consumers are real. A lint-staged
handler must be synchronous, and so must a config file evaluated before any
runtime exists.

Out of scope: anything that does IO, anything with an async step, and
anything whose `Effect` is load-bearing for a reason other than the span —
see [where the policy stops](#where-the-policy-stops).

## The derivation

```ts
static parseResult(text: string): Result.Result<A, E> { /* the engine */ }
static readonly parse = Effect.fn("X.parse")((text: string) =>
  Effect.fromResult(X.parseResult(text)),
);
```

Three properties make this cheap and safe. Adding the sync form is purely
additive — the `Effect` signature is unchanged, so no consumer breaks. The
span is preserved, so observability is not traded away. And the two forms
cannot drift, because one is defined in terms of the other rather than
re-deriving the engine.

The derivation direction is the load-bearing half. A package that ships both
forms over two independent copies of the engine has satisfied the letter of
the policy and none of its value: `@effected/yaml` shipped exactly that for a
while, with the `Effect` path calling the composer, the failure records and
the alias budget inline while the sync path called the same three
independently. Fixing the derivation, not adding the surface, was the real
work.

## Why it pays inside Effect too

The payoff is easiest to miss because it looks like a concession to
non-Effect hosts. It is not. `@effected/github`'s `GitTag.latestSemver` is a
single pass over the tag stream, filtering and comparing inside one
`Effect.sync`, because `@effected/semver` ships `parseResult` and `compare`
synchronously. With only the `Effect` forms available, the same operation was
several times longer — one `Effect` per candidate comparison. A sync
primitive on a pure boundary is what lets an effectful consumer keep its own
loop flat.

## Naming: `*Result`, never `*Sync`

The sync form is spelled `*Result`, on three arguments in ascending order of
force:

1. **Precedent.** `*Result` is where the policy started and what the kit's
   own skills name.
2. **Accuracy.** `Sync` names a distinction that does not exist — the
   `Effect` form is also synchronous, which is the entire premise of the
   policy. `Result` names the one thing that actually differs: the return
   type.
3. **`*Sync` is already taken in this kit, for an incompatible meaning.**
   `@effected/workspaces` ships a sync facade family
   (`findWorkspaceRootSync`, `getWorkspacePackagesSync`, `readPackageSync`)
   whose members are genuinely IO-performing functions returning nullables,
   not `Result`s. Within one kit, `*Sync` would mean both "does blocking IO,
   returns a nullable" and "pure computation, returns a `Result`".

The rule holds even where the `Effect` twin is not merely a span.
`@effected/jsonc`'s `JsoncFingerprint.hash` requires core's `Crypto.Crypto`,
so its synchronous twin is not a free derivation — it takes the digest from
the caller — and the accuracy argument above does not strictly apply, since
the `Effect` form really is the effectful one. It is still spelled
`hashResult` (`packages/jsonc/src/JsoncFingerprint.ts:483`), on the
precedent and naming-collision arguments: `Result` is what the kit's readers
have been taught to look for, and `*Sync` would still collide with the
workspaces meaning. A sync twin that needs the caller to supply the platform
is named for its return type like every other one, and takes that platform
as an explicit argument rather than importing `node:*` — the
`TsconfigLoaderSyncOptions` shape
(`packages/tsconfig-json/src/TsconfigLoaderSync.ts:91`) is the worked
example: it carries a `SyncFileSystem` and `SyncPath` supplied by the caller
rather than reaching for `node:fs`/`node:path` itself.

See [sync-form-named-result](../decisions/sync-form-named-result.md) for the
naming decision's alternatives-rejected record.

## Where the policy stops

It applies to the engine, not to every adapter over it.

`@effected/config-file`'s four codecs shape-match the policy and are
deliberately exempt. They do not own their signature — they implement the
`ConfigCodec` interface, whose `Effect` is not a span wrapper but the
polymorphism that makes the seam composable: the error type is generic
precisely so decorator codecs can wrap a codec, widen the error channel and
return a codec. A sync twin would mean a parallel sync interface and a
parallel decorator stack for every decorator. And the synchronous host does
not exist one level down: a codec is consumed by a config-loading pipeline
hosted by an application at startup, already in `Effect` and already reading
files through `FileSystem`. The sync pressure is real one level up, in the
format packages, and that is exactly where the fix belongs.

The second stopping rule is: do not complete the pattern for its own sake.
`@effected/templates` gives only `parse` the `*Result` + `Effect` twin pair,
because only `parse` is a public boundary a consumer would otherwise want as
an `Effect`; its instance methods on an already-parsed document return
`Result`/`Option`/a total value with no `Effect` twin, and adding twins would
mint dead surface.

## Adopters

As of this writing, `grep -rl parseResult packages/*/src` names: `git`,
`github`, `github-actions`, `jsonc`, `jsonl`, `markdown`, `npm`,
`package-json`, `sbom`, `schemastore`, `semver`, `spdx`, `templates`, `toml`,
`workspaces` and `yaml`. Every pure-tier format and grammar package in the
kit is built on this policy, plus the pure cores of some boundary packages;
each package's own documentation names its own primitives.

A missing twin on an in-scope boundary is a review finding, not a
nice-to-have — the policy is also stated in the kit's own Effect
observability guidance so a reviewer meets it without reading this document.


---
<!-- okf/decisions/sync-form-named-result.md -->
---
type: Decision
title: "The sync form is named `*Result`, never `*Sync`"
description: "The kit spells a pure boundary's synchronous twin `*Result`, reserving `*Sync` for genuinely IO-performing sync facades."
status: draft
tags:
  - architecture
  - dx
  - compat
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 53744903cc1e476aac52cab446147c5fc0a223e67f898a3a6b2deb519002d218
---

# The sync form is named `*Result`, never `*Sync`

## Context

The [sync-primitive policy](../conventions/sync-primitive-policy.md)
established that a pure kit boundary derives an `Effect` form from a
synchronous primitive. Naming that primitive needed a single answer, chosen
before it shipped on published surfaces across many packages.

## Decision

The sync form is spelled `*Result`, never `*Sync`, on three arguments in
ascending order of force:

1. **Precedent.** `*Result` is where the policy started and what the kit's
   own skills already name.
2. **Accuracy.** `Sync` names a distinction that does not exist — the
   `Effect` form in scope for this policy is also synchronous (`R = never`,
   no async step, no IO), which is the entire premise of the policy.
   `Result` names the one thing that actually differs between the two forms:
   the return type.
3. **`*Sync` is already taken in this kit, for an incompatible meaning.**
   `@effected/workspaces` ships a sync facade family
   (`findWorkspaceRootSync`, `getWorkspacePackagesSync`, `readPackageSync`)
   whose members are genuinely IO-performing functions returning nullables,
   not `Result`s. Within one kit, `*Sync` would mean both "does blocking IO,
   returns a nullable" and "pure computation, returns a `Result`" —
   indistinguishable from the name alone.

The rule holds even where the `Effect` twin is not merely a span wrapper.
`@effected/jsonc`'s `JsoncFingerprint.hash` requires core's `Crypto.Crypto`,
so its synchronous twin, `hashResult`
(`packages/jsonc/src/JsoncFingerprint.ts:483`), is not a free derivation — it
takes the digest from the caller instead of the service. Argument 2 does not
strictly apply here, since the `Effect` form really is the effectful one, but
arguments 1 and 3 still hold: `Result` is what the kit's readers have been
taught to look for, and `*Sync` would still collide with the workspaces
meaning. A sync twin that needs the caller to supply the platform is named
for its return type like every other one, and takes that platform as an
explicit argument rather than importing `node:*` — the
`TsconfigLoaderSyncOptions` shape
(`packages/tsconfig-json/src/TsconfigLoaderSync.ts:91`), carrying a
consumer-supplied `SyncFileSystem` and `SyncPath`, is the worked example.

This decision is the [format-package
convention](../conventions/format-package-convention.md)'s naming decision
generalized past formatting: `PackageJsonFormat.sortValue` and
`.formatToString` name their own shapes rather than borrowing `*Result`,
because they are total, not fallible-and-sync; `*Result` names the fallible
case specifically.

## Alternatives rejected

**`*Sync`.** Rejected on the naming-collision argument above:
`@effected/workspaces`'s existing sync facade family already uses `*Sync` for
a different contract (real IO, nullable return), and reusing the suffix for
"pure, `Result`-returning" would make the name lie about one of the two
meanings depending on which package a reader last read.

**A generic wrapper name unrelated to the return type, such as `*Pure`.**
Rejected as strictly less useful than naming the return type directly:
`Result` tells a reader exactly what to expect from the call, where `Pure`
only tells them what the call is not.

## Consequences

Every pure boundary's synchronous twin in the kit is discoverable by grepping
for the `*Result` suffix, and that grep is stable because `*Sync` is reserved
for a different, IO-performing contract. A package introducing a new
IO-performing synchronous facade uses `*Sync`; a package deriving a
synchronous primitive under the [sync-primitive
policy](../conventions/sync-primitive-policy.md) uses `*Result` regardless of
whether the derivation is free or takes an explicit platform argument.
