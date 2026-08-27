/**
 * Schema boundary for the committed source hashes and exact expected spans.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LejeuneBoltWorkbenchId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { ExtractedField } from "@/domain/Bundle";

const $I = $LejeuneBoltWorkbenchId.create("fixtures/FixtureManifest");

/** One frozen source identity and content hash. @category fixtures @since 0.0.0 */
export class FrozenSourceHash extends S.Class<FrozenSourceHash>($I`FrozenSourceHash`)(
  { id: S.NonEmptyString, sha256: Sha256Hex },
  $I.annote("FrozenSourceHash", { description: "A committed source identifier and deterministic SHA-256 digest." })
) {}

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
    extractedFields: S.NonEmptyArray(ExtractedField),
    missingFields: S.NonEmptyArray(S.NonEmptyString),
    schemaVersion: S.Literal("lejeune-fixture-manifest/v1"),
    sources: S.NonEmptyArray(FrozenSourceHash),
  },
  $I.annote("FrozenFixtureManifest", {
    description: "The committed acceptance oracle for fixture bytes, exact spans, and deliberate unknowns.",
  })
) {}
