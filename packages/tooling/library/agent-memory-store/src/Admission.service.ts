/**
 * Admission contract: store-side admission of agent writes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { AdmissionOutcome, ConflictResolution, HeldConflict } from "./Admission.models.ts";
import type { AdmissionError } from "./AgentMemoryStore.errors.ts";
import type { NodeId } from "./NodeIdentity.models.ts";
import type { OperationBatch } from "./Operation.models.ts";

const $I = $AgentMemoryStoreId.create("Admission.service");

/**
 * Store-side admission of agent operation batches.
 *
 * **Details**
 *
 * Ruling 2: admission happens in the store with no CRDT merge on agent write
 * paths.
 *
 * - `admit` checks each operation with a per-node compare-and-set against its
 *   expected revision, three-way merges edits on disjoint nodes, and returns one
 *   outcome per operation in order. A conflicting node is held with both texts
 *   retained while clean operations in the same batch still land. Outcomes
 *   report the structural floor (AC-3): every held or rejected write carries
 *   typed findings.
 * - `held` lists the conflicts waiting on the operator.
 * - `resolve` settles one held node with the operator's choice and returns the
 *   resulting outcome.
 *
 * **Example** (Admit a batch)
 *
 * ```ts
 * import { Admission, OperationBatch } from "@beep/agent-memory-store"
 * import * as Effect from "effect/Effect"
 *
 * const admitBatch = (batch: OperationBatch) =>
 *   Effect.gen(function* () {
 *     const admission = yield* Admission
 *     return yield* admission.admit(batch)
 *   })
 * console.log(admitBatch)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Admission extends Context.Service<
  Admission,
  {
    readonly admit: (batch: OperationBatch) => Effect.Effect<ReadonlyArray<AdmissionOutcome>, AdmissionError>;
    readonly held: Effect.Effect<ReadonlyArray<HeldConflict>, AdmissionError>;
    readonly resolve: (
      nodeId: NodeId,
      resolution: ConflictResolution
    ) => Effect.Effect<AdmissionOutcome, AdmissionError>;
  }
>()($I`Admission`) {}
