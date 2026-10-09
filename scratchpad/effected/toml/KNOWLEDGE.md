# toml — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/toml/CLAUDE.md -->
# @effected/toml

Zero-dependency TOML 1.1.0 parse/edit/format schemas: parse into plain values or a byte-exact linear CST, compute comment-preserving edits, format, modify by path, visit as a `Stream`.

**Tier: pure.** Peer-depends on `effect` only. Zero runtime deps, no IO. Eighth migration; merged. **The first format package in the repo with no vendored code** — jsonc, yaml and glob all port an upstream engine with attribution; toml's engine is original work, built from the TOML 1.0.0 spec directly rather than translated from a reference implementation, then upgraded in place to TOML 1.1.0 (released 2025-12-24).

**For the full design:** → `@./okf/modules/toml.md`

Load when changing the public API, the CST shape, the hardening story, or the jsonc/yaml/toml/markdown edit-vocabulary parity convention.

## Architecture: linear CST + semantic pass

`internal/scanner.ts` and `internal/parser.ts` produce a flat `ReadonlyArray<TomlExpression>` — one entry per top-level construct (`TomlKeyValue`, `TomlTableHeader`, `TomlArrayTableHeader`, `TomlTrivia`) — in document order. This is the **linear CST**: no tree, just a list whose expression spans tile the source exactly. That tiling is the round-trip proof — `TomlDocument.stringify()` reconstructs the source by concatenating each expression's `[offset, offset + length)` slice, and the result equals the original byte-for-byte across the full toml-test corpus. There is no separate re-serialization path to drift from the source.

`internal/semantic.ts`'s `analyze` walks that flat list a second time, resolving TOML's table/key model — implicit vs. explicit tables, array-of-tables elements, dotted-key groups, duplicate-key and table-redefinition conflicts — against an iterative navigation structure, not a recursive tree walk. `buildValue` (also in `semantic.ts`) rides the same pass to materialize the plain-JS value. `TomlFormat.modify`'s semantic index (`buildSemanticIndex`) is a third, purpose-built walk over the same expression list, because modification needs a resolution tree with insertion points, which `analyze`'s callback-only pass does not carry.

## Cycle firewall

`noImportCycles` is error-level, held by one rule: `src/internal/` throws **raw carriers** — `RawTomlError` (`{ code, message, offset, length }`, `internal/diagnostics.ts`) and `GuardExceeded` (`internal/limits.ts`) — and never imports a public module. Public modules (`Toml.ts`, `TomlDocument.ts`, `TomlFormat.ts`, `TomlVisitor.ts`) catch those throws and materialize `TomlDiagnostic` (deriving `line`/`character` from `offset`) plus the tagged `TomlParseError` / `TomlStringifyError` / `TomlModificationError`.

The one sanctioned exception: the engine may import `TomlNode.ts`'s node classes and `TomlDateTime.ts`'s four value classes — both are leaves (`TomlDateTime.ts` imports only `effect`; `TomlNode.ts` imports only `effect` and `TomlDateTime.ts`), so importing them from `internal/` cannot close a cycle back into the facade. Nothing else under `src/*.ts` is a legal engine import.

## Hardening inventory

Malformed or hostile input fails through the typed `E` channel — never a `Cause.Die` defect, never `RangeError: Maximum call stack size exceeded`, never a hang. `MAX_NESTING_DEPTH = 256` (`internal/limits.ts`) is enforced independently on both sides of the codec, because arrays and inline tables are the only genuinely recursive value shapes:

1. **Parse side** — `internal/parser.ts`'s `parseArray`/`parseInlineTable` guard array/inline-table descent via an explicit `depth` parameter against `MAX_NESTING_DEPTH`; a bomb trips `GuardExceeded` at the opening bracket, materialized by `Toml.parse`/`TomlDocument.parse`/`TomlVisitor.visit` into a `NestingDepthExceeded` diagnostic. (`semantic.ts`'s `buildValue` needs no guard of its own — it rides the CST the parser already depth-capped.)
2. **Stringify side** — `internal/stringifyValue.ts` guards the mirror-image descent when encoding a value back to text; a bomb trips the same `GuardExceeded`, materialized by `Toml.stringify`.
3. **`TomlFormat.modify`'s path argument** is capped at `MAX_NESTING_DEPTH` explicitly (not via `GuardExceeded` — a straight length check before resolution starts), so an attacker-controlled path array cannot force unbounded navigation depth.

