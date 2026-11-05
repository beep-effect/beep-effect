/**
 * Ports of the claim self-check. Each port is one outside capability with no
 * policy of its own; its adapter lives in `@beep/law-practice-server`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { UsptoClaimsError } from "./ClaimSelfCheck.errors.ts";
import type { UsptoClaimInputSet, UsptoClaimSet, UsptoClaimSource } from "./ClaimSelfCheck.schemas.ts";

const $I = $LawPracticeUseCasesId.create("ClaimSelfCheck/ClaimSelfCheck.ports");

/**
 * Port shape: read access to public USPTO claims.
 *
 * **Example** (Name the claims method)
 *
 * ```ts
 * import type { UsptoClaimsShape } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 *
 * const method: keyof UsptoClaimsShape = "claims"
 * console.log(method)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export interface UsptoClaimsShape {
  /**
   * Full-text claims of one public USPTO record, normalized into validated patent claims.
   * OCR-only claims fail with `no-full-text-claims`; they are never repaired.
   */
  readonly claims: (source: UsptoClaimSource) => Effect.Effect<UsptoClaimSet, UsptoClaimsError>;
}

/**
 * Port: public USPTO claims for an application file wrapper or a publication.
 *
 * **Details**
 *
 * The server adapter implements it over the `@beep/uspto` driver's document
 * listing and download, reads structured full-text claims, and translates
 * every driver error into `UsptoClaimsError`.
 *
 * **Example** (Reference the claims port)
 *
 * ```ts
 * import { UsptoClaims } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 *
 * console.log(UsptoClaims.key)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class UsptoClaims extends Context.Service<UsptoClaims, UsptoClaimsShape>()($I`UsptoClaims`) {}

/**
 * Separate acquisition capability for failure-preserving source inspection.
 *
 * **Example** (Name the input method)
 *
 * ```ts
 * import type { UsptoClaimInputsShape } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 * const method: keyof UsptoClaimInputsShape = "inputs"
 * console.log(method) // inputs
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export interface UsptoClaimInputsShape {
  /** Acquire all XML source records without interpreting a failed record as absent. */
  readonly inputs: (source: UsptoClaimSource) => Effect.Effect<UsptoClaimInputSet, UsptoClaimsError>;
}

/**
 * Read-only public source acquisition port for per-record inspection.
 *
 * **Details**
 * Acquisition and document-level format failures remain typed errors. Individual
 * record failures remain in the returned input ledger, including all-unusable
 * input. The existing strict UsptoClaims port retains its contract.
 *
 * **Example** (Reference the source-input port)
 *
 * ```ts
 * import { UsptoClaimInputs } from "@beep/law-practice-use-cases/ClaimSelfCheck"
 * console.log(UsptoClaimInputs.key)
 * ```
 *
 * @category ports
 * @since 0.0.0
 */
export class UsptoClaimInputs extends Context.Service<UsptoClaimInputs, UsptoClaimInputsShape>()(
  $I`UsptoClaimInputs`
) {}
