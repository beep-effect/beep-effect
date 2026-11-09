/**
 * Advisory near-duplicate findings.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { NodeId } from "./NodeIdentity.models.ts";

const $I = $AgentMemoryStoreId.create("Dedupe.models");

/**
 * Advisory flag that two nodes are near duplicates.
 *
 * **Details**
 *
 * Decision `dedupe-exact-defer-near-flag`: near duplicates are flagged for
 * consolidation only and never merged or dropped. The simhash distance is
 * capped at 2 (S10: t=2 false-flagged 1.78%, t=4 reached 9.01%).
 *
 * **Example** (Flag a near duplicate)
 *
 * ```ts
 * import { NearDuplicateFlag, NodeId } from "@beep/agent-memory-store"
 *
 * const flag = NearDuplicateFlag.make({
 *   nodeId: NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e7f"),
 *   candidateNodeId: NodeId.make("018f9c3e-7d2a-7b4c-9e1f-2a3b4c5d6e80"),
 *   simhashDistance: 1,
 * })
 * console.log(flag.simhashDistance)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NearDuplicateFlag extends S.Opaque<NearDuplicateFlag, { readonly brand: unique symbol }>()(
  S.Struct({
    nodeId: NodeId.annotateKey({ description: "Node that was written." }),
    candidateNodeId: NodeId.annotateKey({ description: "Existing node it nearly duplicates." }),
    simhashDistance: S.Natural.check(
      S.isLessThanOrEqualTo(
        2,
        $I.annote("NearDuplicateSimhashDistanceCheck", {
          title: "Near Duplicate Simhash Distance",
          description: "Near-duplicate flags are raised only at simhash distance 2 or less.",
          message: "Expected a simhash distance of at most 2.",
        })
      )
    ).annotateKey({ description: "Hamming distance between the two simhashes, at most 2." }),
  }).pipe(
    $I.annoteSchema("NearDuplicateFlag", {
      description: "Advisory flag that two nodes are near duplicates.",
    })
  )
) {}
