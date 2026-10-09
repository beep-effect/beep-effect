# jsonc (lab port of @effected/jsonc)

JSONC parsing, editing and formatting expressed as Effect schemas and pure functions, with no third-party dependency. Parse JSONC into plain values or an offset-preserving AST, strip comments, compute byte-minimal edits, format, modify by path, walk a document as a `Stream`, and decode straight into a validated domain schema.

Every public name is exported from `@beep/scratchpad/effected/jsonc/index`.

## Why @effected/jsonc

JSONC is JSON with comments and trailing commas: the format behind `tsconfig.json`, VS Code settings and much of the JavaScript toolchain. Those files are written by humans, and humans leave comments in them. A `JSON.parse` then `JSON.stringify` round-trip destroys every one of them, so any tool that rewrites a `tsconfig.json` that way hands the user back a file they did not recognize.

This module treats the source text as the document. Modifications are computed as edits against the original bytes rather than re-serialized from a parsed object, so a change to one key leaves every comment, blank line and indentation choice untouched. Parsing recovers from errors and aggregates every diagnostic into one `JsoncParseError` carrying `code`, `offset`, `length`, `line` and `character` per error, instead of throwing on the first. And `Jsonc.schema` composes with a domain schema so a JSONC string decodes into a validated value in a single step.

Everything is a pure function or a schema. No IO, no owned services and no third-party runtime dependency: besides `effect`, the lab imports only the workspace helpers `@beep/identity`, `@beep/schema` and `@beep/utils`, and the scanner, parser and navigator are vendored into the module with attribution rather than pulled in as a dependency. The one effectful edge is fingerprint hashing, and the module ships no backend for it: `JsoncFingerprint.hash` and `hashText` require core's `Crypto.Crypto` service in `R`, provided by the consumer at the application edge, while their `hashResult` / `hashTextResult` twins take the digest as a plain function argument so a synchronous caller can fingerprint with no runtime at all.

## Quick start

Compose your schema with `Jsonc.schema` to decode JSONC straight into a validated domain value:

```ts
import { Jsonc } from "@beep/scratchpad/effected/jsonc/index";
import { Effect } from "effect";
import * as S from "effect/Schema";

const Config = S.Struct({ port: S.Finite });
const ConfigFromJsonc = Jsonc.schema(Config);

const program = Effect.gen(function* () {
  return yield* S.decodeEffect(ConfigFromJsonc)(`{
    // dev server
    "port": 3000
  }`);
});

Effect.runPromise(program).then(console.log);
// { port: 3000 }
```

Malformed input fails through the typed channel, never as a throw:

```ts
import { Jsonc } from "@beep/scratchpad/effected/jsonc/index";
import { Effect } from "effect";

Effect.runPromise(Effect.result(Jsonc.parse('{ "a": }'))).then(console.log);
// Failure with JsoncParseError:
// "JSONC parse failed with 1 error: ValueExpected at 1:8"
// The `errors` field carries one JsoncParseErrorDetail per recovered error,
// each with code, offset, length, line and character.
```

Synchronous boundaries that cannot run an Effect (a plain config loader, a build script) call `Jsonc.parseResult`, the same parse returning a `Result` directly instead of wrapping it in `Effect.runSync(Effect.result(...))`:

```ts
import { Jsonc } from "@beep/scratchpad/effected/jsonc/index";
import * as Result from "effect/Result";

const result = Jsonc.parseResult('{ "port": 3000 // dev\n}');
console.log(Result.isSuccess(result) ? result.success : result.failure);
// { port: 3000 }
```

`Jsonc.parse` is defined in terms of `parseResult`, and `Jsonc.parseTree` in terms of `Jsonc.parseTreeResult`, so the pairs never diverge. Prefer the Effect variants inside Effect code, where they carry their tracing spans.

## Editing without losing comments

`JsoncModifier.modify` returns a `JsoncEdit` array (offset, length and replacement content) that `JsoncEdit.applyAll` splices into the original text. Only the bytes covered by an edit change:

