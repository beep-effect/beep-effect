// Property floor for the jsonc module (effected-port goal 11.4, D10).
//
// Every exported schema and codec round-trips: encoding then decoding returns
// the value under the schema's own equivalence, and decoding an encoded value
// never fails. Every parser and formatter keeps its idempotence and fidelity
// laws, together with the README's guarantees: comments survive edits, value
// spans are exact, a formatter pass is a whitespace diff, comment stripping
// keeps offsets with a replacement character, and fingerprints ignore key order
// (and line endings when asked). The properties already in Jsonc.test.ts (parse
// agreeing with stripComments, JsoncFromString over one fixed struct) and
// JsoncFormatter.test.ts (idempotence on plain JSON) are not repeated here.
//
// The synchronous digest twin is checked against Node's real SHA-256 backend.
// @effect-diagnostics-next-line nodeBuiltinImport:off
import { createHash } from "node:crypto";
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertDefined, assertFalse, assertSome, assertSuccess, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import type { JsoncDigest } from "../../effected/jsonc/index.ts";
import {
  Jsonc,
  JsoncCanonicalizeError,
  JsoncCanonicalizeErrorCode,
  JsoncEdit,
  JsoncEditOverlapError,
  JsoncFingerprint,
  JsoncFormatter,
  JsoncFormattingOptions,
  JsoncFormattingOptionsLike,
  JsoncModificationError,
  JsoncModifier,
  JsoncModifyOptions,
  JsoncNode,
  JsoncNodeType,
  JsoncParseError,
  JsoncParseErrorCode,
  JsoncParseErrorDetail,
  JsoncParseOptions,
  JsoncPath,
  JsoncRange,
  JsoncSegment,
  JsoncStringifyError,
  JsoncStringifyErrorCode,
  JsoncStringifyOptions,
  JsoncTextHashOptions,
  JsoncVisitor,
  JsoncVisitorEvent,
} from "../../effected/jsonc/index.ts";

const runs = { arbitrary: fcRuns(100) };

// ── Shared JSON vocabulary ──────────────────────────────────────────────────

const decodeJson = S.decodeUnknownEffect(S.Json);
const jsonEquivalent = S.toEquivalence(S.Json);
const compact = JsoncStringifyOptions.make({ tabSize: 0 });
const commentsRejected = JsoncParseOptions.make({ disallowComments: true });

// Parse a document and read the result back as a JSON value.
const parseJson = Effect.fnUntraced(function* (text: string, options?: JsoncParseOptions) {
  return yield* decodeJson(yield* Jsonc.parse(text, options));
});

// The members of a JSON container as `[key, value]` pairs (array keys are
// indexes); a scalar has none.
const members = (value: unknown): ReadonlyArray<readonly [string, unknown]> => {
  if (A.isArray(value)) {
    return A.map(value, (item, index): readonly [string, unknown] => [String(index), item]);
  }
  return P.isObject(value) ? R.toEntries(value) : A.empty();
};

// The same JSON value with every object's members in reverse order.
const reverseKeys = (value: unknown): unknown => {
  if (A.isArray(value)) {
    return A.map(value, (item) => reverseKeys(item));
  }
  if (P.isObject(value)) {
    return R.fromEntries(A.reverse(A.map(R.toEntries(value), ([key, item]): readonly [string, unknown] => [key, reverseKeys(item)])));
  }
  return value;
};

// Whether every string and member key is well-formed Unicode: the domain on
// which RFC 8785 canonicalization is total.
const isWellFormed = (value: unknown): boolean =>
  P.isString(value)
    ? value.isWellFormed()
    : A.every(members(value), ([key, item]) => key.isWellFormed() && isWellFormed(item));

// The number of scalar leaves of a JSON value.
const leaves = (value: unknown): number =>
  A.isArray(value) || P.isObject(value) ? A.reduce(members(value), 0, (count, [, item]) => count + leaves(item)) : 1;

// The value a parsed document holds at a path, if any.
const at = (value: unknown, path: JsoncPath): O.Option<unknown> =>
  A.reduce(path, O.some(value), (current, segment) =>
    O.flatMap(current, (node) => {
      if (P.isString(segment)) {
        return P.isObject(node) ? R.get(node, segment) : O.none();
      }
      return A.isArray(node) ? A.get(node, segment) : O.none();
    })
  );

const lineBreaks = (text: string): number => Str.split(text, "\n").length - 1;

