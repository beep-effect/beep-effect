/**
 * Provenance traversal port: the read every claim provenance answer goes
 * through.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type { ClaimId } from "@beep/epistemics/ClaimCore";
import type * as Effect from "effect/Effect";
import type { ProvenanceResult } from "./ProvenanceTraversal.values.ts";

const $I = $LawPracticeUseCasesId.create("ProvenanceTraversal/ProvenanceTraversal.ports");

/**
 * Service shape of provenance traversal.
 *
 * **Details**
 *
 * `fromClaim` authorizes `provenance-traversal` on the claim's scope and on
 * every capture its activities used. A denied claim answers `Missing`, like an
 * absent one; a denied capture is omitted with the activities that used it.
 *
 * **Example** (Name the traversal method)
 *
 * ```ts
 * import type { ProvenanceTraversalShape } from "@beep/law-practice-use-cases/ProvenanceTraversal"
 *
 * const method: keyof ProvenanceTraversalShape = "fromClaim"
 * console.log(method) // "fromClaim"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface ProvenanceTraversalShape {
  /** The provenance of the claim, or `Missing`. */
  readonly fromClaim: (claim: ClaimId) => Effect.Effect<ProvenanceResult>;
}

/**
 * The service every claim provenance read goes through.
 *
 * **Example** (Reference the traversal service)
 *
 * ```ts
 * import { ProvenanceTraversal } from "@beep/law-practice-use-cases/ProvenanceTraversal"
 *
 * console.log(ProvenanceTraversal.key)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ProvenanceTraversal extends Context.Service<ProvenanceTraversal, ProvenanceTraversalShape>()(
  $I`ProvenanceTraversal`
) {}
