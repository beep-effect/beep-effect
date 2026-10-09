# yaml — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/yaml/CLAUDE.md -->
# @effected/yaml

Zero-dependency YAML 1.2 parsing, editing, formatting and linting as Effect schemas. **Tier: pure** — peer-depends on `effect` only, zero runtime deps, no IO, no services. `src/internal/` holds a **vendored engine** ported with attribution from the `yaml` package; a pure package owns its parser — never add `yaml` as a dependency.

## Knowledge bundle

Durable knowledge about this package lives in `okf/`, not here. Load the concept a task needs:

- Purpose, tier, module layout and cycle firewall, Effect-wrapping policy, AST and value extraction, diagnostics and the error set, input hardening caps, jsonc/yaml parity, multi-document support, Equal/Hash, internal construction, fixture corpus and compliance harness, testing, build → `okf/modules/yaml.md` — Load when: changing the public API, the engine seams or the hardening guards.
- Comment model (which node owns a comment, forward attribution, trailing ownership, the three recorded divergences atop `src/internal/composer/comments.ts`) → `okf/interfaces/yaml-comment-model.md` — Load when: changing where a comment is captured, which node owns it, or how the stringifier puts it back.
- Emitter options (`indentSequences`, the explicit-key spill, `lineWidth` value-path-only folding, `requoteScalars`, `quoteCompat: "yaml-1.1"`) → `okf/interfaces/yaml-stringify-options.md`, `okf/gotchas/yaml-three-stringify-adapters.md`, `okf/limitations/yaml-explicit-key-spill.md` — Load when: changing an emitter option, or adding a call path into `internal/stringifier.ts` (a new adapter that omits `quoteCompat` silently no-ops).
- Token stream and lint system (`YamlToken.ts`, `YamlLintRule.ts`, `YamlLint.ts`, `src/internal/rules/`; the model/facade split, `parse-validity` always on, autofix only through `YamlEdit.applyAll`, the built-in catalog and its rulings, `infer` hooks and config inference, the rule harness and its mutants, token tiling) → `okf/interfaces/yaml-lint.md`, `okf/decisions/yaml-lint-pure-half-only.md` — Load when: touching tokens, rules, lint config, autofix, config inference or a rule test.
- Format-package conventions and the fidelity guarantee → `okf/conventions/format-package-convention.md`, `okf/decisions/format-naming.md` — Load when: adding or renaming a public entry point.

## Operating instructions

- `src/index.ts` is the only re-exporting module; read it for the public surface. `noImportCycles` is error-level — the engine returns raw records and never imports public modules, and mutual recursion threads through the dispatch record on state, never a direct import.
- Lint rules are tested through `__test__/rules/harness.ts` (input → expected diagnostics → expected fixed output), never a bespoke suite; a fixture input must parse cleanly unless it declares `expectsParseErrors`.
- The nine byte-pinned fixtures under `__test__/fixtures/explicit-key/` and the `yaml@2.9.0` literals in `__test__/comment-model-oracle.test.ts` are the contract — never regenerate them.
- The yaml-test-suite e2e harness stays at 100% with empty skip maps; a new entry in the format-idempotence ledger is a loss bug to fix, not to park.
- `savvy.build.ts` carries a narrow `{ messageId: "ae-forgotten-export", pattern: "_base" }` suppression — never widen it.

## Testing and building

Test conventions follow the root context file (`__test__/`, `it.effect`, `assert.*` never `expect`).

```bash
pnpm vitest run packages/yaml            # this package's tests
pnpm build --filter @effected/yaml       # dev + prod, from the repo root
```


---
<!-- okf/modules/yaml.md -->
---
type: Module
title: "@effected/yaml"
description: Pure-tier YAML 1.2 parsing, editing, formatting and linting as Effect schemas, with a vendored engine and full per-node comment fidelity.
status: stable
kind: package
resource: ../../packages/yaml
tags: [architecture, bundle]
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: a4131429d3083c6320019a35befba211fa815f308b98fd6989415824fb4376da
---

# @effected/yaml

`@effected/yaml` is YAML 1.2 as pure Effect schemas, and the largest package
in the kit. It carries a full layered pipeline (lex → CST → compose → value),
a "the class is the schema" AST, an edits-not-mutations model, a
warnings-as-data recoverable-parse design, a vendored compliance harness,
string→domain schema factories, full per-node comment fidelity, and a
yamllint-class lint system over a public token stream. DX is class-based
throughout: statics and instance methods on the schema classes, never
floating functions.

Three subsystems are large enough to carry their own contract document:

- [The comment model](../interfaces/yaml-comment-model.md) — per-node
  capture, attribution, the one-string encoding and its escape, emission and
  the recorded divergences.
- [Stringify presentation and compatibility options](../interfaces/yaml-stringify-options.md)
  — `indentSequences`, the explicit-key spill, `lineWidth`, `requoteScalars`
  and `quoteCompat`.
- [The lint system](../interfaces/yaml-lint.md) — the rule engine, the
  built-in catalog, autofix and config inference.

This package follows the kit's [format-package
convention](../conventions/format-package-convention.md) and [sync-primitive
policy](../conventions/sync-primitive-policy.md), and is held to the [fidelity
obligation](../decisions/format-fidelity-obligation.md).

## Tier and dependencies

Pure tier, per [the tier taxonomy](../glossary/library-tier.md) — no IO
anywhere. Inputs are strings; outputs are values, documents, edits, streams
or domain errors, and even the visitor streams are pure. `effect` is the only
peer; no `@effect/platform*` or `node:` imports. `@effected/config-file`
depends on this package through a one-file codec adapter, never the reverse.
The package ships `"sideEffects": false`.

## Module layout

Module-per-concept, with the engine behind `internal/`. `src/index.ts`
re-exports; nothing else is public.

- `Yaml.ts` — the value-level facade: a namespace object of statics over the
  parser, stringifier and schema layers, not a schema class. Owns the parse
  and stringify option and error vocabulary.
- `YamlDiagnostic.ts` — the structured diagnostic concept carrying errors
  *and* warnings-as-data, the staged code unions and the single fatal-code
  predicate.
- `YamlNode.ts` — the mutually-recursive AST, co-located in one file. The
  co-location is what breaks the AST import cycle.
- `YamlDocument.ts` — `YamlDocument` and `YamlDirective`: the parsed AST plus
  recovered `errors`/`warnings` arrays.
- `YamlEdit.ts` — the edit class and the shared `YamlRange` / `YamlPath` /
  `YamlSegment` vocabulary bound by the jsonc/yaml parity convention.
- `YamlFormat.ts` — non-mutating `format` and `modify` edits, and
  `YamlFormattingOptions`.
- `YamlVisitor.ts` — SAX-style AST events as a `Stream`, including comment
  events discriminated by `placement`.
- `YamlToken.ts` — the public positioned token stream: `YamlTokenKind`,
  `YamlToken`, and the `YamlTokens.tokenize` / `.stream` pair
  (`src/YamlToken.ts:65,119`).
- `YamlLintRule.ts` — the lint model: `LintContext`, `LintLine`, `YamlRule`,
  `YamlLintSeverity`, `YamlLintDiagnostic`.
- `YamlLint.ts` — the lint config and facade: `YamlLintRuleSetting`,
  `YamlLintConfig` and `YamlLint.run` / `.fix` / `.builtins`.
- `internal/` — the engine: lexer, CST parser and visitor, the `composer/`
  directory split along its seams (including `composer/comments.ts`), the
  stringifier, the folder, the differ, equality, requoting, the raw-document
  materializer and `rules/` — one file per built-in lint rule.

The engine is **vendored** — ported with attribution from the `yaml` package
rather than taken as a runtime dependency. House policy for pure-tier format
packages: a pure package owns its parser. Do not add `yaml` as a dependency.

### Cycle firewall

`noImportCycles` is error-level, and two rules keep it green. The engine
returns raw records (`{ code, message, offset, length }`) and never imports a
public module; the facade materializes `YamlDiagnostic` — computing
`line`/`character` from `offset` against the source — and constructs the
typed errors. `YamlDiagnostic` and its code unions live in their own module
because that is where diagnostics are materialized.

Mutual recursion threads through a dispatch record on state, never a direct
import. The block composer needs the flow composer, so `composer/state.ts`
declares a `FlowComposers` record and `composer/document.ts` injects the
implementations. No generic node dispatcher is needed.

The lint layer obeys the same firewall, and it is what split the lint model
out of the facade: built-in rules construct `YamlLintDiagnostic` while the
facade imports the rule catalog, so one module would close
`YamlLint → rules → YamlLint`. The model lives in `YamlLintRule.ts`, which
imports nothing back.

### The token layer is public; the CST stays internal

The public surface is the value and document layers, the AST, the
edit/format/modify concepts, the AST-level visitor, the schema factories, the
lexical token stream and the lint system. The CST parser, pull-based scanner
and CST visitor remain internal — there is no public CST type.