// A JSONC rendering of JSON text: a leading line comment, a block comment at
// the start of every line, a trailing comma before every closer that opens a
// line, and a trailing block comment. JSON text carries raw line breaks only
// between tokens, so every insertion lands between tokens. The rendering holds
// exactly `2 + lineBreaks(json)` comments.
const decorate = (json: string): string =>
  `// lead\n${pipe(json, Str.replace(/\n(\s*[}\]])/g, ",\n$1"), Str.replaceAll("\n", "\n/* c */"))} /* tail */`;

const render = Effect.fnUntraced(function* (value: S.Json, options: JsoncStringifyOptions) {
  return decorate(yield* Jsonc.stringify(value, options));
});

// Formatting options whose `eol` is a real line ending; the schema itself
// accepts any string there, which no formatter can honour as a line break.
const FormattingSample = S.Struct({
  tabSize: S.Int.check(S.isBetween({ minimum: 0, maximum: 8 })),
  insertSpaces: S.Boolean,
  eol: S.Literals(["\n", "\r\n"]),
  insertFinalNewline: S.Boolean,
  keepLines: S.Boolean,
});

// A domain target whose own encoding is not the identity (`size` travels as a
// string), so the JSONC factories are exercised through a real composition.
const Config = S.Struct({
  name: S.String,
  port: S.Int,
  size: S.BigIntFromString,
  enabled: S.Boolean,
  tags: S.Array(S.String),
  extra: S.optionalKey(S.Json),
});
const decodeConfigJsonc = S.decodeEffect(Jsonc.schema(Config));
const configEquivalent = S.toEquivalence(Config);

// A three-member object for the modifier, with a fresh member name to insert.
const Document = S.Struct({ alpha: S.Json, beta: S.Json, gamma: S.Json });
const MemberKey = S.Literals(["alpha", "beta", "gamma"]);

const wellFormedJson = Arbitrary.schema(S.Json).pipe(Arbitrary.filter(isWellFormed));

// Text made of the characters that matter to a JSONC scanner, so most samples
// are near-miss documents rather than plain prose.
const hostileText = S.Literals(["{", "}", "[", "]", ",", ":", '"', "\\", "/", "*", "1", "-", ".", "e", "t", "r", "u", "n", "l", " ", "\n", "\r", "\u2028"]).pipe(
  S.Array,
  Arbitrary.schema,
  Arbitrary.map(A.join(""))
);

// Text mixing every line-ending convention with ordinary characters.
const lineText = S.Literals(["a", " ", "\n", "\r", "\r\n", "{", "\u00e9"]).pipe(S.Array, Arbitrary.schema, Arbitrary.map(A.join("")));

// A real SHA-256 backend over WebCrypto behind core's Crypto contract, and the
// synchronous digest the Result twins take.
const CryptoTest = Layer.succeed(
  Crypto.Crypto,
  Crypto.make({
    randomBytes: (size) => globalThis.crypto.getRandomValues(new Uint8Array(size)),
    digest: (algorithm, data) =>
      Effect.map(Effect.promise(() => globalThis.crypto.subtle.digest(algorithm, new Uint8Array(data))), (buffer) => new Uint8Array(buffer)),
  })
);
const nodeDigest: JsoncDigest = (bytes) => createHash("sha256").update(bytes).digest();