```ts
import { JsoncEdit, JsoncModifier } from "@beep/scratchpad/effected/jsonc/index";
import { Effect } from "effect";

const source = `{
  // dev server
  "port": 3000
}`;

const program = Effect.gen(function* () {
  const edits = yield* JsoncModifier.modify(source, ["port"], 8080);
  return JsoncEdit.applyAll(source, edits);
});

Effect.runPromise(program).then(console.log);
// {
//   // dev server
//   "port": 8080
// }
```

`JsoncFormatter.format` produces the same kind of edit array for whitespace normalization, so a formatter pass is a diff rather than a rewrite.

Overlapping edits are a programmer error that neither `JsoncFormatter` nor `JsoncModifier` ever produces. `JsoncEdit.applyAll` throws the tagged `JsoncEditOverlapError` (carrying both offsets) when it receives them; `JsoncEdit.applyAllResult` returns the same error as a `Result` failure for callers that assemble edit arrays by hand:

```ts
import { JsoncEdit } from "@beep/scratchpad/effected/jsonc/index";
import * as Result from "effect/Result";

const overlapping = JsoncEdit.applyAllResult("abcdef", [
  JsoncEdit.make({ offset: 0, length: 4, content: "x" }),
  JsoncEdit.make({ offset: 2, length: 3, content: "y" }),
]);
console.log(Result.isFailure(overlapping) ? overlapping.failure.message : "");
// JsoncEdit.applyAll received overlapping edits at offsets 0 and 2
```

