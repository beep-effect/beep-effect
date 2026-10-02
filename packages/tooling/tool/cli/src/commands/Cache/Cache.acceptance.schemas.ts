/**
 * Authenticated import preparation without ledger or activation writes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { CacheClientChannel, CacheTaskContract } from "@beep/repo-configs/cache";
import { Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { CacheProducerEvidenceFragment } from "./Cache.producer.schemas.ts";
import { CacheProducerObservation } from "./Cache.workflow.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.acceptance.schemas");

/**
 * Independently configured issuer stores, never selected by submitted receipts.
 *
 * **Example** (Inspect the required channel stores)
 * ```ts
 * import { CacheProducerTrustLocations } from "@beep/repo-cli/test/Cache"
 * console.assert("stable" in CacheProducerTrustLocations.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheProducerTrustLocations extends S.Class<CacheProducerTrustLocations>($I`CacheProducerTrustLocations`)(
  { stable: S.NonEmptyString, canary: S.NonEmptyString },
  $I.annote("CacheProducerTrustLocations", {
    description: "Operator-selected private stores for the two independently pinned channels.",
  })
) {}

/**
 * Both complete authenticated channel reports submitted for import preparation.
 *
 * **Example** (Require both channel reports)
 * ```ts
 * import { CacheProducerImportRequest } from "@beep/repo-cli/test/Cache"
 * console.assert("observations" in CacheProducerImportRequest.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheProducerImportRequest extends S.Class<CacheProducerImportRequest>($I`CacheProducerImportRequest`)(
  { observations: S.Record(CacheClientChannel, CacheProducerObservation) },
  $I.annote("CacheProducerImportRequest", {
    description: "Stable and canary bundles and envelopes without caller-selected policy or trust roots.",
  })
) {}

/**
 * Authenticated evidence preparation and remaining policy failures.
 *
 * **Details**
 * This preview grants no ledger transition. Authentication, current source
 * admission and complete policy satisfaction must also hold at persistence.
 *
 * **Example** (Inspect unmet obligations)
 * ```ts
 * import { CacheProducerImportPreview } from "@beep/repo-cli/test/Cache"
 * console.assert("failures" in CacheProducerImportPreview.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheProducerImportPreview extends S.Class<CacheProducerImportPreview>($I`CacheProducerImportPreview`)(
  {
    authority: S.tag("authenticated-import-preview-only"),
    contract: CacheTaskContract,
    fragments: S.Array(CacheProducerEvidenceFragment),
    failures: S.Array(S.NonEmptyString),
  },
  $I.annote("CacheProducerImportPreview", {
    description: "Derived evidence and unfulfilled policy obligations; no persistence or activation authority.",
  })
) {}

/**
 * Immutable content identity resolved only inside an independently chosen store.
 *
 * **Example** (No caller-selected path or issuer)
 * ```ts
 * import { CacheProducerAcceptanceReference } from "@beep/repo-cli/test/Cache"
 * console.assert("sha256" in CacheProducerAcceptanceReference.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheProducerAcceptanceReference extends S.Class<CacheProducerAcceptanceReference>(
  $I`CacheProducerAcceptanceReference`
)(
  { schemaVersion: S.tag("cache-producer-acceptance-reference/v1"), sha256: Sha256Hex },
  $I.annote("CacheProducerAcceptanceReference", {
    description: "Canonical request-byte identity; a hash is not authentication or qualification authority.",
  })
) {}

/**
 * Independently configured private acceptance storage and issuer locations.
 *
 * **Example** (Inspect operator-owned configuration)
 * ```ts
 * import { CacheProducerStoreConfiguration } from "@beep/repo-cli/test/Cache"
 * console.assert("trust" in CacheProducerStoreConfiguration.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheProducerStoreConfiguration extends S.Class<CacheProducerStoreConfiguration>(
  $I`CacheProducerStoreConfiguration`
)(
  { directory: S.NonEmptyString, trust: CacheProducerTrustLocations },
  $I.annote("CacheProducerStoreConfiguration", {
    description: "Operator configuration loaded outside report authority; private paths are verified at use.",
  })
) {}
