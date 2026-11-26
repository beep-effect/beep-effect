import { DocumentKeyMismatch, DocumentKeyRepeated } from "@beep/annotation/AnnotationDocument";
import { AnnotationId } from "@beep/annotation/AnnotationId";
import { TextDocument } from "@beep/annotation/Kinds";
import { fcRuns } from "@beep/fc-runs";
import { JsoncFingerprint } from "@beep/jsonc/JsoncFingerprint";
import { ContentHash } from "@beep/schema/ContentHash";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { codec, fixtureGeneration, fixtureParts } from "./support/fixtures.ts";
import { documentCase, runOf } from "./support/generators.ts";

const runs = { arbitrary: fcRuns(60) };

const decodeBare = S.decodeUnknownEffect(S.toCodecJson(TextDocument));

const canonical = (value: unknown) => Effect.fromResult(JsoncFingerprint.canonicalizeResult(value));

type Envelope = Effect.Success<ReturnType<typeof codec.encode>>;

const TaggedJson = S.Struct({ _tag: S.String });

const JsonText = S.fromJsonString(S.Unknown);

const decodeAnnotationId = S.decodeUnknownOption(AnnotationId);

const head = <Value>(values: ReadonlyArray<Value>): Value => O.getOrThrow(A.head(values));

const reversed = (envelope: Envelope): Envelope => ({
  ...envelope,
  anchors: A.reverse(envelope.anchors),
  annotations: A.reverse(envelope.annotations),
  attribution: A.map(A.reverse(envelope.attribution), ([key, generations]) => [key, A.reverse(generations)] as const),
});

const fake = ContentHash.make(`sha256:${Str.repeat(64)("f")}`);

const replaceEverywhere = (value: unknown, from: string, to: string): unknown =>
  S.encodeResult(JsonText)(value).pipe(
    Result.map(Str.replaceAll(from, to)),
    Result.flatMap(S.decodeResult(JsonText)),
    Result.getOrThrow
  );

const keyOfKind = (encoded: Envelope, kind: string): AnnotationId =>
  A.findFirst(encoded.annotations, ([key, value]) =>
    S.is(TaggedJson)(value) && value._tag === kind ? decodeAnnotationId(key) : O.none()
  ).pipe(O.getOrThrow);

it.layer(Digest.layerWebCrypto, { timeout: "20 seconds" })("@beep/annotation document codec", (it) => {
  it.effect("keeps the bytes of the canonical fixture document", (context) =>
    Effect.gen(function* () {
      const document = yield* codec.assemble(fixtureParts);
      const bytes = yield* codec.encode(document).pipe(Effect.flatMap(canonical));
      yield* Effect.promise(() =>
        context.expect(`${bytes}\n`).toMatchFileSnapshot("./fixtures/canonical-document-v1.jcs")
      );
    })
  );

  it.effect(
    "decodes a reordered copy of the fixture and re-encodes it to the same bytes",
    Effect.fnUntraced(function* () {
      const document = yield* codec.assemble(fixtureParts);
      const encoded = yield* codec.encode(document);
      const decoded = yield* codec.decode(reversed(encoded));
      expect(decoded).toEqual(document);
      const before = yield* canonical(encoded);
      const after = yield* codec.encode(decoded).pipe(Effect.flatMap(canonical));
      expect(after).toBe(before);
    })
  );

  it.effect.prop(
    "round-trips generated documents and encodes one byte form per document",
    [documentCase],
    ([{ document }]) =>
      Effect.gen(function* () {
        const encoded = yield* codec.encode(document);
        const decoded = yield* codec.decode(encoded);
        expect(decoded).toEqual(document);
        const reread = yield* codec.decode(reversed(encoded));
        const bytes = yield* Effect.forEach(
          [decoded, reread],
          (value) => codec.encode(value).pipe(Effect.flatMap(canonical)),
          {
            concurrency: 1,
          }
        );
        expect(A.dedupe(bytes)).toHaveLength(1);
      }),
    runs
  );

  it.effect(
    "refuses a repeated key in each table, which the bare schema accepts",
    Effect.fnUntraced(function* () {
      const document = yield* codec.assemble(fixtureParts);
      const encoded = yield* codec.encode(document);
      const repeats = [
        ["anchors", { ...encoded, anchors: A.append(encoded.anchors, head(encoded.anchors)) }],
        ["annotations", { ...encoded, annotations: A.append(encoded.annotations, head(encoded.annotations)) }],
        ["attribution", { ...encoded, attribution: A.append(encoded.attribution, head(encoded.attribution)) }],
      ] as const;
      for (const [table, repeated] of repeats) {
        const accepted = yield* decodeBare(repeated);
        expect(accepted).toEqual(document);
        const refused = yield* Effect.flip(codec.decode(repeated));
        expect(refused).toEqual(DocumentKeyRepeated.make({ table, key: head(encoded[table])[0] }));
      }
    })
  );

  it.effect(
    "refuses a key that is not the hash of its value in each table",
    Effect.fnUntraced(function* () {
      const document = yield* codec.assemble(fixtureParts);
      const encoded = yield* codec.encode(document);
      const forgedAnchorWithResolvingTargets = replaceEverywhere(encoded, head(encoded.anchors)[0], fake);
      const word = keyOfKind(encoded, "Word");
      const run = runOf({ content: word, activity: fixtureGeneration.activity });
      const forgedAnnotation = replaceEverywhere(
        replaceEverywhere(
          encoded,
          run,
          runOf({ content: AnnotationId.make(fake), activity: fixtureGeneration.activity })
        ),
        word,
        fake
      );
      const forgedRunTheSchemaSeesAsAnyBrandedHash = replaceEverywhere(encoded, run, fake);
      const cases = [
        [forgedAnchorWithResolvingTargets, "anchors"],
        [forgedAnnotation, "annotations"],
        [forgedRunTheSchemaSeesAsAnyBrandedHash, "attribution"],
      ] as const;
      for (const [forged, table] of cases) {
        yield* decodeBare(forged);
        const refused = yield* Effect.flip(codec.decode(forged));
        expect(refused).toEqual(DocumentKeyMismatch.make({ table, key: fake }));
      }
    })
  );

  it.effect(
    "refuses input that is not a document envelope with the schema error",
    Effect.fnUntraced(function* () {
      const refused = yield* Effect.flip(codec.decode({ anchors: "none" }));
      expect(S.isSchemaError(refused)).toBe(true);
    })
  );
});
