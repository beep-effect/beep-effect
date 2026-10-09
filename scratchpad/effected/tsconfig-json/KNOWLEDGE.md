# tsconfig-json — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/tsconfig-json/CLAUDE.md -->
# @effected/tsconfig-json

tsconfig.json schemas, `extends`-chain resolution and config discovery. The one **new** (non-migration) `0.1.0` gate package; designed 2026-07-13.

**Design doc:** `@./okf/modules/tsconfig-json.md` — load when changing the merge semantics, the extends-target engine, or the enum tables.

## Tier: boundary

`effect` is the only non-workspace peer (`catalog:effect` in this manifest); `@effected/jsonc` and `@effected/walker` are `workspace:^` in `peerDependencies` (so a published patch floats), mirrored by the plain `workspace:*` in `devDependencies` — the two specifiers now deliberately differ. Runtime `dependencies` stays empty — **zero external runtime dependencies**. All IO goes through core `FileSystem`/`Path` in `R`; a `PlatformError` from the underlying IO flows through **untranslated**.

**HARD RULE: zero `typescript` imports, including `import type`.** The version-coupled enum mappings live in `TsEnumCodec` as plain data tables; nothing else in the package may know TypeScript's numeric enums exist.

`TsconfigDiscovery`, `TsconfigLoader`, `TsconfigLoaderSync` and `TsEnumCodec` are static classes with a private constructor, not `as const` namespace objects (the same conversion as `@effected/commands`' `Run`/`Redaction`/`Retry`) — an `as const` object's member types are inferred in the built `.d.ts` and lose their TSDoc entirely. `ResolvedTsconfig` and `PortableTsconfig` carry the same conversion one step further: each merges the static class with the pre-existing same-named data interface (`{@link (X:interface)}` / `{@link (X:class)}` selectors disambiguate the two in TSDoc), which trips Biome's `noUnsafeDeclarationMerging` — narrowly suppressed with a reason on both classes, since neither contributes instance members to the merge. `SpdxExpression`-shaped facades (a `type` alias sharing the facade's name, as in `@effected/spdx`) are NOT eligible for this conversion — a class cannot merge with a type alias, only with an interface. `TsEnumCodec.ts`'s conversion also fixed one latent `ae-unresolved-link` (a stale `{@link (CompilerOptions:variable).Type}` that should have selected `:namespace`) that the prior `as const` shape had silently hidden from API Extractor by never emitting that doc comment at all.

## Module map (one concept per module)

