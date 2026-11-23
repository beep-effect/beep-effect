/**
 * Checked and canonical handoff wire codecs.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LangExtractId } from "@beep/identity/packages";
import { mintActivityId } from "@beep/jsonc/ActivityStart";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { ExtractionHandoff, extractionDocumentCodec, HandoffRefused } from "./Handoff.model.ts";

const $I = $LangExtractId.create("Handoff/Handoff.codec");
const Envelope = S.StructWithRest(
  S.Struct({ document: S.Unknown, readings: S.Array(S.Tuple([S.String, S.Unknown])) }),
  [S.Record(S.String, S.Unknown)]
).pipe($I.annoteSchema("HandoffEnvelope", { description: "Handoff JSON before reading-key collapse." }));
const decodeEnvelope = S.decodeUnknownEffect(Envelope);
const Json = S.toCodecJson(ExtractionHandoff);
const decodeJson = S.decodeUnknownEffect(Json);
const encodeJson = S.encodeEffect(ExtractionHandoff);
const byKey = Order.mapInput(Order.String, (entry: readonly [string, unknown]) => entry[0]);
const byCandidate = Order.mapInput(Order.Number, (reading: { readonly candidate: number }) => reading.candidate);

/**
 * Decode a handoff through its document and activity integrity checks.
 * **Example** (Build the wire reader)
 * ```ts
 * import { decodeExtractionHandoff } from "@beep/langextract/Handoff"
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 *
 * const readWire = (input: unknown) =>
 *   decodeExtractionHandoff(input).pipe(Effect.provide(Digest.layerWebCrypto))
 * console.log(typeof readWire)
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const decodeExtractionHandoff = Effect.fn("LangExtract.decodeExtractionHandoff")(function* (input: unknown) {
  const envelope = yield* decodeEnvelope(input);
  const keys = A.sort(
    A.map(envelope.readings, ([key]) => key),
    Order.String
  );
  const repeated = A.findFirst(A.zip(keys, A.drop(keys, 1)), ([key, next]) => (key === next ? O.some(key) : O.none()));
  if (O.isSome(repeated)) return yield* HandoffRefused.make({ reason: "readings-key-repeated", key: repeated.value });
  yield* extractionDocumentCodec.decode(envelope.document);
  const handoff = yield* decodeJson(input);
  const id = yield* mintActivityId(handoff.activity.start);
  if (id !== handoff.activity.id)
    return yield* HandoffRefused.make({ reason: "activity-id-mismatch", key: handoff.activity.id });
  return handoff;
});

/**
 * Encode one canonical document and sort readings by annotation id and candidate index.
 * **Example** (Build the wire writer)
 * ```ts
 * import { encodeExtractionHandoff } from "@beep/langextract/Handoff"
 * import type { ExtractionHandoff } from "@beep/langextract/Handoff"
 *
 * const writeWire = (checked: ExtractionHandoff) => encodeExtractionHandoff(checked)
 * console.log(typeof writeWire)
 * ```
 * @category codecs
 * @since 0.0.0
 */
export const encodeExtractionHandoff = Effect.fn("LangExtract.encodeExtractionHandoff")(function* (
  handoff: ExtractionHandoff
) {
  const encoded = yield* encodeJson(handoff);
  const document = yield* extractionDocumentCodec.encode(handoff.document);
  return {
    ...encoded,
    document,
    readings: A.map(
      A.sort(encoded.readings, byKey),
      ([key, readings]) => [key, A.sort(readings, byCandidate)] as const
    ),
  };
});