**Header and dotted-key nesting is deliberately not guarded the same way, because it is not recursion.** `[a.b.c...]` table headers and `a.b.c... = 1` dotted keys are parsed and navigated **iteratively** — `internal/parser.ts`'s key-path scan is a loop, and `analyze`'s `navigateHeaderPrefix`/dotted-key walk in `TomlFormat.ts` is a loop over a `Map`. A header with 5,000 segments parses and resolves fine; there is no stack to blow. Guarding it would be defending against a cost that does not exist. Know this before "fixing" header depth to match the 256 value cap — that would be over-guarding a non-recursive surface.

Defect passthrough is proven, not assumed: every `catch` block in the facade (`Toml.ts`, `TomlDocument.ts`, `TomlFormat.ts`, `TomlVisitor.ts`) checks `isRawTomlError` and `isGuardExceeded` in that order and **rethrows anything else** — the engine never silently swallows a genuine programmer-error defect (e.g. a `TypeError` from `assertCap`) into a typed error channel it doesn't belong in.

## Value model

- **Four date-time classes** (`TomlDateTime.ts`): `TomlLocalDate`, `TomlLocalTime`, `TomlLocalDateTime`, `TomlOffsetDateTime`. None subclasses JS `Date` — `effect`'s `DateTime` module has no local-only (no-offset, no-timezone) variant, so all four are `Schema.Class` value objects with real Gregorian-calendar validation (`isRealCalendarDate`, leap-year aware), a canonical `toString`, and structural equality for free from `Schema.Class`.
- **Integers split number/bigint at `±(2^53 − 1)`** (`Number.MAX_SAFE_INTEGER`/`MIN_SAFE_INTEGER`): a TOML integer within that range decodes to a JS `number`; beyond it, to a `bigint`. Both sides are bounds-checked against TOML's 64-bit integer range (`IntegerOutOfRange` on overflow, both parse and stringify).
- **The `1.0` → `1` emitter divergence**: an integral float (`1.0`, `2.0`) that fits exactly in a JS `number` stringifies as `1`, indistinguishable from a TOML integer, because JS has no way to tag a `number` as "float-typed" once it holds an integral value. Every JS TOML emitter shares this limitation — it is not a bug specific to this engine, and there is no representable fix without a wrapper type this package deliberately does not add. Integral floats past `int64` range (i.e. large enough that a `number` cannot round-trip through integer semantics) emit as TOML floats, since at that magnitude the ambiguity does not arise.

## Testing discipline: corpus + differential oracle

Two independent checks, neither a substitute for the other:

