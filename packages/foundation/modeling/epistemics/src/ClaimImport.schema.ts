/**
 * Historical claim imports that retain their old namespace without inventing core provenance.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicsId } from "@beep/identity/packages";
import { CanonicalHashSet } from "@beep/schema/CanonicalHashSet";
import { ContentHash } from "@beep/schema/ContentHash";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import { ValidTime } from "./Claim/index.ts";
import { ClaimId } from "./ClaimCore.schema.ts";
import { KnowledgeInterval } from "./KnowledgeInterval/index.ts";
import type { FieldSchema, SchemaIdentity } from "./Factory/index.ts";

const $I = $EpistemicsId.create("ClaimImport.schema");

/**
 * Owner namespaces in which historical claim identifiers retain their original meaning.
 *
 * **Example** (Identify a knowledge-ledger import)
 *
 * ```ts
 * import { ClaimImportLedger } from "@beep/epistemics/ClaimImport.schema"
 * console.log(ClaimImportLedger.is.kb("kb"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimImportLedger = LiteralKit(["kb", "holds"]).pipe(
  $I.annoteSchema("ClaimImportLedger", { description: "The original identifier namespace of an imported row." })
);

/**
 * @category models
 * @since 0.0.0
 */
export type ClaimImportLedger = typeof ClaimImportLedger.Type;

/**
 * Creation facts that an old envelope cannot establish merely by decoding.
 *
 * **Example** (Recognize missing native generation)
 *
 * ```ts
 * import { MissingClaimCreationFact } from "@beep/epistemics/ClaimImport.schema"
 * console.log(MissingClaimCreationFact.is.generatedBy("generatedBy"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MissingClaimCreationFact = LiteralKit(["scope", "generatedBy", "assertedBy", "supportAtCreation"]).pipe(
  $I.annoteSchema("MissingClaimCreationFact", { description: "Unproved core provenance in a historical import." })
);

/**
 * @category models
 * @since 0.0.0
 */
export type MissingClaimCreationFact = typeof MissingClaimCreationFact.Type;

/**
 * References distinguish historical namespaces even when an old identifier resembles a hash.
 *
 * **Example** (Retain a historical hold reference)
 *
 * ```ts
 * import { ClaimReference } from "@beep/epistemics/ClaimImport.schema"
 * console.log(ClaimReference.cases.Imported.make({ ledger: "holds", oldId: "synthetic@1" }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ClaimReference = S.TaggedUnion({
  Imported: { ledger: ClaimImportLedger, oldId: S.NonEmptyString },
  Native: { claim: ClaimId },
}).pipe($I.annoteSchema("ClaimReference", { description: "An explicit historical or native claim namespace." }));

/**
 * Decoded reference namespace and identifier.
 * @category models
 * @since 0.0.0
 */
export type ClaimReference = typeof ClaimReference.Type;

/**
 * Frame reference namespaces before indexing or comparing ledger links.
 *
 * **Example** (Index a historical claim without relabeling it)
 *
 * ```ts
 * import { ClaimReference, claimReferenceKey } from "@beep/epistemics/ClaimImport.schema"
 * console.log(claimReferenceKey(ClaimReference.cases.Imported.make({ ledger: "kb", oldId: "claim-1" })))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const claimReferenceKey = ClaimReference.match({
  Imported: ({ ledger, oldId }) => `imported:${ledger}:${oldId}`,
  Native: ({ claim }) => `native:${claim}`,
});

/**
 * A checked materialization link preserves both the historical and content-addressed identities.
 *
 * **Example** (Inspect the mapping's namespaces)
 *
 * ```ts
 * import { ClaimImportLink } from "@beep/epistemics/ClaimImport.schema"
 * console.log(ClaimImportLink.fields.ledger)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimImportLink extends S.Opaque<ClaimImportLink, { readonly brand: unique symbol }>()(
  S.Struct({
    ledger: ClaimImportLedger,
    oldId: S.NonEmptyString,
    payloadDigest: ContentHash,
    claim: ClaimId,
  }).pipe($I.annoteSchema("ClaimImportLink", { description: "An explicit import-to-core mapping, never an id cast." }))
) {}

/**
 * Bind retained historical facts to an owner's proposition, review and observation codecs.
 *
 * **Details**
 * The original line remains in its append-only store. Its digest identifies those bytes; this
 * projection has no ClaimId and cannot satisfy a native core or admission decoder.
 *
 * **Example** (Bind a historical read projection)
 *
 * ```ts
 * import { makeClaimImport } from "@beep/epistemics/ClaimImport.schema"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 * const imported = makeClaimImport({ $I: $ScratchpadId.create("Imported"),
 *   ledger: "kb", proposition: S.NonEmptyString, review: S.NonEmptyString, signals: S.NonEmptyString })
 * console.log(imported.fields.oldId)
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export const makeClaimImport = <
  const Ledger extends ClaimImportLedger,
  P extends FieldSchema<unknown, unknown>,
  R extends FieldSchema<unknown, unknown>,
  Signals extends FieldSchema<unknown, unknown>,
>(options: {
  readonly $I: SchemaIdentity;
  readonly ledger: Ledger;
  readonly proposition: P;
  readonly review: R;
  readonly signals: Signals;
}) => {
  const proposition: FieldSchema<P["Type"], P["Encoded"]> = options.proposition;
  const review: FieldSchema<R["Type"], R["Encoded"]> = options.review;
  const signals: FieldSchema<Signals["Type"], Signals["Encoded"]> = options.signals;
  return S.Struct({
    version: S.tag("legacy-claim-import/v1"),
    ledger: S.tag(options.ledger),
    oldId: S.NonEmptyString,
    payloadDigest: ContentHash,
    proposition,
    logicalKey: S.NonEmptyString,
    originalKnowledge: KnowledgeInterval,
    validTime: ValidTime,
    supportRefs: S.Array(S.NonEmptyString),
    challengeRefs: S.Array(S.NonEmptyString),
    predecessor: S.OptionFromOptionalKey(S.NonEmptyString),
    review,
    signals,
    missingFacts: CanonicalHashSet(MissingClaimCreationFact).check(
      S.makeFilter(
        (facts) => HashSet.size(facts) > 0,
        $I.annote("NonEmptyMissingClaimCreationFacts", {
          description: "A historical import names at least one creation fact it cannot prove.",
          message: "Expected at least one missing claim creation fact.",
        })
      )
    ),
  }).pipe(
    options.$I.annoteSchema("LegacyClaimImported", {
      description: "Historical facts and explicit missing provenance; no native core is manufactured.",
    })
  );
};
