/** Structural ownership snapshots through the caller's canonical JSON codec.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineLimits } from "@beep/law-practice-use-cases/server";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { decodeCitationRegexPolicy } from "./RegexPolicy.ts";

/** Copy structural data before asynchronous verification; retain codec services
 * and the caller's closed failure mapping in both directions.
 * @internal @category operations @since 0.0.0
 */
export const snapshotCitationValue = Effect.fn("Citation.snapshotValue")(function* <T, RD, RE, E>(
  codec: S.Codec<T, string, RD, RE>,
  value: T,
  invalid: () => E
) {
  const json = yield* S.encodeEffect(codec)(value).pipe(Effect.mapError(invalid));
  return yield* S.decodeEffect(codec)(json).pipe(Effect.mapError(invalid));
});

/** Decode a citation boundary and retain an owned snapshot through its canonical
 * codec. Boundary, encoding and decoding services stay explicit; callers select
 * the same closed failure mapping for each step.
 * @internal @category operations @since 0.0.0
 */
export const captureCitationSnapshot = Effect.fn("Citation.captureSnapshot")(function* <T, RB, RD, RE, E>(
  boundary: S.Decoder<T, RB>,
  codec: S.Codec<T, string, RD, RE>,
  input: unknown,
  invalid: () => E
) {
  const decoded = yield* S.decodeUnknownEffect(boundary)(input).pipe(Effect.mapError(invalid));
  return yield* snapshotCitationValue(codec, decoded, invalid);
});

/** Encode execution policy into sorted numeric entries for versioned artifact
 * tuples. The caller retains ownership of the surrounding protocol and errors.
 * @internal @category operations @since 0.0.0
 */
export const citationArtifactPolicyEntries = Effect.fn("Citation.artifactPolicyEntries")(function* <E>(
  limits: CitationEngineLimits,
  invalid: () => E
) {
  const encoded = yield* S.encodeEffect(CitationEngineLimits)(limits).pipe(Effect.mapError(invalid));
  return A.sort(
    R.toEntries(encoded),
    Order.mapInput(Order.String, (row: readonly [string, number]) => row[0])
  );
});

/** Digest text already encoded by a versioned artifact's Schema codec. This
 * performs no serialization and preserves the caller's source-free error mapping.
 * @internal @category operations @since 0.0.0
 */
export const digestCitationArtifactText = Effect.fn("Citation.digestArtifactText")(function* <E>(
  text: string,
  invalid: () => E
) {
  return yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(text)).pipe(
    Effect.mapError(invalid),
    Effect.catchDefect(() => Effect.fail(invalid()))
  );
});

const $I = $LawPracticeServerId.create("internal/Citation/Snapshot");
const RestorationIdentity = S.Struct({
  receipt: S.Struct({ engineArtifact: Sha256Hex }),
  expectedEngineArtifact: Sha256Hex,
}).pipe(
  $I.annoteSchema("RestorationIdentity", {
    description: "Minimal artifact relationship required by canonical receipt restoration codecs.",
  })
);
/** Decode and own a canonical restoration input before checking its artifact.
 * Source and occurrence verification remain with the typed receipt producer.
 * @internal @category operations @since 0.0.0
 */
export const captureCitationRestoration = Effect.fn("Citation.captureRestoration")(function* <
  T extends typeof RestorationIdentity.Type,
  RB,
  RD,
  RE,
  E,
>(boundary: S.Decoder<T, RB>, codec: S.Codec<T, string, RD, RE>, input: unknown, invalid: () => E, stale: () => E) {
  const snapshot = yield* captureCitationSnapshot(boundary, codec, input, invalid);
  if (snapshot.receipt.engineArtifact !== snapshot.expectedEngineArtifact) return yield* Effect.fail(stale());
  return snapshot;
});

const OperationLimitsJson = CitationEngineLimits.pipe(S.toCodecJson, S.fromJsonString);
/** Own the trusted operation policy and implementation reference before retaining
 * either in a returned method. The enclosing installer authenticates the build;
 * this shared boundary validates its reference and copies the policy by codec.
 * @internal @category operations @since 0.0.0
 */
export const captureCitationOperationPolicy = Effect.fn("Citation.captureOperationPolicy")(function* <E>(
  policy: unknown,
  artifact: unknown,
  invalid: () => E
) {
  const decoded = yield* decodeCitationRegexPolicy(policy, invalid);
  const limits = yield* snapshotCitationValue(OperationLimitsJson, decoded, invalid);
  const engineArtifact = yield* S.decodeUnknownEffect(Sha256Hex)(artifact).pipe(Effect.mapError(invalid));
  return { limits, engineArtifact };
});
