# toml (lab port of @effected/toml)

Zero-dependency TOML 1.1.0 parsing, editing and formatting expressed as Effect schemas and pure functions. Parse TOML into plain values or a byte-exact linear CST, compute comment-preserving edits, format, modify by path, walk a document as a `Stream`, and decode straight into a validated domain schema.

## Why @effected/toml

TOML is the config format behind `Cargo.toml`, `pyproject.toml` and a large share of the Rust and Python toolchains — files that people maintain by hand and comment heavily. Most JavaScript TOML libraries round-trip through a plain-object model, which loses every comment and blank line the moment you write the file back out.

The engine here is written from scratch against the TOML 1.1.0 spec, and it is the only format package in this repo that vendors no upstream code at all. Parsing accepts everything 1.1 added — newlines, comments and trailing commas inside inline tables, optional seconds in times, and the `\e` and `\xHH` string escapes — while `Toml.stringify` deliberately emits 1.0 spellings, which are valid 1.1, so documents this package writes stay readable by 1.0-only consumers. It parses into a lossless linear CST whose expression spans tile the source byte-exact, so `TomlDocument.parse(text).stringify()` reproduces the original text exactly for any valid document. There is no separate re-serialization path that can drift from the source. Edits are byte-minimal splices against that CST, so formatting and path-based modification preserve every comment and every byte you did not touch.

The value model is honest about TOML's types rather than flattening them into JavaScript's. Integers past ±(2^53 − 1) decode to `bigint` instead of silently losing precision, and TOML's four date-time types decode to four calendar-validated value classes instead of a `Date` that cannot represent a local time. TOML has no null, so `Toml.stringify` on a value containing `null` fails with a structured `UnsupportedValue` diagnostic naming the offending path rather than dropping the key. Every fallible entry point carries a typed error built from `TomlDiagnostic`, and nesting-depth guards on both the parse and the stringify side mean hostile input fails through that channel rather than as a stack overflow.

## Quick start

Compose your schema with `Toml.schema` to decode TOML straight into a validated domain value, or reach for the pre-bound `Toml.TomlFromString` codec when you just want the plain value:

```ts
import { Toml } from "@beep/scratchpad/effected/toml/Toml";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const Config = S.Struct({ name: S.String, port: S.Number });
const ConfigFromToml = Toml.schema(Config);

const program = Effect.gen(function* () {
  return yield* S.decodeUnknownEffect(ConfigFromToml)(`
    name = "api"
    port = 3000
  `);
});

console.log(JSON.stringify(Effect.runSync(program))); // {"name":"api","port":3000}
```

`Toml.stringify` goes the other way, emitting canonical TOML:

```ts
import { Toml } from "@beep/scratchpad/effected/toml/Toml";
import * as Effect from "effect/Effect";

console.log(Effect.runSync(Toml.stringify({ title: "app", server: { port: 8080 } })));
// title = "app"
//
// [server]
// port = 8080
```

## Editing without losing comments

`TomlFormat.modify` computes a `TomlEdit` array against the parsed CST; `modifyToString` applies it in one step. Comments, blank lines and layout that an edit does not cover come through byte-identical:

```ts
import { TomlFormat } from "@beep/scratchpad/effected/toml/TomlFormat";
import * as Effect from "effect/Effect";

const source = `# server config
name = "api"
port = 3000 # dev default
`;

console.log(Effect.runSync(TomlFormat.modifyToString(source, ["port"], 8080)));
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
import { Toml } from "@beep/scratchpad/effected/toml/Toml";
import * as Result from "effect/Result";

const result = Toml.stringifyResult({ a: null });
if (Result.isFailure(result)) {
  console.log(result.failure.message); // TOML stringify failed: UnsupportedValue unsupported null value at a
}
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

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — Lab uses MutableHashMap, Record and DateTime helpers plus ancestor arrays where upstream used Map, Object helpers, native Date construction and Set. (scratchpad/test/toml/Toml.test.ts:148,223,232; scratchpad/test/toml/semantic.test.ts:298; scratchpad/test/toml/TomlFormat.test.ts)
- **identity-keys** — Lab detects cycles through branch-local ancestor arrays scanned with === where upstream used a mutable identity Set. (scratchpad/test/toml/Toml.test.ts:223,232; scratchpad/test/toml/hostile.test.ts:143,156)
- **tagged-errors** — Lab uses schema-backed tagged raw, cap and invariant errors and diagnostic snapshots where upstream used native errors and unchecked element access. (scratchpad/test/toml/TomlDiagnostic.test.ts:69; scratchpad/test/toml/TomlEdit.test.ts:32; scratchpad/test/toml/Toml.test.ts:40,62; module suite scratchpad/test/toml/**)
- **schema-first** — Lab adds schema authority, LiteralKit domains, schema or tag guards and a JSON codec where upstream used type-only models, literal schemas, instanceof and JSON.parse. (scratchpad/test/toml/TomlNode.test.ts:36,45,137,169; scratchpad/test/toml/TomlDiagnostic.test.ts:42,69; scratchpad/test/toml/TomlVisitor.test.ts:91)
- **numeric-domains** — Lab narrows numeric spans, positions and carrier fields to S.Finite where upstream allowed non-finite numbers or left fields unchecked. (scratchpad/test/toml/TomlNode.test.ts:36,51; scratchpad/test/toml/TomlDiagnostic.test.ts:12; scratchpad/test/toml/TomlEdit.test.ts:24; module suite scratchpad/test/toml/**)
- **type-safety** — Lab replaces casts and unchecked indexed access with narrowing and assertions, concentrating deliberate wrong-input casts in the authorized helper. (scratchpad/test/toml/Toml.test.ts:22,421; scratchpad/test/toml/hostile.test.ts:203; scratchpad/test/toml/parser.test.ts:58; scratchpad/test/toml/semantic.test.ts:14)
- **tsgo-diagnostics** — Lab adds diagnostic-required dual signatures, schema factories, declared IEEE codecs and typed failure extraction where upstream used simpler signatures, new, Schema.Number and Effect.flip. (scratchpad/test/toml/expectFailure.ts:6; scratchpad/test/toml/Toml.test.ts:40,289; scratchpad/test/toml/TomlDiagnostic.test.ts:70; scratchpad/test/toml/scanner.test.ts; scratchpad/test/toml/e2e/taggedJson.ts:136)
- **effect-first** — Lab uses Match, A.sort, Effect.try, Effect.fn and Effect helpers where upstream used switches, native sorts, direct catches and generator wrappers. (scratchpad/test/toml/TomlEdit.test.ts:11,36; scratchpad/test/toml/TomlVisitor.test.ts:119; scratchpad/test/toml/scanner.test.ts:77; scratchpad/test/toml/TomlFormat.test.ts:18; scratchpad/test/toml/hostile.test.ts:46)
- **effect-imports** — Lab source, tests and source examples import dedicated effect/Module paths where upstream imported the root effect barrel. (module suite scratchpad/test/toml/**)
- **identity-annotations** — Lab schemas, errors, calendar constraints and fields carry composer identities and metadata where upstream used short identities or omitted annotations. (module suite scratchpad/test/toml/**)

### Dependency backlog

None.
