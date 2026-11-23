import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import {
  Jsonc,
  JsoncCanonicalizeError,
  JsoncCanonicalizeErrorCode,
  JsoncCanonicalizeOptions,
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
} from "@beep/jsonc";
import { assert, describe, it } from "@effect/vitest";
import { assertDefined, assertFailure, assertFalse, assertSome, assertSuccess, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
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
import { sha256 } from "./support/Sha256.ts";
import type { JsoncDigest } from "@beep/jsonc";

const runs = { arbitrary: fcRuns(100) };

const decodeJson = S.decodeUnknownEffect(S.Json);
const jsonEquivalent = S.toEquivalence(S.Json);
const compact = JsoncStringifyOptions.make({ tabSize: 0 });
const commentsRejected = JsoncParseOptions.make({ disallowComments: true });

const parseJson = Effect.fnUntraced(function* (text: string, options?: JsoncParseOptions) {
  const parsed1 = yield* Jsonc.parse(text, options);
  return yield* decodeJson(parsed1);
});

const members = (value: unknown): ReadonlyArray<readonly [string, unknown]> => {
  if (A.isArray(value)) {
    return A.map(value, (item, index): readonly [string, unknown] => [String(index), item]);
  }
  return P.isObject(value) ? R.toEntries(value) : A.empty();
};

const reverseKeys = (value: unknown): unknown => {
  if (A.isArray(value)) {
    return A.map(value, (item) => reverseKeys(item));
  }
  if (P.isObject(value)) {
    return R.fromEntries(
      A.reverse(A.map(R.toEntries(value), ([key, item]): readonly [string, unknown] => [key, reverseKeys(item)]))
    );
  }
  return value;
};

const UNSET_KEY = "unset";

const withUnsetMembers = (value: unknown): unknown => {
  if (A.isArray(value)) {
    return A.map(value, (item) => withUnsetMembers(item));
  }
  if (P.isObject(value)) {
    const mapped = R.map(value, (item) => withUnsetMembers(item));
    return R.has(mapped, UNSET_KEY) ? mapped : { ...mapped, [UNSET_KEY]: undefined };
  }
  return value;
};

const withUnsetMembersWouldAddAMember = (value: unknown): boolean =>
  (P.isObject(value) && !A.isArray(value) && !R.has(value, UNSET_KEY)) ||
  A.some(members(value), ([, item]) => withUnsetMembersWouldAddAMember(item));

const isWellFormedSoRfc8785CanonicalizationIsTotal = (value: unknown): boolean =>
  P.isString(value)
    ? value.isWellFormed()
    : A.every(
        members(value),
        ([key, item]) => key.isWellFormed() && isWellFormedSoRfc8785CanonicalizationIsTotal(item)
      );

const leaves = (value: unknown): number =>
  A.isArray(value) || P.isObject(value) ? A.reduce(members(value), 0, (count, [, item]) => count + leaves(item)) : 1;

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

const decorateBetweenTokensWithCommentsAndTrailingCommas = (json: string): string =>
  `// lead\n${pipe(json, Str.replace(/\n(\s*[}\]])/g, ",\n$1"), Str.replaceAll("\n", "\n/* c */"))} /* tail */`;

const render = Effect.fnUntraced(function* (value: S.Json, options: JsoncStringifyOptions) {
  const stringify2 = yield* Jsonc.stringify(value, options);
  return decorateBetweenTokensWithCommentsAndTrailingCommas(stringify2);
});

const FormattingSampleWithAnEolAFormatterCanHonour = S.Struct({
  tabSize: S.Int.check(S.isBetween({ minimum: 0, maximum: 8 })),
  insertSpaces: S.Boolean,
  eol: S.Literals(["\n", "\r\n"]),
  insertFinalNewline: S.Boolean,
  keepLines: S.Boolean,
});

const ConfigWithNonIdentitySizeEncoding = S.Struct({
  name: S.String,
  port: S.Int,
  size: S.BigIntFromString,
  enabled: S.Boolean,
  tags: S.Array(S.String),
  extra: S.optionalKey(S.Json),
});
const decodeConfigJsonc = S.decodeEffect(Jsonc.schema(ConfigWithNonIdentitySizeEncoding));
const configEquivalent = S.toEquivalence(ConfigWithNonIdentitySizeEncoding);

const Document = S.Struct({ alpha: S.Json, beta: S.Json, gamma: S.Json });
const MemberKey = S.Literals(["alpha", "beta", "gamma"]);

const wellFormedJson = Arbitrary.schema(S.Json).pipe(Arbitrary.filter(isWellFormedSoRfc8785CanonicalizationIsTotal));

const nearMissTextOfJsoncScannerCharacters = S.Literals([
  "{",
  "}",
  "[",
  "]",
  ",",
  ":",
  '"',
  "\\",
  "/",
  "*",
  "1",
  "-",
  ".",
  "e",
  "t",
  "r",
  "u",
  "n",
  "l",
  " ",
  "\n",
  "\r",
  "\u2028",
]).pipe(S.Array, Arbitrary.schema, Arbitrary.map(A.join("")));

const lineText = S.Literals(["a", " ", "\n", "\r", "\r\n", "{", "\u00e9"]).pipe(
  S.Array,
  Arbitrary.schema,
  Arbitrary.map(A.join(""))
);

const RealWebCryptoThroughCoreLayers = Layer.mergeAll(Digest.layerWebCrypto, SecureRandom.layerWebCrypto);
const syncDigest: JsoncDigest = sha256;

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
        const encoded3 = yield* encode(decoded);
        assert.deepStrictEqual(encoded3, encoded, "re-encoding the decoded value reproduces the encoded form");
      }),
    runs
  );
};

