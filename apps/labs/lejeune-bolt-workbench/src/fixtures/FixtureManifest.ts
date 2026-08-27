/**
 * Schema boundary for the committed source hashes and exact expected spans.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LejeuneBoltWorkbenchId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import { identity } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ExtractedField } from "@/domain/Bundle";

const $I = $LejeuneBoltWorkbenchId.create("fixtures/FixtureManifest");

const FrozenFixtureSourceId = LiteralKit([
  "rfq-a-outlook-body",
  "rfq-a-xlsx-takeoff",
  "rfq-b-prose-email",
  "rfq-b-pdf-schedule",
]).pipe(
  $I.annoteSchema("FrozenFixtureSourceId", {
    description: "The exact four source identities authorized by fixture-manifest contract v1.",
  })
);

/**
 * One frozen source identity and content hash.
 *
 * **Example** (Inspect the digest field)
 *
 * ```ts
 * import { FrozenSourceHash } from "@/fixtures/FixtureManifest"
 *
 * console.log(FrozenSourceHash.fields.sha256 !== undefined)
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export class FrozenSourceHash extends S.Class<FrozenSourceHash>($I`FrozenSourceHash`)(
  { id: FrozenFixtureSourceId, sha256: Sha256Hex },
  $I.annote("FrozenSourceHash", { description: "A committed source identifier and deterministic SHA-256 digest." })
) {}

const ExpectedFrozenSourceHashes: ReadonlyArray<FrozenSourceHash> = [
  FrozenSourceHash.make({
    id: "rfq-a-outlook-body",
    sha256: Sha256Hex.make("ee38c21a1635fa152f1e48914ae2c2ce3761d5ada7f96b8c7c3d5a50e808f3b5"),
  }),
  FrozenSourceHash.make({
    id: "rfq-a-xlsx-takeoff",
    sha256: Sha256Hex.make("09c038e5118283ff15382a632ca6c6e9c811ef4e7235128623956f6043b1d4c5"),
  }),
  FrozenSourceHash.make({
    id: "rfq-b-prose-email",
    sha256: Sha256Hex.make("bc1144a4fdde67229b9e2178c09c133cdd48a0b8881e5f9b9f0316f4ba91806e"),
  }),
  FrozenSourceHash.make({
    id: "rfq-b-pdf-schedule",
    sha256: Sha256Hex.make("bbaa1ae10d94a0680966ed5d1eef8c020b172131d760eb7bc9bc61e8f4831360"),
  }),
];

const ExpectedManifestExtractionIdentities: ReadonlyArray<string> = [
  "rfq-a-outlook-body|projectName",
  "rfq-a-outlook-body|deliveryDate",
  "rfq-a-outlook-body|domesticOrigin",
  "rfq-a-outlook-body|finish",
  "rfq-a-xlsx-takeoff|product",
  "rfq-a-xlsx-takeoff|grade",
  "rfq-a-xlsx-takeoff|diameter",
  "rfq-a-xlsx-takeoff|length",
  "rfq-a-xlsx-takeoff|quantity",
  "rfq-a-xlsx-takeoff|dti",
  "rfq-b-prose-email|projectName",
  "rfq-b-prose-email|deliveryDate",
  "rfq-b-prose-email|certificationRequirement",
  "rfq-b-pdf-schedule|product",
  "rfq-b-pdf-schedule|grade",
  "rfq-b-pdf-schedule|diameter",
  "rfq-b-pdf-schedule|length",
  "rfq-b-pdf-schedule|quantity",
  "rfq-b-pdf-schedule|finish",
  "rfq-b-pdf-schedule|dti",
];

const frozenSourceHashEquivalence = S.toEquivalence(FrozenSourceHash);

const FrozenFixtureManifestFields = S.Struct({
  extractedFields: S.Tuple([
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
    ExtractedField,
  ]),
  missingFields: S.Tuple([S.Literal("rfq-a|certificationRequirement"), S.Literal("rfq-b|domesticOrigin")]),
  schemaVersion: S.Literal("lejeune-fixture-manifest/v1"),
  sources: S.Tuple([FrozenSourceHash, FrozenSourceHash, FrozenSourceHash, FrozenSourceHash]),
});

type FrozenFixtureManifestFields = typeof FrozenFixtureManifestFields.Type;

const manifestSourceHashesAreExact = (manifest: FrozenFixtureManifestFields): boolean =>
  A.every(A.zip(manifest.sources, ExpectedFrozenSourceHashes), ([actual, expected]) =>
    frozenSourceHashEquivalence(actual, expected)
  );

const manifestExtractionIdentity = (field: ExtractedField): string => `${field.sourceDocumentId}|${field.name}`;

const manifestExtractionsAreExact = (manifest: FrozenFixtureManifestFields): boolean => {
  const identities = A.map(manifest.extractedFields, manifestExtractionIdentity);
  const identitiesMatch = A.every(A.zip(identities, ExpectedManifestExtractionIdentities), ([actual, expected]) =>
    Str.Equivalence(actual, expected)
  );
  const valuesMatchAnchors = A.every(manifest.extractedFields, (field) =>
    Str.Equivalence(field.value, field.anchor.quote)
  );
  return A.every([identitiesMatch, valuesMatchAnchors], identity);
};

const FrozenFixtureManifestChecks = S.makeFilterGroup(
  [
    S.makeFilter(manifestSourceHashesAreExact, {
      identifier: $I`FrozenFixtureManifestSourceHashCheck`,
      title: "Frozen Fixture Manifest Source Hashes",
      description: "Requires the exact ordered source identities and SHA-256 digests frozen by manifest v1.",
      message: "Fixture manifest source identities and hashes must match the committed v1 corpus.",
    }),
    S.makeFilter(manifestExtractionsAreExact, {
      identifier: $I`FrozenFixtureManifestExtractionCheck`,
      title: "Frozen Fixture Manifest Extractions",
      description: "Requires the exact ordered extraction identity graph and self-consistent anchored values.",
      message: "Fixture manifest extraction identities and anchored values must match contract v1.",
    }),
  ],
  {
    identifier: $I`FrozenFixtureManifestChecks`,
    title: "Frozen Fixture Manifest",
    description: "Closes every source, digest, extraction, and missing-field identity in fixture-manifest v1.",
  }
);

/**
 * Committed fixture hash, exact-span, and missing-field manifest.
 *
 * **Example** (Inspect the extraction collection)
 *
 * ```ts
 * import { FrozenFixtureManifest } from "@/fixtures/FixtureManifest"
 *
 * console.log(FrozenFixtureManifest.fields.extractedFields !== undefined) // true
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export class FrozenFixtureManifest extends S.Class<FrozenFixtureManifest>($I`FrozenFixtureManifest`)(
  FrozenFixtureManifestFields.mapFields(identity).check(FrozenFixtureManifestChecks),
  $I.annote("FrozenFixtureManifest", {
    description: "The committed acceptance oracle for fixture bytes, exact spans, and deliberate unknowns.",
  })
) {}