- `CompilerOptions` — string-level literal-union schemas: case-insensitive decode, canonical-lowercase encode; typed live option set plus passthrough so unknown **and** dead options survive.
- `TsconfigJson` — the document schema, the `TsconfigJsonFromString` JSONC codec (bound once at module top level) and `TsconfigParseError`. **Every parse is JSONC** via `@effected/jsonc`; there is no JSON-strict path.
- `ResolvedTsconfig` — the pure merge engine: E4 per-field semantics, path-option absolutization, final-phase `${configDir}` substitution, `pathsBase` provenance. No `FileSystem`, no `Path` service.
- `TsEnumCodec` — string↔numeric data maps (including the `node18`=101 / `node20`=102 gaps) and the `lib` normalizer. `encodeCompilerOptions` returns the exported `ProgrammaticCompilerOptions` (values `ProgrammaticCompilerOptionsValue`) — a structural transcription of typescript 6.0.3's `CompilerOptionsValue` that keeps the zero-`typescript`-imports rule (one documented internal assertion), feeds the external `type-registry-effect` package's `TsEnvironment` (the former `@effected/ts-vfs`, now outside this kit), and emits `lib` in the **file-name form** (`lib.esnext.d.ts`) — verified against typescript 6.0.3's `pathForLibFile`, which joins the entry verbatim onto the lib directory.
- `CompilerOptionsFromProgrammatic` — the **validating door IN** from TypeScript's programmatic spelling (`{ target: ts.ScriptTarget.ES2025 }`, a live `ts.CompilerOptions`, or `encodeCompilerOptions` output). A codec, deliberately **not** a `normalizeCompilerOptions` function: `TsEnumCodec.decodeCompilerOptions` already does the whole value-level normalization, and its wide `Record<string, unknown>` return is the point — an unmappable numeric passes through it, so only composing it with `CompilerOptions`'s own decode can promise `CompilerOptions.Type`. That composition is what makes "never guess" **enforced**: the surviving numeric fails decode typed, instead of being asserted away by a cast at the call site. Case-insensitivity comes free from `CompilerOptions`. Covers the same six families plus `lib` that `encodeCompilerOptions` covers — **not** the watch families, which belong to `watchOptions`.
- `PortableTsconfig` — an **allow-list** filter (never a deny-list), forced `composite: false` / `noEmit: true`, and a `$schema` stamp. The allow-list has **two tiers**: the unconditional one, and a single opt-in key `types`, reached via `make`'s optional `PortableTsconfigOptions` second argument (`includeTypes`, default `false`). `types` is portable (package names, not paths) but carrying it makes tsc *demand* those packages resolve — a hard error in a virtual environment with no `node_modules` — so the caller picks the failure mode. `typeRoots` stays dropped in **both** tiers (machine-specific, config-location-dependent directories — absolute off a `ResolvedTsconfig`, relative off a bare options bag, portable in neither form). Do not "simplify" this into an unconditional allow-list entry; the two-tier split is the whole point (see the design doc's portable-vs-resolvable section).
- `JsxConfig` — a pure projection from decoded compiler options to the JSX transform a bundler can configure: `react-jsx` / `react-jsxdev` → the `automatic` runtime (`importSource` defaulting to `"react"`, tsc's own default), `react` → `classic`; `preserve`, `react-native` and an absent `jsx` → `Option.none()`. The classic factory options stay on `CompilerOptions`.
- `TsconfigLoader` — `load` / `resolve` / `compilerOptions` (a thin projection of `resolve` down to the merged options), each an `Effect.fn` with a named span (`TsconfigLoader.load` etc.): depth-first `extends` with **per-branch** cycle stacks (diamonds are legal), `MAX_EXTENDS_DEPTH = 32`, and `TsconfigExtendsError` with reasons `not-found` / `cycle` / `depth` / `empty`.
- `TsconfigLoaderSync` — the sync facade for sync-only host APIs (bundler plugin hooks, config factories): the **unchanged** `TsconfigLoader` pipeline under `Effect.runSyncExit`, over consumer-supplied `SyncFileSystem` / `SyncPath` ops (`node:fs` one-liners and `node:path` itself satisfy them) adapted into per-call service values — never layers, so no memoization to poison across calls. The adapters are deliberately asymmetric: an unsupported `Path` member throws a **named defect**, while an un-overridden `FileSystem` member fails typed with `makeNoop`'s `NotFound`. Typed failures (`TsconfigParseError` / `TsconfigExtendsError` / `PlatformError`) are **thrown as themselves**, defects rethrown as-is — never a fiber-failure wrapper. No `node:*` import, no posix assumption; Windows correctness is the consumer passing a win32-appropriate `path`.
- `TsconfigDiscovery` — `findNearest` over `Walker.ascend` + `Walker.findUpward`; absence is `Option.none()`, never an error; `stopAt` is inclusive.
- `internal/extendsTarget` — **not exported**: E1 relative/rooted and E2 bare-specifier target resolution, plus the hardened `exports`-map subset.

## The tsc-parity discipline

The `extends`/merge semantics were **extracted from TypeScript 6.0.3 source** (`commandLineParser.ts` / `moduleNameResolver.ts`) and encoded as data-driven tests with `typescript.js` line citations embedded in the test comments. The following parity facts cost real review cycles — **do not regress them**:

- A malformed or non-object `package.json` coerces to `{}` and **falls through** to the `<pkg>/tsconfig.json` probe (tsc's `readJson(...) || {}`).
- There is **no `package.json` presence gate** — a manifest-less package directory still resolves via its `tsconfig.json`.
- The ancestor `node_modules` walk **continues past a present-but-unresolved candidate**; an `exports` map blocks only that package's own fallbacks, never a farther ancestor's copy.
- A falsy `"tsconfig"` manifest field target falls through to the `tsconfig.json` probe.
- `exports`-map `*` patterns match by **longest base prefix** (most specific), not first-in-order.
- Enum **values** are case-insensitive (lowercased before lookup); option **names** are case-sensitive.

## The file-only FileSystem contract

Target probing uses `fs.exists`, which is true for a directory, where tsc's `host.fileExists` is file-only. The loader documents a **file-only contract** (see the `TsconfigLoader.ts` header): a directory hit fails typed via `readFileString`'s `PlatformError` — never a defect — where tsc would retry `"./dir.json"`. Accepted, documented divergence; do not "fix" it by rewriting the tsc-cited engine. A test now pins the directory hit itself (`./dir` → `Some("/proj/dir")`), so the divergence cannot regress unnoticed.

## Hardening (do not relax)

- `extends` depth guard (32) and per-branch cycle detection in the loader.
- `exports`-map recursion depth guard (32) in `internal/extendsTarget`.
- `Object.hasOwn` on every untrusted map read; `__proto__` / `constructor` / `prototype` keys skipped; wildcard-substituted maps built with `Object.create(null)`.
- Malformed input always fails through the **typed** channel (`TsconfigParseError`, `TsconfigExtendsError`, `PlatformError`) — never as a defect.

## Testing and building

Tests live in `__test__/`, use `@effect/vitest`, and assert with `assert.*` — **never** `expect`. For the count, run `pnpm test --filter @effected/tsconfig-json`.

```bash
pnpm vitest run packages/tsconfig-json
pnpm build --filter @effected/tsconfig-json   # from the repo root
```

- Resolution suites run on in-memory fixture trees from `__test__/fixtures.ts`: `@effected/memfs` (a devDependency) seeded from a `Map`, merged with core `Path.layer` — **no platform package, even in tests**. The volume creates real parent directories, so `exists` is directory-true and the file-only divergence above is **observable in tests** rather than hidden; the previous `layerNoop`-over-a-`Map` stub was structurally file-only and masked it. The **discovery** suite's permission-denied case is the same volume with an `exists` fault on a candidate that is genuinely present, so disarming the fault moves the answer. `TsconfigLoaderSync`'s suites pass the handle's node-shaped `sync` port (`MemoryFileSystem.makeSync(seed).sync`) as the consumer's `SyncFileSystem` — it satisfies the interface structurally; the win32 suite reaches the POSIX volume through a two-member spelling shim (`C:\proj` → `/C:/proj`) and nothing more. The production `makeNoop` adapter in `TsconfigLoaderSync.ts` is the facade itself, not a test double.
- `savvy.build.ts` carries the standard **narrow** suppression `{ messageId: "ae-forgotten-export", pattern: "_base" }`; exactly 3 suppressed entries are expected in `issues.json` (the two error bases plus `JsxConfig_base`). Never widen it, and never run `node savvy.build.ts --target prod` directly.

## Consumers this API was designed against

- `rspress-plugin-api-extractor`'s tsconfig-parser — the `0.1.0` gate proof.
- `@savvy-web/bundler`'s tsconfig-resolver.
- `type-registry-effect` (external; the former `@effected/ts-vfs`) — `TsEnumCodec.encodeCompilerOptions` produces the shape its `TsEnvironment` hands to `@typescript/vfs`.


---
<!-- okf/modules/tsconfig-json.md -->
---
type: Module
title: tsconfig-json
description: Read, decode, validate, resolve and construct tsconfig.json files with zero typescript imports.
status: stable
kind: package
resource: ../../packages/tsconfig-json
tags:
  - dx
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 847a622f1c35a1f50ddeaf0a3174a2be4b94f6964ccb8329be4eab6fcd3fa6c1
---

# tsconfig-json

## Purpose

`@effected/tsconfig-json` reads, decodes, validates, resolves and constructs `tsconfig.json` files: string-level schemas for the document shape, full `extends`-chain resolution matching `tsc` semantics, nearest-tsconfig upward discovery, a data-owned codec between string option values and TypeScript's numeric enums, and a portable-tsconfig filter for virtual-TS environments. It is a new invention scoped by named consumer surveys, not a port. It enforces the kit's TypeScript posture: version-coupled parts of tsconfig knowledge become plain data owned here, so no `@effected/*` package ever imports `typescript` — see [no typescript imports](../conventions/no-typescript-imports.md).

## One package, not two

A split into a pure schema package plus a boundary IO package was considered and rejected — see [tsconfig-json is one package, not two](../decisions/tsconfig-one-package-not-two.md). The two-layer instinct survives as **internal architecture**: pure schema and codec modules that never import `FileSystem`, and separate loader, resolver and discovery modules that do.

## Tier and dependency posture

[Boundary tier](../glossary/library-tier.md). All file IO — loading, extends resolution, discovery — goes exclusively through core `FileSystem`/`Path` arriving via the `R` channel, and `PlatformError` flows through untranslated. `effect` is the only non-workspace peer; `jsonc` (the decode engine) and `walker` (upward traversal) are `workspace:^` peers mirrored by plain `workspace:*` devDependencies. Runtime `dependencies` stays **empty**.

**Hard rule: zero `typescript` imports anywhere, including type imports.** The version-coupled enum mappings are owned as plain data (see [the numeric-enum codec](#the-numeric-enum-codec-data-not-typescript)); anything shaped like `ts.CompilerOptions` is typed structurally. No services, no layers: the package exposes effectful statics requiring `FileSystem`/`Path` in `R`, discharged once by the consumer's platform layer at the edge — there is no per-consumer state that would earn a `Context.Service`.

## Module layout

One concept per file, no barrels beyond `index.ts`. The document schema, option schemas, merge engine, enum codec, the programmatic-input codec, portable filter and JSX projection are all **pure** and never import `FileSystem`; only the loader, its sync facade, discovery and the internal target resolver touch the `R` channel. The merge engine takes an injected `join` rather than the `Path` service, which is what keeps it on the pure side.

The extends-target resolver is one internal module (`internal/extendsTarget.ts`) owning both target forms — relative/rooted resolution, and bare-specifier `node_modules` lookup including a hardened subset of package.json `exports`-map resolution — because target resolution is an implementation seam of the loader, not a concept a consumer names; a hostile manifest is absorbed to "no resolution for that candidate", never a defect. The document codec is a bare module-level const rather than a dotted static, because the document schema is a `Schema.StructWithRest` **value** chosen for its passthrough rest row, which has no static slot to hang a `FromString` idiom on.

## Schema design: string-level, JSONC-always, forward-tolerant

The document schema models the raw file shape. Enum-valued options stay **string-level literal unions**, case-insensitive on decode the way `tsc` accepts them, canonical-lowercase on encode, eliminating the numeric→string round trip a raw consumer of the TypeScript config API performs; option *names* stay case-sensitive. The package targets **TS ≥ 6 only** — dead and removed options get no typed fields, but they are not decode errors either, riding the passthrough. The schema is **forward- and backward-tolerant**: unknown compiler-option keys are preserved through decode via a passthrough record, never rejected; known keys validate strictly; unknown keys survive re-encode — TypeScript adds options every minor release, and a schema pinned at publish time must not break on a newer consumer's tsconfig. **Every parse is JSONC**, unconditionally — tsconfig files are JSONC regardless of the `.json` name, and there is no JSON-strict path. Construction and validation are pure and need no IO.

## Extends resolution and merge semantics

The loader reads a tsconfig by path, decodes it as JSONC, and resolves the full `extends` chain matching `tsc` semantics: relative targets against the extending file's directory; array `extends` with later entries winning; and package-name targets via plain upward `node_modules` **file** resolution, including the implicit `/tsconfig.json` suffix and the package.json `"tsconfig"` field — file and module-path resolution, not compiler machinery, which is the whole reason this capability can live in a zero-`typescript` package. Compiler options merge per key with the derived config winning; file-selection arrays replace wholesale; relative paths in a base config are re-rooted relative to the base file; project references are never inherited. The result is a resolved-config type distinct from the document type, carrying the config path and the extended paths in resolution order, with `${configDir}` substitution as a final phase and `pathsBase` provenance.

The lookup and merge rules were extracted from the TypeScript source and encoded as data-driven tests with line citations embedded in the test comments and module headers, so drift from `tsc` is a failing test rather than a latent bug — these parity facts cost real review cycles and must not be regressed: a malformed or non-object `package.json` coerces to `{}` and falls through to the `<pkg>/tsconfig.json` probe; there is no `package.json` presence gate; the ancestor `node_modules` walk continues past a present-but-unresolved candidate rather than aborting; a falsy `"tsconfig"` manifest field falls through to the `tsconfig.json` probe; `exports`-map wildcard selection is longest base prefix, not first-in-order; and slashes are normalized once, on the spec, with the normalized name resolving throughout.

**The file-only `FileSystem` contract** is a deliberate, accepted divergence: target probes use core `FileSystem.exists`, true for a directory on a real filesystem, whereas `tsc`'s host check is file-only. A relative extends target naming a real directory therefore resolves the directory verbatim and the subsequent read fails with a typed `PlatformError`, where `tsc` would retry the `.json`-appended sibling. This satisfies the hardening invariant, the in-memory fixture filesystem cannot exercise it by construction, and a stat-and-is-file probe would rewrite the `tsc`-cited target engine for a case no supported test can reach — do not "fix" it.

Extends resolution is a recursive walk over untrusted files, so the input-hardening invariants apply and must not be relaxed: an extends-depth guard with **per-branch** cycle stacks (so diamonds stay legal), a recursion depth guard inside the `exports`-map subset, own-property checks on every untrusted map read with dunder keys skipped, and wildcard-substituted maps built on a null prototype. Malformed input always fails through the typed channel, never as a defect.

## The loader surface

`load`, `resolve` and `compilerOptions` are uniform `Effect.fn`s with named spans; `compilerOptions` is a thin projection of `resolve` down to the merged compiler options — the common "just give me the effective options" question, so consumers stop hand-parsing tsconfig files with bare `JSON.parse`, which is JSONC-blind and misses everything inherited through `extends`.

### TsconfigLoaderSync — the sync facade

Bundler plugin hooks and config factories are synchronous host APIs, and the kit is async-first, so the sync facade is the escape hatch — the design rule it implements: sync escape hatches take their platform from the caller, since the kit never imports `node:*` and never assumes posix. **Consumer-supplied ops, structurally typed**: minimal structural filesystem and path interfaces that Node's built-ins satisfy verbatim (the `fs` functions one-liner each, and `node:path` — including `node:path/win32` explicitly, or a Bun or Deno equivalent — *is* the path interface). Windows correctness is the consumer passing a win32-appropriate implementation, not anything in this module. **Zero logic duplication**: the facade runs the unchanged async pipeline under `Effect.runSyncExit`; the consumer's ops are adapted into core service **values** provided per call, never layers, so there is no memoization to poison across calls with different options — an unsupported path member throws a named defect, while an un-overridden filesystem member fails typed. **The failure contract is the async pipeline's, thrown**: on failure the `Cause` is unwrapped so the typed error is thrown as itself, and a defect rethrows as-is — a caller never sees a fiber-failure wrapper. `TsconfigLoaderSyncOptions` is the shape a Node consumer's `fs`/`path` wrapper satisfies to unlock this facade.

## JsxConfig

A pure projection from decoded compiler options to the JSX transform a bundler can actually configure. The automatic-runtime spellings yield the automatic runtime with the import source defaulting exactly as `tsc` does; the classic spelling yields classic, with the factory options left on the compiler-options model where classic consumers read them. `preserve`, React Native and an absent setting yield `Option.none()` — JSX is left untransformed, so there is nothing to configure.

## Discovery

Nearest-tsconfig upward search over `walker`, with the filename parameterized — the default, a build-variant name, or any other by argument — returning `Option`. Absence is `Option.none()`, never an error, and the stop boundary is inclusive.

## The numeric-enum codec: data, not typescript

One pure module owns the version-coupled string↔numeric mappings **as plain data**, including the enum-value gaps that not all TypeScript versions export, plus the lib-reference normalizer — see [the numeric-enum codec is data, not code](../decisions/numeric-enum-codec-is-data.md) and [the enum mapping tables](../models/tsconfig-enum-mappings.md) for the tables' own shape and refresh procedure. When TypeScript adds an enum member, the change here is a data edit and a test fixture, not a dependency bump.

The **encode** direction feeds an external virtual-TS environment; the **decode** direction absorbs numeric configs coming out of TS APIs. Decode returns an open record, not the validated option type — passthrough-honest: a numeric value with no table entry (a future TS enum member) is left as-is rather than errored, and callers wanting the validated shape decode through the schema afterwards. The `lib` encode direction emits the file-name form (`lib.esnext.d.ts`), not the short name, verified against the installed TypeScript, which joins each entry onto the lib directory as a literal file name — a virtual-TS environment hands the options straight to the compiler, so consumers get the one form it resolves; decode and the normalizer emit the short form.

Encode returns exported **structural** types rather than an open record, so a consumer handing the result to a virtual-TS environment or to the compiler does not end the pipeline with a cast — those types are a verbatim structural transcription of TypeScript 6's compiler-option value union, minus the compiler-internal AST case unreachable from JSON, cited in TSDoc; the zero-`typescript` rule is preserved throughout. One documented internal assertion bridges the codec's internal record to the assignable value union, owned once here rather than re-cast at every call site, exactly as the compiler's own index signature makes the identical unproven claim about passthrough values, pinned by a compile-time assignability test against a cited structural replica with no `typescript` import. That free assignability targets the TypeScript 6 consumer specifically — TypeScript 7 dropped the index signature while keeping nominal enums, so the structural-subset argument holds against the TS6 shape the encode target's consumer pins.

### The validating door in

A **codec**, composing the existing decode normalizer with the schema's own decode, is the answer to "someone writing options in TypeScript naturally reaches for `ts.ScriptTarget.ES2025` over `\"es2025\"`" — deliberately not a `normalizeCompilerOptions` function, because the normalizer already exists (whole-object decode does the entire value-level job) and the actual gap is typing, not normalization: decode's open-record return is deliberate, so a total function returning the validated option type cannot exist without re-asserting exactly what a downstream laundering cast already asserts, one layer up. The codec form buys three things a function could not: "never guess" becomes enforced (an unmappable numeric survives normalization as a number and is rejected typed by the enum-family schemas, rather than the pass-through staying correct one layer down where a boundary that *promises* the validated type has to fail loudly); case-insensitivity comes free from the schema's existing case-insensitive literal decode; and the synchronous consumer keeps its shape via the schema's `Result` entry point with no `Effect` in the path. Scope is the exact inverse of the encode direction — the same six compiler-option families plus `lib`, deliberately not the watch families, which belong to a different document node.

## Portable tsconfig

A small pure module producing a self-contained, machine-independent config from a resolved one: compiler options only, emit/path/file-selection options excluded, `composite: false` and `noEmit: true` forced, and a `$schema` stamp. It is generic to any virtual-TS or Twoslash environment. The filter is an **allow-list, never a deny-list** — only classified keys reach the output, and unknown options, including every forward-tolerance passthrough key the schemas preserve, are dropped by design; growing the allow-list is an explicit, reviewed addition. Emit-formatting keys are excluded as having no bearing on type-checking and inert under the forced `noEmit`.

The allow-list has **two tiers**. The unconditional tier is safe for every consumer; the second holds exactly one key, `types`, reached through an optional options argument and defaulting to off. `types` holds package *names*, never a path, so it passes the portability criterion outright — unlike `typeRoots`, which names machine-specific, config-location-dependent directories and stays dropped in **both** tiers. What makes `types` not-unconditional is the failure mode it selects: emitting it makes `tsc` **demand** those packages resolve, a hard error in a virtual environment with no `node_modules`, while omitting it lets TypeScript auto-include whatever type packages the environment happens to have and never error — dropping it trades a loud failure for a silent missing-globals one, so the caller picks. Do not simplify this into an unconditional entry; the two-tier split is the whole point.

## Errors

Typed errors owned by their modules, under the restrained-granularity rule of one tag per genuinely distinct recovery path. A parse error carries the path and a structured cause; the path is the file path when the failure is file-bound and empty when decoding an in-memory string. An extends error carries one tag with a `reason` literal covering not-found, cycle, depth and empty, because all four share a single recovery path (fix the chain), plus the full resolution chain of normalized absolute paths for diagnostics. `PlatformError` flows through untranslated on IO — the package neither absorbs nor rewraps filesystem failures it cannot interpret.

## Testing

`@effect/vitest`, `it.effect`, `assert.*` never `expect`, tests in `__test__/`. Resolution suites run on in-memory fixture trees — a real volume from `memfs` (a devDependency) seeded from a `Map`, merged with core's `Path` layer, so there is still no platform package even in tests. **A structurally file-only double must never come back**, and the reason is this package's own cautionary tale: a `layerNoop`-over-a-`Map` fixture makes directories not exist, which makes its `exists` structurally file-only, accidentally *agreeing* with the loader's file-only contract and thereby hiding the very divergence that contract exists to record — a test asserting `Option.none()` for a relative path to a directory passed for the wrong reason under that stub, while against a real volume the divergence is observable and the test pins the real answer. The **discovery** suite keeps a separate, narrow `layerNoop` stub, since it asserts which candidates walker probes rather than what a filesystem holds. The families that matter: fixture trees with real extends chains asserting merge semantics and extended-path ordering; data-driven parity tests recorded from the TypeScript-source verification; hostile inputs (cycles, deep chains, malformed JSONC, dunder keys) each failing with its typed error; round-trip properties on the document schema including unknown-key preservation; and the compile-time assignability test on the encode return.

## Consumers this API was designed against

`rspress-plugin-api-extractor`'s tsconfig parser loads a tsconfig by path, resolves extends, extracts a compiler-options subset, needs the extended-path metadata, and feeds numeric options to a virtual-TS environment. `@savvy-web/bundler`'s tsconfig resolver does the same load-and-resolve, followed by the numeric-to-portable-string conversion this package's string-level schemas eliminate outright. `type-registry-effect` (external) consumes numeric compiler options in its virtual-TS environment, which is the enum codec's encode target. Out of scope: the bundler's declaration-file AST walkers and the api-extractor plugin's Twoslash type-checking keep direct `typescript` as a sanctioned island — this package resolves and shapes configuration; it never runs a compiler.

## Build

Standard gates: `tsc --noEmit`, a zero-warning `dist/prod/issues.json`, Biome and markdownlint clean, the full suite green. `savvy.build.ts` carries the standard narrow `_base` suppression; the prod gate expects a **non-zero** suppressed count — `suppressed: 0` means the build did not run properly.
