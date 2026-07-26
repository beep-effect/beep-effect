/**
 * Execution ledger repository layers.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { ExecutionLedger } from "@beep/epistemic-use-cases/ExecutionLedger";
import { Layer } from "effect";
import { makeDrizzleExecutionLedger } from "./ExecutionLedger.repo.ts";
import type { PostgresDrizzle } from "@beep/postgres";

/**
 * Drizzle-backed execution ledger repository layer.
 *
 * There is no in-memory sibling here, and that is deliberate: the append-only
 * property this repository sells — the chain primary key, the
 * outcome-per-decision primary key, the triggers that reject UPDATE and DELETE
 * — is enforced by the database, so an in-memory stand-in would be proving a
 * different thing than the one callers depend on.
 *
 * @example
 * ```ts
 * import { ExecutionLedgerDrizzle } from "@beep/epistemic-server/ExecutionLedger"
 *
 * console.log(ExecutionLedgerDrizzle)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ExecutionLedgerDrizzle: Layer.Layer<ExecutionLedger, never, PostgresDrizzle> = Layer.effect(
  ExecutionLedger,
  makeDrizzleExecutionLedger()
);
