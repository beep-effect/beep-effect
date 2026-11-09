/**
 * Versioned six-form installation commitment without legacy runtime claims.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CourtReporterArtifactVersion } from "@beep/law-practice-domain/values/CourtReporterVocabulary";
import { CitationEngineLimits, CitationInputError } from "@beep/law-practice-use-cases/server";
import { Sha256Hex } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CitationNativeRuntimeKind } from "./NativeProcess.ts";
import { captureCitationSnapshot, citationArtifactPolicyEntries, digestCitationArtifactText } from "./Snapshot.ts";

const $I = $LawPracticeServerId.create("internal/Citation/SixFormArtifact");
const Version = S.NonEmptyString.check(S.isMaxLength(128));

/**
 * Trusted installer claims about the implementation, runtime, policy and canonical
 * vocabulary. Hashing commits these claims; it does not authenticate the build or
 * prove that the described executable was installed.
 *
 * **Example** (Inspect the trusted vocabulary binding)
 * ```ts
 * import { CitationSixFormArtifactDescriptor } from "@beep/law-practice-server/internal/Citation/SixFormArtifact"
 * console.log(CitationSixFormArtifactDescriptor.fields.vocabularyVersion !== undefined) // true
 * ```
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationSixFormArtifactDescriptor extends S.Opaque<
  CitationSixFormArtifactDescriptor,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    implementation: Sha256Hex,
    runtime: S.Struct({ kind: CitationNativeRuntimeKind, version: Version }),
    limits: CitationEngineLimits,
    vocabularyVersion: CourtReporterArtifactVersion,
  }).pipe(
    $I.annoteSchema("CitationSixFormArtifactDescriptor", {
      description: "Installer-owned implementation, selected runtime, effective policy and vocabulary claims.",
    })
  )
) {}

const DescriptorType = S.toType(CitationSixFormArtifactDescriptor);
const DescriptorJson = CitationSixFormArtifactDescriptor.pipe(S.toCodecJson, S.fromJsonString);
const Preimage = S.fromJsonString(
  S.Tuple([
    S.tag("citation-extractor-artifact/v1"),
    S.tag("eyecite-ts"),
    S.tag("0.34.2"),
    S.tag("sha512-QPTLaIX32YDsD666fjJjODQ7qHIbwEx1I1Lko98Ps5ssPtK7Wy2/WuHqi1V0CwsIw6DqaVF5EXLs8/yE6MdShg=="),
    S.tag("six-form/v1"),
    S.tag("strict-linking/v1"),
    Sha256Hex,
    CitationNativeRuntimeKind,
    Version,
    CourtReporterArtifactVersion,
    S.Array(S.Tuple([S.NonEmptyString, S.Finite])).check(S.isMaxLength(128)),
  ])
).pipe(
  $I.annoteSchema("Preimage", {
    description:
      "Ordered six-form artifact protocol with pinned package integrity and sorted numeric execution policy.",
  })
);
const invalid = () => CitationInputError.make({ operation: "extract" });

/**
 * Snapshot trusted installation metadata and commit the exact six-form protocol.
 * No request data, source text, legacy oracle or CPython runtime claim enters the
 * commitment. Changing implementation behavior requires a changed build identity.
 *
 * **Example** (Reference the installation commitment producer)
 * ```ts
 * import { makeCitationSixFormArtifact } from "@beep/law-practice-server/internal/Citation/SixFormArtifact"
 * console.log(typeof makeCitationSixFormArtifact) // "function"
 * ```
 * @internal
 * @category operations
 * @since 0.0.0
 */
export const makeCitationSixFormArtifact = Effect.fn("Citation.makeSixFormArtifact")(function* (input: unknown) {
  const descriptor = yield* captureCitationSnapshot(DescriptorType, DescriptorJson, input, invalid);
  const entries = yield* citationArtifactPolicyEntries(descriptor.limits, invalid);
  const text = yield* S.encodeEffect(Preimage)([
    "citation-extractor-artifact/v1",
    "eyecite-ts",
    "0.34.2",
    "sha512-QPTLaIX32YDsD666fjJjODQ7qHIbwEx1I1Lko98Ps5ssPtK7Wy2/WuHqi1V0CwsIw6DqaVF5EXLs8/yE6MdShg==",
    "six-form/v1",
    "strict-linking/v1",
    descriptor.implementation,
    descriptor.runtime.kind,
    descriptor.runtime.version,
    descriptor.vocabularyVersion,
    entries,
  ]).pipe(Effect.mapError(invalid));
  return yield* digestCitationArtifactText(text, invalid);
});
