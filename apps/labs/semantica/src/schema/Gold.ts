import { $SemanticaId } from "@beep/identity/packages";
import { TextAnchorFields, TextAnchorWidthCheck } from "@beep/provenance";
import { LiteralKit, NonNegativeInt, Sha256Hex } from "@beep/schema";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Context, Effect, Equal, HashSet, identity, Number as N, SchemaGetter, SchemaIssue, Tuple } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CorpusPaperId } from "@/corpus/Manifest";
import { sha256TextSync } from "@/schema/Digest";
import { CoreferenceCluster, StructureRole } from "@/schema/Evidence";
import { ModelIdentity } from "@/schema/Model";
import type { SchemaAST } from "effect";

const $I = $SemanticaId.create("schema/Gold");

const GoldSubsetFields = S.Struct({
  structure: S.Array(CorpusPaperId),
  entity: S.Array(CorpusPaperId),
  relation: S.Array(CorpusPaperId),
});

type GoldSubsetFields = typeof GoldSubsetFields.Type;

const hasUniqueIds = (ids: ReadonlyArray<CorpusPaperId>): boolean =>
  Equal.equals(HashSet.size(HashSet.fromIterable(ids)), A.length(ids));

const isProperSubset = (subset: ReadonlyArray<CorpusPaperId>, superset: ReadonlyArray<CorpusPaperId>): boolean => {
  const subsetSet = HashSet.fromIterable(subset);
  const supersetSet = HashSet.fromIterable(superset);
  return HashSet.isSubset(subsetSet, supersetSet) && N.isLessThan(HashSet.size(subsetSet), HashSet.size(supersetSet));
};

const GoldSubsetChecks = S.makeFilterGroup([
  S.makeFilter(
    (subsets: GoldSubsetFields) =>
      hasUniqueIds(subsets.structure) && hasUniqueIds(subsets.entity) && hasUniqueIds(subsets.relation),
    {
      identifier: $I`GoldSubsetUniqueIds`,
      title: "Gold subset identity uniqueness",
      description: "Requires every paper id to appear at most once within each scored subset.",
      message: "GoldSubset arrays must contain unique paper ids.",
    }
  ),
  S.makeFilter(
    (subsets: GoldSubsetFields) =>
      isProperSubset(subsets.entity, subsets.structure) && isProperSubset(subsets.relation, subsets.entity),
    {
      identifier: $I`GoldSubsetContainment`,
      title: "Gold subset strict containment",
      description: "Requires relation to be a proper subset of entity and entity to be a proper subset of structure.",
      message: "GoldSubset must satisfy relation ⊂ entity ⊂ structure.",
    }
  ),
  S.makeFilter(
    (subsets: GoldSubsetFields) =>
      Equal.equals(A.length(subsets.structure), 10) &&
      Equal.equals(A.length(subsets.entity), 5) &&
      Equal.equals(A.length(subsets.relation), 3),
    {
      identifier: $I`GoldSubsetExactSizes`,
      title: "Gold subset exact sizes",
      description: "Requires structure, entity, and relation subsets to contain exactly ten, five, and three papers.",
      message: "GoldSubset sizes must equal structure=10, entity=5, and relation=3.",
    }
  ),
]);