describe("jsonc property floor (effected-port goal 11.4, D10), not repeating the properties Jsonc.test.ts and JsoncFormatter.test.ts already hold", () => {
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
    roundTrips("JsoncCanonicalizeOptions", JsoncCanonicalizeOptions);
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
          const value26 = yield* S.decodeEffect(codec)(text);
          const decodedJson = yield* decodeJson(value26);
          assertTrue(jsonEquivalent(decodedJson, value));
        }),
      runs
    );

    it.effect.prop(
      "Jsonc.schema(Target, options) round-trips a domain value, and decodes its commented rendering",
      [Arbitrary.schema(JsoncParseOptions), Arbitrary.schema(ConfigWithNonIdentitySizeEncoding)],
      ([options, value]) =>
        Effect.gen(function* () {
          const codec = Jsonc.schema(ConfigWithNonIdentitySizeEncoding, options);
          const text = yield* S.encodeEffect(codec)(value);
          const value4 = yield* S.decodeEffect(codec)(text);
          assertTrue(configEquivalent(value4, value));
          const decodedConfigJsonc = yield* decodeConfigJsonc(decorateBetweenTokensWithCommentsAndTrailingCommas(text));
          assertTrue(configEquivalent(decodedConfigJsonc, value));
        }),
      runs
    );

    it.effect.prop(
      "Jsonc.bind(Target) decodes what it encodes, through the bound and the composed codec alike",
      [Arbitrary.schema(ConfigWithNonIdentitySizeEncoding)],
      ([value]) =>
        Effect.gen(function* () {
          const bound = Jsonc.bind(ConfigWithNonIdentitySizeEncoding);
          const text = yield* bound.encode(value);
          const decoded5 = yield* bound.decode(text);
          assertTrue(configEquivalent(decoded5, value));
          const value6 = yield* S.encodeEffect(bound.schema)(value);
          assert.strictEqual(value6, text);
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
          const render7 = yield* render(value, rendering);
          const parsed = yield* parseJson(render7);
          assertTrue(jsonEquivalent(parsed, value));
          const stringify27 = yield* Jsonc.stringify(parsed, restringify);
          const parsedJson = yield* parseJson(stringify27);
          assertTrue(jsonEquivalent(parsedJson, parsed));
        }),
      runs
    );

    it.effect.prop(
      "the AST evaluates to the parsed value",
      [Arbitrary.schema(S.Json), Arbitrary.schema(JsoncStringifyOptions)],
      ([value, rendering]) =>
        Effect.gen(function* () {
          const text = yield* render(value, rendering);
          const parsedTree = yield* Jsonc.parseTree(text);
          const root = yield* Effect.fromOption(parsedTree);
          const decodedJson8 = yield* decodeJson(root.toValue());
          const parsedJson28 = yield* parseJson(text);
          assertTrue(jsonEquivalent(decodedJson8, parsedJson28));
        }),
      runs
    );

    it.effect.prop(
      "parsing is total on hostile text, and the value and AST modes agree",
      [nearMissTextOfJsoncScannerCharacters],
      ([text]) =>
        Effect.gen(function* () {
          const tree = Jsonc.parseTreeResult(text);
          Result.match(Jsonc.parseResult(text), {
            onFailure: (error) => assertFailure(tree, error),
            onSuccess: (value) =>
              assertSuccess(
                Result.map(
                  tree,
                  O.map((root) => root.toValue())
                ),
                O.some(value)
              ),
          });
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
          const parsedJson9 = yield* parseJson(stripped, commentsRejected);
          assertTrue(jsonEquivalent(parsedJson9, value));
          const blanked = Jsonc.stripComments(text, " ");
          assert.strictEqual(blanked.length, text.length);
          const parsedJson10 = yield* parseJson(blanked, commentsRejected);
          assertTrue(jsonEquivalent(parsedJson10, value));
        }),
      runs
    );

    it.effect.prop(
      "stripComments is idempotent and offset-stable on hostile text",
      [nearMissTextOfJsoncScannerCharacters],
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
          const stringify11 = yield* Jsonc.stringify(reverseKeys(value), compact);
          assertTrue(Jsonc.equals(text, stringify11));
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
          const text = decorateBetweenTokensWithCommentsAndTrailingCommas(json);
          const parsed = yield* Jsonc.parse(text);
          const parsedTree12 = yield* Jsonc.parseTree(text);
          const root = yield* Effect.fromOption(parsedTree12);
          const events = yield* Stream.runCollect(JsoncVisitor.visit(text));
          assert.deepStrictEqual(A.filter(events, JsoncVisitorEvent.guards.Error), []);
          assert.strictEqual(
            A.filter(events, JsoncVisitorEvent.guards.Comment).length,
            2 + lineBreaks(json),
            "the decoration adds a lead comment, one comment per line break and a tail comment"
          );
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
      [
        Arbitrary.schema(S.Json),
        Arbitrary.schema(JsoncStringifyOptions),
        Arbitrary.schema(FormattingSampleWithAnEolAFormatterCanHonour),
      ],
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
          const parsedJson13 = yield* parseJson(once);
          assertTrue(jsonEquivalent(parsedJson13, value));
        }),
      runs
    );

    it.effect.prop(
      "formatting is total on hostile text and rewrites only whitespace",
      [nearMissTextOfJsoncScannerCharacters, Arbitrary.schema(FormattingSampleWithAnEolAFormatterCanHonour)],
      ([text, formatting]) =>
        Effect.gen(function* () {
          const edits = JsoncFormatter.format(text, undefined, formatting);
          for (const edit of edits) {
            assert.strictEqual(Str.trim(Str.substring(edit.offset, edit.offset + edit.length)(text)), "");
            assert.strictEqual(Str.trim(edit.content), "");
          }
          assert.strictEqual(
            JsoncFormatter.formatToString(text, undefined, formatting),
            JsoncEdit.applyAll(text, edits),
            "port deviation (upstream-bug): upstream's String.prototype.repeat throws a RangeError on a surplus closer; the lab clamps the indent to none"
          );
        }),
      runs
    );
  });

  describe("modifier laws", () => {
    it.effect.prop(
      "replacing a member edits exactly the value's span, and nothing else",
      [
        Arbitrary.schema(Document),
        Arbitrary.schema(MemberKey),
        Arbitrary.schema(S.Json),
        Arbitrary.schema(JsoncStringifyOptions),
      ],
      ([document, key, next, rendering]) =>
        Effect.gen(function* () {
          const text = yield* render(document, rendering);
          const edits = yield* JsoncModifier.modify(text, [key], next);
          assert.strictEqual(edits.length, 1);
          const [edit] = edits;
          assertDefined(edit);
          const parsedTree14 = yield* Jsonc.parseTree(text);
          const root = yield* Effect.fromOption(parsedTree14);
          assertSome(
            O.map(root.find([key]), (node) => [node.offset, node.length]),
            [edit.offset, edit.length]
          );
          const parsedJson15 = yield* parseJson(JsoncEdit.applyAll(text, edits));
          assertTrue(jsonEquivalent(parsedJson15, { ...document, [key]: next }));
        }),
      runs
    );

    it.effect.prop(
      "deleting a member keeps every other member and the document's outer comments",
      [Arbitrary.schema(Document), Arbitrary.schema(MemberKey), Arbitrary.schema(JsoncStringifyOptions)],
      ([document, key, rendering]) =>
        Effect.gen(function* () {
          const text = yield* render(document, rendering);
          const modify16 = yield* JsoncModifier.modify(text, [key], undefined);
          const result = JsoncEdit.applyAll(text, modify16);
          const parsedJson17 = yield* parseJson(result);
          assertTrue(jsonEquivalent(parsedJson17, R.remove(document, key)));
          assertTrue(Str.startsWith("// lead\n")(result));
          assertTrue(Str.endsWith(" /* tail */")(result));
        }),
      runs
    );

    it.effect.prop(
      "inserting a member is one pure insertion that changes no existing byte",
      [
        Arbitrary.schema(Document),
        Arbitrary.schema(S.Json),
        Arbitrary.schema(JsoncStringifyOptions),
        Arbitrary.schema(FormattingSampleWithAnEolAFormatterCanHonour),
      ],
      ([document, next, rendering, formatting]) =>
        Effect.gen(function* () {
          const text = yield* render(document, rendering);
          const edits = yield* JsoncModifier.modify(text, ["delta"], next, { formattingOptions: formatting });
          assert.deepStrictEqual(
            A.map(edits, (edit) => edit.length),
            [0]
          );
          const parsedJson18 = yield* parseJson(JsoncEdit.applyAll(text, edits));
          assertTrue(jsonEquivalent(parsedJson18, { ...document, delta: next }));
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
          const parsed29 = yield* Jsonc.parse(canonical);
          const canonicalize19 = yield* JsoncFingerprint.canonicalize(parsed29);
          assert.strictEqual(canonicalize19, canonical);
          const parsedJson20 = yield* parseJson(canonical, commentsRejected);
          assertTrue(jsonEquivalent(parsedJson20, value));
          const canonicalize21 = yield* JsoncFingerprint.canonicalize(reverseKeys(value));
          assert.strictEqual(canonicalize21, canonical);
          const stringify22 = yield* Jsonc.stringify(value);
          assertTrue(Jsonc.equals(canonical, stringify22));
        }),
      runs
    );

    it.effect.prop(
      "omitUndefinedMembers changes nothing on JSON and equals deleting the undefined members",
      [wellFormedJson],
      ([value]) =>
        Effect.gen(function* () {
          const omitting = JsoncCanonicalizeOptions.make({ omitUndefinedMembers: true });
          const canonical = yield* JsoncFingerprint.canonicalize(value);
          const unchanged = yield* JsoncFingerprint.canonicalize(value, omitting);
          assert.strictEqual(unchanged, canonical);
          const sparse = withUnsetMembers(value);
          const omitted = yield* JsoncFingerprint.canonicalize(sparse, omitting);
          assert.strictEqual(omitted, canonical);
          assert.strictEqual(
            Result.isFailure(JsoncFingerprint.canonicalizeResult(sparse)),
            withUnsetMembersWouldAddAMember(value)
          );
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

    it.layer(RealWebCryptoThroughCoreLayers)("hashing with a Crypto layer", (it) => {
      it.effect.prop(
        "hash is hashText of the canonical text, agrees with hashResult, and ignores key order",
        [wellFormedJson],
        ([value]) =>
          Effect.gen(function* () {
            const digest = yield* JsoncFingerprint.hash(value);
            const canonicalize30 = yield* JsoncFingerprint.canonicalize(value);
            const hashText23 = yield* JsoncFingerprint.hashText(canonicalize30);
            assert.strictEqual(hashText23, digest);
            assertSuccess(JsoncFingerprint.hashResult(value, syncDigest), digest);
            const hash24 = yield* JsoncFingerprint.hash(reverseKeys(value));
            assert.strictEqual(hash24, digest);
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
            const hashText25 = yield* JsoncFingerprint.hashText(JsoncFingerprint.normalizeEol(text));
            assert.strictEqual(hashText25, digest);
            assertSuccess(JsoncFingerprint.hashTextResult(text, syncDigest, normalize), digest);
          }),
        runs
      );
    });
  });
});
