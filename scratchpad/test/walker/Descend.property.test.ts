import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Getter from "effect/SchemaGetter";
import { DescendError, DescendResult, UnreadableDirectory } from "../../effected/walker/Descend.ts";

const runs = { arbitrary: fcRuns(100) };

// instanceOf has no built-in generator. Supply a generation-only link while
// retaining the public schema's actual encoder, decoder and equivalence.
const ReasonSample = S.Literals(["PermissionDenied", "Unknown", "NotFound"]);
const directorySchema = UnreadableDirectory.mapFields((fields) => ({
  ...fields,
  cause: fields.cause.annotate({
    toCodecArbitrary: () => S.link<PlatformError.PlatformError>()(ReasonSample, {
      decode: Getter.transform((reason) => PlatformError.systemError({ _tag: reason, module: "FileSystem", method: "readDirectory", pathOrDescriptor: "/generated" })),
      encode: Getter.forbiddenEncoding,
    }),
  }),
}));
const resultSchema = DescendResult.mapFields((fields) => ({ ...fields, unreadable: S.Array(directorySchema) }));

describe("descent schemas", () => {
  it.effect.prop("DescendError: decode(encode(x)) equals x and decoding never fails", [Arbitrary.schema(DescendError)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(DescendError)(value);
    const decoded = yield* S.decodeEffect(DescendError)(encoded);
    assertTrue(S.toEquivalence(DescendError)(decoded, value));
    assert.strictEqual(decoded.message, value.message);
    assert.deepStrictEqual(yield* S.encodeEffect(DescendError)(decoded), encoded);
  }), runs);
  it.effect.prop("UnreadableDirectory: decode(encode(x)) preserves path and original cause", [Arbitrary.schema(directorySchema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(UnreadableDirectory)(value);
    const decoded = yield* S.decodeEffect(UnreadableDirectory)(encoded);
    assertTrue(S.toEquivalence(UnreadableDirectory)(decoded, value));
    assert.strictEqual(decoded.cause, value.cause);
    assert.deepStrictEqual(yield* S.encodeEffect(UnreadableDirectory)(decoded), encoded);
  }), runs);
  it.effect.prop("DescendResult: decode(encode(x)) preserves matches and unreadable records", [Arbitrary.schema(resultSchema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(DescendResult)(value);
    const decoded = yield* S.decodeEffect(DescendResult)(encoded);
    assertTrue(S.toEquivalence(DescendResult)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(DescendResult)(decoded), encoded);
  }), runs);
});
