/**
 * The legal vocabulary asset pack: where its manifest lives and the pins of
 * the concept schemes it holds.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { IRI } from "@beep/identity/Iri";
import { $LawPracticeDomainId, $SemanticFoundationId } from "@beep/identity/packages";
import { ConceptSchemePin } from "@beep/ontology/ConceptScheme";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/LegalVocabularyPack/LegalVocabularyPack.model");

const pin = (path: string) =>
  ConceptSchemePin.make({ scheme: IRI.make($SemanticFoundationId.create(path).iri), version: "1.0.0" });

/**
 * The legal vocabularies a consumer looks concepts up in by notation.
 *
 * **Example** (Check the legal roles kind)
 *
 * ```ts import.meta.vitest name="Check the legal roles kind"
 * import { LegalVocabularyKind } from "@beep/law-practice-domain/values/LegalVocabularyPack"
 *
 * LegalVocabularyKind.is["legal-roles"]("legal-roles") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LegalVocabularyKind = LiteralKit(["docketing", "party-kinds", "legal-roles"]).pipe(
  $I.annoteSchema("LegalVocabularyKind", {
    description: "Docketing terms, party-holder kinds or contextual legal roles.",
  })
);

/**
 * Runtime type for {@link LegalVocabularyKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type LegalVocabularyKind = typeof LegalVocabularyKind.Type;

/**
 * The pin of the docketing vocabulary in the pack.
 *
 * **Example** (Read the pinned version)
 *
 * ```ts
 * import { docketingPin } from "@beep/law-practice-domain/values/LegalVocabularyPack"
 *
 * console.log(docketingPin.version)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const docketingPin = pin("vocabulary/docketing");

/**
 * The pin of the party-kinds vocabulary in the pack.
 *
 * **Example** (Read the pinned scheme)
 *
 * ```ts
 * import { partyKindsPin } from "@beep/law-practice-domain/values/LegalVocabularyPack"
 *
 * console.log(partyKindsPin.scheme)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const partyKindsPin = pin("vocabulary/party-kinds");

/**
 * The pin of the legal-roles vocabulary in the pack.
 *
 * **Example** (Read the pinned scheme)
 *
 * ```ts
 * import { legalRolesPin } from "@beep/law-practice-domain/values/LegalVocabularyPack"
 *
 * console.log(legalRolesPin.scheme)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const legalRolesPin = pin("vocabulary/legal-roles");

/**
 * The pin of the legal-intake concept scheme in the pack.
 *
 * **Example** (Read the pinned scheme)
 *
 * ```ts
 * import { legalIntakePin } from "@beep/law-practice-domain/values/LegalVocabularyPack"
 *
 * console.log(legalIntakePin.scheme)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const legalIntakePin = pin("taxonomy/legal-intake");

/**
 * The manifest id of the intake taxonomy payload.
 *
 * @category constants
 * @since 0.0.0
 */
export const intakeTaxonomyPayloadId = "intake-taxonomy";

/**
 * The pack manifest, addressed relative to this module.
 *
 * **Details**
 *
 * The domain does no IO. A reader turns the URL into a path with its
 * platform `Path` service and loads it with `TaxonomyLoader`, using
 * {@link legalVocabularyRootUrl} as the root.
 *
 * **Example** (Read the manifest file name)
 *
 * ```ts
 * import { legalVocabularyManifestUrl } from "@beep/law-practice-domain/values/LegalVocabularyPack"
 *
 * console.log(legalVocabularyManifestUrl.pathname.endsWith("/assets/vocabulary/manifest.jsonl"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const legalVocabularyManifestUrl = new URL("../../../assets/vocabulary/manifest.jsonl", import.meta.url);

/**
 * The directory the pack manifest's row paths are relative to.
 *
 * @category constants
 * @since 0.0.0
 */
export const legalVocabularyRootUrl = new URL("../../../assets/vocabulary/", import.meta.url);

/**
 * Raised when a loaded pack holds no intake taxonomy payload.
 *
 * **Example** (Make a missing-payload error)
 *
 * ```ts
 * import { IntakeTaxonomyNotLoaded } from "@beep/law-practice-domain/values/LegalVocabularyPack"
 *
 * console.log(IntakeTaxonomyNotLoaded.make({ id: "intake-taxonomy" })._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class IntakeTaxonomyNotLoaded extends S.TaggedError<IntakeTaxonomyNotLoaded, { readonly brand: unique symbol }>(
  $I`IntakeTaxonomyNotLoaded`
)(
  "IntakeTaxonomyNotLoaded",
  { id: S.NonEmptyString },
  $I.annoteError<IntakeTaxonomyNotLoaded>("IntakeTaxonomyNotLoaded", {
    description: "The loaded pack holds no payload row with the intake taxonomy id.",
  })
) {}