/**
 * Frozen nested W1 paper ids used for structure, entity, and relation scoring.
 *
 * **Example** (Inspect the relation subset)
 *
 * ```ts
 * import { GoldSubset } from "@/schema/Gold"
 *
 * console.log(GoldSubset.fields.relation !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoldSubset extends S.Class<GoldSubset>($I`GoldSubset`)(
  GoldSubsetFields.mapFields(identity).check(GoldSubsetChecks),
  $I.annote("GoldSubset", {
    description: "Unique, exact-sized gold paper ids satisfying relation proper-subset entity proper-subset structure.",
  })
) {}

const GoldRefFields = S.Struct({
  version: S.Literal("gold/v1"),
  digest: Sha256Hex,
  proposer: ModelIdentity,
  spotCheckedFraction: UnitInterval,
  subsets: GoldSubset,
});

const GoldRefProposerCheck = S.makeFilter(
  (gold: typeof GoldRefFields.Type) => gold.proposer.taskType === "gold-proposal",
  {
    identifier: $I`GoldRefProposerCheck`,
    title: "Gold proposer task",
    description: "Requires the pinned proposer model identity to carry the gold-proposal task role.",
    message: "GoldRef proposer.taskType must equal gold-proposal.",
  }
);

/**
 * Versioned digest and independent proposer identity for the frozen gold corpus.
 *
 * **Example** (Inspect the fixed gold version)
 *
 * ```ts
 * import { GoldRef } from "@/schema/Gold"
 *
 * console.log(GoldRef.fields.version.literals[0]) // "gold/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoldRef extends S.Class<GoldRef>($I`GoldRef`)(
  GoldRefFields.mapFields(identity).check(GoldRefProposerCheck),
  $I.annote("GoldRef", {
    description: "Content-addressed gold-v1 reference with spot-check coverage and an independent proposer model.",
  })
) {}

const GoldStructureLabelFields = S.Struct({
  role: StructureRole,
  depth: NonNegativeInt,
  ...TextAnchorFields,
  verified: S.Boolean,
});

/**
 * Anchored structural gold label with a human spot-check marker.
 *
 * **Example** (Inspect the verified field)
 *
 * ```ts
 * import { GoldStructureLabel } from "@/schema/Gold"
 *
 * console.log(GoldStructureLabel.fields.verified !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoldStructureLabel extends S.Class<GoldStructureLabel>($I`GoldStructureLabel`)(
  GoldStructureLabelFields.mapFields(identity).check(TextAnchorWidthCheck),
  $I.annote("GoldStructureLabel", {
    description: "Paper structural role and depth grounded to canonical text with a spot-check marker.",
  })
) {}

const GoldEntityLabelFields = S.Struct({
  label: S.NonEmptyString,
  entityType: S.NonEmptyString,
  cluster: CoreferenceCluster,
  ...TextAnchorFields,
  verified: S.Boolean,
});

/**
 * Anchored entity gold label with a human spot-check marker.
 *
 * **Example** (Inspect the entity type field)
 *
 * ```ts
 * import { GoldEntityLabel } from "@/schema/Gold"
 *
 * console.log(GoldEntityLabel.fields.entityType !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoldEntityLabel extends S.Class<GoldEntityLabel>($I`GoldEntityLabel`)(
  GoldEntityLabelFields.mapFields(identity).check(TextAnchorWidthCheck),
  $I.annote("GoldEntityLabel", {
    description:
      "Entity surface label, explicit coreference cluster, and type grounded to canonical paper text with a spot-check marker.",
  })
) {}

const GoldRelationLabelFields = S.Struct({
  predicate: S.NonEmptyString,
  subject: S.NonEmptyString,
  subjectStartChar: NonNegativeInt,
  subjectEndChar: NonNegativeInt,
  object: S.NonEmptyString,
  objectStartChar: NonNegativeInt,
  objectEndChar: NonNegativeInt,
  ...TextAnchorFields,
  verified: S.Boolean,
});

const GoldRelationEndpointWidthCheck = S.makeFilter(
  (label: typeof GoldRelationLabelFields.Type) =>
    N.isLessThan(label.subjectStartChar, label.subjectEndChar) &&
    N.isLessThan(label.objectStartChar, label.objectEndChar),
  {
    identifier: $I`GoldRelationEndpointWidthCheck`,
    title: "Gold relation endpoint widths",
    description: "Requires subject and object endpoint anchors to have positive UTF-16 widths.",
    message: "Gold relation endpoint anchors must satisfy startChar < endChar.",
  }
);

/**
 * Anchored relation gold label with deterministic endpoint surfaces.
 *
 * **Example** (Inspect the predicate field)
 *
 * ```ts
 * import { GoldRelationLabel } from "@/schema/Gold"
 *
 * console.log(GoldRelationLabel.fields.predicate !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoldRelationLabel extends S.Class<GoldRelationLabel>($I`GoldRelationLabel`)(
  GoldRelationLabelFields.mapFields(identity).check(TextAnchorWidthCheck, GoldRelationEndpointWidthCheck),
  $I.annote("GoldRelationLabel", {
    description: "Relation predicate and endpoint surfaces grounded to canonical paper text with a spot-check marker.",
  })
) {}

/**
 * Canonical document text supplied while decoding a digest-only gold file.
 *
 * **Example** (Provide gold document text)
 *
 * ```ts
 * import { CurrentGoldDocumentText } from "@/schema/Gold"
 * import { Effect } from "effect"
 *
 * const text = CurrentGoldDocumentText.pipe(
 *   Effect.provideService(CurrentGoldDocumentText, "Canonical paper text")
 * )
 * console.log(Effect.isEffect(text)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CurrentGoldDocumentText extends Context.Service<CurrentGoldDocumentText, string>()(
  $I`CurrentGoldDocumentText`
) {}

const sha256Equivalence = S.toEquivalence(Sha256Hex);

const digestMismatch = (input: unknown, options: SchemaAST.ParseOptions, field: string): SchemaIssue.InvalidValue =>
  new SchemaIssue.InvalidValue(
    { message: `Gold ${field} digest does not match the canonical document slice.` },
    input,
    options
  );

const sliceForDigest = (
  text: string,
  startChar: number,
  endChar: number,
  digest: Sha256Hex,
  input: unknown,
  options: SchemaAST.ParseOptions,
  field: string
): Effect.Effect<string, SchemaIssue.InvalidValue> => {
  const value = Str.slice(startChar, endChar)(text);
  return sha256Equivalence(sha256TextSync(value), digest)
    ? Effect.succeed(value)
    : Effect.fail(digestMismatch(input, options, field));
};

class EncodedGoldStructureLabel extends S.Class<EncodedGoldStructureLabel>($I`EncodedGoldStructureLabel`)(
  {
    role: StructureRole,
    depth: NonNegativeInt,
    startChar: TextAnchorFields.startChar,
    endChar: TextAnchorFields.endChar,
    quoteSha256: Sha256Hex,
    verified: S.Boolean,
  },
  $I.annote("EncodedGoldStructureLabel", {
    description: "Digest-only persisted structural gold label without W1 corpus text.",
  })
) {}

const GoldStructureLabelFromEncoded = EncodedGoldStructureLabel.pipe(
  S.decodeTo(GoldStructureLabel, {
    decode: SchemaGetter.transformOrFail<GoldStructureLabel, EncodedGoldStructureLabel, CurrentGoldDocumentText>(
      (label, options) =>
        CurrentGoldDocumentText.use((text) =>
          sliceForDigest(text, label.startChar, label.endChar, label.quoteSha256, label, options, "quote").pipe(
            Effect.map((quote) =>
              GoldStructureLabel.make({
                depth: label.depth,
                endChar: label.endChar,
                quote,
                role: label.role,
                startChar: label.startChar,
                verified: label.verified,
              })
            )
          )
        )
    ),
    encode: SchemaGetter.transform<EncodedGoldStructureLabel, typeof GoldStructureLabel.Encoded>((label) =>
      EncodedGoldStructureLabel.make({
        depth: NonNegativeInt.make(label.depth),
        endChar: NonNegativeInt.make(label.endChar),
        quoteSha256: sha256TextSync(label.quote),
        role: label.role,
        startChar: NonNegativeInt.make(label.startChar),
        verified: label.verified,
      })
    ),
  })
);

class EncodedGoldEntityLabel extends S.Class<EncodedGoldEntityLabel>($I`EncodedGoldEntityLabel`)(
  {
    cluster: CoreferenceCluster,
    endChar: TextAnchorFields.endChar,
    entityType: S.NonEmptyString,
    labelSha256: Sha256Hex,
    quoteSha256: Sha256Hex,
    startChar: TextAnchorFields.startChar,
    verified: S.Boolean,
  },
  $I.annote("EncodedGoldEntityLabel", {
    description: "Digest-only persisted entity gold label without W1 corpus text.",
  })
) {}

const GoldEntityLabelFromEncoded = EncodedGoldEntityLabel.pipe(
  S.decodeTo(GoldEntityLabel, {
    decode: SchemaGetter.transformOrFail<GoldEntityLabel, EncodedGoldEntityLabel, CurrentGoldDocumentText>(
      (label, options) =>
        CurrentGoldDocumentText.use((text) => {
          const quote = sliceForDigest(
            text,
            label.startChar,
            label.endChar,
            label.quoteSha256,
            label,
            options,
            "quote"
          );
          const entityLabel = sliceForDigest(
            text,
            label.startChar,
            label.endChar,
            label.labelSha256,
            label,
            options,
            "entity label"
          );
          return Effect.all({ label: entityLabel, quote }).pipe(
            Effect.map(({ label: hydratedLabel, quote: hydratedQuote }) =>
              GoldEntityLabel.make({
                cluster: label.cluster,
                endChar: label.endChar,
                entityType: label.entityType,
                label: hydratedLabel,
                quote: hydratedQuote,
                startChar: label.startChar,
                verified: label.verified,
              })
            )
          );
        })
    ),
    encode: SchemaGetter.transform<EncodedGoldEntityLabel, typeof GoldEntityLabel.Encoded>((label) =>
      EncodedGoldEntityLabel.make({
        cluster: label.cluster,
        endChar: NonNegativeInt.make(label.endChar),
        entityType: label.entityType,
        labelSha256: sha256TextSync(label.label),
        quoteSha256: sha256TextSync(label.quote),
        startChar: NonNegativeInt.make(label.startChar),
        verified: label.verified,
      })
    ),
  })
);

class EncodedGoldRelationLabel extends S.Class<EncodedGoldRelationLabel>($I`EncodedGoldRelationLabel`)(
  {
    predicate: S.NonEmptyString,
    subjectStartChar: NonNegativeInt,
    subjectEndChar: NonNegativeInt,
    subjectSha256: Sha256Hex,
    objectStartChar: NonNegativeInt,
    objectEndChar: NonNegativeInt,
    objectSha256: Sha256Hex,
    startChar: TextAnchorFields.startChar,
    endChar: TextAnchorFields.endChar,
    quoteSha256: Sha256Hex,
    verified: S.Boolean,
  },
  $I.annote("EncodedGoldRelationLabel", {
    description: "Digest-only persisted relation gold label with anchored subject and object surfaces.",
  })
) {}

const GoldRelationLabelFromEncoded = EncodedGoldRelationLabel.pipe(
  S.decodeTo(GoldRelationLabel, {
    decode: SchemaGetter.transformOrFail<GoldRelationLabel, EncodedGoldRelationLabel, CurrentGoldDocumentText>(
      (label, options) =>
        CurrentGoldDocumentText.use((text) =>
          Effect.all({
            object: sliceForDigest(
              text,
              label.objectStartChar,
              label.objectEndChar,
              label.objectSha256,
              label,
              options,
              "relation object"
            ),
            quote: sliceForDigest(text, label.startChar, label.endChar, label.quoteSha256, label, options, "quote"),
            subject: sliceForDigest(
              text,
              label.subjectStartChar,
              label.subjectEndChar,
              label.subjectSha256,
              label,
              options,
              "relation subject"
            ),
          }).pipe(
            Effect.map((surfaces) =>
              GoldRelationLabel.make({
                endChar: label.endChar,
                object: surfaces.object,
                objectEndChar: label.objectEndChar,
                objectStartChar: label.objectStartChar,
                predicate: label.predicate,
                quote: surfaces.quote,
                startChar: label.startChar,
                subject: surfaces.subject,
                subjectEndChar: label.subjectEndChar,
                subjectStartChar: label.subjectStartChar,
                verified: label.verified,
              })
            )
          )
        )
    ),
    encode: SchemaGetter.transform<EncodedGoldRelationLabel, typeof GoldRelationLabel.Encoded>((label) =>
      EncodedGoldRelationLabel.make({
        endChar: NonNegativeInt.make(label.endChar),
        objectEndChar: NonNegativeInt.make(label.objectEndChar),
        objectSha256: sha256TextSync(label.object),
        objectStartChar: NonNegativeInt.make(label.objectStartChar),
        predicate: label.predicate,
        quoteSha256: sha256TextSync(label.quote),
        startChar: NonNegativeInt.make(label.startChar),
        subjectEndChar: NonNegativeInt.make(label.subjectEndChar),
        subjectSha256: sha256TextSync(label.subject),
        subjectStartChar: NonNegativeInt.make(label.subjectStartChar),
        verified: label.verified,
      })
    ),
  })
);

class GoldStructureFile extends S.Class<GoldStructureFile>($I`GoldStructureFile`)(
  {
    version: S.Literal("gold/v1"),
    paperId: CorpusPaperId,
    subset: S.tag("structure"),
    labels: S.Array(GoldStructureLabelFromEncoded),
    proposer: ModelIdentity,
  },
  $I.annote("GoldStructureFile", {
    description: "Gold-v1 structural labels for one W1 paper.",
  })
) {}

class GoldEntityFile extends S.Class<GoldEntityFile>($I`GoldEntityFile`)(
  {
    version: S.Literal("gold/v1"),
    paperId: CorpusPaperId,
    subset: S.tag("entity"),
    labels: S.Array(GoldEntityLabelFromEncoded),
    proposer: ModelIdentity,
  },
  $I.annote("GoldEntityFile", {
    description: "Gold-v1 entity labels for one W1 paper.",
  })
) {}

class GoldRelationFile extends S.Class<GoldRelationFile>($I`GoldRelationFile`)(
  {
    version: S.Literal("gold/v1"),
    paperId: CorpusPaperId,
    subset: S.tag("relation"),
    labels: S.Array(GoldRelationLabelFromEncoded),
    proposer: ModelIdentity,
  },
  $I.annote("GoldRelationFile", {
    description: "Gold-v1 relation labels for one W1 paper.",
  })
) {}

const GoldFileSubset = LiteralKit(["structure", "entity", "relation"]);

const GoldFileDefinition = GoldFileSubset.mapMembers(
  Tuple.evolve([() => GoldStructureFile, () => GoldEntityFile, () => GoldRelationFile])
)
  .annotate(
    $I.annote("GoldFileDefinition", {
      description: "Subset-indexed gold-v1 label file variants.",
    })
  )
  .pipe(S.toTaggedUnion("subset"));

const GoldFileProposerCheck = S.makeFilter(
  (file: typeof GoldFileDefinition.Type) => file.proposer.taskType === "gold-proposal",
  {
    identifier: $I`GoldFileProposerCheck`,
    title: "Gold file proposer task",
    description: "Requires every gold label file to record a model with the gold-proposal task role.",
    message: "GoldFile proposer.taskType must equal gold-proposal.",
  }
);

/**
 * Subset-indexed label file written by the independent gold proposer.
 *
 * **Example** (Inspect the structure constructor)
 *
 * ```ts
 * import { GoldFile } from "@/schema/Gold"
 *
 * console.log(GoldFile.ast !== undefined) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const GoldFile = GoldFileDefinition.check(GoldFileProposerCheck).pipe(
  $I.annoteSchema("GoldFile", {
    description: "Gold-v1 structure, entity, or relation labels for one paper and pinned proposer.",
  }),
  SchemaUtils.withCodecStatics(["decodeEffect"])
);

/**
 * Decoded gold label file.
 *
 * **Example** (Inspect a gold file type)
 *
 * ```ts
 * import type { GoldFile } from "@/schema/Gold"
 *
 * const inspect = (file: GoldFile) => file.subset
 * console.log(typeof inspect) // "function"
 * ```
 *
 * @see {@link GoldFile} for subset-indexed variants.
 * @category type-level
 * @since 0.0.0
 */