- **The vendored toml-test 1.1.0 corpus** (`__test__/fixtures/toml-test/`, toml-test `v2.2.0`, `files-toml-1.1.0` subset: 214 valid + 467 invalid cases) runs in `__test__/e2e/toml-test.e2e.test.ts` to **100% pass, no skip list**. Every valid case decodes to its expected typed value; every invalid case fails through `TomlParseError`. The corpus tree carries its own `.gitattributes` (`* -text`) scoping off the repo-root `*.toml text eol=lf` rule, because several fixtures deliberately embed bare CR / CRLF bytes to exercise line-ending handling and must stay byte-for-byte identical to upstream.
- **`smol-toml@1.7.0`** is an exact-pinned `devDependency`, imported only by `__test__/oracle.property.test.ts` as a **differential property-test oracle** (250 runs) — never a runtime dependency, never imported outside that one file. `EXPECTED_ORACLE_DIVERGENCES` is **empty**: oracle, corpus and this engine are in full three-way agreement, and the assertion pins that. Corpus and oracle disagreement, if it ever recurs, is resolved with the corpus winning (it is the spec's own compliance suite); document the divergence rather than silently picking a side.
- The hostile-input suite (`__test__/hostile.test.ts`) exercises the guard surfaces in the previous section plus prototype-key handling (`__proto__` lands as an own data property, never polluting the prototype) and defect-passthrough.

## Deviations from a hypothetical "full spec + full parity" package

- **No `TomlParseOptions`.** `Toml.parse` takes no options — TOML 1.1.0 parsing has no knobs, unlike jsonc's error-recovery mode or yaml's multi-document handling. The 1.1.0 upgrade did **not** add a spec-version knob: the parser accepts the full 1.1 grammar unconditionally. Do not add an options parameter speculatively; add it only when a real knob exists.
- **Liberal read, conservative write.** `parse` accepts the full 1.1 grammar, but `stringify` deliberately emits 1.0 spellings (every 1.0 document is valid 1.1, so the asymmetry is safe in one direction only). Do not "modernize" the emitter to 1.1 syntax for symmetry.
- **`U+FFFD` is rejected as `InvalidUtf8`.** The replacement character is treated as evidence of lossy decoding upstream (a prior UTF-8 decode step already lost information) rather than a legal source character. This is corpus-compliant — the toml-test suite expects this — but is a deliberate deviance from the RFC 3629 letter of "any Unicode scalar value is legal," worth knowing before "fixing" it to accept literal U+FFFD.
- **Nanosecond truncation beyond 9 fractional digits.** A `TomlLocalTime`/`TomlLocalDateTime`/`TomlOffsetDateTime` literal with more than 9 digits after the decimal point truncates to 9 (nanosecond resolution); it does not round or error.
- **`TomlEdit`/`TomlRange` are parity-identical to jsonc/yaml** (`{ offset, length, content }` / `{ offset, length }`); one behavior still diverges:
  - `TomlFormat.format`'s `range` filter is an **owning-expression intersection** — an edit survives if its owning expression's span intersects the requested range at all — where yaml's equivalent requires the edit to fall **fully within** the range. Do not assume the two are interchangeable when porting range-filtering logic between packages.
  - `TomlEdit.applyAll` **rejects overlapping edits as a thrown defect**, and this is no longer a divergence: jsonc, yaml and markdown all adopted the same guard, so all four format packages agree. `TomlFormat` never produces overlapping edits itself, so it only fires on hand-constructed edit arrays — which is the point: it is a programmer-error guard, not a runtime input-hardening guard.
- **`TomlVisitor` construction is eager; enumeration is streamed.** `TomlVisitor.visit` parses, runs `analyze`, and sorts the full event list into document order **before** the `Stream` starts producing — `Stream.take` still short-circuits consumption, but it cannot skip the up-front parse/analyze/sort pass the way a truly lazy visitor could skip late document sections. Do not advertise early termination as an input-size optimization for this visitor; it isn't one.

## Public surface

Exported from `src/index.ts`:

- `Toml` — `parseResult`, `stringifyResult` (sync `Result`, the **primitives**) and `parse`, `stringify` (`Effect`, failing with `TomlParseError`/`TomlStringifyError`, each `Effect.fromResult` over its `Result` twin behind its existing span, so the two cannot drift — kit convention, `@./okf/conventions/sync-primitive-policy.md` and `@./okf/decisions/sync-form-named-result.md`; never re-derive the engine on the `Effect` side); `fromString`, `TomlFromString`, `schema(target)`, `bind(target)` → a `TomlBoundCodec` `{ schema, decode, encode }` pre-binding both directions, each failing with `Schema.SchemaError` — thin sugar over `schema(target)` plus `Schema.decodeEffect`/`encodeEffect`, adding no error taxonomy of its own. All three are schema-producing: bind results to a `const` on hot paths. Plus `TomlStringifyOptions` (the only knob: `newline`).
- `TomlDocument` — `parse`, `schema()`, `toValue()`, `stringify()` — the lossless document (`source`, `expressions`, `diagnostics`).
- `TomlEdit` (+ `applyAll`), `TomlRange`, `TomlPath`, `TomlSegment` — the edit vocabulary.
- `TomlFormat` — `format`/`formatToString` (pure, total), `modify`/`modifyToString` (`Effect`, failing with `TomlParseError`/`TomlModificationError`); `TomlFormattingOptions`.
- `TomlVisitor`, `TomlVisitorEvent` — SAX-style `Stream<TomlVisitorEvent, TomlParseError>` (`TableStart`/`ArrayTableStart`/`KeyValue`/`Comment`).
- `TomlDiagnostic` — `code`, `message`, `offset`/`length`, `line`/`character`; plus the five staged error-code unions: `TomlLexErrorCode`, `TomlParseErrorCode`, `TomlSemanticErrorCode`, `TomlStringifyErrorCode`, and the aggregate `TomlErrorCode`. The 1.1.0 upgrade **retired `TrailingCommaInInlineTable` and `NewlineInInlineTable`** from `TomlParseErrorCode` — both constructs are legal in 1.1, so the codes have no producer and are gone from the public union, not merely unused.
- `TomlLocalDate`, `TomlLocalTime`, `TomlLocalDateTime`, `TomlOffsetDateTime` — the four date-time value classes.
- The CST node classes (`TomlNode.ts`): `TomlKey`, `TomlKeyKind`, `TomlString`, `TomlStringStyle`, `TomlInteger`, `TomlFloat`, `TomlBoolean`, `TomlDateTimeLiteral`, `TomlArray`, `TomlInlineEntry`, `TomlInlineTable`, `TomlKeyValue`, `TomlTableHeader`, `TomlArrayTableHeader`, `TomlTrivia`, `TomlValueNode`, `TomlExpression`.

## Working here

```bash
pnpm vitest run packages/toml/__test__   # this package's tests
pnpm build --filter @effected/toml       # dev + prod, in order
```

Never run `node savvy.build.ts --target prod` directly. It skips `build:dev`, emits no `.d.ts`, and leaves a truncated `issues.json` shaped exactly like a clean gate.

Tests live in `__test__/`, use `@effect/vitest`, and assert with `assert.*` — never `expect`.

`savvy.build.ts` carries one narrow API Extractor suppression: `{ messageId: "ae-forgotten-export", pattern: "_base" }`, covering the heritage symbols synthesized by inline class factories — the largest such count in the repo, tracking the package's larger class surface. Never widen it. (For the current number, count `_base` in `dist/prod/issues.json` after a build; it moves with every class added, so it is not recorded here.) `package.json` stays `"private": true` — the bundler emits the publishable manifest.


---
<!-- okf/modules/toml.md -->
---
type: Module
title: toml
description: TOML 1.1.0 parsing, editing and formatting as pure Effect Schema classes on a from-scratch engine.
status: stable
kind: package
resource: ../../packages/toml
tags:
  - dx
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 4ed83c46f2ec08f1a28dcedd54ea283101ec34653b7bb5ff8fb657289cc33c29
---

# toml

## Purpose

`@effected/toml` is TOML 1.1.0 as pure Effect schemas on a from-scratch, Effect-native engine: parse, stringify, Schema integration, a lossless CST, edit-in-place, a formatter and a visitor. It is a full-parity format sibling of [jsonc](jsonc.md), [yaml](yaml.md) and [markdown](markdown.md), sharing their surface contract — see [toml is a full-parity package built from scratch](../decisions/toml-full-parity-from-scratch.md) for why both halves of that sentence were deliberate. `smol-toml` appears only as a devDependency differential-test oracle, never as a runtime dependency.

## Tier and dependency posture

[Pure tier](../glossary/library-tier.md): `effect` is the only peer and there are **zero runtime dependencies**. No IO, no services, no layers, no `R` — all inputs are strings, all outputs are values, documents, edits, streams or typed errors. `smol-toml` is pinned exact as a devDependency only, imported solely by the oracle test file. `"sideEffects": false`.

## Architecture: linear CST plus semantic pass

TOML's syntax is flat — a linear sequence of key-value lines and `[table]` / `[[array-of-table]]` headers — while its semantics form a tree derived from those headers. The engine honors the split rather than papering over it:

- **scanner → recursive-descent parser → lossless linear CST**: a flat list of expression nodes whose spans **tile the source exactly**, each carrying attached trivia.
- **A separate semantic pass** walks that list to build the logical table tree, enforcing TOML's redefinition rules — table redefinition, dotted-key collision, appending to inline tables, array-of-tables interleaving — and emitting typed diagnostics with line, column and range.
- Value parse is CST → semantic pass → plain values; edit and format operate on the linear CST as text splices; the visitor streams events from the semantic walk.

The exact tiling is the round-trip proof: document stringify reconstructs the source by concatenating each expression's slice, so there is no separate re-serialization path to drift from the source. A tree-shaped CST like jsonc's was rejected: TOML's dotted keys, out-of-order headers and array-of-table headers scatter one logical node across non-contiguous source spans, so a tree CST would make edit and format fight the format. Two separate engines — a fast lossy value parser plus a CST layer — were rejected too, since there would be two grammars to keep in sync with no throughput requirement justifying it. Modification runs a **third** walk over the same expression list, purpose-built, because it needs a resolution tree with insertion points that the semantic pass's callback-only walk does not carry.

## Module layout

One concern per file, mirroring yaml's layout: a value facade (`Toml.ts`), the four datetime classes, the lossless document, the CST node classes, the edit vocabulary, format, visitor and diagnostics, with the engine under `src/internal/`. `src/index.ts` is the only barrel.

`noImportCycles` is error-level, held by one rule: `src/internal/` throws **raw carriers** — a raw error record and a guard-exceeded signal — and never imports a public module. The public modules catch those throws and materialize `TomlDiagnostic` (deriving `line`/`character` from `offset`) plus the tagged errors. The one sanctioned exception is that the engine may import the CST node classes and the four datetime value classes, because both are leaves that import only `effect` (and, for the nodes, the datetimes), so importing them from `internal/` cannot close a cycle back into the facade. Defect passthrough is proven, not assumed: every `catch` in the facade tests for the two raw carriers and rethrows anything else, so a genuine programmer-error defect is never silently swallowed into a typed error channel it does not belong in.

## TOML 1.1.0

The engine parses TOML 1.1.0, and there is **no version option** (see [Implementation notes](#implementation-notes)). The relaxations that matter when reading the grammar: `\e` (U+001B) and `\xHH` escapes, with `\xHH` deliberately bypassing the control-character ban the same way `\u`/`\U` already did; newlines and comments inside inline tables via a shared value-gap production, plus a trailing comma in inline tables; and optional seconds in times, with the secfrac group nested inside the seconds group per the ABNF, so `07:32` is valid and `07:32.5` is invalid (an absent seconds group materializes as `0`). Unicode bare keys are **not** in released 1.1 — they were dropped before release and are not implemented here.

**Liberal read, conservative write.** `stringify` keeps 1.0.0 spellings: seconds always emitted, no `\e` or `\xHH`, no trailing comma, single-line inline tables — every emitted document is therefore valid under both specs. The asymmetry is deliberate and safe in one direction only; do not "modernize" the emitter for symmetry. Document round-tripping preserves 1.1 spellings regardless, because it replays source text — only *value* stringify normalizes.

## Value model

Effect Schema classes throughout. **Datetimes** are four `Schema.Class` value objects, none subclassing JS `Date` — Effect's `DateTime` module has no local-only (offset-free, timezone-free) variant, and a `Date` subclass cannot faithfully carry a timezone-free value; they validate against the real Gregorian calendar, leap years included, and get structural equality for free. **Integers** split at `±(2^53 − 1)`: within that range a TOML integer decodes to a JS `number`, beyond it to a `bigint`, with both sides bounds-checked against TOML's 64-bit signed range on parse and on stringify. **Floats** are `number`, honoring TOML's `inf` and `nan` spellings; an integral float emits as an integer because JS cannot tag a `number` as float-typed once it holds an integral value, and an integral number past int64 range emits as a TOML float so the output re-parses — there is no representable fix without a wrapper type this package deliberately does not add, and every JS TOML emitter shares this limitation. The divergence from smol-toml's `Date`-subclass API is deliberate; consumers map at their own boundary rather than drop-in swapping.

## Hardening

Malformed input **always fails through the typed channel** — never a defect, never a hang. Arrays and inline tables are the only genuinely recursive value shapes, so a shared depth cap is enforced independently on both sides of the codec — parse descent and stringify descent — plus an explicit length check on the modification path's caller-supplied key path, so an attacker-controlled path array cannot force unbounded navigation. **Header and dotted-key nesting is deliberately not guarded, because it is not recursion**: table headers and dotted keys are parsed and navigated iteratively, so a header with thousands of segments resolves fine with no stack to blow — guarding it would defend against a cost that does not exist.

The remaining guards: prototype-pollution keys are neutralized (TOML keys are attacker-controlled, and `__proto__` would otherwise land as an own data property); control characters are rejected in strings and comments per spec, with escapes the deliberate carve-out; escape code points are validated against the surrogate range and the Unicode maximum; fractional seconds truncate beyond nanosecond precision rather than rounding or erroring. **U+FFFD is rejected** as evidence of a lossy upstream decode — corpus-compliant, but a deliberate deviance from the RFC 3629 letter that any Unicode scalar value is legal, costing a genuine U+FFFD scalar in string input. The semantic pass distinguishes two cases the redefinition rules can conflate: a header **passes through** dotted-created intermediate tables legally, while a header **landing** on a dotted-created table is illegal.

## Testing

`@effect/vitest`, `assert.*` — never `expect` — with tests in `__test__/`. Three families, none a substitute for another:

1. **The compliance gate**: the BurntSushi toml-test 1.1.0 corpus, vendored as committed plain files pinned to a recorded upstream ref, passing in full with **no skip list**. Byte-exact round-trip is proven over every valid corpus file; the corpus tree carries its own `.gitattributes` disabling text normalization, because several fixtures deliberately embed bare CR/CRLF bytes and must stay byte-identical to upstream.
2. **Differential property tests** against the exact-pinned `smol-toml` oracle, asserting parse agreement modulo the documented value-model divergence — the expected-divergence set is **empty**, and the assertion pins that. Should corpus and oracle ever disagree, the corpus wins (it is the spec's own compliance suite), and the divergence gets documented rather than silently resolved.
3. **Hand-written suites** for what the corpus cannot see: CST fidelity, edit/format/visitor behavior, the datetime classes, and a hostile-input suite exercising every guard above plus defect passthrough.

Corpus comparison is structural, not textual: expected datetime strings are re-parsed through the scanner's own classifier and compared with `Equal.equals`; integers are BigInt-compared. `smol-toml` never appears outside that one oracle test file and never in `dependencies`.

## Consumer seam

`TomlCodec` implements `config-file`'s `ConfigCodec` over this package's parse and stringify, living inside `@effected/config-file` as one of four free-standing codec exports, reached through a `workspace:^` peer. **Nothing in toml knows about config-file**: the edge points config-file → toml, and this package stays a pure, unaware format package.

## Implementation notes

- **Parse has no options class.** TOML parsing has no knobs, unlike jsonc's error-recovery mode or yaml's multi-document handling, so only the stringify direction carries an options surface. A spec-version knob was considered and rejected — it would fork the grammar, the corpus and every error-code union to serve no identified consumer. Do not add an options parameter speculatively.
- **The edit vocabulary is parity-identical** to its jsonc, yaml and markdown counterparts, and `applyAll` rejects overlapping edits as a defect like all four siblings do — a programmer-error guard on hand-constructed arrays, since format never produces overlapping edits itself. One behavior still diverges: `TomlFormat.format`'s range filter uses **owning-expression intersection**, where yaml's equivalent requires the edit to fall fully within the range — do not assume the two are interchangeable when porting range-filtering logic.
- **`Result` is the primitive.** `parseResult` and `stringifyResult` hold the engine; the `Effect` forms are `Effect.fromResult` over them behind their existing spans, so the two cannot drift. Never re-derive the engine on the `Effect` side — per the [sync primitive policy](../conventions/sync-primitive-policy.md).
- **`bind(Target)`** returns `{ schema, decode, encode }`, thin sugar over `schema(Target)` with **no new error taxonomy**; it lands identically in jsonc, yaml and toml, so the bound-codec shape joins the parity surface, with yaml's single-document restriction the sole cross-package asymmetry. Schema-producing, like `fromString` and `schema` — bind the result to a `const` on a hot path.
- **Recursive `Schema.suspend` references are typed `Schema.Codec<T>`.** `Schema.Schema<T>` leaves services `unknown` and breaks decode.
- **`TomlVisitor` construction is eager; only enumeration is streamed.** It parses, analyzes and sorts the full event list into document order before the stream produces anything; `Stream.take` still short-circuits consumption, but it cannot skip the up-front pass — do not advertise early termination as an input-size optimization for this visitor.

## Observability

Named `Effect.fn` spans on the public fallible boundaries only. No per-node instrumentation inside the scanner, parser or semantic pass. No metrics; telemetry-agnostic.

## Build

Scaffolded from a pure sibling with the api-extractor model wired at `website/lib/models/toml` in both `turbo.json` outputs and `savvy.build.ts`. The Schema class factories need the narrow `_base` suppression, one entry per class factory and no wider — this package carries the largest such count in the repository, tracking its larger class surface.


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
