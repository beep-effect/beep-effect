/** Production helper data projected from eyecite 2.7.6, Free Law Project.
 * BSD-2-Clause; see THIRD_PARTY_NOTICES.md. No fixture or test imports.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import { CitationAssetFailureReason, CitationAssetSeal, loadCitationJsonAsset } from "./Asset.ts";
import { CitationCaseMetadataConfiguration } from "./CaseMetadata.ts";
import { CitationExtractionLoopConfiguration } from "./ExtractionLoop.ts";
import { CitationHtmlDiscoveryConfiguration } from "./HtmlDiscovery.ts";
import { CitationJournalMetadataConfiguration } from "./JournalMetadata.ts";
import { CitationLawMetadataConfiguration } from "./LawMetadata.ts";
import { CitationPublicationMetadataConfiguration } from "./MetadataComposition.ts";
import { makeCitationMetadataYear } from "./MetadataYear.ts";
import { CitationPostCaseMetadataConfiguration } from "./PostCaseMetadata.ts";
import { CitationReferencePatternConfiguration } from "./ReferencePatterns.ts";
import { CitationReferenceTokenConfiguration } from "./ReferenceTokenExtraction.ts";
import { CitationTokenDispatchBindings } from "./TokenDispatch.ts";

const $I = $LawPracticeServerId.create("internal/Citation/HelperConfigurations");
const expectedBytes = 127091;
const expectedSha256 = "231c08c796c44dcc0a0d278b03798c29dfadcd2debda09c8b7fff6a6334e40c3";
/** @internal @category errors @since 0.0.0 */
export class CitationHelperConfigurationsFailure extends S.TaggedError<
  CitationHelperConfigurationsFailure,
  { readonly brand: unique symbol }
>($I`CitationHelperConfigurationsFailure`)(
  "CitationHelperConfigurationsFailure",
  { reason: CitationAssetFailureReason },
  $I.annoteError<CitationHelperConfigurationsFailure>("CitationHelperConfigurationsFailure", {
    description: "Helper asset installation failed without paths, patterns or nested causes.",
  })
) {}
const fail = (reason: CitationAssetFailureReason) => CitationHelperConfigurationsFailure.make({ reason });
/** Static patterns derive from existing runtime schemas with only the captured
 * calendar field omitted. Native byte JSON uses Effect's derived Base64 codec.
 * @internal @category models @since 0.0.0
 */
export class CitationHelperConfigurationsAsset extends S.Opaque<
  CitationHelperConfigurationsAsset,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    schemaVersion: S.tag("citation-helper-configurations/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    producerSha256: Sha256Hex,
    inputs: S.Record(S.String, Sha256Hex),
    case: S.Struct({
      names: CitationCaseMetadataConfiguration.fields.names,
      post: S.Struct(Struct.omit(CitationPostCaseMetadataConfiguration.fields, ["highestValidYear"])),
      pre: S.Struct(Struct.omit(CitationPublicationMetadataConfiguration.fields, ["highestValidYear"])),
    }),
    law: S.Struct(Struct.omit(CitationLawMetadataConfiguration.fields, ["highestValidYear"])),
    journal: S.Struct(Struct.omit(CitationJournalMetadataConfiguration.fields, ["highestValidYear"])),
    pin: S.Struct(Struct.omit(CitationPublicationMetadataConfiguration.fields, ["highestValidYear"])),
    supra: CitationReferenceTokenConfiguration.fields.supra,
    generated: CitationReferencePatternConfiguration,
    discovery: CitationHtmlDiscoveryConfiguration,
  }).pipe(
    $I.annoteSchema("CitationHelperConfigurationsAsset", {
      description: "Authenticated static helper data; fixture cases and fixture calendar cutoffs are excluded.",
    })
  )
) {}
const Json = CitationHelperConfigurationsAsset.pipe(S.toCodecJson, S.fromJsonString);
const seal = CitationAssetSeal.make({ byteLength: expectedBytes, sha256: Sha256Hex.make(expectedSha256) });
/** Authenticate the complete bounded asset before schema decoding.
 * @internal @category operations @since 0.0.0
 */
export const loadCitationHelperConfigurations = Effect.fn("Citation.loadHelperConfigurations")(function* (
  input: unknown
) {
  return yield* loadCitationJsonAsset(input, seal, Json, fail);
});
/** Capture one installation calendar ceiling for all five temporal helpers.
 * Runtime paths and executable services remain separately supplied server ports.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationHelperConfigurations = Effect.fn("Citation.makeHelperConfigurations")(function* (
  policy: unknown,
  path: unknown,
  bindings: unknown
) {
  const asset = yield* loadCitationHelperConfigurations(path);
  const editions = yield* S.decodeUnknownEffect(CitationTokenDispatchBindings)(bindings).pipe(
    Effect.mapError(() => fail("invalid-data"))
  );
  const { highestValidYear } = yield* makeCitationMetadataYear(policy);
  const names = asset.case.names;
  const loop = CitationExtractionLoopConfiguration.make({
    full: {
      editions,
      case: {
        names,
        post: { ...asset.case.post, highestValidYear },
        pre: { ...asset.case.pre, highestValidYear },
      },
      law: { ...asset.law, highestValidYear },
      journal: { ...asset.journal, highestValidYear },
    },
    reference: { editions, names, pin: { ...asset.pin, highestValidYear }, supra: asset.supra },
    generated: asset.generated,
  });
  return { loop, discovery: asset.discovery, artifact: Sha256Hex.make(expectedSha256) };
});