The token layer was held private until a tooling consumer materialized, and
the lint system was that consumer, so `YamlToken.ts` promotes the internal
lexer token behind a `Result` primitive and a derived `Stream` (see [the lint
interface](../interfaces/yaml-lint.md#the-public-positioned-token-stream)).
The promotion is deliberately additive: public `line`/`character` are
derived from `offset` against a line index and `text` is the raw source
slice, because the internal `column` carries a construct's indent on
synthetic markers and the internal `value` is the processed form of a
quoted scalar. Deriving left the lexer and CST parser untouched, so nothing
behind the new surface could regress. A `Stream<CstNode>` is deferred on the
same terms — the CST layer gets promoted only when something needs it.

## Effect-wrapping policy

Pure synchronous where nothing can fail; `Effect` only where the error
channel is real; `Stream` for the visitor. The split makes fallibility
legible at the call site — an `Effect` return type means "this can produce a
domain error."

Pure and total: node navigation, value extraction, edit application, the
formatting-edit computation, comment stripping and semantic equality. An
`Effect<_, never>` wrapper over any of these is ceremony.

Fallible, and therefore `Effect`: parsing, stringifying, modification and the
schema decode path. Every one of these also has a synchronous `Result` twin
for config-time callers that cannot enter a runtime — a `vitest.config.ts`,
say — per the [sync-primitive policy](../conventions/sync-primitive-policy.md).
`parseResult` is the package's single parse path, with `Yaml.parse` defined
in terms of it behind the named span, so the two cannot diverge. The
`Result` forms drive the same synchronous engine and share the same
defect-materialization helpers, so hardening is identical across both: a
fatal diagnostic, duplicate key, alias bomb, circular reference or depth
overflow returns a failed `Result` and never throws.

The visitor is infallible by design: every composer diagnostic, including
stream-level directive errors and the alias-count guard, surfaces as an
error event in the union rather than failing the stream.

## AST and value extraction

Each node is a `Schema.TaggedClass`, recursion handled with `Schema.suspend`
and no parent pointers — those would break structural equality,
serialization and Schema encode/decode. Absence stays `Option`, never a
`NotFound` error. `pathOf` is reference-identity based, the inverse of `find`
and composable with `findAtOffset`.

Two value-extraction rules are load-bearing. Single-document parse resolves
aliases against the most recently seen anchor at the point of use, while
multi-document parse builds an independent anchor map per document. And
`__proto__` mapping keys become own data properties via
`Object.defineProperty`, closing the prototype-pollution footgun a naive
`obj["__proto__"] = value` assignment would open.

`YamlDocument.schema` targets `Schema.instanceOf(YamlDocument)` as its
`decodeTo` destination, because `Schema.decodeTo(Class)` expects the
transformation to produce the class's *encoded* struct rather than instances.

`YamlEdit.applyAll` applies in reverse-offset order — byte-minimal,
comment- and whitespace-preserving, the library's real differentiator — and
rejects overlapping edits as a defect. It is a programmer-error guard on
hand-constructed arrays; `YamlFormat` never emits overlapping edits. All
four format siblings across the kit share this posture.

## Schema transformation strategy

Mirrors `@effected/jsonc`'s arrangement: a pre-bound `YamlFromString`
singleton on default options, a `fromString(options?)` factory,
`allFromString(options?)` for the multi-document case (no jsonc analog),
`schema(Target, options?)` composing with a target schema and `bind(Target)`
returning `{ schema, decode, encode }`.

`bind` is single-document only. A bound codec's `decode: (text) => T` shape
has no natural array reading, and inventing a `bindAll` for a surface with no
jsonc or toml analog would spend parity for no consumer. Like its neighbors
it is thin sugar introducing no new error taxonomy, and like all the
schema-producing functions its result should be bound to a `const` on a hot
path — each call returns a fresh instance and v4 derivation caches key by
reference.

`fromString` takes parse options only; the encode direction uses default
stringify options.

**Boundary discipline.** A `Schema` cannot fail with a domain error, so the
`decodeTo` transformation fails with a `SchemaError` whose issue message is
the aggregate parse message. The *domain* `YamlParseError` is constructed
directly by the `parse`/`parseAll` path, which drives the composer and
bypasses `Schema` — that is why `SchemaError` never escapes as the documented
contract of those methods. Consumers wanting the domain error out of a
schema pipeline normalize with `Effect.catchTag("SchemaError", ...)`.

## Diagnostics and the error set

Errors are `Schema.TaggedError` with structured payloads and a `message`
getter derived from the fields — never preformatted strings, never collapsed
to a `reason: string`. `YamlDiagnostic` is itself a `Schema.Class`, so error
payloads are serializable for free. See `src/Yaml.ts` and `src/YamlFormat.ts`
for the current set.

`YamlDiagnostic` is the single source of truth for fatality: it owns the
staged code unions and one fatal-code predicate, so fatality is a property of
the code, declared once rather than inlined at each parse entry point.

The lint layer's `YamlLintDiagnostic` is deliberately a separate class rather
than a reuse: it carries a rule id, a severity and an optional fix, none of
which belong on an engine error-code type. The `parse-validity` rule bridges
the two, mapping engine diagnostics into lint ones and keeping the engine's
own grading.

There is deliberately no format error: `format` is pure and returns no edits
on input whose parse has fatal errors, so it never corrupts a malformed
document and never needs a fallible path.

## Input hardening

Malformed and adversarial input must fail typed, never as a defect. Four
surfaces are guarded, all regression-tested:

1. **Composer depth cap** — `MAX_NESTING_DEPTH = 256`
   (`internal/composer/state.ts:201`), a fatal nesting diagnostic. The
   uncapped engine overflowed the stack around 900 levels.
2. **CST parser depth cap** — `MAX_CST_DEPTH = 256 + 8`
   (`internal/cst-parser.ts:30`), deliberately set a few levels above the
   composer's cap so the composer's guard fires first and the user gets a
   positioned diagnostic rather than the CST parser's flat error node. Never
   lower it to or below the composer cap.
3. **Stringify recursion** on both the value path and the node path, capped
   at the shared depth constant; the internal throw is materialized into a
   typed stringify error at the facade.
4. **Alias-expansion budget** — a "billion laughs" bomb can stay under
   `maxAliasCount` and still exhaust the heap during materialization, so
   materialized nodes are bounded by a budget derived from `maxAliasCount`
   (`aliasExpansionLimit`, `src/YamlNode.ts:556`), with the internal throw
   materialized into a typed parse error.

Raw C0 control characters other than tab, LF and CR are fatal anywhere in a
document's span, scanned once per document per YAML 1.2 §5.1 c-printable.

The lesson from the alias budget generalizes: depth is not the only DoS
vector. When an engine expands references during materialization, budget the
*materialization*, not just the input's static depth.

## jsonc/yaml parity reconciliation

The jsonc/yaml parity convention requires `YamlEdit`, `YamlRange`,
`YamlPath`, `YamlSegment` and the diagnostic core to be structurally
identical to their `Jsonc*` counterparts. `YamlDiagnostic` adopts the shared
five-field core (code, offset, length, line, character), with `message` and
`severity` additive on top. All of that holds exactly. The point is
codec-generic consumer code — one function over "a document codec's
Edit/Range/Path" that works against both packages — and it is the pre-work
for a possible future extraction, deferred until a consumer needs it.

`YamlFormattingOptions` is the one exception. All three options classes
(`YamlStringifyOptions`, `YamlFormattingOptions` and the lint layer's
per-rule option schemas) use bare `optionalKey` fields with
implementation-level `?? default` rather than v4 constructor or
decoding-default wrappers, which keeps the class-factory annotations
tractable. `YamlFormattingOptions` derives its shared fields at runtime by
spreading `YamlStringifyOptions.fields` (v4 classes expose `.fields`),
adding its own on top. Because those mechanics differ from jsonc's
hand-derived shape, it is deliberately *not* structurally identical to
`JsoncFormattingOptions` even though field names and semantics line up — the
recorded parity exception. The spread earns its keep: `indentSequences` was
added to the stringify options alone and appeared on the formatting options
derived, not hand-duplicated — exactly the drift it exists to prevent. See
[the stringify options interface](../interfaces/yaml-stringify-options.md)
for what the individual options mean.

## Multi-document support

A yaml-specific surface with no jsonc analog. YAML's `---`/`...`
document-stream model gets first-class support at both the value and
document layers. This is genuinely yaml's own concern — anchors, aliases,
pairs-versus-properties, multi-document — and no shared tree abstraction is
extracted across jsonc and yaml: the trees differ enough that a shared
abstraction would be premature and leaky.

## Equal and Hash semantics

Structural `Schema.TaggedClass` equality is load-bearing for the visitor and
AST tests and works as designed; no node customizes `[Equal.symbol]`, so the
`[Hash.symbol]` obligation never arises. `Yaml.equals`/`equalsValue`
implement the *semantic* relation — comment- and format-ignoring,
alias-resolving — which is different, so they stay explicit statics. Any
recorded parse error, or a duplicate-key warning, on either side yields
`false`: malformed input is never equal to anything, including itself.
Should a node ever customize `[Equal.symbol]`, it must override
`[Hash.symbol]` too, since `Equal.equals` fast-paths on hash mismatch.

## Internal construction

The house rule is `X.make(...)`, never `new X(...)`. The engine is the
recorded exception: it retains `new` for AST construction on the hot
recursive composition path, where nodes are trusted (built from validated
CST) and per-node `make` validation is exactly the hot-path cost the
observability posture already refuses to pay. All public surface, tests and
doc examples use `make`.

`new` on a v4 tagged class still validates structurally — explicit
`undefined` for an `optionalKey` field throws even with
`{ disableChecks: true }`, which only skips refinement checks. The engine's
`new` sites therefore use conditional spreads for every optional field.

## Observability

Named `Effect.fn` spans at public *fallible* boundaries only — parse,
stringify and modify at the facade, document and format layers. Pure
synchronous operations are not instrumented, there is no per-node
instrumentation inside the composer (a hot recursive path), and internal
helpers get no spans. The visitor carries no span: stream construction is
lazy and pure, with no clean `Effect.fn` boundary. The library is
telemetry-agnostic.

## No services

A pure-tier library needs none — class statics suffice, and a codec adapter
is the consumer's layer. `src/` defines no `Context` and no `Layer`.
`@effected/config-file`'s `ConfigCodec` interface is exactly the `Yaml`
facade shape, so its `YamlCodec` adapter is one file; the codec lives there,
not here, because the dependency arrow points *at* yaml, never from it.

## Comment model

Per-node comments round-trip: every scalar, collection and alias carries
`commentBefore`, `comment` and `spaceBefore`; `YamlPair` carries none;
attribution runs forward; and a whole run of comment lines lives in one
string. See [the comment-model interface](../interfaces/yaml-comment-model.md)
before touching capture in `internal/composer/comments.ts` or any of the
stringifier's comment branches, since capture and emission are paired code
and a schema change routinely leaves one half behind.

## Fixture corpus and compliance harness

The vendored yaml-test-suite is committed as plain files (nested `.git`
stripped) under `__test__/fixtures/yaml-test-suite/`, pinned to a recorded
upstream ref — deterministic, offline and Turbo-cacheable, with no
fetch-on-test dependency. The harness is the regression safety net: an e2e
suite covering parse success/failure, JSON equivalence, canonical-output
byte equality and round-trip. It must stay at 100% with empty skip maps, and
it is a ratchet in both directions — a passing count that rises means a
fixture's assertion changed, which is as much a failure as one that falls.

The same corpus carries a second e2e suite: token position fidelity. Every
token of every fixture must tile the source — ordered, non-overlapping,
`text.slice(offset, offset + length)` equal to the token's `text`, and every
gap between consecutive tokens horizontal-whitespace-only. It is the
invariant the whole lint layer rests on, since every diagnostic position and
every autofix span is a token position, and tiling (rather than
slice-equality alone) is what proves the stream *covers* the source instead
of merely quoting correctly where it speaks. A floor assertion on the token
count keeps a silently-empty walk from passing as green.

## Testing

`@effect/vitest` with `it.effect` as the default mode, split per concept
under `__test__/` with the two compliance suites in `__test__/e2e/` and the
lint rule suites under `__test__/rules/`. Construct via `X.make(...)`.

Beyond the behavior-contract suites, three families are structural: property
tests via `it.effect.prop` with `Schema.toArbitrary` on the AST classes
(round-trip and format idempotence — pattern-field checks use
lookahead-free regexes so derivation works), diagnostic-position tests
pinning `line`/`character` computation and the fatal-code predicate, plus
structure-preserving-error tests asserting that failures carry diagnostic
arrays rather than reason strings.

The lint rules add a fourth: a shared fixture harness
(`__test__/rules/harness.ts`) taking each fixture as input → expected
diagnostics → expected fixed output, so the built-in rules cannot drift into
as many dialects of "tested". Two guards ride on it. Every fixture input must
parse cleanly unless it declares `expectsParseErrors`, checked bidirectionally
— a fixture with an accidental syntax error would otherwise test a rule
against a document the composer never built, and an unchecked opt-out would
decay into a suppression pasted everywhere. And every rule is proven
falsifiable by two automated mutants: a dead-rule mutant that reports
nothing, and an unfixing mutant that reports but declines to fix. The second
catches what the first cannot — correct diagnostics with an inert `fix`.

## Lint system

`@effected/yaml` ships a yamllint-class lint system: a rule engine whose first
rule is parse-validity, a catalog of built-in rules under `internal/rules/`, a
rule-aware `YamlLintConfig` with `default` / `relaxed` presets, surgical
autofix that routes only through `YamlEdit.applyAll`, and config inference —
`YamlLint.observe` / `.resolve*` / `.infer*` derive the config a document's
style already follows.

Its full contract is [the lint interface](../interfaces/yaml-lint.md). Three
things matter at this level:

- It stays inside the pure tier. No file discovery, no config-file loading,
  no CLI, no autofix-to-disk — strings in, diagnostics or a fixed string out.
  The runner is a consumer's tier.
- It adds no parser. Rules read the one materialized token array, the
  composed document and the source lines; the engine tokenizes and composes
  once per run.
- Autofix is not `format`. Fixes are surgical `YamlEdit`s, never a reflow — a
  structural test asserts `YamlLint.ts` does not import `YamlFormat`.

## Build

All class factories are written inline with no exported `*_base` const; the
synthesized `_base` heritage symbols — including the co-recursive AST bases
and the visitor-event union — are suppressed narrowly in `savvy.build.ts` and
land in the `issues.json` `suppressed` bucket, keeping it zero-warning. Never
widen the suppression. The `Schema.suspend` callbacks' own return-type
annotations survive where recursion requires them, and genuinely reusable
public schemas stay `@public` on their own merit.


---
<!-- okf/interfaces/yaml-comment-model.md -->
---
type: Interface
title: "@effected/yaml comment model"
description: The per-node comment fields, their attribution rules, one-string storage with its spaces-only escape, and the recorded divergences from the reference implementation.
status: stable
kind: api
resource: ../../packages/yaml/src/internal/composer/comments.ts
tags: [architecture]
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: b39905119a7ba522df95840c1d3d18d5c7bf307d8405cd6abb040c89bf383643
verified:
  - by: human:spencer
    at: 2026-09-24T00:12:07.272Z
---

# @effected/yaml comment model

[`@effected/yaml`](../modules/yaml.md) round-trips comments per node: where a
comment is captured, which node owns it, how a run of comment lines is
encoded in one string field, and how the stringifier puts it back. Capture
lives in `src/internal/composer/comments.ts`; emission is spread across the
stringifier's block, flow, explicit-key and compact branches.

Two constraints shape the model. Leading is split from trailing: a single
undiscriminated `comment` field makes a composer attribute own-line comments
*backward*, so `# section` above `b:` re-emits as `a: 1 # section` —
relocating a comment onto the wrong line and construct, a worse fidelity bug
than dropping it. And the fields live on the key and value nodes, not on
`YamlPair`, which is where the model actually closes.

## The fields

`YamlScalar`, `YamlMap`, `YamlSeq` and `YamlAlias` each carry
`commentBefore` (own-line comment text directly above), `comment` (strictly
**trailing**) and `spaceBefore` (a blank line preceded the node and its
`commentBefore` block) — `src/YamlNode.ts:136-138`. `YamlPair` carries none —
it is `key` and `value`, nothing else. `YamlDocument` uses the same two
names as the node classes: `commentBefore` is the leading header block, and
`comment` the trailing one.

**Two node slots per entry rather than one pair slot is the whole point.** A
key-line comment and a value's trailing comment become different fields on
different nodes, so neither has to relocate onto the other's line — which a
single pair-level slot forces. Pair-level storage is also what produces a
whole cluster of reference divergences at once (pair-level placement, an
alias drop, a trailing-comment drop on multi-line complex keys), and they
dissolve with the move rather than being patched one at a time. The
generalizable lesson: when a divergence list clusters, suspect where the
data is stored, not the emitter reading it.

## Attribution

Attribution runs forward, and a trailing comment belongs to the last node on
its line. An own-line comment leads the following entry's KEY node
(`commentBefore`, plus `spaceBefore` when a blank line preceded it). A
same-line comment attaches to the entry's VALUE when the value ends on that
line (`a: 1 # t`) and to the KEY when it does not (`push: # only main`, with
the value written below) — so a comment stays on the line its author put it
on. Consecutive own-line comments join with newlines into one run, and blank
lines inside a run embed as extra `\n`s. Own-line comments after a
collection's last entry become the collection's `comment` when at or beyond
its content column and escape to the enclosing scope — through multiple
levels — when shallower, which is what makes a terminal comment land on the
construct a reader would say it belongs to.

The document header is marker-aware. A header block *ahead* of a `---`
marker is the document's `commentBefore`; a header *after* the marker leads
the ROOT NODE; a header with no marker at all forward-attributes to the
first entry's key exactly like any other own-line comment. A root **block**
collection's terminal comment run escapes to the document — the document is
that collection's enclosing scope, so the escape rule above keeps applying
at the top — while a root **flow** collection's does not, because it sits
inside the brackets with nowhere to escape to.

## Storage and the spaces-only escape

Storage is the raw post-`#` slice. Alignment spaces, no-space-after-`#` and
bare `#` are all preserved byte-faithfully, because normalizing them at
capture would make the field lossy for the one job it exists to do.

One string, one reserved value — so spaces-only comments carry an escape. A
comment field holds a whole run of comment lines joined into a single
string, and the empty segment `""` is *reserved* as the blank-line-within-a-run
encoding. That is a pigeonhole: with `""` spent, no in-string sentinel can
distinguish a bare `#` (raw slice `""`) from a `#` followed by one space
(raw slice `" "`) from an embedded blank line. The resolution is a
reversible escape rather than a second field or a structured type — a
spaces-only raw slice is stored with one extra trailing space at capture
(`rawCommentText`) and the renderers strip it back off at emission
(`commentBlockLines` / `renderTrailingComment` in the stringifier). The
escape is injective, so a bare `#`, a `#` with a trailing space and an
embedded blank line all round-trip byte-intact. Its **public** consequence
is real and deliberate: the comment-string value a consumer reads off a
node for a spaces-only comment carries that extra trailing space, so the
escaped form is what the field exposes — documented on `rawCommentText`'s
TSDoc and in `packages/yaml/CLAUDE.md`.

## Divergences from the reference

Three divergences from the reference `yaml` package are recorded in one
place — the header comment of `src/internal/composer/comments.ts`. Absent-
value placement: a trailing comment on a valueless `a:` lands on the KEY,
where the reference materializes a null `Scalar` and uses that — identical
bytes, visible only to a consumer reading the field, and matching it would
mean making `pair.value` always-a-node, which breaks every `value === null`
check at runtime rather than at compile time. Plus pre-`#` spacing
normalization and multi-document `...` trailer attribution. Every one keeps
the emitted bytes reparse-stable. Read that header before changing
attribution; do not re-derive the divergences from scratch.

## Emission and the visitor

The stringifier emits comments for every node kind in both block and flow
styles, including the explicit-key and compact branches, and a block scalar
at the document root splices its captured header comment onto its first
rendered line across the bare, `---` and tag/anchor branches.
`preserveComments` delivers what its name promises instead of reaching only
the document comment. Canonical mode (`forceDefaultStyles`) is comment-free
— that is what keeps the e2e harness's byte-equality assertions comparing
structure rather than trivia. The visitor's `Comment` event carries
`placement: "leading" | "trailing"`; it walks alias comments and emits no
pair-level events, which leaves the stream a consumer sees unchanged because
the key and value walks run at the pair's own path. `YamlFormat.modify`
replaces a value node outright, so the replacement starts comment-free while
the entry's key keeps its own.

Capture and emission are paired code, and a schema change leaves one half
behind. Giving `YamlAlias` the comment triple makes capture work while the
stringifier's `instanceof YamlAlias` guards still skip those fields, so an
alias comment is attached on parse and dropped on emit — a divergence half
closed that reads as closed. That is why the oracle's alias cases assert
byte-intact re-emission, not capture: for a round-tripping format, a test
that reads a field back off the AST proves the parser and nothing else.

A closing bracket is not content. The spec puts no indentation floor on a
flow collection's closer (`x: {\n  a: 1\n}`) and the reference accepts the
shape, so the continuation-indent check in `internal/composer/flow.ts`
exempts a line holding only closing punctuation. Do not re-tighten it — a
check that rejects it also blocks flow-comment parity.

## Verification

Verification is a committed-literal oracle plus a fixed point.
`__test__/comment-model-oracle.test.ts` pins the node-level model against
the reference `yaml` package (`yaml@2.9.0`) on the same convention as [the
explicit-key fixtures](yaml-stringify-options.md): authored once offline
with provenance recorded, the committed literals are the contract
thereafter, and the reference package is never a dependency of the test
run. A real-world workflow fixture stays byte-identical under
`YamlFormat.formatToString` — including `push: # only main`, the case that
separates a key-line attribution from a re-basing one. The compliance
harness described in [the yaml Module](../modules/yaml.md#fixture-corpus-and-compliance-harness)
must hold at 100% through any attribution change, since the composer sits
in the path every fixture exercises.

An idempotence ledger entry is a place to look for a loss bug, not a place
to park one. A fixture that "converges on the second pass" in the
format-idempotence ledger (`__test__/e2e/format-properties.e2e.test.ts`) is
almost always a comment-**loss** defect on a single pass — an emitter
branch that never emits a node's own `commentBefore`, or a terminal
own-line comment swallowed while hunting for a value that is not there. Fix
the loss; do not park the id.


---
<!-- okf/interfaces/yaml-stringify-options.md -->
---
type: Interface
title: "@effected/yaml stringify options"
description: The emitter's optional presentation and compatibility behaviours -- indentSequences, explicit-key spill, lineWidth folding, requoteScalars and quoteCompat.
status: stable
kind: api
resource: ../../packages/yaml/src/YamlFormat.ts
tags: [architecture]
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: ed917dc3b3464f0209032fa7234e8028d917930b116f951881be977e89ade4cc
verified:
  - by: human:spencer
    at: 2026-09-24T00:12:12.812Z
---

# @effected/yaml stringify options

The emitter's optional behaviours — how a nested sequence is indented, when
a long key spills into explicit form, when a long scalar folds, whether
already-quoted scalars are re-quoted, and how far to quote for a YAML 1.1
consumer. They share one property that is the reason to read them together:
every default keeps output byte-identical to what a caller already gets,
because [`@effected/yaml`](../modules/yaml.md)'s stringifier is
byte-compatible with its source dialect and a cosmetic default is not worth
a diff in every downstream repo.

The options themselves are `YamlStringifyOptions` (`src/Yaml.ts`) and
`YamlFormattingOptions` (`src/YamlFormat.ts`); the emitter is
`src/internal/stringifier.ts`, with folding in `src/internal/fold.ts` and
re-quoting in `src/internal/requote.ts`. How the two option classes relate
is described in [the yaml Module's options-derivation
section](../modules/yaml.md#jsoncyaml-parity-reconciliation).

## indentSequences — presentation, not fidelity

Controls how a block sequence nested under a mapping key is presented: at
the key's column, or indented one level (the shape the `yaml` npm package
and prettier default to). Top-level sequences sit at column zero either way.

The default is `false`, and the default is the whole decision. Both forms
are valid YAML parsing to identical data, so this is presentation, not
semantics — but flipping a default that changes bytes would rewrite
sequence indentation in every file every existing consumer round-trips.
Consumers who want the popular shape ask for it.

The explicit-key compact-sequence branch is deliberately untouched by the
option. `? key` / `: value` syntax is a different construct with its own
emitter path, and folding it under the same flag would change a form nobody
asked about while chasing the common one. That branch is a *destination* of
the spill below, not a thing the option steers — do not conflate the two.

## lineWidth — value-path-only by contract

A positive `lineWidth` folds long **plain**, **double-quoted** and
**block-folded** scalars at approximately that column, inserting only
semantically transparent breaks — ones a reader folds back to a single
space, so the round-trip is preserved. Block-literal and single-quoted
scalars are never folded: literal blocks preserve their bytes by
definition, and single-quoted folding is out of scope. Flow-collection
items pass `allowFold=false`, because they are re-joined with spaces and a
fold break would corrupt them.

The default is `0` — never wrap — and, as with `indentSequences`, the
default is the decision. It is what keeps default output byte-identical and
the compliance harness at 100%: nothing folds unless a caller asks.

**Value-path-only is the documented contract, not a gap.** Only
`Yaml.stringify` and `Yaml.stringifyResult` fold. The document and node path
threads `lineWidth` into its render context but never reads it, and the
schema factories encode with default stringify options, so neither ever
folds. The TSDoc states the boundary and steers node-path callers to
`Yaml.stringify(doc.toValue(), options)`, and a regression test pins the
node path's inertness — so folding cannot land there without failing that
test and rewriting the docs with it.

## Explicit-key spill — the implicit-key limit

See [the explicit-key spill limitation](../limitations/yaml-explicit-key-spill.md)
for the bound itself and what a caller sees when it fires.

## requoteScalars — opt-in re-quoting on the format path

On the format path, `quoteStyle` governs only quotes the stringifier
*introduces* — it never re-quotes scalars already quoted in the source.
That source-preserving default is a contract consumers rely on and does not
change; `requoteScalars` (default `false`, on `YamlFormattingOptions`,
`src/YamlFormat.ts:95`) is the opt-in that makes `quoteStyle` apply to
already-quoted source scalars too, which is the behavior an ex-Prettier
consumer expects from `singleQuote: false`.

**A companion boolean, not a widened value space.** The alternative spelling
— a `"double-requote"` value on `quoteStyle` — is rejected because an
option value should not encode two axes. When `quoteStyle` is omitted the
fallback is `"single"`, so `requoteScalars` alone converts double→single;
the option's TSDoc says so, and the README's "Migrating from Prettier"
table maps `singleQuote` onto the pair.

**Semantics-preserving or skip.** Re-quoting never changes the parsed
value. Single→double applies double-quote escaping to the content;
double→single is impossible when the content needs escapes single quotes
cannot express (control characters and the like) — such scalars stay
untouched rather than corrupted. Plain scalars stay plain: this is
quote-style normalization, not forcing quotes. Comment and byte fidelity
elsewhere is unchanged, because the edit is a surgical `YamlEdit` per
scalar span.

**Lint symmetry, with the lint fix deliberately conservative.**
`src/internal/requote.ts` carries both surfaces behind one helper
(`requoteScalarText`) with two modes. `"conservative"` is the
[`quoted-strings` lint fix's](yaml-lint.md) semantics — it bails whenever
escapes are in play — and `"escaping"` is the format path's wider
transform. The two surfaces agree on what "re-quotable" means because both
delegate to that helper; the escaping mode belongs only to the format path.

**Composition guarantee.** Escaping mode's replacement text comes from the
stringifier's own `renderDoubleQuoted` / `renderSingleQuoted`, and the
format path uses the helper as the re-quotable predicate and flips the
node's `style` — the stringifier then emits through those same renderers,
so flip-and-stringify and the helper's replacement cannot disagree.

## quoteCompat — quoting for a YAML 1.1 resolver

`YamlStringifyOptions.quoteCompat`, currently the single-member
`"yaml-1.1"`, additionally quotes a plain scalar that a YAML **1.1**
resolver (js-yaml, PyYAML, libyaml) would implicitly coerce to a
non-string but the 1.2 Core Schema rules do not: the extended boolean
spellings (`y`/`yes`/`on`/`off` and case variants — the "Norway problem"),
1.1's timestamp grammar including its space-separated forms, sexagesimal
numbers (`1:30`), underscore-separated digits (`1_000`) and the base-2/8/16
integer forms. `src/internal/stringifier.ts`'s `wouldBeResolved11` carries
the pattern set and deliberately over-quotes at every spec/real-world-
resolver seam — over-quoting is the safe direction for a compat mode, never
under.

**Strictly additive, exactly like `indentSequences`'s default-off posture.**
Absent (the default) it changes nothing, and set, it can only add quotes
the 1.2 rules did not already require; it can never un-quote anything, and
a scalar carrying an explicit tag is exempt on the same terms as the 1.2
type-conflict check. It threads through `requiresQuoting`'s existing single
gate rather than a parallel check, so the two dialects' rules can never
disagree about which characters win when both would quote.

## The three stringify-input adapters are a maintenance hazard

See [the adapters gotcha](../gotchas/yaml-three-stringify-adapters.md) for
what a reader sees when one adapter is updated for a new option field and
the others are not.


---
<!-- okf/gotchas/yaml-three-stringify-adapters.md -->
---
type: Gotcha
title: A new stringify option added to one adapter silently no-ops on the other two
description: "@effected/yaml has three hand-copied option adapters into the engine's stringify input; adding a field to one and forgetting the others compiles clean and drops the option at runtime."
resource: ../../packages/yaml/src/YamlDocument.ts
status: stable
stale_after: 2027-03-13T00:00:00Z
tags: [architecture, dx]
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 9ec6c412f1b7af6af71e8122035e5a6ec4278125553bd67c0635f23fbc2e9f5e
---

# A new stringify option added to one adapter silently no-ops on the other two

## What a reader sees

A contributor adds a field to `YamlStringifyOptions`, wires it into
`src/internal/stringifier.ts`, and updates one of the three call sites that
build the engine's `StringifyOptionsInput` — say, `Yaml.ts`. Every test they
ran against `Yaml.stringify` passes. `tsc` is silent, because all three
adapters build the same optional-field object shape, so a field present at
one call site and absent at another is not a type error — an object with
fewer optional keys still satisfies the same type.

## What they would wrongly conclude

That the option is now supported everywhere the package accepts stringify
options, since it works from the entry point they tested and nothing
flagged the other two.

## What is actually true

`Yaml.ts`, `YamlDocument.ts` and `YamlFormat.ts` each hand-copy
`YamlStringifyOptions` onto the engine's `StringifyOptionsInput`
field-by-field rather than through one shared mapping function. Every new
`YamlStringifyOptions` field must be added to all three by hand, and
nothing enforces that structurally — unlike `YamlFormattingOptions`, which
derives its shared fields from `YamlStringifyOptions.fields` by spread
precisely to avoid this class of drift (see [the yaml Module's options
derivation](../modules/yaml.md#jsoncyaml-parity-reconciliation)).

A caller who passes the new option through `YamlDocument#stringify` or
`YamlFormat`'s stringify path — instead of the one adapter that was
updated — silently gets the old, unpatched behavior. Nothing throws and
nothing warns; the option is simply not forwarded to the engine.

The hazard is not hypothetical: `YamlDocument.ts`'s adapter once silently
dropped `quoteStyle`, so a document-path caller setting it got the
`"single"` fallback regardless of what they passed. All three adapters now
forward the full option set, and a node-path regression test pins
`YamlDocument#stringify` under `quoteStyle: "double"` as the tripwire for
the next field added.

## The check

Before considering a new `YamlStringifyOptions` field done, `grep` for the
field name across `src/Yaml.ts`, `src/YamlDocument.ts` and
`src/YamlFormat.ts` and confirm it appears in each adapter's construction of
the engine's stringify input, not just the one call site under test. Add or
extend a regression test on the node path (`YamlDocument#stringify` or a
`YamlFormat` path) for the new field, mirroring the existing `quoteStyle`
tripwire, so a future adapter that drops it fails a test rather than only a
manual `grep`.


---
<!-- okf/limitations/yaml-explicit-key-spill.md -->
---
type: Limitation
title: A block-mapping key longer than 1024 rendered characters spills to explicit-key form
description: "YAML 1.2's implicit-key length cap forces the stringifier to switch a long key from block-implicit to explicit-key form, changing the emitted shape."
bounds: ../interfaces/yaml-stringify-options.md
status: stable
tags: [architecture]
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: b4af426b107a58c1245af04c2e5f420a1cf9d7844419402fa42f7bcb277ceb56
---

# A block-mapping key longer than 1024 rendered characters spills to explicit-key form

## The condition

YAML 1.2 §8.1.3 caps an implicit block-mapping key: the `:` indicator must
appear at most 1024 characters after the key's start. Both `@effected/yaml`
stringify paths — value and node — spill a block-mapping key whose
**rendered** form exceeds that limit into explicit-key form: `? key` on its
own line, `: value` on the next.

## The symptom

A caller who stringifies a document containing a long block-mapping key
(the real-world case is the pnpm 11 lockfile `snapshots:` shape) sees the
key's line shape change from `key: value` to a two-line `? key` / `: value`
pair, rather than the emitter producing an implicit key over 1024
characters. This is not configurable and cannot be suppressed.

Three details are precise on purpose and are not bugs if they surprise a
reader:

- The measure is the **rendered** key, not the source scalar — quotes and
  escapes are what a parser counts, so a short source scalar that renders
  long (through escaping) can still spill.
- The threshold is **strictly greater than** 1024, matching the reference
  `yaml` package (a rendered key of exactly 1024 stays implicit).
- The spill is **block-context only** — flow mappings have no implicit-key
  line to overrun, so a flow-context long key never spills.

A further divergence sits inside the spilled form itself:
`EXPLICIT_COMPACT_PAD` (`src/internal/stringifier.ts:76`) pads compact
continuation lines — the lines after `: first-item` / `? first-line` — with
a structural two columns (an indicator character plus its space), never the
configured `indent`. The reference `yaml` package pads them with the
configured indent, and at `indent ≠ 2` its own strict parser then misreads
the sequence output (items merge into one scalar) or rejects the mapping
output outright. `@effected/yaml` follows the spec instead and records the
divergence rather than reproducing the reference's bug, per [the fidelity
obligation](../decisions/format-fidelity-obligation.md).

## Why this is acceptable

Without the spill the emitter would produce output that strict YAML parsers
reject on re-parse — a correctness bug against the reference, not a style
choice. The cap is a hard property of the YAML 1.2 grammar, not a kit
policy decision, so there is no non-breaking alternative: either the
stringifier changes the emitted shape past the boundary, or it emits an
implicit key a compliant parser refuses to read back.

## What the fix would take

There is no fix to make; the limit is external. What can regress is the
compact-pad divergence: byte-pinned fixtures under
`packages/yaml/__test__/fixtures/explicit-key/` pin the emit, including
both sides of the 1024/1025 boundary, and were authored once against
`yaml@2.9.0` as a strict oracle in a scratch directory outside the repo,
with provenance recorded in that directory's `ORACLE.md`. The committed
bytes are the contract thereafter; the reference package is not a
dependency of the test run, and the fixtures are never regenerated from a
live oracle.


---
<!-- okf/interfaces/yaml-lint.md -->
---
type: Interface
title: "@effected/yaml lint system"
description: The yamllint-class rule engine, public token stream, autofix, config schema and config-inference surface built on the yaml engine.
status: stable
kind: api
resource: ../../packages/yaml/src/YamlLint.ts
tags: [architecture]
generated:
  by: "okfit/claude-code"
  at: 2026-09-22T01:21:07Z
  body_sha256: f298a2970a4ea1c98f34d302b78a0afa8473b27b836bbcd3326f22aecb923454
verified:
  - by: human:spencer
    at: 2026-09-24T00:12:11.119Z
---

# @effected/yaml lint system

A yamllint-class lint system inside pure-tier [`@effected/yaml`](../modules/yaml.md):
a public positioned token stream, a rule engine whose first built-in rule is
parse-validity, surgical comment-safe autofix, and config inference that
reads a corpus's existing style back out as a config. It lives in
`packages/yaml/src/YamlToken.ts`, `YamlLintRule.ts`, `YamlLint.ts` and
`src/internal/rules/`.

The shape is "both, layered": not a bare validity checker and not a
formatter dressed up as a linter, but a rule engine with validity as rule
one. Consumers register custom rules alongside the built-ins; config
references rules by id; a subset of rules carries a surgical fix.

## What it builds on

The lint system is mostly composition over surfaces the package already
ships — the engine already tokenizes, composes an AST, streams SAX events
and applies positioned edits, so the linter adds a rule layer, not a second
parser. It builds on the lex → CST → compose → stringify engine under
`src/internal/`, `Yaml.parse` / `Yaml.parseResult`, the composed
`YamlDocument` / `YamlNode` AST, `YamlVisitor.visit`, `YamlEdit` (the
positioned replacement plus `applyAll`, the fix substrate) and
`YamlDiagnostic`, the engine's structured diagnostic — wrapped, not reused,
by parse-validity. The lint system is the consumer that earned the internal
lexer token (`src/internal/token.ts`) a public surface, `YamlToken`; the
engine underneath is unchanged.

## The governing constraint: the pure half only

The lint system stays inside pure-tier `@effected/yaml`: the rule engine,
the built-in rule catalog, and a config *schema* — a validating
`Schema.Struct`, not a config-file loader. Everything with a tier smell
belongs to a later, separate boundary or integrated package, or to the
host: file discovery, config-file loading, reading and writing files, a
CLI, and autofix-to-disk.

This is the load-bearing decision — see [the no-second-tier-violation
Decision](../decisions/yaml-lint-pure-half-only.md). A pure package that owns
its parser must not also own its runner. The pure engine stays pure —
strings in, diagnostics or edits out — and the runner is someone else's
tier.

## The four verbs, composed

The system is four verbs over one document, two of which predate it:

- **build** — `Yaml.parse` / `YamlTokens.tokenize` (text → document /
  tokens).
- **check** — `YamlLint.run` → an array of `YamlLintDiagnostic`, sorted by
  position.
- **format** — `YamlFormat.formatToString` (canonical emit).
- **fix** — `YamlLint.fix` → `Result<string, YamlParseError>`, applying
  surgical rule edits.

Autofix is deliberately *not* `format` — see [autofix](#autofix-surgical-and-comment-safe).

## The public positioned token stream

`YamlToken.ts` promotes the internal lexer token. A `YamlToken`
(`src/YamlToken.ts:65`) is a `Schema.Class` carrying `kind` (a
`YamlTokenKind` literal union of 22 members), `offset`, `length`, `line`,
`character` and `text`.

The primitive follows the kit's [sync-primitive
policy](../conventions/sync-primitive-policy.md): `YamlTokens.tokenize`
(`src/YamlToken.ts:147`) returns a sync `Result` of an array, and
`YamlTokens.stream` (`src/YamlToken.ts:162`) derives a `Stream` from it,
parallel to the existing `YamlVisitor.visit`. The primitive is the sync
array, not a `Stream`, and the reasoning is the policy's own: tokenizing is
a pure batch transform with no async step and no IO. A `Stream` primitive
would invert that — forcing every synchronous consumer (a lint host) to
drive a stream to completion to get an array it could have had directly.
The `Stream` form still exists for genuinely incremental consumers; it is
the derived shape, not the source of truth.

Neither entry point takes an options parameter, because the lexer takes
none.

### Two properties the promotion forced

**Positions and text are derived, not copied — and the engine was not
touched.** The public `line`/`character` are computed from each token's
`offset` against a line-start index built in one monotone pass, and `text`
is the raw source slice. Neither is the internal token's own field, and
that is the point: the internal `column` is CST-parser vocabulary carrying
the *construct's* indent on the synthetic block-start markers rather than
the token's own position, and the internal `value` is the *processed* form
on quoted scalars. The public contract is the position and the bytes.
Deriving keeps the promotion additive — the lexer and CST parser are
unchanged, so nothing in the engine can regress behind the new surface.

**`tokenize` always succeeds; the failure channel is reserved.** The lexer
is total, and lexical errors surface as `"error"`-kind tokens inside the
success array. This is a ruling, not an accident: parse-validity exists
precisely for documents that do not parse, so a `tokenize` that failed on
malformed input would make exactly the documents the linter is for
unlintable. The `Result` return type is kept for the reserved channel —
future input-hardening guards, matching the rest of the package's hardening
posture — and is documented as never firing today. The derived `stream`
inherits the contract: error tokens arrive as elements, never as a stream
failure. Do not "fix" either to fail on error tokens.

## The rule model

The model is the lint context, the rule interface, the lint diagnostic and
the facade, shipped across two modules (`YamlLintRule.ts` and
`YamlLint.ts`) — see [module layout](#module-layout) for why.

### `LintContext`

The context handed to every rule (`YamlLintRule.ts`) carries the source
`text`, a `lines` array of `LintLine` records, the materialized `tokens`
and the composed `document`.

The engine tokenizes once and every rule shares the one materialized
`tokens` array. It materializes rather than streaming on purpose: linting
is inherently multi-pass and random-access. N rules each traverse the
input, and layout rules need lookahead and lookbehind — colon-spacing
inspects the token after the key, empty-lines counts runs of newline
tokens. There is no early-exit to exploit and no memory to win, because the
full `text` and the composed AST are already resident; a single-pass stream
would only force re-tokenization per rule or hand-rolled windowing. The
streaming token form exists for *other* consumers; the lint context is
eager by nature.

Two properties of how the context is built are load-bearing:

- **`document` is always present, including for input that does not
  parse.** The context is built through the engine's recovered compose
  path, so a malformed document still reaches every rule carrying its
  `errors` / `warnings`, which is what parse-validity reports. That
  materializer stays internal: it builds a document from raw records, and
  exporting it would put a second, unvalidated document constructor on the
  public surface next to `Yaml.parse`. The lint layer is in-package, so it
  can use the internal path without widening anything.
- **The context composes with `uniqueKeys: false`.** Duplicate-key
  *policy* belongs to the configurable `key-duplicates` rule, so the
  engine's own duplicate warnings are switched off when building the
  context and parse-validity never double-reports what `key-duplicates`
  already owns.

### `YamlRule`

The public rule interface (`YamlLintRule.ts:164`) is `id`, a `check`
function from context and options to an iterable of diagnostics, and an
optional `infer` hook — the mirror image of `check`, feeding [config
inference](#config-inference). Built-ins and custom rules are the same
shape: a consumer registers a custom rule by putting it in the array
alongside them, and config references any rule by `id`. There is no
privileged built-in mechanism a custom rule cannot reach.

### `YamlLintDiagnostic`

A separate `Schema.Class` (`YamlLintRule.ts:43`) from the engine's
`YamlDiagnostic`, carrying `rule`, `severity`, `message`, position and an
optional `fix: YamlEdit`.

It is separate because `YamlDiagnostic.code` is the
lexer/parser/composer/stringifier error-code union — it carries no severity
and no fix, and it is the single source of truth for engine fatality. See
[the yaml Module](../modules/yaml.md#diagnostics-and-the-error-set). Forcing
rule id, severity and fix onto it would pollute an engine type with
lint-layer concerns it has no business modelling. So the two stay distinct,
and parse-validity bridges them: rule #1 runs the engine parse and **maps**
each engine diagnostic into a `YamlLintDiagnostic` with
`rule: "parse-validity"`, `severity: "error"` and no fix.

## Autofix: surgical and comment-safe

A diagnostic may carry a `fix`. `YamlEdit` already models a positioned
replacement, and `YamlEdit.applyAll` applies edits in reverse-offset order,
preserves comments and whitespace, and throws on overlaps. So
`YamlLint.fix` applies non-overlapping rule fixes and is comment-safe by
construction.

**Autofix must never route through `YamlFormat.formatToString`.** Surgical
per-rule edits replace exactly the span a rule flagged; a linter that
reflows the whole file to fix one flagged span is not fixing, it is
formatting under another name. The constraint is structurally tested — a
test asserts `YamlLint.ts` contains no import of `YamlFormat` — so it
cannot be violated by a well-meaning refactor rather than only by a
reviewer noticing. Rules omit `fix` when no safe surgical edit exists;
`line-length` and `indentation` are the two that ship without one, because
satisfying either means reformatting.

**Conflict resolution is deterministic.** Fixes are collected in `run`
order — position, then length, then rule id — and a fix is dropped when it
overlaps the previously accepted one or starts at the same offset. The
same-offset clause is not redundant with overlap: two zero-length
insertions at one position do not overlap yet would apply in arbitrary
order, so the tie is broken by the same total order everything else uses.
A dropped fix is still **reported** by `run`; only its application is
skipped, and a second `fix` pass applies it.

**`fix` fails with `YamlParseError` when the input carries a fatal parse
error.** A document the engine cannot compose has no trustworthy offsets to
edit against, so refusing to fix is the honest answer; `run` still works on
that input, because reporting is exactly what parse-validity is for.

## The facade

`YamlLint` is a class of statics: `run` and `fix`, the `builtins` catalog,
and the config-inference surface (`observe`, `resolveStrict`,
`resolveLenient`, `inferStrict`, `inferLenient`). Custom usage is array
concatenation, nothing more:

```ts
YamlLint.run(text, [...YamlLint.builtins, myRule], config);
```

## Module layout

- `packages/yaml/src/YamlToken.ts` — the public positioned token stream.
- `packages/yaml/src/YamlLintRule.ts` — the model: severity,
  `YamlLintDiagnostic`, `LintLine`, `LintContext`, `YamlRule`, and the
  per-occurrence inference vocabulary.
- `packages/yaml/src/YamlLint.ts` — the config and facade: the
  rule-setting and config schemas, the aggregate inference vocabulary, and
  the `YamlLint` statics.
- `packages/yaml/src/internal/rules/` — one file per built-in rule, plus
  `catalog.ts` (the ordered rule array and the id → options-schema map) and
  `util.ts` (shared token/scalar-span helpers).

**The model/facade split is a cycle-firewall requirement, not taste.**
Built-in rules must construct `YamlLintDiagnostic`, and the facade must
import the built-in catalog, so a single module would close the cycle
`YamlLint → rules → YamlLint`, and `noImportCycles` is error-level in this
package. Splitting the model out breaks it: `YamlLintRule.ts` imports
nothing back, `src/internal/rules/*` import the model, and `YamlLint.ts`
imports both.

## Config schema and severity model

The config schema is fresh and Effect-native, owing Python yamllint
nothing — designed for kit DX, not for wire compatibility with a
`.yamllint` file.

- `YamlLintConfig` is a `Schema.Class` whose single load-bearing field is a
  `rules` map.
- Each entry keys a **rule id** to either a bare severity literal —
  `"error" | "warning" | "off"` — or a typed per-rule options object. The
  bare literal is the common case; the options object is the tuning case.
- Every built-in rule exports its own options schema, and the `rules` map
  is assembled from that catalog, so config validation is rule-aware,
  never unknown-shaped: a typo'd or mistyped option fails schema
  validation with a typed error naming the field, rather than being
  carried as an opaque `unknown` into the rule's `check`.
- A custom rule id — one not in the built-in catalog — is accepted with a
  bare severity or an opaque options object the custom rule validates
  itself. Rule-aware validation is a property of the built-in catalog, not
  a barrier to registering a rule the catalog has never heard of.
- `"off"` is a config-level disable only. It never reaches a diagnostic:
  severity stays `"error" | "warning"`, and a rule set to `"off"` is not
  run.

Presets ship as statics — `YamlLintConfig.default` and
`YamlLintConfig.relaxed` — not as an `extends` string mechanism. An
`extends: "default"` string is a resolution step that only exists to
survive serialization into a config file, and this package deliberately
owns no config-file loader. In TypeScript a preset is a value; composing
one is object spread over a static, which typechecks and needs no
resolver.

Three rules close ways a config could otherwise lie:

- **Unknown option keys are rejected.** Per-rule options decode with
  `onExcessProperty: "error"`, because v4 `Struct`s strip unknown keys by
  default — without the flag a typo'd option would decode cleanly to `{}`
  and the rule would silently run on its defaults.
- **Numeric options are bounded, not merely numeric.** Options like
  `line-length`'s `max` take a shared non-negative-integer schema, so `-1`
  or `2.5` fails at config validation rather than producing a rule that
  never fires or fires on every line.
- **Overriding parse-validity fails loud.** It is rule #1 and always-on,
  so setting it to `"off"` or `"warning"`, or handing it an options
  object, is a config error rather than a silently ignored entry.

**Severity may also be embedded in the options object.** Resolution order
is: `severity` in the options object, else the bare literal, else
`"error"`. parse-validity is exempt — its bridged engine diagnostics keep
the engine's own grading, since fatality is `YamlDiagnostic`'s to declare,
not the config's.

## The built-in rule set

The catalog is parse-validity plus a YAGNI-filtered set of mechanical
rules — whitespace and line shape, `---` / `...` markers, duplicate keys,
scalar style and the YAML 1.1 truthy trap, token adjacency, and
indentation. `src/internal/rules/catalog.ts` is the roster; each rule is
one file beside it. As of this writing the fourteen built-ins are:
`parse-validity`, `line-length`, `trailing-spaces`, `empty-lines`,
`eof-newline`, `document-start`, `document-end`, `key-duplicates`,
`quoted-strings`, `truthy`, `colon-spacing`, `hyphen-spacing`,
`comments-spacing` and `indentation`.

Rulings that hold across the catalog:

- **Layout rules skip scalar content — a recorded divergence from
  yamllint.** Trailing whitespace inside a scalar is part of the parsed
  *value*, and lines inside a scalar or a flow collection are value or flow
  syntax rather than block indentation. yamllint flags them; this package
  does not, because a layout rule that reports content is noise and a
  layout *fix* that edits content is data corruption.
- **`line-length` defaults to 120, not yamllint's 80.** The rule ids are
  the compatibility surface; the option surface and defaults are the
  kit's own.
- **The marker rules (`document-start`, `document-end`) ship outside both
  presets.** Whether a file leads with `---` is a house convention, not a
  defect, and a preset that flagged every unmarked file by default would
  train users to disable presets.
- **`quoted-strings` defaults to `"double"`**, and its fix delegates to
  the shared `src/internal/requote.ts` helper in `"conservative"` mode —
  byte-exact, bailing whenever escapes are in play — while the format
  path's `requoteScalars` uses the same helper in `"escaping"` mode; see
  [the stringify options](yaml-stringify-options.md).
- **`key-duplicates` owns duplicate policy outright**, which is why
  [`LintContext`](#lintcontext) composes with `uniqueKeys: false`.
- **`indentation` checks indent style only** — a consistent unit per
  level, and one sequence-under-key policy — because structural *legality*
  is the parser's job and parse-validity already reports it. It is the
  only rule that reasons about block structure rather than about a token
  and its neighbours, and it does so over the same `LintContext` as the
  rest.

## Config inference

The inverse of `run`: read existing YAML and produce the config its style
already follows. This is the adoption story for a repo that has never had a
lint config — point the linter at your workflows, get the config out — and
the machinery it needs (the eager context, rule-owned option semantics) is
exactly what the rule engine already built.

### One primitive, two resolution policies

The surface is one primitive and two resolvers, deliberately not a mode
enum:

- **`observe`** returns `StyleEvidence` — pure, per-dimension evidence:
  histograms and measurements (quote types seen, indent widths, marker
  presence, spacing before `#`, longest line, max blank run). Evidence is a
  monoid: observing N files and merging their evidence gives multi-file
  inference for free, and the N-file loop stays the caller's — so the
  pure-half-only constraint holds untouched, strings in, config out, no IO
  enters the package.
- **`resolveStrict`** requires every *observed* dimension to be unanimous
  and yields an exact config; conflicting evidence fails with
  `YamlStyleConflictError`, a `Schema.TaggedError` carrying structured
  conflicts, dominant spelling first. A "mode that fails" is this
  resolver's error channel, not a separate mode. One nuance is pinned
  explicitly: unobserved ≠ conflicting. A document with no comments says
  nothing about `comments-spacing`; it falls back to defaults rather than
  failing. The return is a sync `Result`, per [the sync-primitive
  policy](../conventions/sync-primitive-policy.md).
- **`resolveLenient`** takes the dominant style per dimension with
  base-config defaults for the unobserved rest. It is total, with no
  thresholding — plurality wins outright, and ties break deterministically
  to canonical value order rather than by a tunable cutoff.

The residual report — the diagnostics the inferred config would still
produce, "here is your config, and the three places that do not match it"
— lives on the `inferStrict` / `inferLenient` pair, which return a
`YamlLintInference` of config plus residual. The residual reuses the same
context and engine, so the whole round costs one tokenize/compose.

The evidence vocabulary is Schema classes across the two lint modules.
`YamlLintRule.ts` holds the per-occurrence side — `StyleVote`
(`YamlLintRule.ts:110`) and `StyleFloor` (`YamlLintRule.ts:132`), with
`StyleObservation` their union. Both are `Schema.TaggedClass`, not plain
`Schema.Class`, and aggregation branches on the runtime `_tag`, never
`instanceof`: Schema class instances are structurally assignable, so a
custom rule returning a plain object that type-checks as a `StyleVote`
would fail `instanceof` and silently fall into the floor branch.
`YamlLint.ts` holds the aggregate side — the canonically-sorted tallies and
`StyleEvidence`, with an `empty` static and an associative `combine`
(counts add, left first-seen position wins, floors max, output
canonicalized) plus the homomorphism from observation lists into the
monoid. Monoid laws are generative tests over Schema-derived arbitraries.
Value keys are type-discriminating: `"2"` ≠ `2`.

### Ownership: an `infer` hook on the rule

Detection logic lives beside check logic. `YamlRule`'s optional `infer`
hook is the mirror image of `check`, so each rule owns its own style
detection with the same fixtures its `check` already has, and custom rules
participate in inference for free, on the same no-privileged-built-ins
principle as [the rule model](#the-rule-model).

The key refinement is that a vote's `dimension` IS the rule's option key
and its `value` IS the option value — so the resolvers turn votes into
config entries with zero per-rule knowledge, and a custom rule's hook feeds
the same machinery untranslated. An emergent property rode in for free:
rule-aware config validation means a hook voting a bogus dimension on a
built-in fails config validation loudly.

Strict overlay semantics are pinned: unanimity is required per *observed*
dimension; unobserved dimensions fall to the base config; base `"off"`
outranks inference; a base `"warning"` severity survives the overlay;
observed rules absent from the base are added.

### Honesty about detectability

Some rules have no detectable *style* and must say so rather than guess:

- `truthy` and `key-duplicates` are policy rules — their only evidence is
  violations, so nothing about a clean corpus reveals what the policy
  should be.
- `line-length` and `empty-lines` are inferable only as a floor: the
  longest observed line, or the longest observed blank run, proves the
  limit is *at least* N, not what N is.

Floor-only dimensions stay default-driven under both resolvers — floors
are informational, never resolved into config. The remaining
max-constraint rules (`trailing-spaces`, `eof-newline`, `colon-spacing`,
`hyphen-spacing`) have no hook for the same reason as the policy rules:
their only evidence is violations. Seven built-ins carry `infer` hooks in
total: five vote (`quoted-strings`, `indentation`, `document-start`,
`document-end`, `comments-spacing`), two emit floor-only evidence
(`line-length`, `empty-lines`).

## Testing

Three pieces, and no Python-yamllint differential.

- **A shared per-rule fixture harness** (`__test__/rules/harness.ts`),
  driving fixture sets grouped by rule family. Each fixture is a triple:
  input → expected diagnostics → expected fixed output where a fix exists.
  Uniform structure is the point — a per-rule bespoke test file is how a
  rule set drifts into N dialects of "tested".
- **Every rule proven falsifiable by mutation.** A deliberately mutated
  implementation must make its fixtures fail. The mutants are automated
  and two-sided — a dead-rule mutant, which reports nothing, and an
  unfixing mutant, which reports but declines to fix. The second half
  catches the failure the first cannot: a rule whose diagnostics are right
  and whose `fix` is inert. The harness carries a dead-infer mutant per
  rule set too, so a hook that silently stops observing fails its
  fixtures.
- **A token-stream position-fidelity conformance check** across the
  vendored yaml-test-suite corpus. This is the one invariant the whole
  rule layer rests on — every diagnostic position and every autofix span is
  a token position. It is a tiling check rather than mere slice-equality:
  tokens must be ordered, non-overlapping, and every gap between
  consecutive tokens must be horizontal-whitespace-only, so the walk
  proves the stream *covers* the source rather than merely quoting it
  correctly where it happens to speak. A floor assertion stops a
  silently-empty walk passing as green.

**The harness guards its own fixtures.** Every fixture input is asserted to
parse cleanly, with an explicit `expectsParseErrors: true` opt-out for the
fixtures that are *about* malformed input. The guard is bidirectional —
declaring the opt-out on an input that parses fine fails too.

**Strict-mode inference over our own emitted output is a self-consistency
test of the stringifier** — unanimous evidence out of our own emit, or the
stringifier is inconsistent with itself. It runs as an e2e suite and pins
the stringifier's voice.

A differential against Python yamllint is explicitly rejected. It would
install a Python toolchain into a TypeScript monorepo's test path, and it
would bind diagnostics to another tool's message text and off-by-one
conventions — pinning the package to bug-for-bug agreement with an
implementation whose config schema it just decided not to copy. The
mutation proofs give the falsifiability a differential was wanted for,
without the second toolchain.

## Dependence on the comment model

`comments-spacing` needs to know whether a comment is an own-line comment
or a trailing one to say anything true about the space before its `#`.
That distinction lives in the [node-level comment
model](yaml-comment-model.md), which the rule is written against.

The same model is why autofix is surgical by design rather than by
necessity: `YamlFormat.formatToString` preserves per-node comments too, and
autofix still must not route through it — surgical edits are the right
shape for a linter, not merely the safe one.


---
<!-- okf/decisions/yaml-lint-pure-half-only.md -->
---
type: Decision
title: The yaml lint system stays inside the pure tier
description: The lint engine and built-in rules ship in pure-tier @effected/yaml; file discovery, config-file loading, a CLI and autofix-to-disk are explicitly out of scope for the package.
status: draft
tags: [architecture]
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: c90b8afb533af2b29119b0554d27f4af5bec0476545098c662cd14668f1b58d1
---

# The yaml lint system stays inside the pure tier

## Context

`@effected/yaml` added a yamllint-class lint system — a rule engine, a
built-in rule catalog and a config schema — on top of its existing pure
parsing and formatting engine. A lint system in the wild typically also
does file discovery, reads a config file from disk, exposes a CLI and
writes fixes back to disk. Building the yaml lint system had to decide
which of those the package itself would own.

## Decision

The lint system stays inside pure-tier `@effected/yaml`: the rule engine,
the built-in rule catalog, and a config *schema* — a validating
`Schema.Struct`, not a config-file loader. Everything with a tier smell
belongs to a later, separate boundary or integrated package, or to the
host: file discovery, config-file loading, reading and writing files, a
CLI, and autofix-to-disk. The package's contract stays strings in,
diagnostics or a fixed string out.

## Alternatives rejected

**Bundling a config-file loader and CLI into `@effected/yaml`.** Rejected
because it would repeat the tier violation the kit's [dependency
policy](../conventions/dependency-policy.md) exists to prevent: a pure
package that owns its parser must not also own its runner. Putting IO into
a pure-tier package would force every consumer of `@effected/yaml` — most
of whom never touch the lint surface — to accept a heavier dependency
closure and a tier reclassification for the whole package.

**Wire-compatible config with an existing `.yamllint` file.** Rejected
because it requires a deferred config-file loader, and it would fossilize
Python yamllint's option spellings inside an Effect `Schema` that would
then have to keep them forever. See the config schema's own [fresh vs.
yamllint-shaped reasoning in the lint interface](../interfaces/yaml-lint.md#config-schema-and-severity-model)
for the fuller argument against wire compatibility.

## Consequences

A consumer that wants file discovery, on-disk config loading, a CLI
entry point or autofix-to-disk builds that layer in a boundary or
integrated package, or in the host application, over `YamlLint.run` /
`.fix` and the config schema. The pure engine's test suite and public
surface never grow an IO dependency because of the lint feature. Any future
CLI or config-loader package for yaml lint is a new package or a host
concern, not a `@effected/yaml` addition.


---
<!-- okf/conventions/format-package-convention.md -->
---
type: Convention
title: Format-package convention
description: How @effected/* packages expose formatting as distinct from validation, and the fidelity guarantee a kit formatter makes.
status: stable
stale_after: 2027-03-13T00:00:00Z
tags:
  - architecture
  - dx
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 56015737879a155ff6561cca92d4b80cbf27de64a5593b4a95c9463d106ec1b7
---

# Format-package convention

The kit contains five packages that format text — `jsonc`, `yaml`, `toml`,
`markdown` and `package-json` — and this convention states the one seam they
all expose, so a new formatting surface is checked against a stated rule
rather than reinvented per package. It ratifies what the five packages had
already converged on independently rather than minting a further spelling.

## The driving constraint

Kit formatters ship into consumers' lint hooks — lint-staged, pre-commit.
Those hosts hand a formatter file contents and expect text back,
synchronously. Two properties follow, and they are the whole basis of the
rules below.

**C1 — a formatter must not hard-fail on legal input.** A strict path that
throws on `{"private": true}` or a version-less root — both perfectly legal
`package.json` files — is unusable as a lint handler, and the consumer routes
around the kit to whatever does work. A formatter that rejects legal input is
not a formatter.

**C2 — a formatter must not silently rewrite legal input into a
different-but-equivalent encoding.** Two bugs of this class shipped in
released packages, neither caught by its own suite: a model class with no
catch-all dropped unknown author keys on a read→write round trip, and a YAML
emitter wrote C0 control characters raw in plain scalars, corrupting on round
trip. Fidelity is the whole job of a kit containing four format packages, and
suites that test the emitter against the model do not catch fidelity bugs —
which is why the fidelity obligation below is the rule with the most teeth.

### Why a convention and not four local answers

Precedent from inside the kit: one consumer once wrote four differently-shaped
error folds for a single compile-plus-expand glob pattern inside one package,
because no kit package owned the seam, and that fan-out produced a real bug —
two divergent `dot` semantics in one package. Absent a stated convention, the
same fan-out happens across four format packages, on published surfaces that
cannot then be changed without a breaking release.

## The rules

Four rules, stated so a reviewer can check a package against them.

**P1 — the tolerant path is its own named entry point, never a flag.** A
`{ strict: false }` option on the strict path is banned: it makes the strict
path's return type a union of guarantees and hides the choice from the call
site and from `grep`.

**P2 — offer the shape(s) the hosts actually have, and route them through one
implementation.** Value→value and bytes→bytes are different hosts, not a
convenience pair; a package with only one kind of host ships only one entry
point. Two entry points that re-derive the same ordering will drift, so they
share the internal.

**P3 — the value path only reorders. It never adds or removes a key.** This is
what makes a `T → T` signature honest, and the type system enforces it: an
earlier `stripEmpty` option on the value path was rejected by `tsc`, because
removing a key makes `T → T` a lie. The option moved to the text path rather
than the return weakening to `Partial<T>`. A capability that must remove keys
belongs on the text path with an explicitly-defaulted-off option.

**P4 — input the formatter cannot handle is returned unchanged.** Never
partially rewritten. A formatter returning zero edits on a fatal parse error
and a value path passing non-objects through are the same rule.

## The five packages as they are

| Package | Formatting surface | Shape | Fails on bad input? |
| --- | --- | --- | --- |
| `jsonc` | `JsoncFormatter.format` / `.formatToString` (`packages/jsonc/src/JsoncFormatter.ts:33,48`) | `string → ReadonlyArray<JsoncEdit>` / `string → string` | No — pure and total |
| `yaml` | `YamlFormat.format` / `.formatToString` (`packages/yaml/src/YamlFormat.ts:799,826`) | same shape | No — malformed input yields no edits rather than corrupting the document |
| `toml` | `TomlFormat.format` / `.formatToString` (`packages/toml/src/TomlFormat.ts:775,790`) | same shape | No — same construction |
| `markdown` | `MarkdownFormat.format` / `.formatToString` (`packages/markdown/src/MarkdownFormat.ts:609,673`) | same shape | No — an unparseable document yields no edits |
| `package-json` | `PackageJsonFormat.sortValue` / `.formatToString` (`packages/package-json/src/PackageJsonFormat.ts:159,196`) | `T → T` / `string → Result<string, …>` | Text path fails on non-JSON only |

The four format packages converged independently on the same shape: a
`*Format`/`*Formatter` concept class carrying total statics, edit-based
(`format` returns edits, `formatToString` applies them), degrading to identity
when the document cannot be parsed. That convergence is the strongest
available evidence about what the convention should be. `MarkdownFormat` and
`PackageJsonFormat` also carry `modify`/`modifyToString`, which replace a node
or field through the canonical emitter — an editing operation rather than a
formatting entry point, and not governed by the [return-type
decision](../decisions/format-return-type.md).

`package-json` differs for a real reason: it is the only one of the five with
a schema between text and text, so it is the only one where a formatting path
could ever have hard-failed on legal input. The other four satisfy C1 by
construction.

The rest of the shape decisions — naming, which packages need a tolerant
seam, the return-type rule, the options-type rule, and the fidelity
obligation — each carry their own alternatives-rejected record: see
[format-naming](../decisions/format-naming.md),
[format-tolerant-seam](../decisions/format-tolerant-seam.md),
[format-return-type](../decisions/format-return-type.md),
[format-options-type](../decisions/format-options-type.md), and
[format-fidelity-obligation](../decisions/format-fidelity-obligation.md).
The return-type rule generalizes past formatting into the
[sync-primitive policy](sync-primitive-policy.md).

## Open notes

These points are open by design rather than settled, so a future change
finds them here instead of re-litigating from nothing:

1. Should the total formatters gain a way to signal "could not parse"?
   Recommendation is no change — totality is what makes them safe in a lint
   hook, and each package's `parse` entry point already provides the
   diagnostic to any host that needs it. Flagged because it is a real
   ergonomic gap and the decision should be conscious rather than inherited.
2. Is the `toml` oracle-differential pattern (property tests run against an
   independent reference implementation) worth replicating for `yaml` and
   `jsonc`? Not recommended as a mandate — both would need a reference
   implementation to differ against, reintroducing a dependency question for
   a devDependency-only benefit. The fidelity rules are the mandate; an
   oracle stays a per-package judgment call where a suitable reference
   exists.
3. Parity hardening is the next planned pass: complete frontmatter updates
   flowing through `markdown`'s edit layer, standardize the four packages'
   three different range-filter postures onto one, and then promote the
   kit's parity contract from shape-identical to behavior-identical.


---
<!-- okf/decisions/format-naming.md -->
---
type: Decision
title: "Format-package naming is `*Format`, not `*Unvalidated`"
description: "The `*Format` concept class with total statics is the kit's naming convention; `*Unvalidated` is rejected."
status: draft
tags:
  - architecture
  - dx
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 9a9966b582e8f2db71f0f0ae3597e123d464d05c27da1ba523e429e8fca2c959
---

# Format-package naming is `*Format`, not `*Unvalidated`

## Context

Four of the kit's five format packages — `jsonc`, `yaml`, `toml`, `markdown`
— converged independently on a `*Format`/`*Formatter` concept class exposing
`format` (edits) and `formatToString` (bytes→bytes), per the [format-package
convention](../conventions/format-package-convention.md). The fifth,
`package-json`, differs because it alone decodes against a schema. A naming
convention was needed for the shared shape before any of these surfaces
shipped and became unchangeable.

## Decision

The `*Format` concept class with total statics is the kit's naming
convention. `formatToString` is the shared name for the bytes→bytes shape, so
a consumer who has met one kit formatter has met them all
(`packages/jsonc/src/JsoncFormatter.ts:48`, `packages/yaml/src/YamlFormat.ts:826`,
`packages/toml/src/TomlFormat.ts:790`, `packages/markdown/src/MarkdownFormat.ts:673`,
`packages/package-json/src/PackageJsonFormat.ts:196`). A package-specific
shape gets a package-specific name instead of being forced into the shared
one — `package-json`'s value-path entry point is `sortValue`
(`packages/package-json/src/PackageJsonFormat.ts:159`), not `format`, because
its shape (`T → T`) differs from the other four's (`string →
ReadonlyArray<Edit>`).

The guarantee a formatter makes lives in the class's doc comment, where it
can be stated precisely, rather than compressed into a name prefix.

## Alternatives rejected

**`*Unvalidated`.** Accurate for `package-json`, which has a decode step to
skip, and wrong everywhere else. `yaml`, `toml`, `jsonc` and `markdown` have
no validation to be un-done — their tolerant/strict distinction is about
fidelity and error tolerance, not schema decoding. The axis worth naming is
not "validated" but whether the path decodes at all: a decode-free path
cannot normalize, because it never looks at the field, and *source-preserving*
is the guarantee a consumer is actually shopping for.

## Consequences

A reader who has used `JsoncFormatter.formatToString` recognizes
`YamlFormat.formatToString` on sight, and can predict that a package with a
genuinely different shape (`package-json`) will diverge in the value-path
name while keeping the shared text-path name. New format surfaces added to
the kit are checked against this naming before they ship, since renaming a
published static is a breaking change.