// encode then decode is the identity under the schema's own equivalence;
// decoding the encoded value never fails (a failure falsifies the property);
// re-encoding the decoded value reproduces the encoded form.
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const encode = S.encodeEffect(schema);
  const decode = S.decodeEffect(schema);
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: decode(encode(x)) is x and decoding never fails`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* encode(value);
        const decoded = yield* decode(encoded);
        assertTrue(equivalent(decoded, value));
        assert.deepStrictEqual(yield* encode(decoded), encoded);
      }),
    runs
  );
};

describe("jsonc property floor", () => {
  describe("schemas round-trip", () => {
    roundTrips("JsoncParseErrorCode", JsoncParseErrorCode);
    roundTrips("JsoncParseErrorDetail", JsoncParseErrorDetail);
    roundTrips("JsoncParseError", JsoncParseError);
    roundTrips("JsoncParseOptions", JsoncParseOptions);
    roundTrips("JsoncStringifyErrorCode", JsoncStringifyErrorCode);
    roundTrips("JsoncStringifyOptions", JsoncStringifyOptions);
    roundTrips("JsoncStringifyError", JsoncStringifyError);
    roundTrips("JsoncRange", JsoncRange);
    roundTrips("JsoncFormattingOptions", JsoncFormattingOptions);
    roundTrips("JsoncFormattingOptionsLike", JsoncFormattingOptionsLike);
    roundTrips("JsoncEditOverlapError", JsoncEditOverlapError);
    roundTrips("JsoncEdit", JsoncEdit);
    roundTrips("JsoncCanonicalizeErrorCode", JsoncCanonicalizeErrorCode);
    roundTrips("JsoncCanonicalizeError", JsoncCanonicalizeError);
    roundTrips("JsoncTextHashOptions", JsoncTextHashOptions);
    roundTrips("JsoncModificationError", JsoncModificationError);
    roundTrips("JsoncModifyOptions", JsoncModifyOptions);
    roundTrips("JsoncSegment", JsoncSegment);
    roundTrips("JsoncPath", JsoncPath);
    roundTrips("JsoncNodeType", JsoncNodeType);
    roundTrips("JsoncNode", JsoncNode);
    roundTrips("JsoncVisitorEvent", JsoncVisitorEvent);
  });

  describe("string codecs round-trip", () => {
    it.effect.prop(
      "Jsonc.fromString(options) decodes every JSON value it encoded, under any parse options",
      [Arbitrary.schema(JsoncParseOptions), Arbitrary.schema(S.Json)],
      ([options, value]) =>
        Effect.gen(function* () {
          const codec = Jsonc.fromString(options);
          const text = yield* S.encodeEffect(codec)(value);
          assertTrue(jsonEquivalent(yield* decodeJson(yield* S.decodeEffect(codec)(text)), value));
        }),
      runs
    );

    it.effect.prop(
      "Jsonc.schema(Target, options) round-trips a domain value, and decodes its commented rendering",
      [Arbitrary.schema(JsoncParseOptions), Arbitrary.schema(Config)],
      ([options, value]) =>
        Effect.gen(function* () {
          const codec = Jsonc.schema(Config, options);
          const text = yield* S.encodeEffect(codec)(value);
          assertTrue(configEquivalent(yield* S.decodeEffect(codec)(text), value));
          assertTrue(configEquivalent(yield* decodeConfigJsonc(decorate(text)), value));
        }),
      runs
    );

    it.effect.prop(
      "Jsonc.bind(Target) decodes what it encodes, through the bound and the composed codec alike",
      [Arbitrary.schema(Config)],
      ([value]) =>
        Effect.gen(function* () {
          const bound = Jsonc.bind(Config);
          const text = yield* bound.encode(value);
          assertTrue(configEquivalent(yield* bound.decode(text), value));
          assert.strictEqual(yield* S.encodeEffect(bound.schema)(value), text);
        }),
      runs
    );
  });

  describe("parser laws", () => {
    it.effect.prop(
      "parse(stringify(parse(x))) is parse(x), and parse recovers the rendered value",
      [Arbitrary.schema(S.Json), Arbitrary.schema(JsoncStringifyOptions), Arbitrary.schema(JsoncStringifyOptions)],
      ([value, rendering, restringify]) =>
        Effect.gen(function* () {
          const parsed = yield* parseJson(yield* render(value, rendering));
          assertTrue(jsonEquivalent(parsed, value));
          assertTrue(jsonEquivalent(yield* parseJson(yield* Jsonc.stringify(parsed, restringify)), parsed));
        }),
      runs
    );

    it.effect.prop(
      "the AST evaluates to the parsed value",
      [Arbitrary.schema(S.Json), Arbitrary.schema(JsoncStringifyOptions)],
      ([value, rendering]) =>
        Effect.gen(function* () {
          const text = yield* render(value, rendering);
          const root = yield* Effect.fromOption(yield* Jsonc.parseTree(text));
          assertTrue(jsonEquivalent(yield* decodeJson(root.toValue()), yield* parseJson(text)));
        }),
      runs
    );

    it.effect.prop(
      "parsing is total on hostile text, and the value and AST modes agree",
      [hostileText],
      ([text]) =>
        Effect.gen(function* () {
          const value = Jsonc.parseResult(text);
          const tree = Jsonc.parseTreeResult(text);
          assert.deepStrictEqual(
            Result.map(tree, O.map((root) => root.toValue())),
            Result.map(value, O.some)
          );
        }),
      runs
    );

    it.effect.prop(
      "stripComments is idempotent, offset-stable with a replacement character, and value-preserving",
      [Arbitrary.schema(S.Json), Arbitrary.schema(JsoncStringifyOptions)],
      ([value, rendering]) =>
        Effect.gen(function* () {
          const text = yield* render(value, rendering);
          const stripped = Jsonc.stripComments(text);
          assert.strictEqual(Jsonc.stripComments(stripped), stripped);
          assertTrue(jsonEquivalent(yield* parseJson(stripped, commentsRejected), value));
          const blanked = Jsonc.stripComments(text, " ");
          assert.strictEqual(blanked.length, text.length);
          assertTrue(jsonEquivalent(yield* parseJson(blanked, commentsRejected), value));
        }),
      runs
    );

    it.effect.prop(
      "stripComments is idempotent and offset-stable on hostile text",
      [hostileText],
      ([text]) =>
        Effect.gen(function* () {
          const stripped = Jsonc.stripComments(text);
          assert.strictEqual(Jsonc.stripComments(stripped), stripped);
          assert.strictEqual(Jsonc.stripComments(text, " ").length, text.length);
        }),
      runs
    );

    it.effect.prop(
      "equals ignores comments, whitespace, formatting and key order, but not values",
      [Arbitrary.schema(S.Json), Arbitrary.schema(JsoncStringifyOptions)],
      ([value, rendering]) =>
        Effect.gen(function* () {
          const text = yield* render(value, rendering);
          assertTrue(Jsonc.equals(text, yield* Jsonc.stringify(reverseKeys(value), compact)));
          assertTrue(Jsonc.equalsValue(text, value));
          assertFalse(Jsonc.equalsValue(text, [value]));
        }),
      runs
    );

    it.effect.prop(
      "the visitor reports every comment, no error, and each literal the parser reads at its path",
      [Arbitrary.schema(S.Json), Arbitrary.schema(JsoncStringifyOptions)],
      ([value, rendering]) =>
        Effect.gen(function* () {
          const json = yield* Jsonc.stringify(value, rendering);
          const text = decorate(json);
          const parsed = yield* Jsonc.parse(text);
          const root = yield* Effect.fromOption(yield* Jsonc.parseTree(text));
          const events = yield* Stream.runCollect(JsoncVisitor.visit(text));
          assert.deepStrictEqual(A.filter(events, JsoncVisitorEvent.guards.Error), []);
          assert.strictEqual(A.filter(events, JsoncVisitorEvent.guards.Comment).length, 2 + lineBreaks(json));
          const literals = A.filter(events, JsoncVisitorEvent.guards.LiteralValue);
          assert.strictEqual(literals.length, leaves(value));
          for (const literal of literals) {
            assertSome(at(parsed, literal.path), literal.value);
            assertSome(root.pathAt(literal.offset), literal.path);
          }
        }),
      runs
    );
  });

  describe("formatter laws", () => {
    it.effect.prop(
      "formatting a commented document is idempotent, a whitespace-only diff, and value-preserving",
      [Arbitrary.schema(S.Json), Arbitrary.schema(JsoncStringifyOptions), Arbitrary.schema(FormattingSample)],
      ([value, rendering, formatting]) =>
        Effect.gen(function* () {
          const text = yield* render(value, rendering);
          for (const edit of JsoncFormatter.format(text, undefined, formatting)) {
            assert.strictEqual(Str.trim(Str.substring(edit.offset, edit.offset + edit.length)(text)), "");
            assert.strictEqual(Str.trim(edit.content), "");
          }
          const once = JsoncFormatter.formatToString(text, undefined, formatting);
          assert.strictEqual(JsoncFormatter.formatToString(once, undefined, formatting), once);
          assert.deepStrictEqual(JsoncFormatter.format(once, undefined, formatting), []);
          assertTrue(jsonEquivalent(yield* parseJson(once), value));
        }),
      runs
    );
  });

  describe("modifier laws", () => {
    it.effect.prop(
      "replacing a member edits exactly the value's span, and nothing else",
      [Arbitrary.schema(Document), Arbitrary.schema(MemberKey), Arbitrary.schema(S.Json), Arbitrary.schema(JsoncStringifyOptions)],
      ([document, key, next, rendering]) =>
        Effect.gen(function* () {
          const text = yield* render(document, rendering);
          const edits = yield* JsoncModifier.modify(text, [key], next);
          assert.strictEqual(edits.length, 1);
          const [edit] = edits;
          assertDefined(edit);
          const root = yield* Effect.fromOption(yield* Jsonc.parseTree(text));
          assertSome(
            O.map(root.find([key]), (node) => [node.offset, node.length]),
            [edit.offset, edit.length]
          );
          assertTrue(jsonEquivalent(yield* parseJson(JsoncEdit.applyAll(text, edits)), { ...document, [key]: next }));
        }),
      runs
    );

    it.effect.prop(
      "deleting a member keeps every other member and the document's outer comments",
      [Arbitrary.schema(Document), Arbitrary.schema(MemberKey), Arbitrary.schema(JsoncStringifyOptions)],
      ([document, key, rendering]) =>
        Effect.gen(function* () {
          const text = yield* render(document, rendering);
          const result = JsoncEdit.applyAll(text, yield* JsoncModifier.modify(text, [key], undefined));
          assertTrue(jsonEquivalent(yield* parseJson(result), R.remove(document, key)));
          assertTrue(Str.startsWith("// lead\n")(result));
          assertTrue(Str.endsWith(" /* tail */")(result));
        }),
      runs
    );

    it.effect.prop(
      "inserting a member is one pure insertion that changes no existing byte",
      [Arbitrary.schema(Document), Arbitrary.schema(S.Json), Arbitrary.schema(JsoncStringifyOptions), Arbitrary.schema(FormattingSample)],
      ([document, next, rendering, formatting]) =>
        Effect.gen(function* () {
          const text = yield* render(document, rendering);
          const edits = yield* JsoncModifier.modify(text, ["delta"], next, { formattingOptions: formatting });
          assert.deepStrictEqual(A.map(edits, (edit) => edit.length), [0]);
          assertTrue(jsonEquivalent(yield* parseJson(JsoncEdit.applyAll(text, edits)), { ...document, delta: next }));
        }),
      runs
    );
  });

  describe("fingerprint laws", () => {
    it.effect.prop(
      "canonicalize is idempotent through parse, faithful to the value, and blind to key order",
      [wellFormedJson],
      ([value]) =>
        Effect.gen(function* () {
          const canonical = yield* JsoncFingerprint.canonicalize(value);
          assert.strictEqual(yield* JsoncFingerprint.canonicalize(yield* Jsonc.parse(canonical)), canonical);
          assertTrue(jsonEquivalent(yield* parseJson(canonical, commentsRejected), value));
          assert.strictEqual(yield* JsoncFingerprint.canonicalize(reverseKeys(value)), canonical);
          assertTrue(Jsonc.equals(canonical, yield* Jsonc.stringify(value)));
        }),
      runs
    );

    it.effect.prop(
      "normalizeEol is idempotent, leaves no carriage return, and changes nothing but line endings",
      [lineText],
      ([text]) =>
        Effect.gen(function* () {
          const normalized = JsoncFingerprint.normalizeEol(text);
          assert.strictEqual(JsoncFingerprint.normalizeEol(normalized), normalized);
          assertFalse(Str.includes("\r")(normalized));
          const withoutBreaks = Str.replaceAll(/[\r\n]/g, "");
          assert.strictEqual(withoutBreaks(normalized), withoutBreaks(text));
        }),
      runs
    );

    it.layer(CryptoTest)("hashing with a Crypto layer", (it) => {
      it.effect.prop(
        "hash is hashText of the canonical text, agrees with hashResult, and ignores key order",
        [wellFormedJson],
        ([value]) =>
          Effect.gen(function* () {
            const digest = yield* JsoncFingerprint.hash(value);
            assert.strictEqual(yield* JsoncFingerprint.hashText(yield* JsoncFingerprint.canonicalize(value)), digest);
            assertSuccess(JsoncFingerprint.hashResult(value, nodeDigest), digest);
            assert.strictEqual(yield* JsoncFingerprint.hash(reverseKeys(value)), digest);
          }),
        runs
      );

      it.effect.prop(
        "hashText with normalizeEol fingerprints every line-ending convention identically",
        [lineText],
        ([text]) =>
          Effect.gen(function* () {
            const normalize = JsoncTextHashOptions.make({ normalizeEol: true });
            const digest = yield* JsoncFingerprint.hashText(text, normalize);
            assert.strictEqual(yield* JsoncFingerprint.hashText(JsoncFingerprint.normalizeEol(text)), digest);
            assertSuccess(JsoncFingerprint.hashTextResult(text, nodeDigest, normalize), digest);
          }),
        runs
      );
    });
  });
});
