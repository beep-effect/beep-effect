/** Production default extraction assembly from authenticated eyecite assets.
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { makeCitationHelperConfigurations } from "./HelperConfigurations.ts";
import { CitationNativeProcessRuntime } from "./NativeProcess.ts";
import { makeCitationParserCatalog } from "./ParserCatalog.ts";
import { CitationSemanticExtractionConfiguration } from "./SemanticExtraction.ts";
import { loadCitationSemanticVocabularyAsset } from "./SemanticVocabulary.ts";
import { CitationTokenDispatchBindings } from "./TokenDispatch.ts";

const $I = $LawPracticeServerId.create("internal/Citation/DefaultConfiguration");
/** @internal @category errors @since 0.0.0 */
export class CitationDefaultConfigurationFailure extends S.TaggedError<
  CitationDefaultConfigurationFailure,
  { readonly brand: unique symbol }
>($I`CitationDefaultConfigurationFailure`)(
  "CitationDefaultConfigurationFailure",
  {},
  $I.annoteError<CitationDefaultConfigurationFailure>("CitationDefaultConfigurationFailure", {
    description: "Invalid trusted installation input without paths, runtime data or schema causes.",
  })
) {}
const invalid = () => CitationDefaultConfigurationFailure.make({});
const Path = S.NonEmptyString.check(S.isMaxLength(4096));
/** Trusted server locations and executable backend, never raw request fields.
 * @internal @category models @since 0.0.0
 */
export class CitationDefaultConfigurationInput extends S.Opaque<
  CitationDefaultConfigurationInput,
  { readonly brand: unique symbol }
>()(
  S.Struct({ parserCatalog: Path, helpers: Path, vocabulary: Path, diffRuntime: CitationNativeProcessRuntime }).pipe(
    $I.annoteSchema("CitationDefaultConfigurationInput", {
      description: "Explicit server-owned asset paths and existing diff runtime; no ambient environment reads.",
    })
  )
) {}
/** Individual data identities are not a complete engine implementation identity.
 * @internal @category models @since 0.0.0
 */
export class CitationDefaultAssetIdentities extends S.Opaque<
  CitationDefaultAssetIdentities,
  { readonly brand: unique symbol }
>()(
  S.Struct({ parserCatalog: Sha256Hex, helpers: Sha256Hex, vocabulary: Sha256Hex }).pipe(
    $I.annoteSchema("CitationDefaultAssetIdentities", {
      description: "Authenticated data identities retained separately from native/code/port implementation identity.",
    })
  )
) {}
/** Capture complete default parsing, document geometry and semantic projection
 * configuration plus its existing frozen-edition owner. Calendar state is captured
 * by the helper installer. Installation grants no request/native execution.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationDefaultConfiguration = Effect.fn("Citation.makeDefaultConfiguration")(function* (
  policy: unknown,
  input: unknown
) {
  const config = yield* S.decodeUnknownEffect(CitationDefaultConfigurationInput)(input).pipe(Effect.mapError(invalid));
  const catalog = yield* makeCitationParserCatalog(policy, config.parserCatalog);
  const bindings = yield* S.decodeEffect(CitationTokenDispatchBindings)(
    A.map(catalog.tokenizer.editions, (row) => ({ id: row.id, ref: row.ref }))
  ).pipe(Effect.mapError(invalid));
  const helpers = yield* makeCitationHelperConfigurations(policy, config.helpers, bindings);
  const vocabulary = yield* loadCitationSemanticVocabularyAsset(config.vocabulary);
  const configuration = CitationSemanticExtractionConfiguration.make({
    extraction: {
      document: { discovery: helpers.discovery, diffRuntime: config.diffRuntime },
      extraction: { tokenizer: catalog.tokenizer, loop: helpers.loop },
    },
    semantic: { vocabulary: vocabulary.text, editions: bindings },
  });
  const assets = CitationDefaultAssetIdentities.make({
    parserCatalog: catalog.artifact,
    helpers: helpers.artifact,
    vocabulary: vocabulary.artifact,
  });
  return { configuration, editions: catalog.editions, assets };
});
