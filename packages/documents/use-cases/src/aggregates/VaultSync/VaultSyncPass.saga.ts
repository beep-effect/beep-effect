/**
 * Durable orchestration declaration for one explicitly identified sync pass.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import * as S from "effect/Schema";

/**
 * Runs probe, scan, pump and remote classification in a durable workflow.
 *
 * **Details**
 * Use a fresh key per pass; retrying a key retrieves the existing run.
 *
 * **Example** (Inspect the workflow)
 * ```ts
 * import { VaultSyncPass } from "@beep/documents-use-cases/aggregates/VaultSync";
 * console.log(VaultSyncPass.sagaName);
 * ```
 * @category sagas
 * @since 0.0.0
 */
export class VaultSyncPass extends Domain.Saga("VaultSyncPass", {
  key: S.NonEmptyString,
  input: { destinationId: V.DestinationId },
  result: { operationsSucceeded: S.Int, conflicts: S.Int },
}) {}
