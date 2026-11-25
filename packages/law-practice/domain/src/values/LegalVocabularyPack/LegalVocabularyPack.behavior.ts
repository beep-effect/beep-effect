/**
 * Pure lookups over a loaded legal vocabulary pack.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { decodeUtf8 } from "@beep/ontology/TaxonomyLoader";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as S from "effect/Schema";
import { IntakeTaxonomy } from "../IntakeTaxonomy/IntakeTaxonomy.model.ts";
import {
  docketingPin,
  IntakeTaxonomyNotLoaded,
  intakeTaxonomyPayloadId,
  LegalVocabularyKind,
  legalIntakePin,
  legalRolesPin,
  partyKindsPin,
} from "./LegalVocabularyPack.model.ts";
import type { ConceptScheme, ConceptSchemePin } from "@beep/ontology/ConceptScheme";
import type { ConceptSchemeNotLoaded, ConceptSchemeVersionMismatch, LoadedPack } from "@beep/ontology/TaxonomyLoader";

type SchemeLookupError = ConceptSchemeNotLoaded | ConceptSchemeVersionMismatch;

const decodeIntakeTaxonomy = S.decodeUnknownEffect(S.fromJsonString(IntakeTaxonomy));

/**
 * The pack pin of a legal vocabulary.
 *
 * **Example** (Pin the docketing vocabulary)
 *
 * ```ts
 * import { pinFor } from "@beep/law-practice-domain/values/LegalVocabularyPack"
 *
 * console.log(pinFor("docketing").version)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const pinFor: (kind: LegalVocabularyKind) => ConceptSchemePin = LegalVocabularyKind.match({
  docketing: () => docketingPin,
  "party-kinds": () => partyKindsPin,
  "legal-roles": () => legalRolesPin,
});

/**
 * The concept scheme of a legal vocabulary in a loaded pack.
 *
 * **Example** (Look up the docketing scheme)
 *
 * ```ts
 * import { scheme } from "@beep/law-practice-domain/values/LegalVocabularyPack"
 *
 * const docketing = scheme("docketing")
 * console.log(typeof docketing)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const scheme: {
  (kind: LegalVocabularyKind): (pack: LoadedPack) => Effect.Effect<ConceptScheme, SchemeLookupError>;
  (pack: LoadedPack, kind: LegalVocabularyKind): Effect.Effect<ConceptScheme, SchemeLookupError>;
} = dual(
  2,
  (pack: LoadedPack, kind: LegalVocabularyKind): Effect.Effect<ConceptScheme, SchemeLookupError> =>
    pack.schemeFor(pinFor(kind))
);

/**
 * The legal-intake concept scheme in a loaded pack.
 *
 * **Example** (Look up the intake scheme)
 *
 * ```ts
 * import { intakeScheme } from "@beep/law-practice-domain/values/LegalVocabularyPack"
 *
 * console.log(typeof intakeScheme)
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const intakeScheme = (pack: LoadedPack): Effect.Effect<ConceptScheme, SchemeLookupError> =>
  pack.schemeFor(legalIntakePin);

/**
 * The intake taxonomy decoded from a loaded pack's verified payload bytes.
 *
 * **Example** (Decode the intake taxonomy)
 *
 * ```ts
 * import { intakeTaxonomy } from "@beep/law-practice-domain/values/LegalVocabularyPack"
 *
 * console.log(typeof intakeTaxonomy)
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const intakeTaxonomy = Effect.fn("LegalVocabularyPack.intakeTaxonomy")(function* (pack: LoadedPack) {
  const bytes = yield* Effect.fromOption(HashMap.get(pack.payloads, intakeTaxonomyPayloadId), () =>
    IntakeTaxonomyNotLoaded.make({ id: intakeTaxonomyPayloadId })
  );
  const text = yield* decodeUtf8(intakeTaxonomyPayloadId, "intake-taxonomy.json", bytes);
  return yield* decodeIntakeTaxonomy(text);
});
