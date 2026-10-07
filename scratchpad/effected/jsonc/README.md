# jsonc (lab port of @effected/jsonc)

[![npm](https://img.shields.io/npm/v/@effected%2Fjsonc?label=npm&color=cb3837)](https://www.npmjs.com/package/@effected/jsonc)
[![License: MIT](https://img.shields.io/badge/License-MIT-4caf50.svg)](https://opensource.org/licenses/MIT)
[![Node.js %3E%3D24.11.0](https://img.shields.io/badge/Node.js-%3E%3D24.11.0-5fa04e.svg)](https://nodejs.org/)
[![TypeScript 7.0](https://img.shields.io/badge/TypeScript-7.0-3178c6.svg)](https://www.typescriptlang.org/)

Zero-dependency JSONC parsing, editing and formatting expressed as Effect schemas and pure functions. Parse JSONC into plain values or an offset-preserving AST, strip comments, compute byte-minimal edits, format, modify by path, walk a document as a `Stream`, and decode straight into a validated domain schema.

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

## Why @effected/jsonc

JSONC is JSON with comments and trailing commas: the format behind `tsconfig.json`, VS Code settings and much of the JavaScript toolchain. Those files are written by humans, and humans leave comments in them. A `JSON.parse` then `JSON.stringify` round-trip destroys every one of them, so any tool that rewrites a `tsconfig.json` that way hands the user back a file they did not recognize.

This package treats the source text as the document. Modifications are computed as edits against the original bytes rather than re-serialized from a parsed object, so a change to one key leaves every comment, blank line and indentation choice untouched. Parsing recovers from errors and aggregates every diagnostic into one `JsoncParseError` carrying `code`, `offset`, `length`, `line` and `character` per error, instead of throwing on the first. And `Jsonc.schema` composes with a domain schema so a JSONC string decodes into a validated value in a single step.

Everything is a pure function or a schema. No IO, no owned services and no runtime dependency other than `effect` itself: the scanner, parser and navigator are vendored into the package with attribution rather than pulled in as a dependency. The one effectful edge is fingerprint hashing, and the package ships no backend for it: `JsoncFingerprint.hash` and `hashText` require core's `Crypto.Crypto` service in `R`, provided by the consumer at the application edge, while their `hashResult` / `hashTextResult` twins take the digest as a plain function argument so a synchronous caller can fingerprint with no runtime at all.

## Install

```bash
npm install @effected/jsonc effect
```

```bash
pnpm add @effected/jsonc effect
```

Requires Node.js >=24.11.0. `effect` v4 is a peer dependency; the package itself adds no other runtime dependencies.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

## Quick start

Compose your schema with `Jsonc.schema` to decode JSONC straight into a validated domain value:

```ts
import { Jsonc } from "@effected/jsonc";
import { Effect, Schema } from "effect";

const Config = Schema.Struct({ port: Schema.Number });
const ConfigFromJsonc = Jsonc.schema(Config);

const program = Effect.gen(function* () {
  return yield* Schema.decodeUnknownEffect(ConfigFromJsonc)(`{
    // dev server
    "port": 3000
  }`);
});

Effect.runPromise(program).then(console.log);
// { port: 3000 }
```

Malformed input fails through the typed channel, never as a throw:

```ts
import { Jsonc } from "@effected/jsonc";
import { Effect } from "effect";

Effect.runPromise(Effect.result(Jsonc.parse('{ "a": }'))).then(console.log);
// Failure with JsoncParseError:
// "JSONC parse failed with 1 error: ValueExpected at 1:8"
// The `errors` field carries one JsoncParseErrorDetail per recovered error,
// each with code, offset, length, line and character.
```

Synchronous boundaries that cannot run an Effect (a plain config loader, a build script) call `Jsonc.parseResult`, the same parse returning a `Result` directly instead of wrapping it in `Effect.runSync(Effect.result(...))`:

```ts
import { Jsonc } from "@effected/jsonc";
import { Result } from "effect";

const result = Jsonc.parseResult('{ "port": 3000 // dev\n}');
console.log(Result.isSuccess(result) ? result.success : result.failure);
// { port: 3000 }
```

`Jsonc.parse` is defined in terms of `parseResult`, and `Jsonc.parseTree` in terms of `Jsonc.parseTreeResult`, so the pairs never diverge. Prefer the Effect variants inside Effect code, where they carry their tracing spans.

## Editing without losing comments

`JsoncModifier.modify` returns a `JsoncEdit` array — offset, length and replacement content — that `JsoncEdit.applyAll` splices into the original text. Only the bytes covered by an edit change:

```ts
import { JsoncEdit, JsoncModifier } from "@effected/jsonc";
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

> **Migrating from `jsonc-effect` 0.3.x?** That library's value spans over-reached
> trailing content ([jsonc-effect#62](https://github.com/spencerbeggs/jsonc-effect/issues/62)),
> so edits could swallow whitespace or comments after a value. `@effected/jsonc`
> 0.1.0 fixes this: value spans cover exactly the value, format-preserving edits
> are byte-exact, and any downstream AST-plus-`trimEnd` workarounds can be deleted.

## Comments and round-trips

There is no comment-preserving `stringify` in this package, and that is deliberate rather than an oversight. `Jsonc.stringify` and its synchronous twin `Jsonc.stringifyResult` emit plain JSON — comments live in the document and edit layer (`JsoncNode`, `JsoncEdit`, `JsoncFormatter`), never in a plain JavaScript value. The encode direction of `Jsonc.schema`, `Jsonc.fromString` and `Jsonc.JsoncFromString` is that same emission. **Comments do not survive a decode then encode round trip** — once a document has been reduced to a plain JavaScript value, the comments are already gone and no honest encoder can put them back.

Values JSON cannot represent fail through a typed channel rather than throwing:

```ts
import { Jsonc } from "@effected/jsonc";
import { Result } from "effect";

const ok = Jsonc.stringifyResult({ port: 3000 });
console.log(Result.isSuccess(ok) ? ok.success : ok.failure);
// {
//   "port": 3000
// }

const bad = Jsonc.stringifyResult(0n);
console.log(Result.isFailure(bad) ? bad.failure.code : "");
// BigIntValue
```

Preserving comments requires the original source text, which is exactly what `JsoncModifier` and `JsoncFormatter` take. If you need to write a JSONC file back out with its comments intact, edit the text: parse for reading, and modify for writing.

## Canonical JSON and content fingerprints

`JsoncFingerprint` produces RFC 8785 canonical JSON (the JSON Canonicalization Scheme) and SHA-256 fingerprints over it: compact output, object keys sorted by UTF-16 code units, ECMAScript number serialization. Two values that differ only in key order canonicalize — and fingerprint — identically. Unlike `Jsonc.stringify`, which follows `JSON.stringify`'s drop/null semantics for nested unrepresentables, canonicalization refuses to alter the document: an `undefined`, a function, a symbol, a `bigint`, a non-finite number, a string or member key containing an unpaired surrogate, or a non-plain object (a `Date`, a `Map`, a class instance) fails typed with a `JsoncCanonicalizeError` naming the JSON-pointer `path` to fix, rather than being silently dropped or nulled. `toJSON` methods are ignored on purpose — encode `Schema` classes and `Date`s to plain JSON first (the same error carries one code that is not about the document, `InvalidDigest`, for a synchronous caller's own digest function — see below):

```ts
import { JsoncFingerprint } from "@effected/jsonc";
import { Result } from "effect";

const ok = JsoncFingerprint.canonicalizeResult({ b: 2, a: 1 });
console.log(Result.isSuccess(ok) ? ok.success : "");
// {"a":1,"b":2}

const bad = JsoncFingerprint.canonicalizeResult({ a: { b: undefined } });
console.log(Result.isFailure(bad) ? `${bad.failure.code} at "${bad.failure.path}"` : "");
// UnrepresentableValue at "/a/b"
```

`hash` and `hashText` carry that canonicalization through to a content digest: the lowercase-hex SHA-256 of the UTF-8 bytes of the canonical text (`hash`) or of raw text as given (`hashText`). Both require core's `Crypto.Crypto` service in `R` — this package owns no backend, so provide `@effect/platform-node`'s `NodeCrypto.layer` (or any `Crypto` layer) at the application edge:

```ts
import { JsoncFingerprint } from "@effected/jsonc";
import { NodeCrypto } from "@effect/platform-node";
import { Effect } from "effect";

const program = Effect.gen(function* () {
  const a = yield* JsoncFingerprint.hash({ b: 2, a: 1 });
  const b = yield* JsoncFingerprint.hash({ a: 1, b: 2 });
  return a === b;
});

Effect.runPromise(program.pipe(Effect.provide(NodeCrypto.layer))).then(console.log);
// true
```

`hashResult` and `hashTextResult` are the synchronous twins of those two, for callers with no fiber to run an `Effect` in — a bundler plugin's synchronous hook, a cache `read`/`write` invoked from inside a host callback. They agree byte for byte with the `Effect` forms. Since a `Crypto` layer cannot be provided from inside a synchronous callback, the digest itself is the argument: pass a `JsoncDigest`, `(bytes: Uint8Array) => Uint8Array`. This package still imports nothing from `node:*` and assumes no runtime, so a Node consumer binds the platform in one line:

```ts
import { createHash } from "node:crypto";
import { JsoncFingerprint, type JsoncDigest } from "@effected/jsonc";
import { Result } from "effect";

const digest: JsoncDigest = (bytes) => createHash("sha256").update(bytes).digest();

const fingerprint = JsoncFingerprint.hashResult({ b: 2, a: 1 }, digest);
console.log(Result.isSuccess(fingerprint) ? fingerprint.success : "");
// 64 lowercase hex characters — the same answer `hash` gives
```

A digest that throws, or that returns anything other than 32 bytes, fails typed with `JsoncCanonicalizeError`'s `InvalidDigest` code at path `""` rather than escaping into the host or emitting a plausible-looking digest of the wrong width — a SHA-1 binding would otherwise have produced 40 hex characters. No check can catch a *different* 32-byte algorithm; that much is the caller's to get right.

Digests are always exactly 64 lowercase hexadecimal characters, with no `sha256:` or other algorithm prefix — the same format `@effected/sbom`'s `Sha256Digest` schema decodes, so a fingerprint flows straight into an attestation subject without this package taking a dependency edge on `sbom`. `hashText`'s (and `hashTextResult`'s) `normalizeEol: true` option normalizes `\r\n` and bare `\r` to `\n` before hashing — reach for it when the same file content must fingerprint identically across checkouts with different line-ending settings; `JsoncFingerprint.normalizeEol` exposes the same normalization as a pure, total function.

## Features

- `Jsonc.parse` / `Jsonc.parseTree` — error-recovery parsing to a plain value or an offset-preserving `JsoncNode` AST, aggregating every recovered error into one `JsoncParseError` rather than failing on the first.
- `Jsonc.parseResult` / `Jsonc.parseTreeResult` — the synchronous `Result` variants of `parse` and `parseTree` for callers outside an Effect runtime; the Effect forms are defined in terms of them, so the pairs never diverge.
- `Jsonc.stringify` / `Jsonc.stringifyResult` — value-level JSON emission with configurable indent, failing with a typed `JsoncStringifyError` whose `code` names the mode: `CircularReference`, `BigIntValue` or `TopLevelUnrepresentable`.
- `Jsonc.stripComments` — pure comment removal yielding valid JSON; pass a replacement character to keep every byte offset stable.
- `Jsonc.equals` / `Jsonc.equalsValue` — semantic equality that ignores comments, whitespace, formatting and object key order, while keeping array order significant.
- `Jsonc.schema` / `Jsonc.fromString` / `Jsonc.JsoncFromString` — string→domain schema factories that decode JSONC directly into a validated Effect `Schema` value.
- `JsoncFormatter` / `JsoncModifier` — compute byte-minimal `JsoncEdit` arrays for formatting and path-based modification, so callers apply the smallest possible diff instead of re-serializing the document.
- `JsoncVisitor` — walk a parsed document as a `Stream` of visitor events, with `Stream.take` early termination on large inputs.
- `JsoncFingerprint` — RFC 8785 canonical JSON (`canonicalize` / `canonicalizeResult`) and SHA-256 content fingerprints over it (`hash`, `hashText`), failing typed with `JsoncCanonicalizeError` rather than silently dropping or altering non-JSON values; `hash`/`hashText` require core's `Crypto.Crypto` service.
- `JsoncFingerprint.hashResult` / `JsoncFingerprint.hashTextResult` — the synchronous `Result` variants of `hash` and `hashText` for callers outside an Effect runtime, taking the caller's own `JsoncDigest` instead of a `Crypto` layer so a synchronous host hook can fingerprint at all.
- `JsoncParseError` / `JsoncModificationError` — tagged errors carrying structured, positional payloads rather than opaque messages. Hostile input (deep nesting, unterminated literals) fails through the error channel, never as a stack overflow.

## License

[MIT](LICENSE)


## Port notes

### Attribution

- Upstream package: `@effected/jsonc` 0.15.1
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- scratchpad/effected/jsonc/index.ts:8 * string-to-domain schema factories. Ported from `@effected/jsonc` to the
- scratchpad/effected/jsonc/internal/parser.ts:11 // Reference: Microsoft's jsonc-parser parser design (MIT).
- scratchpad/effected/jsonc/internal/scanner.ts:4 // tokenizer surface. Reference: Microsoft's jsonc-parser scanner design (MIT).

### Added exports

None.

### Deviations

None.

### Dependency backlog

None.
