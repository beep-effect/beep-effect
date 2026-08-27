/**
 * Schema boundary for the committed source hashes and exact expected spans.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LejeuneBoltWorkbenchId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import { ExtractedField } from "@/domain/Bundle";
import { EntityId } from "@/domain/Ontology";

const $I = $LejeuneBoltWorkbenchId.create("fixtures/FixtureManifest");

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
  { id: EntityId, sha256: Sha256Hex },
  $I.annote("FrozenSourceHash", { description: "A committed source identifier and deterministic SHA-256 digest." })
) {}

const ExactManifestExtractionCount = S.makeFilter((fields: ReadonlyArray<ExtractedField>) => A.length(fields) === 20, {
  identifier: $I`ExactManifestExtractionCount`,
  title: "Exact Fixture Manifest Extraction Count",
  description: "Requires the committed two-fixture manifest to retain exactly twenty grounded extractions.",
  message: "Fixture manifest must contain exactly twenty extracted fields.",
});

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
  {
    extractedFields: S.Array(ExtractedField).check(ExactManifestExtractionCount),
    missingFields: S.Tuple([S.NonEmptyString, S.NonEmptyString]),
    schemaVersion: S.Literal("lejeune-fixture-manifest/v1"),
    sources: S.Tuple([FrozenSourceHash, FrozenSourceHash, FrozenSourceHash, FrozenSourceHash]),
  },
  $I.annote("FrozenFixtureManifest", {
    description: "The committed acceptance oracle for fixture bytes, exact spans, and deliberate unknowns.",
  })
) {}
