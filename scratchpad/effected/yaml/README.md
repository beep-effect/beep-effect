# yaml (lab port of @effected/yaml)

[![npm](https://img.shields.io/npm/v/@effected%2Fyaml?label=npm&color=cb3837)](https://www.npmjs.com/package/@effected/yaml)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

Zero-dependency YAML 1.2 parsing, editing, formatting and linting expressed as Effect schemas and pure functions. Parse a single document or a multi-document stream into plain values or an offset-preserving AST, resolve anchors and aliases, read and preserve per-node comments, strip comments, compute byte-minimal edits, format, modify by path, walk a document as a `Stream` of AST events or positioned tokens, lint it against a rule catalog with surgical autofix — inferring the lint config from files you already have — and decode straight into a validated domain schema.

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

## Why @effected/yaml

YAML is where untrusted text meets production systems: CI pipeline definitions, Kubernetes manifests and config files that arrive from a pull request, an API payload or a user's home directory. The format is also large enough that a parser has real attack surface. An anchor that references an anchor that references an anchor — the "billion laughs" bomb — is a few hundred bytes of YAML that expands into gigabytes of nodes, and a deeply nested flow collection is a few kilobytes that overflows a recursive-descent parser's stack.

This package treats that as a first-class requirement rather than a footnote. An alias-expansion budget bounds the number of materialized nodes, a depth cap bounds collection nesting on both the parse and the stringify side, and both fire into the typed error channel. Hostile input produces a `YamlParseError` carrying structured `YamlDiagnostic` values with codes and positions; it never produces a `RangeError`, an unhandled defect or an exhausted heap.

The rest follows from the same discipline. Parsing recovers from errors and aggregates every diagnostic into one failure rather than throwing on the first. Modifications are computed as edits against the original bytes, so comments and layout survive a change. Everything is a pure function or a schema: no IO, no services and no runtime dependency other than `effect` — the lexer, CST parser, composer and stringifier are vendored into the package with attribution rather than taken as a dependency. It is the largest package in the repo, and it earns that by owning its engine.

## Install

```bash
npm install @effected/yaml effect
```

```bash
pnpm add @effected/yaml effect
```

Requires Node.js >=24.11.0. `effect` v4 is a peer dependency; the package itself adds no other runtime dependencies.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

## Quick start

Compose your schema with `Yaml.schema` to decode YAML straight into a validated domain value:

```ts
import { Yaml } from "@effected/yaml";
import { Effect, Schema } from "effect";

const Config = Schema.Struct({ port: Schema.Number });
const ConfigFromYaml = Yaml.schema(Config);

const program = Effect.gen(function* () {
  return yield* Schema.decodeUnknownEffect(ConfigFromYaml)("port: 3000 # dev server");
});

Effect.runPromise(program).then(console.log);
// { port: 3000 }
```

`Yaml.stringify` goes the other way, failing typed on circular references rather than throwing:

```ts
import { Yaml } from "@effected/yaml";
import { Effect } from "effect";

Effect.runPromise(Yaml.stringify({ port: 3000, hosts: ["a", "b"] })).then(console.log);
// port: 3000
// hosts:
// - a
// - b
```

Both directions have a synchronous counterpart that returns a `Result` for callers that cannot await an Effect, a `vitest.config.ts` being the motivating case. `Yaml.parse` is defined in terms of `Yaml.parseResult`, so the two forms cannot disagree about what a document means:

```ts
import { Yaml } from "@effected/yaml";
import { Result } from "effect";

const result = Yaml.parseResult("port: 3000 # dev server");
console.log(Result.isSuccess(result) ? result.success : result.failure);
// { port: 3000 }
```

## Hostile input fails typed

An alias bomb — nested anchors whose expansion multiplies at every level — is bounded by an expansion budget and surfaces as a `YamlParseError`, not as an out-of-memory kill:

```ts
import { Yaml } from "@effected/yaml";
import { Effect } from "effect";

const bomb = [
  "a: &a [x,x,x,x,x,x,x,x,x]",
  "b: &b [*a,*a,*a,*a,*a,*a,*a,*a,*a]",
  // ...further levels, each multiplying the one before
  "z: [*g,*g,*g,*g,*g,*g,*g,*g,*g]",
].join("\n");

Effect.runPromise(Effect.result(Yaml.parse(bomb))).then(console.log);
// Failure with YamlParseError, whose `diagnostics` carry:
// { code: "AliasCountExceeded", message: "Alias expansion exceeded budget of ... nodes" }
```

Collection nesting past the depth cap behaves the same way, yielding a `NestingDepthExceeded` diagnostic instead of a stack overflow, and `Yaml.stringify` caps the mirror-image recursion when encoding a value back to text. The guarantee is the same everywhere: every fallible entry point carries a real error channel, and nothing reaches your process as a defect.

## Comments survive an edit

A YAML file a human maintains is mostly explanation, and the explanation is the part a round-trip usually loses. `YamlFormat` computes its edits against the original bytes, so changing a value rewrites the value and leaves the header block, the trailing `# LTS`, the blank line and the indentation where they were. Setting `preserveComments: false` is how you ask for the other behavior:

```ts
import { YamlFormat, YamlFormattingOptions } from "@effected/yaml";

const source = 'node: "20.11.0" # LTS\n\n# why the port\nport: 3000\n';

console.log(YamlFormat.formatToString(source));
// node: "20.11.0" # LTS
//
// # why the port
// port: 3000

console.log(YamlFormat.formatToString(source, undefined, YamlFormattingOptions.make({ preserveComments: false })));
// node: "20.11.0"
// port: 3000
```

Comments are readable as data too. Every node class — `YamlScalar`, `YamlMap`, `YamlSeq` and `YamlAlias` — carries `commentBefore` (the own-line block above the node), `comment` (strictly the trailing comment on the node's own line) and `spaceBefore` (a blank line came first). `YamlPair` carries none of them: an entry is its `key` and its `value`, and the comments live on those two nodes. `YamlDocument` uses the same two names as the nodes do, `commentBefore` for a header block sitting ahead of a `---` marker and `comment` for the trailing block, and `YamlVisitor` tags every `Comment` event with `placement: "leading" | "trailing"`.

Which node a comment lands on follows one rule. An own-line comment above an entry leads that entry's key node, setting `commentBefore` and — when a blank line came first — `spaceBefore`. A trailing comment belongs to the last node on its line: in `a: 1 # t` the value ends the line, so `# t` is the value's `comment`; in `push: # only main` the value renders below, so the comment is the key's. Two slots per entry rather than one is what lets `push: # only main` and an own-line comment above the value both round-trip byte-intact, instead of one spelling being rewritten into the other. A header block with no `---` marker to separate it from the item stream leads the first entry's key by the same rule; one after the marker leads the root node.

## Lint and autofix

`YamlLint.run` checks a string against a rule catalog and returns positioned diagnostics; `YamlLint.fix` applies the fixes that can be expressed as surgical edits and returns the fixed text. Both are pure and synchronous. This is the lint engine, not a runner — no file discovery, no config-file loading, nothing written to disk:

```ts
import { YamlLint, YamlLintConfig } from "@effected/yaml";
import { Result } from "effect";

const source = "# pinned\nname:  demo   \nport: yes\n";

for (const d of YamlLint.run(source, YamlLint.builtins, YamlLintConfig.default)) {
  console.log(`${d.line}:${d.character} ${d.severity} ${d.rule} ${d.message}`);
}
// 1:5 error colon-spacing Too many spaces after ":" (2 > 1)
// 1:11 error trailing-spaces Trailing whitespace
// 2:6 error truthy Truthy value "yes" is not in the allowed spellings

const fixed = YamlLint.fix(source, YamlLint.builtins, YamlLintConfig.default);
console.log(Result.isSuccess(fixed) ? fixed.success : "fatal parse error — not safely fixable");
// # pinned
// name: demo
// port: "yes"
```

Positions are zero-based throughout, so the first finding above sits on the second line of the source. Fixes route through `YamlEdit.applyAll` rather than a reformat, so an autofix cannot move a comment it was not asked to touch, and a rule whose repair would need reflowing the document ships without a fix at all. `YamlLintConfig.default` and `YamlLintConfig.relaxed` are the presets; compose your own by spreading a preset's `rules` into `YamlLintConfig.make`. Config validation is rule-aware for the built-in catalog — a misspelled option key on a built-in rule or an attempt to switch off the always-on `parse-validity` rule fails schema validation instead of being quietly ignored — while an unknown (custom) rule id passes through with its options treated as opaque, left for the custom rule itself to validate. Custom rules are plain array concatenation — `YamlLint.run(text, [...YamlLint.builtins, myRule], config)` — and configuring `myRule` in that config works precisely because of the pass-through.

A repo with no lint config yet can infer one from what its files already do. `YamlLint.inferLenient` observes a text's style — quote type, indentation width, document markers and the rest — and returns the config the dominant style implies, plus the residual: the diagnostics that config still produces on the same text.

```ts
import { YamlLint } from "@effected/yaml";

const workflow = ["---", "name: ci", "on:", "  push:", "    branches: ['main']", "jobs:", "  build:", "    runs-on: ubuntu-latest", ""].join("\n");

const { config, residual } = YamlLint.inferLenient(workflow, YamlLint.builtins);
console.log(config.rules["quoted-strings"], config.rules["document-start"], config.rules.indentation);
// { quoteType: 'single' } { present: true } { spaces: 2 }

for (const d of residual) console.log(`${d.line}:${d.character} ${d.rule} ${d.message}`);
// 2:0 truthy Truthy value "on" is not in the allowed spellings
```

`YamlLint.inferStrict` is the same step in `Result` form: it fails with a structured `YamlStyleConflictError` — naming every conflicting dimension, all observed spellings, counts and positions — when the observed style disagrees with itself, instead of picking a winner. Across many files, compose the primitives instead of the conveniences: `YamlLint.observe` each file, merge the `StyleEvidence` values with `StyleEvidence.combine` (evidence is a monoid, so the order does not matter), then resolve once with `YamlLint.resolveStrict` or `YamlLint.resolveLenient`. Dimensions never observed fall back to the base config rather than failing. Policy rules with no detectable style — `truthy`, `key-duplicates` — stay default-driven, as do `line-length` and `empty-lines`, whose observations are floor-only: the longest line proves the limit is at least that long, not what it should be, so the evidence is carried but never resolved into config. A custom rule participates by implementing the optional `infer` hook on `YamlRule`.

## Migrating from Prettier

`YamlFormat.formatToString(text, undefined, options)` replaces a `prettier --write` over YAML files. The option mapping:

| Prettier | `YamlFormattingOptions` |
| --- | --- |
| `tabWidth` | `indent` |
| `singleQuote` | `quoteStyle: "single" \| "double"` + `requoteScalars: true` |
| indented block sequences (always on) | `indentSequences: true` |
| `printWidth` / `proseWrap` | no analog — see below |
| comments (best-effort) | `preserveComments: true` (the default) |

Two defaults differ from Prettier's output and are worth setting explicitly. The stringify default is `quoteStyle: "single"` for byte-compatibility with the kit's legacy form, so if you ran Prettier with its own default (`singleQuote: false`), set `quoteStyle: "double"`. Likewise `indentSequences` defaults to `false` — the flat legacy form with the `-` markers at the key's column — while Prettier always indented block sequences one level, so an ex-Prettier consumer almost certainly wants `indentSequences: true`.

The `requoteScalars: true` half of the `singleQuote` row is what buys full parity. By default, `quoteStyle` on the format path governs only quotes the stringifier *introduces* — a scalar already quoted in your source keeps its own quote style, so formatting `a: 'x'` with `quoteStyle: "double"` leaves `'x'` untouched, where Prettier would have rewritten it to `"x"`. With `requoteScalars: true` (default `false`), `quoteStyle` applies to already-quoted source scalars too. A re-quote happens only when it provably preserves the parsed value: single→double applies proper double-quote escaping, and double→single is skipped when the value carries characters single quotes cannot express. Plain scalars stay plain, block scalars stay block, and tagged, anchored and multi-line scalars are never touched. One interaction to watch: `quoteStyle` omitted defaults to `"single"`, so `requoteScalars: true` on its own converts `"x"` to `'x'` — an ex-Prettier consumer who ran with `singleQuote: false` wants `quoteStyle: "double"` alongside it.

`printWidth` and `proseWrap` have no analog here: `lineWidth` folding is a value-path feature only (`Yaml.stringify` / `Yaml.stringifyResult`), and the option is deliberately inert on the format path by contract — `YamlFormat` never reflows scalar content (the `lineWidth` TSDoc on `YamlStringifyOptions` pins this). Comments, which Prettier handled best-effort, are preserved exactly by default.

Multi-document streams — a Kubernetes manifest, or the two-document `pnpm-lock.yaml` pnpm 11 writes under `configDependencies` — format whole: every document is re-emitted in order with its own `---`/`...` framing and comments, so no document is ever dropped. Document detection is CST-level, so a `---` inside a block scalar or quoted string is content and formats normally. The formatter leaves input byte-identical rather than corrupting it in exactly two cases: a fatal parse error in any document, and a stream carrying `%YAML`/`%TAG` directives (which the emitter cannot re-emit faithfully). Validate a whole stream with `Yaml.parseAllResult`, which fails typed when any document carries a fatal diagnostic; `YamlFormat.modify` stays single-document, since a path names no particular document of a stream.

## Emitting for a YAML 1.1 consumer

YAML 1.2's Core Schema resolves fewer plain scalars to non-strings than YAML 1.1 does. A plain `on` or `yes` round-trips as a string under this package's own parser but becomes a boolean the moment a YAML 1.1 consumer — js-yaml, PyYAML, libyaml, the `yaml` npm package's YAML 1.1 schema, most CI systems' native YAML support — reads it back: the "Norway problem". `quoteCompat: "yaml-1.1"` closes that gap on the way out, quoting every plain scalar a 1.1 resolver would re-type: the extended booleans (`y`/`yes`/`no`/`on`/`off` and case variants), 1.1 timestamps, sexagesimal numbers (`1:30`), underscore-grouped numbers (`1_000`) and the octal/hex/binary integer forms (`0777`, `0x_FF`, `0b1010_0111`). It is strictly additive — nothing the 1.2 rules already quote loses a quote, and no string outside that list gains one — and composes with `quoteStyle` for the quote character and `lineWidth` for folding:

```ts
import { Yaml, YamlStringifyOptions } from "@effected/yaml";
import { Effect } from "effect";

const frontmatter = { node: "on", released: "2024-01-15", port: "yes" };
const options = YamlStringifyOptions.make({ lineWidth: 0, quoteCompat: "yaml-1.1", quoteStyle: "double" });

Effect.runPromise(Yaml.stringify(frontmatter, options)).then(console.log);
// node: "on"
// released: "2024-01-15"
// port: "yes"
```

That combination — `lineWidth: 0` (no folding), `quoteCompat: "yaml-1.1"`, `quoteStyle: "double"` — is the shape to reach for when stringifying frontmatter destined for YAML-1.1 tooling: Markdown frontmatter parsers and most static-site generators still resolve on the older rules. The option applies on both the value path (`Yaml.stringify`, `Yaml.stringifyResult`) and the node path (`YamlDocument#stringify`, `YamlFormat`), and scalars carrying an explicit tag are exempt, exactly like the 1.2 type-conflict check it extends.

## Features

- `Yaml.parse` / `Yaml.parseAll` — error-recovery parsing of a single document or a `---`-separated stream into plain values, resolving anchors and aliases and aggregating every diagnostic into one `YamlParseError`.
- `Yaml.stringify` — serialize a plain value back to YAML, failing typed with `YamlStringifyError` on circular references or on excessively deep nesting; a block-mapping key too long to render on one line spills into explicit-key form (`? key` / `: value`) so strict parsers still accept the output; `quoteCompat: "yaml-1.1"` additionally quotes plain scalars a YAML 1.1 resolver would re-type.
- `Yaml.parseResult` / `Yaml.parseAllResult` / `Yaml.stringifyResult` — the pure synchronous counterparts, returning a `Result` instead of an `Effect` for config-time callers that cannot await; each runs the same engine call as its `Effect` variant, so the two forms cannot diverge, and a fatal diagnostic, a duplicate key, an alias bomb or a circular reference still fails typed rather than throwing. `parseAllResult` doubles as a whole-stream validity check: it fails when any document in the stream is invalid.
- `Yaml.stripComments` — quote-aware comment removal that keeps line numbers stable, or every byte offset stable when given a replacement character.
- `Yaml.equals` / `Yaml.equalsValue` — semantic equality that ignores comments, whitespace, formatting and mapping key order while keeping sequence order significant.
- `Yaml.schema` / `Yaml.fromString` / `Yaml.YamlFromString` / `Yaml.allFromString` — string→domain schema factories that decode a single document or a whole stream into a validated Effect `Schema` value.
- `YamlNode` — an offset-preserving AST (`YamlScalar`, `YamlMap`, `YamlSeq`, `YamlPair`, `YamlAlias`) for locating and reading nodes by position or path; every node class except `YamlPair` carries its own `commentBefore`, `comment` and `spaceBefore`, and a pair is just its `key` and `value`.
- `YamlDocument` — the full parsed AST plus the recovered `errors` and `warnings` arrays, so a partially valid document is still inspectable, and the header and trailing comment blocks as `commentBefore` / `comment`, the same two names the node classes use.
- `YamlEdit` / `YamlFormat` — compute byte-minimal edit arrays for formatting and path-based modification, so a change preserves every comment and byte you did not touch; `preserveComments: false` opts out, and opt-in `requoteScalars` applies `quoteStyle` to scalars already quoted in the source, semantics-preserving or skipped. `format` handles multi-document streams whole, re-emitting every document and its framing; `modify` is single-document by contract (a path names no particular document of a stream) and fails typed with `MultiDocumentStream` rather than guessing.
- `YamlVisitor` — walk a parsed document as a `Stream` of a tagged-enum event union, with `Stream.take` early termination on large inputs and a `placement` on every comment event.
- `YamlToken` / `YamlTokens` — the positioned token stream the lint rules read: `tokenize` is a synchronous `Result` that always succeeds, surfacing lexical problems as `error`-kind tokens, and `stream` derives an Effect `Stream` from the same walk.
- `YamlLint` — `run`, `fix` and the `builtins` catalog: 14 rules covering parse validity, line length, trailing whitespace, blank lines, end-of-file newline, document markers, duplicate keys, quoting, truthy spellings, comment and colon and hyphen spacing, and indentation. Plus config inference for adopting the linter on an existing corpus: `observe` produces mergeable `StyleEvidence`, `resolveStrict` fails typed with `YamlStyleConflictError` on conflicting spellings, `resolveLenient` picks the dominant style, and `inferStrict` / `inferLenient` do it in one step per text.
- `YamlLintConfig` / `YamlLintRule` / `YamlLintDiagnostic` — the `default` and `relaxed` presets, a config schema validated against the rule catalog, and the model a custom rule implements, including the optional `infer` hook that lets a custom rule participate in config inference.
- `YamlParseError` / `YamlStringifyError` / `YamlModificationError` — tagged errors carrying structured, positional `YamlDiagnostic` arrays rather than opaque messages.

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/yaml` 0.19.1
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- scratchpad/effected/yaml/internal/rules/catalog.ts:4 // not a re-export barrel; rules are imported from their own modules.

### Added exports

None.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — Effect hash collections, Record/Predicate helpers, typed dispatch and Array/Order sorting replace native Map/Set, Object helpers, typeof, switches and sorting, with ordered catalog entries retained separately (scratchpad/test/yaml/YamlNode.test.ts:116; scratchpad/test/yaml/core-regressions.test.ts:77; scratchpad/test/yaml/stringifier-regressions.test.ts:174; module suite scratchpad/test/yaml/**)
- **identity-keys** — Per-traversal ancestor stacks scanned with === replace the formatter and stringifier identity Sets while preserving cycles, shared references and structurally equal distinct values (scratchpad/test/yaml/YamlFormat.test.ts:669; scratchpad/test/yaml/YamlFormat.test.ts:682; scratchpad/test/yaml/YamlFormat.test.ts:690; scratchpad/test/yaml/stringifier-regressions.test.ts:134)
- **tagged-errors** — Schema-backed tagged errors with make/static factories and schema guards replace native Error classes and invariant throws, retaining budget/reason text and adding schema tags (scratchpad/test/yaml/core-regressions.test.ts:98; scratchpad/test/yaml/core-regressions.test.ts:114; scratchpad/test/yaml/stringifier-regressions.test.ts:142; scratchpad/test/yaml/stringifier-regressions.test.ts:159; scratchpad/test/yaml/YamlEdit.test.ts)
- **schema-first** — LiteralKit domains, schema-derived payload/event types, hoisted schema guards and a schema JSON Result codec replace named S.Literals, handwritten payload types, instanceof checks and native JSON rendering (scratchpad/test/yaml/core-regressions.test.ts:138; scratchpad/test/yaml/core-regressions.test.ts:149; scratchpad/test/yaml/composer-regressions.test.ts:91; scratchpad/test/yaml/YamlVisitor.test.ts:128; scratchpad/test/yaml/rules/util.test.ts; module suite scratchpad/test/yaml/**)
- **numeric-domains** — Finite schemas replace unrestricted numeric fields, tagged NonFiniteIndex values echo failed non-finite paths, and rule integer predicates retain acceptance outside the safe range (scratchpad/test/yaml/YamlFormat.test.ts:792; scratchpad/test/yaml/YamlFormat.test.ts:826; scratchpad/test/yaml/rules/util.test.ts:22; module suite scratchpad/test/yaml/**)
- **type-safety** — Explicit narrowing and the sanctioned deliberatelyInvalid test helper replace unchecked casts, with direct rule fields defaulted independently rather than relying on coercion or truthiness (scratchpad/test/yaml/rules/option-isolation.test.ts:17; scratchpad/test/yaml/rules/spacing-regressions.test.ts:52; scratchpad/test/yaml/rules/spacing-regressions.test.ts:69; scratchpad/test/yaml/deliberatelyInvalid.ts; module suite scratchpad/test/yaml/**)
- **tsgo-diagnostics** — Diagnostic-required dual overloads, resolveScalar context tuples, typed rest signatures and make construction replace fixed positional declarations and new schema construction (scratchpad/test/yaml/composer-regressions.test.ts:20; scratchpad/test/yaml/composer-regressions.test.ts:26; scratchpad/test/yaml/composer-regressions.test.ts:34; scratchpad/test/yaml/fold.test.ts:15; module suite scratchpad/test/yaml/**)
- **effect-first** — Effect.fn encoding, Effect-native helpers and consolidated Option property reconstruction replace callback-returned Effect.gen, native helper operations and separate optional spreads (module suite scratchpad/test/yaml/**)
- **effect-imports** — Per-module effect/<Module> imports replace root effect barrel imports throughout yaml source and tests (module suite scratchpad/test/yaml/**)
- **identity-annotations** — Composer-derived schema identities and field metadata replace short class identifiers and unannotated domains, unions and payloads (scratchpad/test/yaml/core-regressions.test.ts:138; scratchpad/test/yaml/stringifier-regressions.test.ts:159; scratchpad/test/yaml/rules/util.test.ts:10; module suite scratchpad/test/yaml/**)
- **test-environment** — The lint structural pin reads the lab effected/yaml directory instead of upstream ../src while retaining the same import-boundary assertion (scratchpad/test/yaml/YamlLint.test.ts:298)
- **upstream-bug** — Lexical comment stripping preserves block-scalar hash content that the upstream character scanner removes (scratchpad/test/yaml/core-regressions.test.ts:43)
- **upstream-bug** — Lexical comment stripping removes real trailing comments after plain apostrophes that the upstream scanner treats as quoted content (scratchpad/test/yaml/core-regressions.test.ts:52)
- **upstream-bug** — Comment replacement preserves CRLF bytes that upstream comment scanning overwrites before LF (scratchpad/test/yaml/core-regressions.test.ts:58)
- **upstream-bug** — Percent-decoded tag suffixes resolve encoded integer tags as numbers instead of upstream literal-tag strings (scratchpad/test/yaml/core-regressions.test.ts:187)
- **upstream-bug** — Malformed percent suffixes produce positioned diagnostics during scalar resolution and explicit CST validation instead of remaining literal without those diagnostics (scratchpad/test/yaml/core-regressions.test.ts:196; scratchpad/test/yaml/core-regressions.test.ts:209)
- **upstream-bug** — Folded rendering preserves more-indented scalar content instead of adding the upstream compensation newline, also repairing corpus cases F6MC/R4YG (scratchpad/test/yaml/fold.test.ts:45; scratchpad/test/yaml/fold.test.ts:50; scratchpad/test/yaml/e2e/format-properties.e2e.test.ts:74)
- **upstream-bug** — AST bigint rendering preserves unquoted numeric values and raw spelling instead of upstream quoted strings (scratchpad/test/yaml/stringifier-regressions.test.ts:59; scratchpad/test/yaml/stringifier-regressions.test.ts:76; scratchpad/test/yaml/stringifier-regressions.test.ts:89)
- **upstream-bug** — Canonical preprocessing raises StringifyDepthExceeded at the nesting limit instead of overflowing upstream recursion with RangeError (scratchpad/test/yaml/stringifier-regressions.test.ts:96; scratchpad/test/yaml/stringifier-regressions.test.ts:115)
- **upstream-bug** — Parent-indent search skips verbatim tag punctuation instead of treating its URI colon as a delimiter and losing block-scalar content (scratchpad/test/yaml/composer-regressions.test.ts:50)
- **upstream-bug** — Populated flow entries reject a second structural colon without a comma instead of accepting an invented empty key (scratchpad/test/yaml/composer-regressions.test.ts:56)
- **upstream-bug** — Flow separator validation accepts folded multiline scalar values in maps and implicit sequence mappings instead of upstream missing-comma errors (scratchpad/test/yaml/composer-regressions.test.ts:69; scratchpad/test/yaml/composer-regressions.test.ts:75)
- **upstream-bug** — An explicit empty flow key is materialized at its comma boundary instead of consuming the next entry as upstream does (scratchpad/test/yaml/composer-regressions.test.ts:91)
- **upstream-bug** — YAML directives reject malformed major.minor version tokens that upstream accepts (scratchpad/test/yaml/composer-regressions.test.ts:107)
- **upstream-bug** — TAG directives reject missing or extra parameters instead of upstream permissive arity (scratchpad/test/yaml/composer-regressions.test.ts:107)
- **upstream-bug** — Scanner and public token positions count lone CR and CRLF consistently instead of leaving lone-CR tokens on the preceding line (scratchpad/test/yaml/lexer.test.ts:58; scratchpad/test/yaml/YamlToken.test.ts:102; scratchpad/test/yaml/YamlToken.test.ts:111)
- **upstream-bug** — Trailing plain-scalar whitespace is emitted separately and retained in token/CST spans instead of disappearing from upstream EOF coverage (scratchpad/test/yaml/lexer.test.ts:85; scratchpad/test/yaml/e2e/token-fidelity.e2e.test.ts:86)
- **upstream-bug** — CST compact mapping events classify contained first keys correctly instead of upstream key/value reversal (scratchpad/test/yaml/cst-visitor.test.ts:24)
- **upstream-bug** — CST entry boundaries preserve subsequent key/value roles after omitted values instead of upstream alternating-state drift (scratchpad/test/yaml/cst-visitor.test.ts:26; scratchpad/test/yaml/cst-visitor.test.ts:27; scratchpad/test/yaml/cst-visitor.test.ts:28; scratchpad/test/yaml/cst-visitor.test.ts:29)
- **upstream-bug** — Interior-CRLF diagnostic offsets yield character zero instead of the upstream negative column (scratchpad/test/yaml/YamlDiagnostic.test.ts:24)
- **upstream-bug** — Indentation checks and inference retain ordinary ---key/...key lines instead of discarding them as upstream document markers (scratchpad/test/yaml/rules/indentation.test.ts:87; scratchpad/test/yaml/rules/indentation.test.ts:93; scratchpad/test/yaml/rules/indentation.test.ts:141; scratchpad/test/yaml/rules/indentation.test.ts:146)
- **upstream-bug** — Indentation checks and inference preserve quoted hash keys instead of stripping their scalar content as upstream comments (scratchpad/test/yaml/rules/indentation.test.ts:99; scratchpad/test/yaml/rules/indentation.test.ts:105; scratchpad/test/yaml/rules/indentation.test.ts:151; scratchpad/test/yaml/rules/indentation.test.ts:156)
- **upstream-bug** — Indentation stacks include compact mapping columns so compact and expanded layouts agree instead of upstream false diagnostics and mixed votes (scratchpad/test/yaml/rules/indentation.test.ts:117; scratchpad/test/yaml/rules/indentation.test.ts:123; scratchpad/test/yaml/rules/indentation.test.ts:129; scratchpad/test/yaml/rules/indentation.test.ts:166)
- **upstream-bug** — Leading-BOM own-line comments avoid upstream false before-spacing diagnostics, fixes and votes while after-hash and inline-BOM checks remain (scratchpad/test/yaml/rules/spacing-regressions.test.ts:19; scratchpad/test/yaml/rules/spacing-regressions.test.ts:26; scratchpad/test/yaml/rules/spacing-regressions.test.ts:38)
- **upstream-bug** — Hyphen-spacing diagnostics omit destructive fixes for continued compact collections instead of changing upstream parsed values, while safe fixes remain available (scratchpad/test/yaml/rules/spacing-regressions.test.ts:109; scratchpad/test/yaml/rules/spacing-regressions.test.ts:128)

### Dependency backlog

None.
