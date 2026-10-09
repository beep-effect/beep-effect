# spdx — upstream knowledge bundle (verbatim)

Provenance: ~/YeeBois/references/effect/effected @ af7566a9da2eff169cb74955efcc5ede1e5de9f8; files listed below.
Relative `okf/...` links refer to that checkout. Content is carried verbatim; port
decisions live in README.md → Port notes, not here.

---
<!-- packages/spdx/CLAUDE.md -->
# @effected/spdx

SPDX license identifiers, exceptions and license expressions as Effect Schema classes.

**Pure tier:** `dependencies: {}`, peer-depends on `effect` only, no IO, `"sideEffects": false`. Never add a filesystem, network or clock dependency here; a boundary-tier consumer owns that.

**Design doc:** `@./okf/modules/spdx.md` — load when changing the public surface, the parser grammar, or regenerating the vendored datasets.

## Public surface

`src/index.ts` is the only re-exporting module. Outside it, modules import explicitly — no barrels.

- `src/License.ts` — `License` (`Schema.Class`) with a static valid/deprecated catalog, the derived catalog-metadata getters `referenceUrl` / `name` / `osiApproved` / `fsfLibre`, plus the single typed `InvalidSpdxExpressionError`.
- `src/LicenseException.ts` — `LicenseException` (`Schema.Class`) with its own valid/deprecated catalog.
- `src/SpdxExpression.ts` — `SpdxExpression` plus the tagged-union AST nodes `LicenseNode` / `LicenseRefNode` / `WithExceptionNode` / `AndNode` / `OrNode`, the sync predicate `isValidExpression`, and the expression-reading pair `primaryLicense` / `licensesOf`.

`License` and `LicenseException` each carry validating constructors `parse` (Effect) and `parseResult` (Result) — **not `make`**, which `Schema.Class` reserves — an `of(...)` construct-from-parts helper mirroring `SemVer.of`, and the predicates `isKnownId`, `isDeprecatedId`, `isLicenseRef`.

`SpdxExpression` is a recursive tagged-union AST built with `Schema.suspend`, carrying a `FromString` codec, an Effect `parse`, the sync `isValidExpression`, and a canonical fully-parenthesized `.toString()`. The parser is hardened and depth-capped: malformed or unknown input fails through `InvalidSpdxExpressionError`, never as a defect.