> **Exact value spans.** `jsonc-effect` 0.3.x's value spans over-reached
> trailing content ([jsonc-effect#62](https://github.com/spencerbeggs/jsonc-effect/issues/62)),
> so edits could swallow whitespace or comments after a value. Upstream fixed
> this in `@effected/jsonc` 0.1.0 and the lab inherits the fix: value spans
> cover exactly the value, format-preserving edits are byte-exact, and any
> downstream AST-plus-`trimEnd` workarounds can be deleted.

## Comments and round-trips

There is no comment-preserving `stringify` in this module, and that is deliberate rather than an oversight. `Jsonc.stringify` and its synchronous twin `Jsonc.stringifyResult` emit plain JSON. Comments live in the document and edit layer (`JsoncNode`, `JsoncEdit`, `JsoncFormatter`), never in a plain JavaScript value. The encode direction of `Jsonc.schema`, `Jsonc.fromString` and `Jsonc.JsoncFromString` is that same emission. **Comments do not survive a decode then encode round trip.** Once a document has been reduced to a plain JavaScript value, the comments are already gone and no honest encoder can put them back.

Values JSON cannot represent, and a `toJSON` method that throws, fail through a typed channel rather than throwing:

```ts
import { Jsonc } from "@beep/scratchpad/effected/jsonc/index";
import * as Result from "effect/Result";

const ok = Jsonc.stringifyResult({ port: 3000 });
console.log(Result.isSuccess(ok) ? ok.success : ok.failure);
// {
//   "port": 3000
// }

const bad = Jsonc.stringifyResult(0n);
console.log(Result.isFailure(bad) ? bad.failure.code : "");
// BigIntValue

const bomb = Jsonc.stringifyResult({
  toJSON: () => {
    throw new RangeError("boom");
  },
});
console.log(Result.isFailure(bomb) ? bomb.failure.code : "");
// SerializationFailed
```

Preserving comments requires the original source text, which is exactly what `JsoncModifier` and `JsoncFormatter` take. If you need to write a JSONC file back out with its comments intact, edit the text: parse for reading, and modify for writing.

## Canonical JSON and content fingerprints

`JsoncFingerprint` produces RFC 8785 canonical JSON (the JSON Canonicalization Scheme) and SHA-256 fingerprints over it: compact output, object keys sorted by UTF-16 code units, ECMAScript number serialization. Two values that differ only in key order canonicalize (and fingerprint) identically. Unlike `Jsonc.stringify`, which follows `JSON.stringify`'s drop/null semantics for nested unrepresentables, canonicalization refuses to alter the document: an `undefined`, a function, a symbol, a `bigint`, a non-finite number, a string or member key containing an unpaired surrogate, or a non-plain object (a `Date`, a `Map`, a class instance) fails typed with a `JsoncCanonicalizeError` naming the JSON-pointer `path` to fix, rather than being silently dropped or nulled. `toJSON` methods are ignored on purpose: encode `Schema` classes and `Date`s to plain JSON first. The same error carries one code that is not about the document, `InvalidDigest`, for a synchronous caller's own digest function (see below):

```ts
import { JsoncFingerprint } from "@beep/scratchpad/effected/jsonc/index";
import * as Result from "effect/Result";

const ok = JsoncFingerprint.canonicalizeResult({ b: 2, a: 1 });
console.log(Result.isSuccess(ok) ? ok.success : "");
// {"a":1,"b":2}

const bad = JsoncFingerprint.canonicalizeResult({ a: { b: undefined } });
console.log(Result.isFailure(bad) ? `${bad.failure.code} at "${bad.failure.path}"` : "");
// UnrepresentableValue at "/a/b"
```

`hash` and `hashText` carry that canonicalization through to a content digest: the lowercase-hex SHA-256 of the UTF-8 bytes of the canonical text (`hash`) or of raw text as given (`hashText`). Both require core's `Crypto.Crypto` service in `R`. This module owns no backend, so provide `@effect/platform-node`'s `NodeCrypto.layer` (or any `Crypto` layer) at the application edge:

```ts
import { JsoncFingerprint } from "@beep/scratchpad/effected/jsonc/index";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const a = yield* JsoncFingerprint.hash({ b: 2, a: 1 });
  const b = yield* JsoncFingerprint.hash({ a: 1, b: 2 });
  return a === b;
});

Effect.runPromise(program.pipe(Effect.provide(NodeCrypto.layer))).then(console.log);
// true
```

`hashResult` and `hashTextResult` are the synchronous twins of those two, for callers with no fiber to run an `Effect` in: a bundler plugin's synchronous hook, a cache `read`/`write` invoked from inside a host callback. They agree byte for byte with the `Effect` forms. Since a `Crypto` layer cannot be provided from inside a synchronous callback, the digest itself is the argument: pass a `JsoncDigest`, `(bytes: Uint8Array) => Uint8Array`. This module still imports nothing from `node:*` and assumes no runtime, so a Node consumer binds the platform in one line:

```ts
import { createHash } from "node:crypto";
import { JsoncFingerprint, type JsoncDigest } from "@beep/scratchpad/effected/jsonc/index";
import * as Result from "effect/Result";

const digest: JsoncDigest = (bytes) => createHash("sha256").update(bytes).digest();

const fingerprint = JsoncFingerprint.hashResult({ b: 2, a: 1 }, digest);
console.log(Result.isSuccess(fingerprint) ? fingerprint.success : "");
// 64 lowercase hex characters, the same answer `hash` gives
```

A digest that throws, or that returns anything other than 32 bytes, fails typed with `JsoncCanonicalizeError`'s `InvalidDigest` code at path `""` rather than escaping into the host or emitting a plausible-looking digest of the wrong width (a SHA-1 binding would otherwise have produced 40 hex characters). No check can catch a *different* 32-byte algorithm; that much is the caller's to get right.

Digests are always exactly 64 lowercase hexadecimal characters, with no `sha256:` or other algorithm prefix: the same format `@effected/sbom`'s `Sha256Digest` schema decodes, so a fingerprint flows straight into an attestation subject without this module taking a dependency edge on `sbom`. The `normalizeEol: true` option of `hashText` and `hashTextResult` (`JsoncTextHashOptions.make({ normalizeEol: true })`) normalizes `\r\n` and bare `\r` to `\n` before hashing. Reach for it when the same file content must fingerprint identically across checkouts with different line-ending settings; `JsoncFingerprint.normalizeEol` exposes the same normalization as a pure, total function.

## Features

- `Jsonc.parse` / `Jsonc.parseTree`: error-recovery parsing to a plain value or an offset-preserving `JsoncNode` AST, aggregating every recovered error into one `JsoncParseError` rather than failing on the first.
- `Jsonc.parseResult` / `Jsonc.parseTreeResult`: the synchronous `Result` variants of `parse` and `parseTree` for callers outside an Effect runtime; the Effect forms are defined in terms of them, so the pairs never diverge.
- `Jsonc.stringify` / `Jsonc.stringifyResult`: value-level JSON emission with configurable indent, failing with a typed `JsoncStringifyError` whose `code` names the mode: `CircularReference`, `BigIntValue`, `TopLevelUnrepresentable` or `SerializationFailed` (a `toJSON` method or getter that threw).
- `Jsonc.stripComments`: pure comment removal yielding valid JSON; pass a replacement character to keep every byte offset stable.
- `Jsonc.equals` / `Jsonc.equalsValue`: semantic equality that ignores comments, whitespace, formatting and object key order, while keeping array order significant.
- `Jsonc.schema` / `Jsonc.fromString` / `Jsonc.JsoncFromString`: string-to-domain schema factories that decode JSONC directly into a validated Effect `Schema` value; `Jsonc.bind` pre-binds the composed schema's `decode` and `encode` directions.
- `JsoncFormatter` / `JsoncModifier`: compute byte-minimal `JsoncEdit` arrays for formatting and path-based modification, so callers apply the smallest possible diff instead of re-serializing the document.
- `JsoncEdit.applyAll` / `JsoncEdit.applyAllResult`: apply an edit array in reverse-offset order; overlapping edits are rejected with the tagged `JsoncEditOverlapError`, thrown by `applyAll` and returned as a `Result` failure by `applyAllResult`.
- `JsoncVisitor`: walk a parsed document as a `Stream` of visitor events, with `Stream.take` early termination on large inputs.
- `JsoncFingerprint`: RFC 8785 canonical JSON (`canonicalize` / `canonicalizeResult`) and SHA-256 content fingerprints over it (`hash`, `hashText`), failing typed with `JsoncCanonicalizeError` rather than silently dropping or altering non-JSON values; `hash`/`hashText` require core's `Crypto.Crypto` service.
- `JsoncFingerprint.hashResult` / `JsoncFingerprint.hashTextResult`: the synchronous `Result` variants of `hash` and `hashText` for callers outside an Effect runtime, taking the caller's own `JsoncDigest` instead of a `Crypto` layer so a synchronous host hook can fingerprint at all.
- `JsoncParseError` / `JsoncModificationError` / `JsoncEditOverlapError`: tagged errors carrying structured, positional payloads rather than opaque messages. Hostile input (deep nesting, unterminated literals) fails through the error channel, never as a stack overflow.

## License

[MIT](LICENSE)

## Port notes

### Attribution

- Upstream package: `@effected/jsonc` 0.15.1 (version from upstream `packages/jsonc/package.json`), by C. Spencer Beggs.
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` of the `effected` monorepo (local reference clone `~/YeeBois/references/effect/effected`, read-only).
- License: MIT. [LICENSE](./LICENSE) carries the upstream notice verbatim.
- Vendored engine: upstream's `CLAUDE.md` (carried verbatim in [KNOWLEDGE.md](./KNOWLEDGE.md)) records that the scanner, parser, navigator and limits in `internal/` are a vendored engine, ported with attribution to Microsoft's `jsonc-parser` design (MIT). The lab keeps the upstream source-header notices: `internal/scanner.ts` ("Reference: Microsoft's jsonc-parser scanner design (MIT).") and `internal/parser.ts` ("Reference: Microsoft's jsonc-parser parser design (MIT)."). `internal/navigate.ts`, `internal/skip.ts` and `internal/limits.ts` carry no separate notice, upstream or lab.

### Added exports

New in the lab (not exported upstream):

- `JsoncEditOverlapError` (value and type): the tagged error `JsoncEdit.applyAll` throws and `JsoncEdit.applyAllResult` returns for overlapping edits.

Facets widened from upstream (upstream exports a type only; the lab exports a schema value and its type under the same name):

- `JsoncFormattingOptionsLike`: upstream type alias; lab `S.toEncoded(JsoncFormattingOptions)`.
- `JsoncModifyOptions`: upstream interface; lab `S.Struct({ formattingOptions: S.optionalKey(JsoncFormattingOptionsLike) })`.
- `JsoncPath`: upstream `ReadonlyArray<JsoncSegment>`; lab `S.Array(JsoncSegment)`.
- `JsoncSegment`: upstream `string | number`; lab `S.Union([S.String, S.Natural])`, so the schema admits only natural-number indices.

New members on existing exports (not index exports): the static `JsoncEdit.applyAllResult`, and the `SerializationFailed` member of `JsoncStringifyErrorCode`.

### Deviations

Each entry gives the lab test that pins it, upstream behaviour, lab behaviour and the reason (section 14 of the port goal: `law:<id>` from `standards/effect-laws-v1.md`, or `upstream-bug:<evidence>`). Upstream behaviour was reproduced against upstream source at the commit above.

1. **A throwing `toJSON` fails typed instead of escaping as a defect.**
   - Test: `scratchpad/test/jsonc/Jsonc.test.ts:362` ("a throwing toJSON fails typed with SerializationFailed"), adjusting upstream `__test__/Jsonc.test.ts:389` ("a throwing toJSON rethrows as a defect, never a typed error").
   - Upstream: `Jsonc.stringifyResult` rethrows the `RangeError` thrown by `toJSON`; inside `Jsonc.stringify` it surfaces as a `Cause.Die` defect.
   - Lab: `Jsonc.stringifyResult` returns a `JsoncStringifyError` with code `SerializationFailed`, and `Jsonc.stringify` fails with it. Serialization runs through the `S.fromJsonString` codec, which reports any throw as a schema error; `SerializationFailed` is the code left when the value the engine refused is neither a `bigint` (primitive or boxed) nor one of its own open containers (a cycle), and the top-level output is not absent. Its `detail` is the codec's sentence, not the thrown message (deviation 11).
   - Reason: `law:7` (typed errors via `S.TaggedError`, not escaping native exceptions) and `law:13` (schema transformations over ad-hoc serialization). It also matches upstream's own hardening invariant in `CLAUDE.md` ("Malformed or hostile input must fail through the typed `E` channel"), which upstream's test contradicts.

2. **`JsoncModifier.modify` re-indents multi-line inserted values to the insertion depth.**
   - Test: `scratchpad/test/jsonc/JsoncModifier.test.ts:232` (exact inserted content for a nested object with tabs and an array with `tabSize: 4`), tightening upstream `__test__/JsoncModifier.test.ts:162` and `:171`, which assert only that the content includes `\t"b"`.
   - Upstream: lines after the first keep `Jsonc.stringify`'s column-0 layout. `modify('{\n  "a": 1\n}', ["b"], { c: { d: 1 } })` applies as `{\n  "a": 1,\n  "b": {\n  "c": {\n    "d": 1\n  }\n}\n}`: the nested members sit one level too shallow and the inserted value's closing brace lands at column 0, beside the document's own.
   - Lab: every line after the first is prefixed with the insertion indent, so the same call yields `"b": {\n    "c": {\n      "d": 1\n    }\n  }` and the nested value lines up with its siblings.
   - Reason: `upstream-bug:` the mis-indented output above; upstream's tests check only `include('\t"b"')`, which both layouts satisfy.

3. **Overlapping edits raise a typed `JsoncEditOverlapError`; `applyAllResult` is the value form.**
   - Test: `scratchpad/test/jsonc/JsoncEdit.test.ts:87` ("overlapping edits throw the typed overlap error"), adjusting upstream `__test__/JsoncEdit.test.ts:47` (`assert.throws(..., /overlap/)`), plus `scratchpad/test/jsonc/JsoncEdit.test.ts:42` for `applyAllResult`.
   - Upstream: `JsoncEdit.applyAll` throws a native `Error` whose message ends "overlapping edits are a programmer error"; a caller can catch it only untyped, and inside an Effect it is a defect.
   - Lab: `JsoncEdit.applyAll` still throws, but what it throws is the tagged `JsoncEditOverlapError` carrying `lower` and `upper` offsets, with the message "JsoncEdit.applyAll received overlapping edits at offsets <lower> and <upper>" (upstream's trailing clause dropped). `JsoncEdit.applyAllResult` returns the same error as a `Result` failure.
   - Reason: `law:7` (no native `Error` in production source; extend `S.TaggedError`).

4. **`navigate` takes a non-empty path: internal shape only, not a deviation.**
   - Test: `scratchpad/test/jsonc/JsoncModifier.test.ts:173` (upstream `__test__/JsoncModifier.test.ts:79`, same meaning: the empty path replaces or clears the whole document) and `scratchpad/test/jsonc/JsoncModifier.test.ts:108` (negative and fractional final indices yield no edits).
   - Upstream: `internal/navigate.ts` returns `{ _tag: "NoOp" }` for an empty path and when its segment loop falls through on a final array index the scan passed (`-1`, `0.5`); `JsoncModifier.modify` maps `NoOp` to no edits.
   - Lab: `navigate` takes `A.NonEmptyReadonlyArray<JsoncSegment>` and returns an `S.TaggedUnion` of `Located | Insert | Mismatch | NoOp`, matched exhaustively; `JsoncModifier.modify` handles `[]` itself before navigating, and `NoOp` keeps upstream's no-edit answer for a passed index. Observable behaviour of `modify` matches upstream for both inputs.
   - History: the first port dropped the index `NoOp` and appended instead; the wave-0 retrofit (2026-10-07) restored upstream's answer and pinned it with the `:108` test.
   - Reason: none required (no observable difference). The internal shape follows `law:20` (finite variants as discriminated unions) and `law:11` (schema `.match` instead of a native `switch`).

5. **Insertion into a container that ends with a trailing comma lands inside it.**
   - Test: `scratchpad/test/jsonc/JsoncModifier.test.ts:91` and the `JsoncModifier insert` property in `scratchpad/test/jsonc/Properties.test.ts`.
   - Upstream: `internal/navigate.ts` scans past the closer after a trailing comma, so `modify('{ "a": 1, }', ["delta"], [])` yields `{ "a": 1, },` followed by the new member (unparseable), a nested object's new key lands in the parent, and `[1, ]` at index `1` yields `[1, ,` plus the element.
   - Lab: a comma followed by the closer ends the scan, so the insertion goes after the last member inside the container and the result parses to the expected value.
   - Reason: `upstream-bug:` the default parse options accept trailing commas, the insertion property fails upstream on `{ "a": 1, }`, and no upstream test inserts into a trailing-comma container.

6. **The formatter is total on unbalanced closers.**
   - Test: `scratchpad/test/jsonc/JsoncFormatter.test.ts:56` and the totality property at `scratchpad/test/jsonc/Properties.test.ts:395`.
   - Upstream: `format` and `formatToString` throw `RangeError` (`indentUnit.repeat(-1)`) on a surplus closer such as `]]` or `{"a":1}}`.
   - Lab: a surplus closer formats with no indent; every edit still rewrites whitespace only.
   - Reason: `upstream-bug:` a defect escapes a formatter on hostile input, against upstream's own hardening invariant and the format-package convention's C1.

7. **A visit stream can run more than once.**
   - Test: `scratchpad/test/jsonc/JsoncVisitor.test.ts:68`.
   - Upstream: `JsoncVisitor.visit` wraps one generator object, so a second run of the same stream yields no events.
   - Lab: each run creates a fresh generator and yields the same events.
   - Reason: `upstream-bug:` a generator object's iterator is itself, so re-running resumes an exhausted generator; a `Stream` is re-runnable everywhere else in Effect.

8. **`JsoncModifier.modify` fails typed on unserializable values.**
   - Test: `scratchpad/test/jsonc/JsoncModifier.test.ts:254`.
   - Upstream: `modify` uses `JSON.stringify`, so a bigint, a cycle or a throwing `toJSON` escapes as a defect.
   - Lab: `modify` fails with `JsoncStringifyError` (`BigIntValue`, `CircularReference` or `SerializationFailed`).
   - Reason: `law:7`, the same cause as deviation 1.

9. **`JsoncModificationError.offset` is finite.**
   - Test: `scratchpad/test/jsonc/JsoncModifier.test.ts:58`.
   - Upstream: `offset` is `Schema.optionalKey(Schema.Number)`, so `NaN` or `Infinity` decode.
   - Lab: `offset` is `S.optionalKey(S.Finite)`; `modify` never sets it.
   - Reason: `law:` the `schemaNumber` Effect rule is an error in `tsconfig.base.json` (`S.Number` admits non-finite values).

10. **`"{ bad }"` reports `InvalidSymbol` before `PropertyNameExpected`: checked, not a deviation.**
   - Test: `scratchpad/test/jsonc/Jsonc.test.ts:160` and `:269` (exact code lists for `parseResult` and `parseTreeResult`) and `:109` (character `2`), tightening upstream `__test__/Jsonc.test.ts:37`, `:97` and `:253`, which assert only `errors.length > 0`, line `0` and character `>= 0`.
   - Upstream: `Jsonc.parseResult("{ bad }")` reports `InvalidSymbol` then `PropertyNameExpected`, both at offset 2, length 3, line 0, character 2; `parseTreeResult` and `JsoncVisitor.visit` report the same order.
   - Lab: identical.
   - Reason: none required. The lab tests pin upstream's existing order where upstream's assertions were looser; the entry stays so a reviewer does not reopen it.

11. **A stringify failure's `detail` is the schema codec's sentence, not the engine's message.**
   - Test: `scratchpad/test/jsonc/Jsonc.test.ts:650` ("carries the schema codec's sentence as detail for every thrown failure"). Upstream `__test__/Jsonc.test.ts:330` and `:342` assert only `code`, so no upstream assertion changes.
   - Upstream: `Jsonc.stringifyResult` catches the engine's `TypeError` and stores its message as `detail`. On JavaScriptCore that is `JSON.stringify cannot serialize BigInt.` or `JSON.stringify cannot serialize cyclic structures.`; upstream's JSDoc notes that on V8 the cycle message also names the offending property path.
   - Lab: for `BigIntValue`, `CircularReference` and `SerializationFailed` the `detail` is `Expected a JSON-serializable value`, the message of the schema issue the `S.fromJsonString` codec reports. The codec catches the throw and keeps nothing of it. `code` still names the cause, and for a `bigint` (primitive or boxed) or a cycle it is the code upstream reports; `TopLevelUnrepresentable` carries upstream's sentence unchanged.
   - Reason: `law:13` (schema transformations over ad-hoc serialization) and the JSON-codec rule of `standards/effect-first-development.md` ("Never use `JSON.parse` / `JSON.stringify`; use schema JSON codecs"). Only a direct `JSON.stringify` call inside a `try` can observe the engine's message, and that is the call the rule forbids.

12. **A caller's thrown `TypeError` is never classified by its message.**
   - Test: `scratchpad/test/jsonc/Jsonc.test.ts:669` ("classifies a caller-thrown TypeError as SerializationFailed whatever its message says").
   - Upstream: `Jsonc.stringifyResult` classifies every caught `TypeError` by matching its message against `/circular|cyclic/i` and `/bigint/i`. A `toJSON` method or getter that throws `new TypeError("my bigint thing")` therefore returns a typed `BigIntValue` failure whose `detail` is the caller's message, and `new TypeError("circular dependency")` returns `CircularReference`. Any other throw is rethrown (deviation 1).
   - Lab: the code comes from the value the engine refused: `BigIntValue` when it is a `bigint`, primitive or boxed, and `CircularReference` when it is one of its own open containers. A throw from caller code is `SerializationFailed`, whatever its message says.
   - Reason: `upstream-bug:` upstream's JSDoc for `stringifyResult` says a throwing `toJSON` method or getter "is caller code failing and rethrows as a defect, never a typed error". The message heuristic contradicts that for a `TypeError` that mentions one of the three words, and upstream `__test__/Jsonc.test.ts:389` throws a `RangeError`, which the heuristic never reaches.

13. **`tabSize` must be finite.**
   - Test: `scratchpad/test/jsonc/Jsonc.test.ts:710`, `scratchpad/test/jsonc/JsoncFormatter.test.ts:152` and `scratchpad/test/jsonc/JsoncModifier.test.ts:360` (each "rejects a non-finite width"). No upstream test passes a non-finite width.
   - Upstream: `tabSize` is `Schema.optionalKey(Schema.Number)` on `JsoncStringifyOptions` and `JsoncFormattingOptions`, so `NaN` and the infinities are accepted. `stringifyResult` reads `NaN` and `-Infinity` as compact output and `Infinity` as ten spaces; with `insertSpaces` left `true`, `JsoncFormatter.format` and `JsoncModifier.modify` read `NaN` as no indent and fail with a `RangeError` for either infinity.
   - Lab: both fields are `S.Finite` with the same default of `2`. Every finite width is accepted, negative and fractional widths included, and read as upstream reads it apart from deviation 14 (`scratchpad/test/jsonc/Jsonc.test.ts:693`, `JsoncFormatter.test.ts:118` and `JsoncModifier.test.ts:318`). A non-finite width is rejected when the options are constructed or decoded: `make` throws, so `format` and `formatToString` throw and `modify` dies on a literal that carries one.
   - Reason: `law:` the `schemaNumber` Effect rule is an error in `tsconfig.base.json` (`S.Number` admits non-finite values), the same cause as deviation 9.

14. **A `tabSize` of `-1` or below formats with no indent instead of throwing.**
   - Test: `scratchpad/test/jsonc/JsoncFormatter.test.ts:138` ("formats a width of -1 or below with no indent instead of throwing") and `scratchpad/test/jsonc/JsoncModifier.test.ts:344` ("stays total for a width of -1 or below, with no indent"). No upstream test passes a negative width.
   - Upstream: with `insertSpaces` left `true`, `JsoncFormatter.format`, `formatToString` and `JsoncModifier.modify` build the indent unit with `" ".repeat(tabSize)`, which throws a `RangeError` for a width of `-1` or below. `modify` builds it before navigating, so every call dies, deletions and no-ops included. `Jsonc.stringify` is unaffected: `JSON.stringify` reads a negative width as compact.
   - Lab: `Str.repeat` clamps the unit to the empty string, so the formatter breaks lines without indenting and `modify` inserts unindented entries around a compact value. Widths between `-1` and `0`, fractional widths and `insertSpaces: false` behave exactly as upstream.
   - Reason: `upstream-bug:` a `RangeError` defect escapes `format` and `formatToString`, which upstream documents as pure and total, and `modify`, on an option value upstream's own schema accepts. The same family as deviation 6.

### Dependency backlog

None. Upstream `@effected/jsonc` has zero runtime dependencies (`effect` is its only peer), and its devDependencies (`@effect/vitest`, `@savvy-web/bundler`, `@types/node`, `typescript`) are build and test tooling, not oracles. The lab adds no third-party package; its only non-`effect` imports are the first-party workspace helpers `@beep/identity`, `@beep/schema` and `@beep/utils`.
