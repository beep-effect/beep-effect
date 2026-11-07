/** Versioned engine commitment using Schema codecs and the existing digest codec.
 * Build/port attestation belongs to the trusted installer, never request data.
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
import { CitationDefaultAssetIdentities, makeCitationDefaultConfiguration } from "./DefaultConfiguration.ts";
import { CitationMetadataYearBound } from "./MetadataYear.ts";
import { CitationNativeRuntimeKind } from "./NativeProcess.ts";
import { decodeCitationRegexPolicy } from "./RegexPolicy.ts";
import { snapshotCitationValue } from "./Snapshot.ts";

const $I = $LawPracticeServerId.create("internal/Citation/EngineArtifact");
const Version = S.NonEmptyString.check(S.isMaxLength(128));
/** Deployment-owned build and selected-port identities. The implementation
 * digest covers code, dependencies and native assets; it is not self-attested by
 * this hash helper. Changing captured port behavior requires a changed identity.
 * @internal @category models @since 0.0.0
 */
export class CitationEngineBuildIdentity extends S.Opaque<
  CitationEngineBuildIdentity,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    implementation: Sha256Hex,
    runtime: S.Struct({ kind: CitationNativeRuntimeKind, version: Version }),
    cleaner: Sha256Hex,
    tokenizer: Sha256Hex,
  }).pipe(
    $I.annoteSchema("CitationEngineBuildIdentity", {
      description:
        "Trusted build/runtime/port metadata; no paths, function values, ambient reads or request authority.",
    })
  )
) {}
/** @internal @category models @since 0.0.0 */
export class CitationEngineArtifactDescriptor extends S.Opaque<
  CitationEngineArtifactDescriptor,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    build: CitationEngineBuildIdentity,
    assets: CitationDefaultAssetIdentities,
    highestValidYear: CitationMetadataYearBound,
    limits: CitationEngineLimits,
  }).pipe(
    $I.annoteSchema("CitationEngineArtifactDescriptor", {
      description:
        "Build plus authenticated data, captured calendar and policy bound by the versioned engine protocol.",
    })
  )
) {}
/** @internal @category errors @since 0.0.0 */
export class CitationEngineArtifactFailure extends S.TaggedError<
  CitationEngineArtifactFailure,
  { readonly brand: unique symbol }
>($I`CitationEngineArtifactFailure`)(
  "CitationEngineArtifactFailure",
  {},
  $I.annoteError<CitationEngineArtifactFailure>("CitationEngineArtifactFailure", {
    description: "Invalid installation identity or failed digest without metadata values or nested causes.",
  })
) {}
const invalid = () => CitationEngineArtifactFailure.make({});
const Preimage = S.fromJsonString(
  S.Tuple([
    S.tag("citation-engine-artifact/v1"),
    S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    S.tag("cpython-3.11.15/unicode-14.0.0/hash-seed-0/captured-source-runtime"),
    Sha256Hex,
    CitationNativeRuntimeKind,
    Version,
    Sha256Hex,
    Sha256Hex,
    Sha256Hex,
    Sha256Hex,
    Sha256Hex,
    CitationMetadataYearBound,
    S.Array(S.Tuple([S.NonEmptyString, S.Finite])).check(S.isMaxLength(128)),
  ])
).pipe(
  $I.annoteSchema("Preimage", {
    description: "Frozen ordered engine identity protocol with sorted schema-encoded numeric policy entries.",
  })
);
const DescriptorType = S.toType(CitationEngineArtifactDescriptor);
const DescriptorJson = CitationEngineArtifactDescriptor.pipe(S.toCodecJson, S.fromJsonString);
const BuildJson = CitationEngineBuildIdentity.pipe(S.toCodecJson, S.fromJsonString);
const LimitsJson = CitationEngineLimits.pipe(S.toCodecJson, S.fromJsonString);
const encodeLimits = S.encodeEffect(CitationEngineLimits);
const encodePreimage = S.encodeEffect(Preimage);
/** Snapshot schema data before hashing. Tuple positions and sorted policy keys
 * remove property insertion-order dependence; no generic serializer is added.
 * This commits the installer's claims and does not authenticate arbitrary code.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationEngineArtifact = Effect.fn("Citation.makeEngineArtifact")(function* (input: unknown) {
  const decoded = yield* S.decodeUnknownEffect(DescriptorType)(input).pipe(Effect.mapError(invalid));
  const descriptor = yield* snapshotCitationValue(DescriptorJson, decoded, invalid);
  const limits = yield* encodeLimits(descriptor.limits).pipe(Effect.mapError(invalid));
  const entries = A.sort(
    R.toEntries(limits),
    Order.mapInput(Order.String, (row: readonly [string, number]) => row[0])
  );
  const build = descriptor.build;
  const text = yield* encodePreimage([
    "citation-engine-artifact/v1",
    "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e",
    "cpython-3.11.15/unicode-14.0.0/hash-seed-0/captured-source-runtime",
    build.implementation,
    build.runtime.kind,
    build.runtime.version,
    build.cleaner,
    build.tokenizer,
    descriptor.assets.parserCatalog,
    descriptor.assets.helpers,
    descriptor.assets.vocabulary,
    descriptor.highestValidYear,
    entries,
  ]).pipe(Effect.mapError(invalid));
  return yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(text)).pipe(
    Effect.mapError(invalid),
    Effect.catchDefect(() => Effect.fail(invalid()))
  );
});
/** Bind identity to configuration actually installed from authenticated assets.
 * The trusted installer supplies build metadata. Its runtime kind must match the
 * installed diff backend; final Layer wiring must use the same selected ports.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationDefaultEngineConfiguration = Effect.fn("Citation.makeDefaultEngineConfiguration")(function* (
  policy: unknown,
  input: unknown,
  buildInput: unknown
) {
  const decoded = yield* S.decodeUnknownEffect(CitationEngineBuildIdentity)(buildInput).pipe(Effect.mapError(invalid));
  const build = yield* snapshotCitationValue(BuildJson, decoded, invalid);
  const decodedLimits = yield* decodeCitationRegexPolicy(policy, invalid);
  const limits = yield* snapshotCitationValue(LimitsJson, decodedLimits, invalid);
  const installed = yield* makeCitationDefaultConfiguration(limits, input);
  const loop = installed.configuration.extraction.extraction.loop;
  if (build.runtime.kind !== installed.configuration.extraction.document.diffRuntime.kind) return yield* invalid();
  const descriptor = CitationEngineArtifactDescriptor.make({
    build,
    assets: installed.assets,
    highestValidYear: loop.full.case.post.highestValidYear,
    limits,
  });
  const engineArtifact = yield* makeCitationEngineArtifact(descriptor);
  return { ...installed, descriptor, engineArtifact };
});
