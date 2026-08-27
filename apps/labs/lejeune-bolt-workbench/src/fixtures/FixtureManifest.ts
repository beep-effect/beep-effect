/**
 * Schema boundary for the committed source hashes and exact expected spans.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LejeuneBoltWorkbenchId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, Sha256Hex } from "@beep/schema";
import { identity, Number as N } from "effect";
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

class ManifestExtractionContract extends S.Class<ManifestExtractionContract>($I`ManifestExtractionContract`)(
  {
    endChar: NonNegativeInt,
    name: S.NonEmptyString,
    quote: S.NonEmptyString,
    sourceDocumentId: FrozenFixtureSourceId,
    startChar: NonNegativeInt,
    value: S.NonEmptyString,
  },
  $I.annote("ManifestExtractionContract", {
    description: "One exact source identity, field name, offset range, quote, and value frozen by manifest v1.",
  })
) {}

const manifestExtractionContract = (
  sourceDocumentId: typeof FrozenFixtureSourceId.Type,
  name: string,
  startChar: number,
  endChar: number,
  quote: string
): ManifestExtractionContract =>
  ManifestExtractionContract.make({
    endChar: NonNegativeInt.make(endChar),
    name,
    quote,
    sourceDocumentId,
    startChar: NonNegativeInt.make(startChar),
    value: quote,
  });

const ExpectedManifestExtractions: ReadonlyArray<ManifestExtractionContract> = [
  manifestExtractionContract("rfq-a-outlook-body", "projectName", 26, 43, "North Loop Canopy"),
  manifestExtractionContract("rfq-a-outlook-body", "deliveryDate", 55, 65, "2026-09-12"),
  manifestExtractionContract("rfq-a-outlook-body", "domesticOrigin", 68, 85, "Domestic required"),
  manifestExtractionContract("rfq-a-outlook-body", "finish", 95, 111, "MG B695 Class 55"),
  manifestExtractionContract("rfq-a-xlsx-takeoff", "product", 6, 17, "TC assembly"),
  manifestExtractionContract("rfq-a-xlsx-takeoff", "grade", 20, 32, "F1852 Type 1"),
  manifestExtractionContract("rfq-a-xlsx-takeoff", "diameter", 35, 41, "7/8 in"),
  manifestExtractionContract("rfq-a-xlsx-takeoff", "length", 44, 52, "3-1/4 in"),
  manifestExtractionContract("rfq-a-xlsx-takeoff", "quantity", 55, 58, "180"),
  manifestExtractionContract("rfq-a-xlsx-takeoff", "dti", 61, 74, "F959 Type 325"),
  manifestExtractionContract("rfq-b-prose-email", "projectName", 20, 42, "County Shops Expansion"),
  manifestExtractionContract("rfq-b-prose-email", "deliveryDate", 56, 66, "2026-09-20"),
  manifestExtractionContract("rfq-b-prose-email", "certificationRequirement", 71, 96, "certification is required"),
  manifestExtractionContract("rfq-b-pdf-schedule", "product", 19, 38, "heavy hex bolt only"),
  manifestExtractionContract("rfq-b-pdf-schedule", "grade", 47, 58, "A490 Type 1"),
  manifestExtractionContract("rfq-b-pdf-schedule", "diameter", 70, 76, "3/4 in"),
  manifestExtractionContract("rfq-b-pdf-schedule", "length", 86, 94, "2-1/2 in"),
  manifestExtractionContract("rfq-b-pdf-schedule", "quantity", 106, 109, "860"),
  manifestExtractionContract("rfq-b-pdf-schedule", "finish", 119, 122, "HDG"),
  manifestExtractionContract("rfq-b-pdf-schedule", "dti", 129, 142, "F959 Type 325"),
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

const manifestExtractionMatchesContract = (field: ExtractedField, contract: ManifestExtractionContract): boolean =>
  A.every(
    [
      Str.Equivalence(field.sourceDocumentId, contract.sourceDocumentId),
      Str.Equivalence(field.name, contract.name),
      N.Equivalence(field.anchor.startChar, contract.startChar),
      N.Equivalence(field.anchor.endChar, contract.endChar),
      Str.Equivalence(field.anchor.quote, contract.quote),
      Str.Equivalence(field.value, contract.value),
    ],
    identity
  );

const manifestExtractionsAreExact = (manifest: FrozenFixtureManifestFields): boolean =>
  A.every(A.zip(manifest.extractedFields, ExpectedManifestExtractions), ([field, contract]) =>
    manifestExtractionMatchesContract(field, contract)
  );

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