export type GoldFile = typeof GoldFile.Type;

/**
 * Type helpers associated with the gold file codec.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GoldFile {
  /**
   * Digest-only representation persisted under `fixtures/gold/v1`.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof GoldFile.Encoded;
}

const GoldFileEncodedDefinition = S.toEncoded(GoldFile);

const GoldFileEncodedProposerCheck = S.makeFilter(
  (file: typeof GoldFileEncodedDefinition.Type) => file.proposer.taskType === "gold-proposal",
  {
    identifier: $I`GoldFileEncodedProposerCheck`,
    title: "Encoded gold file proposer task",
    description: "Requires every persisted gold label file to retain the gold-proposal task role.",
    message: "GoldFileEncoded proposer.taskType must equal gold-proposal.",
  }
);

/**
 * Digest-only gold file schema used for reference hashing before hydration.
 *
 * @category schemas
 * @since 0.0.0
 */
export const GoldFileEncoded = GoldFileEncodedDefinition.check(GoldFileEncodedProposerCheck).pipe(
  $I.annoteSchema("GoldFileEncoded", {
    description: "Persisted gold-v1 file shape containing offsets and digests but no W1 corpus text.",
  })
);

/**
 * Digest-only persisted gold file value.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GoldFileEncoded = typeof GoldFileEncoded.Type;
