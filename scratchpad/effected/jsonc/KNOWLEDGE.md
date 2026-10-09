# jsonc — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/jsonc/CLAUDE.md -->
# @effected/jsonc

Zero-dependency JSONC parse/edit/format schemas: parse into values or an AST, strip comments offset-preservingly, compute byte-minimal edits, format, modify by path, visit as a `Stream`.

**Tier: pure.** Peer-depends on `effect` only. Zero runtime deps, no IO. Second migration; merged. Public facades in `src/`, the engine in `src/internal/`, tests in `__test__/`.

**For the full design:** → `@./okf/modules/jsonc.md`

Load when changing the public API, the error set, the hardening story, or the jsonc/yaml parity convention.

## Engine/facade split

The scanner, parser, navigator and limits in `src/internal/` are a **vendored engine** (~1,245 lines, ported with attribution to Microsoft's `jsonc-parser` design, MIT) — house policy for pure-tier format packages: vendor and attribute, never take a runtime dep.

The split is a **cycle firewall**, and `noImportCycles` is error-level. `src/internal/` returns raw records (`{ code, offset, length }` parse errors, `_tag`-discriminated navigate results); the facade materializes the `Schema.Class` types and tagged errors, deriving `line`/`character` from `offset`. An internal module importing the facade fails the lint — with the one edge `internal/parser.ts` → `JsoncNode.js`, which is why the depth cap lives in the zero-dependency leaf `internal/limits.ts`: every recursive surface imports one constant without closing a cycle.

## Hardening invariant

Malformed or hostile input must fail through the typed `E` channel — never as a `Cause.Die` defect, never as `RangeError: Maximum call stack size exceeded`.

`MAX_NESTING_DEPTH = 256` (in `internal/limits.ts`) is enforced independently at five recursive surfaces:

1. `internal/parser.ts` value mode → `NestingDepthExceeded` parse error
2. `internal/parser.ts` tree mode → same
3. `JsoncNode.ts` walkers (`evaluateNode`, `findAtOffsetImpl`, `buildPath`) → bounded placeholder; reachable only via hand-built trees
4. `Jsonc.ts` `deepEqual` (backs `equals`/`equalsValue`) → returns `false`
5. `JsoncVisitor.ts` `visitValue` → in-band `Error` event, then an iterative `skipDeepContainer()`

`internal/navigate.ts` needs no cap: `skipValue()` is an iterative balanced-bracket skip, so it cannot overflow. The skip algorithm itself (bracket counting over the flat token stream, plus the malformed-closer guard) has a single copy in `internal/skip.ts` (`skipBalancedValue`), parameterized over a token cursor; the parser, navigator and visitor each adapt their own advance discipline to it.

The parser's tree mode constructs nodes via `makeNodeUnsafe` in `JsoncNode.ts` — a validation-free internal path (not re-exported from `index.ts`) that exists because schema construction re-validates the recursive `children` field per node, doubling cost per nesting level (#13). The parser guarantees validity by construction; public `JsoncNode.make`/`new` remain fully validating.

Errors preserve structure. `JsoncModificationError` carries typed `path`/`expected`/`depth`/`offset?` fields — never a `reason: string`.

## Public surface

Exported from `src/index.ts`:

- `Jsonc` — `parse`, `parseTree`, `stringify` (`Effect`, failing with the aggregate `JsoncParseError` / `JsoncStringifyError`); `parseResult`, `parseTreeResult`, `stringifyResult` (synchronous `Result` variants the `Effect` forms are defined in terms of); `stripComments`, `equals`, `equalsValue` (pure, total); `fromString`, `JsoncFromString`, `schema(target)` (generic over `RD`/`RE`, at parity with yaml and toml), `bind(target)` → a `JsoncBoundCodec` `{ schema, decode, encode }` pre-binding both directions, each failing with `Schema.SchemaError` — thin sugar over `schema(target)` plus `Schema.decodeEffect`/`encodeEffect`, adding no error taxonomy of its own. Plus `JsoncParseError`, `JsoncParseErrorDetail`, `JsoncParseErrorCode`, `JsoncParseOptions`, `JsoncStringifyError`, `JsoncStringifyErrorCode`, `JsoncStringifyOptions`
- `JsoncNode`, `JsoncNodeType`, `JsoncPath`, `JsoncSegment` — the AST; no parent pointers (they would break equality, serialization and encode/decode)
- `JsoncEdit` (+ `applyAll`, which **rejects overlapping edits as a thrown defect** — toml's posture, now shared by all four format packages; a programmer-error guard on hand-constructed arrays, not input hardening), `JsoncRange`, `JsoncFormattingOptions`
- `JsoncFingerprint` — `canonicalizeResult`/`canonicalize` (RFC 8785 canonical JSON, failing typed with `JsoncCanonicalizeError` — deliberately stricter than `Jsonc.stringify`: nested `undefined`/functions/symbols, non-finite numbers and non-plain objects all fail with a JSON-pointer `path`, and the depth cap intercepts cycles); `hash` / `hashText` (64-char lowercase-hex SHA-256 digests, the same format `@effected/sbom`'s `Sha256Digest` schema decodes — with **no dependency edge on `sbom`**; `JsoncTextHashOptions.normalizeEol` opts into CRLF/CR→LF) requiring core's `Crypto.Crypto` in `R`, with `hashResult` / `hashTextResult` as their synchronous twins for callers with no fiber — those take the caller's own `JsoncDigest` (`(bytes: Uint8Array) => Uint8Array`, satisfied by a `node:crypto` `createHash` wrapper) and wrap it: a digest that throws or returns anything but 32 bytes fails `InvalidDigest` at path `""` rather than escaping into the synchronous host that called it; they are `*Result`, never `*Sync` — this stays **pure-tier**: needing a service in `R` does not promote a package to boundary/integrated, so never "fix" this into an IO-owning dependency; the consumer provides `NodeCrypto.layer` or any `Crypto` layer; `normalizeEol` (pure, total)
- `JsoncFormatter` — `format`, `formatToString`
- `JsoncModifier` — `modify`; `JsoncModificationError`, `JsoncModifyOptions`
- `JsoncVisitor`, `JsoncVisitorEvent` — SAX `Stream`, infallible at type level

`fromString`, `schema` and `bind` are schema-producing: bind results to a `const` on hot paths.

**Value-stringify is plain JSON emission, not JSONC.** `Jsonc.stringify` writes what `JSON.stringify(value, null, 2)` writes — comments live only in the document/edit layer, so they never survive a value round-trip. The typed failure is deliberately narrow: `CircularReference`, `BigIntValue` and `TopLevelUnrepresentable` only. **Nested** unrepresentables (functions, `undefined`, symbols) follow `JSON.stringify`'s documented semantics — dropped from objects, nulled in arrays — rather than erroring. Do not "harden" that into a typed error; it is JSON's contract, matched on purpose.

## Working here

```bash
pnpm vitest run packages/jsonc/__test__   # this package's tests
pnpm build --filter @effected/jsonc       # dev + prod, in order
```

Never run `node savvy.build.ts --target prod` directly. It skips `build:dev`, emits no `.d.ts`, and leaves a truncated `issues.json` shaped exactly like a clean gate.

Tests live in `__test__/`, use `@effect/vitest`, and assert with `assert.*` — never `expect`.

`savvy.build.ts` carries one narrow API Extractor suppression: `{ messageId: "ae-forgotten-export", pattern: "_base" }`, covering the heritage symbols synthesized by inline class factories. Never widen it. `package.json` stays `"private": true` — the bundler emits the publishable manifest.


---
<!-- okf/modules/jsonc.md -->
---
type: Module
title: jsonc
description: Zero-dependency JSONC parsing, editing and formatting as Effect Schema classes.
status: stable
kind: package
resource: ../../packages/jsonc
tags:
  - dx
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 4c414480882dda4cf96ada0804c1343d2809c6a6bcccaa9b933e9515fdc6875e
---

# jsonc

## Purpose

`@effected/jsonc` is zero-dependency JSONC (JSON with Comments) parsing, editing and formatting as Effect schemas. All inputs are strings; all outputs are values, edits, streams or domain errors. Four things define its shape: a vendored zero-dependency scanner/parser core, an **edits-not-mutations** model (byte-minimal edits that preserve comments and whitespace — the whole value proposition over a `JSON.parse`/`stringify` round trip), a parent-pointer-free AST, and a single aggregate parse error. It is the reference template for [yaml](yaml.md): the two share a structural vocabulary bound by the [jsonc/yaml parity convention](#jsoncyaml-parity-convention).

## Tier and dependency posture

[Pure tier](../glossary/library-tier.md): `effect` is the only peer, no `@effect/platform*` imports, no `node:` imports, and no outbound `@effected` edges — `config-file` and `workspaces` depend on this package, never the reverse. `"sideEffects": false`.

## Module layout

Module-per-concept: `Jsonc.ts` (the facade — a static class over the parser and schema layers, owning the parse/stringify option and error vocabulary, not itself a schema class), `JsoncNode.ts` (the recursive AST node plus `JsoncPath`/`JsoncSegment`), `JsoncEdit.ts` (the edit class, `applyAll`, and the shared `JsoncRange`/`JsoncFormattingOptions` vocabulary), `JsoncFormatter.ts`, `JsoncModifier.ts`, `JsoncVisitor.ts` (formatting, path modification, the SAX stream), and `JsoncFingerprint.ts` (RFC 8785 canonical JSON plus SHA-256 content fingerprints — see [Fingerprinting](#fingerprinting-canonical-json-and-content-hashes)). `internal/` holds the private engine: the scanner, the recursive-descent parser, a scanner-based navigator, the shared `skipBalancedValue`, and `limits.ts`. `JsoncFormatter` is its own module rather than folded into the facade so the facade stays small and the jsonc/yaml surfaces stay structurally symmetric. The engine is **vendored** — ported with attribution to Microsoft's `jsonc-parser` design (MIT), house policy for pure-tier format packages: vendor and attribute, never take a runtime dependency.

## Engine/facade split

`noImportCycles` is error-level, so the split is structural rather than stylistic — see [the engine/facade split is a cycle firewall](../decisions/jsonc-engine-facade-split.md). `internal/` returns raw records (`{ code, offset, length }` parse errors, `_tag`-discriminated navigate results); the facade materializes `Schema.Class` types and tagged errors from them, deriving each detail's `line`/`character` from its `offset` against the source text — offsets are the engine's single positional currency, and the scanner tracks no line or column of its own. An internal module importing a facade module fails the lint; the one permitted edge is `internal/parser.ts` → `JsoncNode.ts`, which is exactly why the depth cap lives in the zero-dependency leaf `internal/limits.ts` — every recursive surface imports one constant without closing a cycle.

## Effect-wrapping policy

Pure synchronous methods where nothing can fail; `Effect` only where the error channel is real — this makes fallibility legible at the call site (an `Effect` return type means "this can produce a `JsoncParseError`") and keeps the pure operations ergonomic without forcing `runSync` on callers.

- **Pure synchronous:** node value extraction, edit application, formatting (computing edits never fails), comment stripping, semantic equality.
- **`Effect`:** parsing, stringifying, modification, the schema decode path.
- **`Result`:** every fallible operation also has a synchronous `Result` twin, and the `Effect` form is *defined in terms of it* via `Effect.fromResult` behind the named span, per the [sync primitive policy](../conventions/sync-primitive-policy.md).
- **`Stream`** for the visitor: demand-driven and `Stream.take`-friendly, with malformed input surfacing as error events in the union rather than the failure channel.

`equals`/`equalsValue` are pure total booleans with a hardened contract: input carrying **any** parse errors compares unequal rather than comparing the recovery parser's best-effort output — malformed input is never equal to anything, including itself.

## Public API shapes

Class-based DX throughout: statics and instance methods on the schema classes, single-optional-parameter statics rather than overload-object signatures.

**`JsoncNode`** is a `Schema.Class` recursive AST node via `Schema.suspend`, with **no parent pointers** — circular references would break structural equality, serialization and Schema encode/decode. Absence is always `Option`, never a `NotFound` error. Its tight token-end offset discipline — node spans never swallow trailing whitespace or comments — is a load-bearing invariant with its own regression tests.

**`JsoncEdit.applyAll`** applies edits in reverse-offset order and **rejects overlapping edits as a defect**: overlapping splices are a caller wiring error on a hand-constructed array, not recoverable input, so the defect channel is right — a programmer-error guard, not input hardening, and all four format siblings share this posture.

**`JsoncModifier.modify`** treats `value === undefined` as delete (comma handling included) and appends on insert. Navigation goes through `internal/navigate.ts`, a scanner-based navigator resolving segments through structural tokens rather than a raw substring match — a correctness property, since a naive backwards string search breaks on keys containing quotes.

Option fields are plain `Schema.optionalKey` with defaults applied at the implementation level (`options?.field ?? default`), keeping the `@public` base annotations tractable; `allowTrailingComma` defaults to `true`, matching the tsconfig/VS Code settings dialect the format exists to serve. `JsoncModifyOptions.formattingOptions` accepts `JsoncFormattingOptionsLike` — the class instance or a structurally matching plain literal — because only the option fields are read and nothing decodes, so requiring construction would buy validation the modifier never performs; `JsoncFormattingOptions` remains the canonical stored form, the `Like` type is an input accommodation at the boundary only.

## Value stringify is plain JSON

`Jsonc.stringify` writes exactly what `JSON.stringify(value, null, 2)` writes; comments live only in the document and edit layers, so they never survive a value round trip. Its options reuse the `JsoncFormattingOptions` vocabulary (`tabSize`, `insertSpaces`) rather than JSON's `space`, so one indent vocabulary covers the formatter and the emitter.

The typed failure set is closed by the underlying primitive rather than invented: circular references and `bigint` are the two exceptions `JSON.stringify` throws, and a top-level unrepresentable is the case where it returns `undefined` instead of a string. **Nested** unrepresentables — functions, `undefined`, symbols — follow `JSON.stringify`'s documented semantics exactly: dropped from objects, `null` in arrays. This is JSON's contract, matched on purpose, and is not "hardened" into a typed error.

## Schema transformation strategy

Mirrors semver's `FromString` + factory-statics arrangement, and is the reason an Effect-native JSONC library exists at all: `Jsonc.JsoncFromString` (the pre-bound zero-config `Schema<unknown, string>` on default options), `Jsonc.fromString(options?)` (the same, bound to supplied options), `Jsonc.schema(Target, options?)` (composes with a target schema to yield a `Schema<A, string>` pipeline, threading the target's decode and encode requirements through so a target's service requirements do not silently vanish into `R = never`), and `Jsonc.bind(Target)` (`{ schema, decode, encode }`, both directions derived once — deliberately thin sugar introducing **no new error taxonomy**, both directions failing `Schema.SchemaError` exactly as calling the `Schema` helpers by hand would).

Decode is driven by the internal parser in value mode; encode goes through the stringify path, so circular-reference and `bigint` failures are typed on the encode channel rather than escaping as defects. The domain `JsoncParseError` is constructed directly by the `parse`/`parseTree` path, bypassing `Schema` entirely — a documented contract, which is why `SchemaError` never escapes those methods. The raw schema decode path is the exception: it fails with a `SchemaError` whose issue message is the aggregate parse message, and consumers wanting the domain error normalize at the boundary with `Effect.catchTag("SchemaError", ...)`.

`fromString` and `schema` are schema-*producing* functions, so each call returns a fresh instance, and v4 derivation caches key by reference — structurally-equal options do not share. Bind the produced schema to a `const` on a hot path; `JsoncFromString` is the pre-bound singleton precisely so the common default case needs no such discipline.

## Error set

A restrained aggregate design, correct where a per-error-class explosion would be wrong. Parsing is **error-recovering**: it collects every parse-error detail and fails once with an aggregate carrying the whole batch plus the input, rather than failing at the first bad byte. Each detail is a `Schema.Class` (not an error) carrying a code and a position. Errors are `Schema.TaggedError` with `message` derived via getter from structured fields, never a preformatted string, never a `reason: string`.

## Input hardening

Deeply-nested hostile input must fail through the typed channel — never as a `Cause.Die`, never as a stack overflow. Collection-nesting depth is capped by a shared constant in `src/internal/limits.ts`, a zero-dependency leaf so every recursive surface imports the same cap without closing a cycle; the cap mirrors yaml's composer cap for cross-package parity. jsonc's recursion is spread across several independent surfaces — the parser's value and tree modes, the node walkers, the structural-equality walk, the visitor, and the modifier's navigation — and **each is guarded separately**, with no single choke point. Over-deep containers are consumed iteratively by bracket counting so recovery still makes progress; that skip algorithm plus its malformed-closer guard has one implementation, `skipBalancedValue` in `src/internal/skip.ts`, parameterized over a token cursor so the parser, navigator and visitor each keep their own advance discipline over the shared algorithm.

Tree construction is validation-free: a naive `parseTree` is exponential in nesting depth, because `Schema.Class` construction re-validates the recursive `children` field once per level. The parser builds nodes through an internal unsafe path in `JsoncNode.ts` (never re-exported) that assigns props onto the prototype directly; validity is guaranteed by construction, since every field comes off a scanner token. Public `JsoncNode.make` and `new` stay fully validating. The one contract the unsafe path carries: absent optional fields must be omitted, never passed as explicit `undefined`.

## Equal and Hash semantics

The AST nodes use plain `Schema.Class` structural equality with no custom `[Equal.symbol]`, load-bearing for the visitor and token tests. `Jsonc.equals`/`equalsValue` implement the *semantic* equality — comment- and format-ignoring, key-order-independent for objects, order-sensitive for arrays — a different relation, so they stay explicit statics rather than overriding structural equality. If a node ever customizes equality it must override `[Hash.symbol]` too, since `Equal.equals` fast-paths on hash mismatch.

## jsonc/yaml parity convention

There is deliberately **no shared-package extraction**: a possible `@effected/text-edit` micro-kernel over Edit/Range/Path/diff is deferred until the shapes prove identical in use. In its place, a binding convention: `JsoncEdit`, `JsoncRange`, `JsoncPath`, `JsoncSegment` and the parse-error-detail shape are **structurally identical** to their `Yaml*` counterparts — same field names, types and optionality, with the same `applyAll`/`equals`/`schema` semantics — so codec-generic consumer code can write one function over "a document codec's Edit/Range/Path" and use it against both packages. Two exceptions are recorded rather than fixed: `YamlFormattingOptions` derives its shared fields from `YamlStringifyOptions` at runtime by spreading `.fields`, which is not structurally identical even though the names and semantics line up; and `JsoncModificationError` is not bound by the convention at all, since its fields differ from yaml's because the underlying failures differ — the convention binds Edit/Range/Path, not the errors.

## Fingerprinting: canonical JSON and content hashes

`JsoncFingerprint.ts` adds RFC 8785 (JSON Canonicalization Scheme, JCS) serialization plus SHA-256 content hashing over it, for callers needing a stable digest of a JSON value — cache keys, change detection, attestation subjects — independent of key order or source formatting. The pure core is a single recursive JCS emitter: compact output, object keys sorted by UTF-16 code unit, ECMAScript number serialization, and `JSON.stringify` string escaping. It follows the package's `Result` primitive / spanned `Effect` twin arrangement: `canonicalizeResult` is the sync primitive, `canonicalize` is `Effect.fromResult` behind a named span.

Canonicalization is deliberately **stricter** than `Jsonc.stringify`: a fingerprint must never silently alter the document it claims to summarize, so every non-JSON value fails typed instead, carrying a JSON-pointer `path` to the offending value. `JsoncCanonicalizeError`'s closed code set: `UnrepresentableValue` (`undefined`, function, symbol, anywhere), `BigIntValue`, `NonFiniteNumber` (`NaN`/`±Infinity`, which RFC 8785 forbids and `JSON.stringify` would silently null), `NonPlainObject` (anything but a plain object or array — `toJSON` methods are deliberately ignored; encode domain values to plain JSON first), `NestingDepthExceeded` (the shared `MAX_NESTING_DEPTH` cap, which also intercepts cyclic values before they can recurse forever), and `InvalidDigest` (about the hashing twins, below, not the document).

Hashing requires core's `Crypto.Crypto` service in `R`, and that does not lift the package's tier: `hash`/`hashText` need a real digest backend this pure-tier package does not own, so the sanctioned pattern is a service required in `R` with the backend supplied by the consumer at the edge (`@effect/platform-node`'s `NodeCrypto.layer`, or any `Crypto` layer). This is not a tier violation — the dependency policy governs runtime *dependencies* and IO ownership, not service *requirements* threaded through `R`; jsonc still has zero runtime dependencies and owns no backend.

The sync hashing twins (`hashResult`/`hashTextResult`) bind the platform in the *caller*, not the package: they take a `JsoncDigest` (`(bytes: Uint8Array) => Uint8Array`) and return a `Result`, so a consumer inside a synchronous host hook (a bundler plugin's `preprocess`, a cache `read`/`write` with no fiber to run an `Effect` in) can fingerprint at all — the same shape as `tsconfig-json`'s `TsconfigLoaderSyncOptions`. They are named `*Result`, never `*Sync`, per the [sync primitive policy](../conventions/sync-primitive-policy.md). A caller-supplied digest can fail two ways a `Crypto` layer cannot — throwing (an unknown algorithm name) or returning the wrong width — and both arrive as a typed `InvalidDigest` at path `""` rather than crashing the synchronous host. The output format is a cross-package guarantee: exactly 64 lowercase hex characters, no algorithm prefix — the same bare-hex vocabulary `sbom`'s `Sha256Digest` schema decodes, so a fingerprint flows downstream into an attestation subject without jsonc taking a dependency edge on `sbom`. `hashText`/`hashTextResult` additionally expose `normalizeEol` for file content that must fingerprint identically across checkout line-ending settings. Equal JSON values canonicalize (and therefore hash) identically regardless of object key order.

## Observability

`Effect.fn("name")` at public *fallible* boundaries only — parse, tree parse, stringify, modify. Pure synchronous operations carry no `Effect` and no span. The `Result` twins carry no span, since they are not Effects; their `Effect` counterparts keep theirs. `JsoncVisitor.visit` is not span-wrapped: stream construction is lazy and pure, with no clean `Effect.fn` boundary to attach a span to without forcing the stream into an effect it does not need. The library is telemetry-agnostic.

## Testing

`@effect/vitest` with `it.effect` as the default mode; `__test__/` splits per concept. Construct instances via `X.make(...)`, never `new`. The suite is organized around behavior contracts rather than methods: token-end offset discipline, edit byte-minimality, the two equality semantics, delete and insert contracts, offset-preserving comment stripping, the schema decode/encode pipeline, and quote-containing-key navigation. Property tests via `it.effect.prop` assert format idempotence and that parsing comment-stripped text agrees with `JSON.parse`. Hardening regressions pin deep and wide documents, plus structural equality between parser-built and `make`-built nodes.

## Build

Every Effect class factory is written inline with no exported `*_base` const; the synthesized `_base` heritage symbols are suppressed narrowly in `savvy.build.ts` and land in the `issues.json` `suppressed` bucket, keeping it zero-warning. Never widen the suppression.
