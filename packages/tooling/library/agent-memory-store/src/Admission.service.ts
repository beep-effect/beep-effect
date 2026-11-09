/**
 * Admission contract: store-side admission of agent writes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { AdmissionOutcome, ConflictResolution, HeldConflict, HoldId } from "./Admission.models.ts";
import type { AdmissionError, HoldNotOpenError } from "./AgentMemoryStore.errors.ts";
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
 *   outcome per operation in order. A conflicting write is held as a
 *   `WriteHeld` log event while clean operations in the same batch still
 *   land. Outcomes report the structural floor (AC-3): every held or rejected
 *   write carries typed findings. The compare-and-set itself is the memory
 *   log's: a `StaleParentsError` from an append becomes a typed finding here,
 *   never an `AdmissionError`. For a replace, delete or status move it is
 *   `staleExpectedRevision`; for an insert it means the minted id already
 *   exists, which is a `rejected` outcome with `nodeIdAlreadyExists`.
 *   An insert whose predecessor did not land is held with
 *   `insertAfterMissingNode`, never placed elsewhere.
 * - `held` lists the unresolved holds waiting on the operator.
 * - `resolve` settles one hold, named by its `HoldId`, with the operator's
 *   choice. `theirs` and `merged` write a revision on the node's heads at
 *   resolve time; `ours` writes none. A held insert is created by `theirs`
 *   or `merged`, at the resolver's `placement` when it gives one. It records
 *   a `HoldResolved` event and returns the resulting outcome (decision
 *   `held-writes-are-log-events`). A hold that is unknown or already resolved
 *   fails with `HoldNotOpenError`.
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
      holdId: HoldId,
      resolution: ConflictResolution
    ) => Effect.Effect<AdmissionOutcome, AdmissionError | HoldNotOpenError>;
  }
>()($I`Admission`) {}