The `SpdxExpression` facade stays an `as const` object, NOT a static class: `export type SpdxExpression = LicenseNode | ... | OrNode` (the AST union) already claims that name as a type alias, and a type alias cannot merge with a class (only an interface can) — `export class SpdxExpression` would be a duplicate-identifier error. This is one of the three recorded holdouts in the kit's static-class-conversion sweep — with `@effected/config-file`'s `MergeStrategy` and `EncryptedCodecKey`, all three the same cause, a class cannot merge with a same-named type ([the container rule](../../okf/conventions/no-barrel-re-exports.md#a-sanctioned-grouped-statics-container-is-a-class-not-an-as-const-object)); the facade's member TSDoc is consequently still exposed to the `as const` inference loss in the built `.d.ts`.

## Conventions and gotchas

- **`WITH` binds to a simple *expression*, and a reference is one.** Per the SPDX ABNF, `LicenseRef-Foo WITH Bison-exception-2.2` is grammatical, so `WithExceptionNode.license` is a **union** of `LicenseNode` and `LicenseRefNode` — never narrow it back. The parser materializes all three simple-license forms into one internal leaf and applies **one** shared `WITH <known exception>` check; never re-branch that tail, which is how the reference forms drifted from the id form. The exception must still be cataloged, and only a cataloged id may carry `+` (`LicenseRef-Foo+` is rejected).
- **The metadata getters are derived, never stored.** `referenceUrl` / `name` / `osiApproved` / `fsfLibre` read `src/internal/licenseMeta.ts`; `name` and `referenceUrl` are `Option` (none for a `LicenseRef-*`), the two flags are plain booleans. `referenceUrl` is **templated** from the id rather than vendored, because every upstream entry's URL is exactly `https://spdx.org/licenses/<id>.html` — the generator asserts that template against upstream for every id, so it is a checked invariant, not an assumption. Entries are `[id, name, flags]` tuples with bit flags, not objects: three repeated keys across 721 ids would cost consumers ~20 KB for no information. Never "tidy" them into objects.
- **`primaryLicense` returns `Option.none()` for `AND`, and that is the whole point.** Simple, `WITH` and `OR` (leftmost) all have a defensible single answer; a conjunction does not, and picking a term would silently drop one that legally applies. A caller that lands on none uses `licensesOf` — the ordered, de-duplicated array — instead. Never "improve" `AND` into a first-term guess.
- **`parse` / `parseResult`, never `make`.** `Schema.Class` reserves `make`, so the validating constructors take these names. The sync `Result` form is the primitive; the `Effect` twin derives from it — kit convention, `@./okf/conventions/sync-primitive-policy.md` and `@./okf/decisions/sync-form-named-result.md`.
- **Vendored datasets are real TypeScript under `src/internal/`** — 695 active + 26 deprecated license ids and 66 exceptions, committed as data literals (`licenseIds.ts`, `exceptions.ts`, `licenseMeta.ts`). Deprecated ids are valid-but-flagged, never rejected.
- **The datasets are devDep-only vendoring.** `spdx-license-ids`, `spdx-exceptions`, `spdx-expression-parse` and `oxc-parser` are **devDependencies only** — never import them from `src/**` at runtime. `lib/scripts/generate-data.ts` regenerates the literals by rewriting their byte-spans via `oxc-parser`; re-run it and diff when the upstream data bumps (it is idempotent).
- **The metadata generator reads a committed file, so refreshing it is an obligation.** `licenseMeta.ts` is generated from `lib/data/spdx-licenses.json` — SPDX's own published catalog at v3.28.0 (CC0-1.0), committed rather than submoduled because the upstream repo is 1.86 GB and this is the one 332 KB file we read from it. When the `spdx-license-ids` devDependency bumps, refresh that file from the SPDX release covering it **in the same commit** and re-run the generator; it fails loudly with that instruction when the catalog cannot cover an installed id.
- **Differential oracle test.** `__test__/oracle.int.test.ts` checks the engine against `spdx-expression-parse` and must agree on 695/695 ids. If the engine disagrees with the oracle, **fix the engine** — never pin the oracle back or exclude the case. **An oracle bump is a grammar review, not a version bump:** probe the new oracle's answers for the forms around the change and let the corpus record each accept and reject. A test-only ambient shim `types/spdx-expression-parse.d.ts` types the oracle dependency.
- `package.json` stays `"private": true`. The bundler emits the publishable manifest.

## Test and build

```bash
pnpm vitest run packages/spdx          # this package's tests
pnpm build --filter @effected/spdx     # dev + prod, from the repo root
```

Tests live in `__test__/` (`oracle.int.test.ts` is integration), use `@effect/vitest`, and assert with `assert.*` — **never `expect`**.

Never run `node savvy.build.ts --target prod` directly: it skips `build:dev`, emits no `.d.ts`, and leaves a truncated `issues.json` shaped exactly like a clean gate.


---
<!-- okf/modules/spdx.md -->
---
type: Module
title: "@effected/spdx"
description: SPDX license identifiers, exceptions and license expressions modeled as pure Effect Schema classes, owning the grammar rather than depending on a parser package.
status: stable
kind: package
resource: ../../packages/spdx
tags: [architecture, bundle]
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 867237bd03ff7a2f222d3b91b0d36046239f754a9c8ea7c40a8ef134d1984434
---

# @effected/spdx

`@effected/spdx` is SPDX license identifiers, exceptions and license
expressions as Effect Schema classes: parse, validate and model the SPDX
grammar, all pure. It follows the semver north star — a strict-grammar
package whose class *is* the schema, with a catalog held as static data on
its owning class — rather than the parse/edit/format shape of the kit's
format packages.

Owning the grammar rather than depending on `spdx-expression-parse` is what
keeps `@effected/package-json` free of a foreign CJS runtime edge, and
therefore at boundary tier. That is the same move `@effected/toml` and
`@effected/glob` made: vendoring a grammar *is* the wrapper, under the
kit's dependency policy.

## Tier and dependencies

Pure tier, per [the tier taxonomy](../glossary/library-tier.md): no IO, no
services, no layers, no `R`. All inputs are strings, all outputs are values
or typed errors. `effect` is the only peer, `dependencies` is empty and
`"sideEffects": false`.

No cross-`@effected` runtime edges: `@effected/package-json` depends on
`spdx`, never the reverse, running from boundary toward pure as the kit's
[dependency policy](../conventions/dependency-policy.md) requires. See [why
package-json delegates to spdx](../decisions/spdx-delegation.md).

Everything SPDX-adjacent — the upstream `spdx-license-ids` and
`spdx-exceptions` datasets, the canonical `spdx-expression-parse` (kept as
the differential oracle and as the algorithm reference) and the parser used
by the regeneration tool — is a **devDependency only**. Never import any of
them from `src/**`. The same holds for `lib/data/spdx-licenses.json`, the
committed catalog behind the metadata table: it is a build-time input to the
generator and nothing else. See [the generator input
convention](../conventions/generator-input-is-a-committed-file.md).

## Module layout

Module-per-concept; `src/index.ts` re-exports only.

- `src/License.ts` — the `License` class, owning the static license catalog
  and its derived metadata getters, plus `InvalidSpdxExpressionError`
  (shared across the surface).
- `src/LicenseException.ts` — `LicenseException` and its own static
  exception catalog.
- `src/SpdxExpression.ts` — the recursive expression AST, its `FromString`
  codec, `parse`, the sync validator and the two license accessors.
- `src/internal/` — the vendored datasets as hand-authored or generated
  TypeScript, and the parser. `licenseIds.ts` and `exceptions.ts` are the
  identifier sets; `licenseMeta.ts` is the generated metadata table.

## Public API

Class-based throughout: the class *is* the schema, no `*Schema` suffixes.

`License` and `LicenseException` are each a single `Schema.Class` carrying
an id and a deprecation flag, owning a **static catalog** of the valid and
deprecated identifiers, co-located with the domain. One class with a static
catalog is the deliberate choice over per-license classes or a bare
`Set<string>`: it is simple and cheap, it hands consumers real typed domain
objects rather than raw strings, and it keeps the catalog next to the
concept it describes.

The string-parsing constructors are `parse` (Effect) and `parseResult`
(Result) — not `make`, which `Schema.Class` already owns. An `of(...)`
construct-from-parts helper mirrors `SemVer.of`, and static predicates
answer catalog and grammar questions without constructing anything. Parsing
checks an id against the static catalog or against the `LicenseRef-` /
`DocumentRef-` pattern.

This does not contradict the kit's `X.make(...)`, never `new X(...)` rule —
`make` remains the fields constructor (`License.make({ id, deprecated })`
is exactly how the catalog is built), and reading either statement alone
makes it look like it does. What `make` cannot be is a **string parser**:
it takes the field record, not the encoded form, and applies only
field-level schema checks (`id` is `Schema.String`, with no catalog check
attached), so it will happily construct
`License.make({ id: "Not-A-License", deprecated: false })`. Catalog
membership is not a field-level constraint, so a string form needs a
second, differently-named entry point — `parse`/`parseResult`. Deprecated
ids are valid but flagged: they parse successfully and carry the
deprecation marker, and are never rejected.

### Catalog metadata

`License` carries four derived getters over a generated metadata table —
`referenceUrl`, `name`, `osiApproved` and `fsfLibre` (`src/License.ts`).
They exist because a downstream consumer rendering a license needs a title
and a link, and the alternative is every consumer re-deriving both from the
id, badly.

Four rulings hold this surface together, and each is the safe answer
rather than the convenient one:

- **Absence is `Option.none()`, not a fabricated value.** `referenceUrl`
  and `name` are `Option`, because a `LicenseRef-`/`DocumentRef-` reference
  names a license that lives in the consuming document rather than on
  spdx.org, and an uncataloged id names nothing at all. Templating a URL
  anyway would hand a caller a confidently broken link, which is worse than
  no link.
- **The flags are plain `boolean` and default to `false`.** They assert
  something about a *known* license, so the absence of a catalog entry is
  never "approved".
- **`osiApproved` and `fsfLibre` are independent and neither may be derived
  from the other.** The FSF's list is much shorter than the OSI's and the
  two disagree in **both** directions — `0BSD` is OSI-approved and not
  FSF-libre, `Apache-1.0` is FSF-libre and not OSI-approved.
- **`reference` is not vendored; it is templated, and the template is a
  checked invariant.** Every upstream entry's URL is exactly
  `https://spdx.org/licenses/<id>.html`, so shipping every one would be
  hundreds of copies of a format string. The generator asserts the
  template against upstream for every id and fails loudly on any
  deviation. Never relax that assertion to make a regeneration pass — a
  deviation means upstream changed the URL shape, and the answer is to
  vendor the field.

The table itself is `[id, name, flags]` tuples, one per id in the
`licenseIds.ts` catalog — 721 ids. Objects would repeat three keys per
entry for no information: roughly 20 KB saved by not doing so. Never
"tidy" them into objects.

### Reading licenses out of an expression

Two accessors on the `SpdxExpression` facade
(`src/SpdxExpression.ts:311,351`) answer "which license(s) is this under",
and the pair is the point — neither is complete alone.

- **`licensesOf(expr): ReadonlyArray<License>`** — every license the
  expression names, in written order, de-duplicated by identifier keeping
  first appearance. Reach for it wherever a target permits more than one
  license.
- **`primaryLicense(expr): Option<License>`** — the single license an
  expression can be said to be under, when there is one. A simple license,
  or one with an exception, yields that license; `OR` yields the leftmost,
  the choice the author wrote first and npm's convention treats as
  preferred; `AND` yields `Option.none()`. See [the conjunction
  decision](../decisions/spdx-primary-license-declines-conjunction.md).

`WITH` is handled by carrying the license and dropping the exception, in
both accessors: the exception qualifies a license rather than naming a
different one. The `+` "or later" marker is dropped for the same reason —
`License` models identifiers, not operators.

An accessor that declines to collapse does not stop a caller collapsing
downstream: a consumer that maps `licensesOf(...)` to a bare `string[]` of
ids discards the `License` entries, so only the primary's `referenceUrl`
survives — and a dual-licensed (`AND`) package then emits no license at
all, since an `AND` has no primary. The entries are the payload:
`licensesOf` returns `License` objects rather than ids precisely so
per-entry metadata travels with them.

`SpdxExpression` is a recursive tagged-union AST over the grammar, with each
variant a separate node class and the recursion expressed via
`Schema.suspend`. It provides a `FromString` codec, an Effect `parse`, a
sync validity predicate and a canonical fully-parenthesized `toString` —
one grammar as the single source of truth, so parse and encode round-trip.
The AST's license node is deliberately distinct from the catalog `License`
class: it carries the grammar's trailing-`+` "or later" marker, which a
catalog entry has no place for.

**`WITH` binds to a *simple expression*, and a reference is one.** The SPDX
ABNF reads `simple-expression = license-id / license-id"+" / license-ref`
and `with-expression = simple-expression "WITH" license-exception-id`, so
`LicenseRef-Foo WITH Bison-exception-2.2` and
`DocumentRef-spdx-tool-1.2:LicenseRef-MIT-Style-2 WITH Classpath-exception-2.0`
are both grammatical. The exception node's license field is therefore a
union of the license node and the reference node, not the license node
alone. Two neighbouring rules are deliberately not symmetric with this
widening: the exception must still be a cataloged exception id
(`LicenseRef-Foo WITH Bogus-exception` is rejected), and only a cataloged
id may carry `+` (`LicenseRef-Foo+` is rejected, since the ABNF puts `+` on
`license-id`, never on `license-ref`).

The engine parses all three simple-license forms — `DocumentRef:LicenseRef`,
bare `LicenseRef`, cataloged id with optional `+` — into one internal leaf,
then applies a single `WITH <known exception>` check to whichever it
produced. That shared tail is the invariant to preserve: three per-branch
`WITH` checks is how the reference forms drifted from the id form in the
first place.

The `SpdxExpression` facade is an `as const` object, not a static class —
a recorded holdout from the kit's static-class-conversion sweep rather than
an oversight: the AST union already claims that name as a type alias, and a
type alias cannot merge with a class (only an interface can), so
`export class SpdxExpression` would be a duplicate-identifier error. The
cost is that the facade's member TSDoc is exposed to the `as const`
inference loss in the built `.d.ts`.

## The sync primitive

Per the kit's [sync-primitive policy](../conventions/sync-primitive-policy.md),
this pure boundary exposes a sync `Result` primitive alongside its Effect
form, with the Effect form derived from the sync one behind its span so the
two cannot drift. Synchronous consumers — lint hooks, non-Effect callers —
need the sync form, and `@effected/package-json`'s own license validation
reaches for the sync expression predicate.

## Error set

The single typed error is `InvalidSpdxExpressionError`. Both malformed
grammar and an unknown identifier fail through it on the `E` channel,
never as a defect — the kit's input-hardening invariant applied to this
grammar: recursive descent over the expression AST is depth-capped and
surfaces the overflow as that error rather than a `RangeError`.

## Vendored data and regeneration

The license-id and exception sets are vendored as real TypeScript in
hand-authored internal modules, split so a consumer touching only
exceptions never pulls the license set — genuine tree-shaking, which a
single `JSON.parse("…")` blob would defeat. Each module carries an
attribution header naming the SPDX source and its upstream license.

A hand-run regeneration tool, `lib/scripts/generate-data.ts`, keeps them
current: a devDep script run manually, never in CI and never in the test
suite. It rewrites only each data literal's contents in place by byte span,
leaving module headers, types and co-located hand-authored code untouched.
It is idempotent — re-run and diff when the upstream data bumps. Full
mechanics, provenance and the refresh obligation are in [the license-data
model](../models/spdx-license-data.md) and [the regeneration
runbook](../runbooks/regenerate-spdx-data.md).

Catalog construction carries no meaningful load-cost penalty: the catalog
is built through `License.make`, which applies only the field-level schema
checks and performs no catalog lookup or grammar parse, since the vendored
data is canonical by construction. Parse cost falls only on user input,
never on the known-good catalog at module load.

## Consumer contract

`@effected/package-json` delegates core SPDX expression validity to this
package and nothing more. It keeps its npm-specific special cases —
`UNLICENSED` and `SEE LICENSE IN <file>` — because those are npm semantics,
not SPDX. The `workspace:^` edge does not lift package-json's tier: an edge
to a pure package leaves the boundary-tier consumer at boundary, exactly as
its semver and npm edges do.

## Testing

`@effect/vitest` with `it.effect` the default mode, `assert.*` and never
`expect`; tests in `packages/spdx/__test__/`.

- A **differential-oracle** conformance harness runs the validator and
  parser against `spdx-expression-parse` over the full id set and an
  expression corpus — the same posture as `glob`'s minimatch oracle and
  `toml`'s smol-toml oracle. If the engine disagrees with the oracle, fix
  the engine. A test-only ambient shim types that dependency.
  - An oracle bump is a grammar review, not a version bump. The rule has
    already moved the public surface once — a bump surfaced
    `LicenseRef-… WITH …` as an accept the engine rejected, and the
    exception node's license field widened rather than the oracle being
    pinned back or the case excluded. Probe the new oracle's answers for
    the forms around any change (a reference with `WITH`, a document-ref
    with `WITH`, an unknown exception, a reference with `+`) and let the
    corpus record each answer.
- Unit tests apply the mutate-the-edges discipline across malformed
  grammar, unknown ids, the `+` marker, `WITH` exceptions, `AND`/`OR`
  precedence and the ref forms.
- A round-trip property test builds its FastCheck arbitrary over the known
  SPDX id set rather than using raw `Schema.toArbitrary`: the AST's
  bare-`Schema.String` leaves make derivation emit ungrammatical
  identifiers, so the arbitrary composes grammatical expressions instead.


---
<!-- okf/conventions/no-barrel-re-exports.md -->
---
type: Convention
title: Only entrypoint files re-export; never a barrel or a namespace object
description: Restrict re-exports to src/index.ts and published subpath entrypoints; every other module imports explicitly, and grouped implementations that each reach a distinct engine are never collected into one binding.
status: stable
stale_after: "2027-03-13T00:00:00Z"
tags:
  - architecture
  - bundle
sources:
  - id: config-file-index
    resource: ../../packages/config-file/src/index.ts
  - id: config-file-codec
    resource: ../../packages/config-file/src/ConfigCodec.ts
generated:
  by: "okfit/claude-code"
  at: 2026-09-13T05:33:04Z
  body_sha256: 34b360c986fec3e21129ca358e4ed78fb507b90a9a462561b9bc1466a3b26c54
---

# Only entrypoint files re-export; never a barrel or a namespace object

Only entrypoint files — `src/index.ts` and any published subpath
entrypoints — may re-export. Every other module imports the values and
types it uses explicitly from their defining module: no intermediate
barrel files, no blanket `export * from` facades, and no re-exporting a
dependency's surface. Two failure modes justify the rule, both observed
in this kit's predecessor libraries: a blanket re-export facade creates a
phantom dependency nothing in `src/` actually uses, and entrypoint-based
static wiring couples module load order to the entrypoint, forcing
`sideEffects` declarations and deep imports on consumers.

## A namespace object is a barrel in different syntax, and a worse one

`export const Codecs = { json, jsonc, yaml, toml }` collects independent
implementations behind one binding exactly as `export *` collects
independent modules behind one module. It is worse because a bundler can
see through a re-export barrel — the named exports stay individually
reachable — but a namespace object is a **single live binding**:
reference it at all and every member is reachable, so every member's
whole module graph is retained. The failure is silent: no error, no
warning, just a bundle carrying engines the consumer never named.

## The worked example: config-file's four codecs

`@effected/config-file` holds every config codec, but the `jsonc`, `yaml`
and `toml` format packages stay independent, and the four codecs —
`JsonCodec`, `JsoncCodec`, `YamlCodec`, `TomlCodec` — are exported as
free-standing named exports, one per module, never collected into a
namespace object.[^config-file-index] `ConfigCodec` is the interface
only; there is no runtime value that groups the four
implementations.[^config-file-codec]

Collecting them into `export const Codecs = { JsonCodec, JsoncCodec,
YamlCodec, TomlCodec }` would drag every parsing engine — the JSONC, YAML
and TOML engines alike — into a JSON-only consumer's bundle, killing
tree-shaking silently: with the codecs as free-standing named exports, a
consumer importing only `JsonCodec` bundles a few hundred bytes; grouped
into one object, importing anything from that object would pull in all
three other engines too. Never collect the codecs into a namespace
object.

## `"sideEffects": false` does not answer this for an unbundled consumer

The entrypoint permission above is stated against bundlers, where a
barrel's named exports stay individually reachable and a tree-shaker
retains only what is named. An unbundled Node consumer has no
tree-shaker: importing one binding from `src/index.ts` evaluates that
module, which evaluates every module it re-exports, loading the whole
module graph regardless of `sideEffects: false`. The only mechanism that
answers "does a consumer that wants one class pay for the rest of the
package" is a published subpath entrypoint, reserved for a genuinely
heavy optional part of a package rather than reached for as a matter of
taste.

## When grouping is still allowed

Grouped statics are not banned outright. A set of variants of one
concept that live in one module and reach nothing heavier than each
other may be grouped — `MergeStrategy`'s `firstMatch`/`layeredMerge` pair
in `@effected/config-file` is exactly this shape. The hazard scales with
what sits behind each member: group siblings that share a module and a
dependency footprint; never group siblings that each drag in a distinct
engine. When in doubt, split — the cost of a separate module is one line
in `index.ts`, and the cost of getting it wrong is invisible until
someone measures the bundle.

### A sanctioned grouped-statics container is a class, not an `as const` object

Where grouping is warranted, the container is a `class` with a private
constructor and `static readonly` members, never
`export const X = { … } as const`. An `as const` object infers its member
types into the built `.d.ts`, and inference drops every member's doc
comment, so the documentation a package wrote for that surface becomes
invisible in a consumer's IDE. Call syntax is identical between the two
forms — this is a house-form rule about how the sanctioned group is
spelled, not a rule about whether grouping is allowed, and the two must
not be collapsed into one another: the namespace-object ban is about
*what* may be grouped and is load-bearing for bundle weight; this is
about *how* the sanctioned group is spelled and is load-bearing for docs.

[^config-file-index]: `packages/config-file/src/index.ts:33-38` —
    `JsonCodec`, `JsoncCodec`, `TomlCodec` and `YamlCodec` exported as
    separate named bindings, one import per line.
[^config-file-codec]: `packages/config-file/src/ConfigCodec.ts:55-56` —
    the four codecs "are free-standing named exports, one per module."


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
