# toml (lab port of @effected/toml)

[![npm](https://img.shields.io/npm/v/@effected%2Ftoml?label=npm&color=cb3837)](https://www.npmjs.com/package/@effected/toml)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

Zero-dependency TOML 1.1.0 parsing, editing and formatting expressed as Effect schemas and pure functions. Parse TOML into plain values or a byte-exact linear CST, compute comment-preserving edits, format, modify by path, walk a document as a `Stream`, and decode straight into a validated domain schema.

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

## Why @effected/toml

TOML is the config format behind `Cargo.toml`, `pyproject.toml` and a large share of the Rust and Python toolchains — files that people maintain by hand and comment heavily. Most JavaScript TOML libraries round-trip through a plain-object model, which loses every comment and blank line the moment you write the file back out.

The engine here is written from scratch against the TOML 1.1.0 spec, and it is the only format package in this repo that vendors no upstream code at all. Parsing accepts everything 1.1 added — newlines, comments and trailing commas inside inline tables, optional seconds in times, and the `\e` and `\xHH` string escapes — while `Toml.stringify` deliberately emits 1.0 spellings, which are valid 1.1, so documents this package writes stay readable by 1.0-only consumers. It parses into a lossless linear CST whose expression spans tile the source byte-exact, so `TomlDocument.parse(text).stringify()` reproduces the original text exactly for any valid document. There is no separate re-serialization path that can drift from the source. Edits are byte-minimal splices against that CST, so formatting and path-based modification preserve every comment and every byte you did not touch.

The value model is honest about TOML's types rather than flattening them into JavaScript's. Integers past ±(2^53 − 1) decode to `bigint` instead of silently losing precision, and TOML's four date-time types decode to four calendar-validated value classes instead of a `Date` that cannot represent a local time. TOML has no null, so `Toml.stringify` on a value containing `null` fails with a structured `UnsupportedValue` diagnostic naming the offending path rather than dropping the key. Every fallible entry point carries a typed error built from `TomlDiagnostic`, and nesting-depth guards on both the parse and the stringify side mean hostile input fails through that channel rather than as a stack overflow.

## Install

```bash
npm install @effected/toml effect
```

```bash
pnpm add @effected/toml effect
```

Requires Node.js >=24.11.0. `effect` v4 is a peer dependency; the package itself adds no other runtime dependencies.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

## Quick start

Compose your schema with `Toml.schema` to decode TOML straight into a validated domain value, or reach for the pre-bound `Toml.TomlFromString` codec when you just want the plain value:

```ts
import { Toml } from "@effected/toml";
import { Effect, Schema } from "effect";

const Config = Schema.Struct({ name: Schema.String, port: Schema.Number });
const ConfigFromToml = Toml.schema(Config);

const program = Effect.gen(function* () {
  return yield* Schema.decodeUnknownEffect(ConfigFromToml)(`
    name = "api"
    port = 3000
  `);
});

Effect.runPromise(program).then(console.log);
// { name: "api", port: 3000 }
```

`Toml.stringify` goes the other way, emitting canonical TOML:

```ts
import { Toml } from "@effected/toml";
import { Effect } from "effect";

Effect.runPromise(Toml.stringify({ title: "app", server: { port: 8080 } })).then(console.log);
// title = "app"
//
// [server]
// port = 8080
```

## Editing without losing comments

`TomlFormat.modify` computes a `TomlEdit` array against the parsed CST; `modifyToString` applies it in one step. Comments, blank lines and layout that an edit does not cover come through byte-identical:

```ts
import { TomlFormat } from "@effected/toml";
import { Effect } from "effect";

const source = `# server config
name = "api"
port = 3000 # dev default
`;

Effect.runPromise(TomlFormat.modifyToString(source, ["port"], 8080)).then(console.log);
// # server config
// name = "api"
// port = 8080 # dev default
```

## Value model

TOML's types do not all have a JavaScript equivalent, so the ones that do not get a real one:

| TOML | Decodes to |
| ---- | ---------- |
| Integer within ±(2^53 − 1) | `number` |
| Integer beyond ±(2^53 − 1), inside the 64-bit range | `bigint` — precision is never silently lost |
| Integer outside the 64-bit range | fails with an `IntegerOutOfRange` diagnostic |
| Offset date-time (`1979-05-27T07:32:00Z`) | `TomlOffsetDateTime` |
| Local date-time (`1979-05-27T07:32:00`) | `TomlLocalDateTime` |
| Local date (`1979-05-27`) | `TomlLocalDate` |
| Local time (`07:32:00`) | `TomlLocalTime` |

The four date-time classes are `Schema.Class` value objects with real Gregorian-calendar validation and structural equality, not `Date` subclasses: JavaScript's `Date` has no way to represent a date with no time, or a time with no offset.

TOML cannot represent `null` at all. Rather than dropping the key or writing an empty string, `Toml.stringify` fails:

```ts
import { Toml } from "@effected/toml";
import { Effect } from "effect";

Effect.runPromise(Effect.result(Toml.stringify({ a: null }))).then(console.log);
// Failure with TomlStringifyError, whose `diagnostic` carries:
// { code: "UnsupportedValue", message: "unsupported null value at a", ... }
```

## Features

- `Toml.parse` / `Toml.stringify` — value-level parse and canonical stringify, both carrying typed `TomlParseError` / `TomlStringifyError` channels, including nesting-depth guards on adversarial input.
- `Toml.fromString` / `Toml.TomlFromString` / `Toml.schema` — string→domain schema factories that decode TOML directly into a validated Effect `Schema` value.
- `TomlDocument` — the lossless document: `parse`, `schema`, `toValue` and `stringify`, backed by the linear CST whose expression spans reconstruct the source byte-exact.
- `TomlEdit` / `TomlRange` (with `applyAll`) — the non-mutating text-edit vocabulary shared by the formatter and the modifier, and identical in shape to `@effected/jsonc`'s and `@effected/yaml`'s.
- `TomlFormat` — `format` and `formatToString` compute conservative, comment-preserving formatting edits; `modify` and `modifyToString` compute the edits to replace, delete or insert a value at a path.
- `TomlVisitor` — walk a parsed document as a `Stream` of visitor events.
- `TomlDiagnostic` — the structured diagnostic (`code`, `message`, `offset`, `length`, `line`, `character`) every typed error carries, across five staged error-code unions.
- `TomlLocalDate` / `TomlLocalTime` / `TomlLocalDateTime` / `TomlOffsetDateTime` — TOML's date-time types as calendar-validated `Schema.Class` value objects.

## Conformance

The engine runs the [toml-test](https://github.com/toml-lang/toml-test) compliance corpus — its `files-toml-1.1.0` subset, 214 valid cases and 467 invalid ones — to a 100% pass rate with no skip list, and a differential property suite cross-checks it against an independent TOML parser. Both oracles are devDependency-only; neither reaches your runtime.

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/toml` 0.11.1
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- Vendored-engine notices: none found in source headers.

### Added exports

None.

### Deviations

None.

### Dependency backlog

None.
