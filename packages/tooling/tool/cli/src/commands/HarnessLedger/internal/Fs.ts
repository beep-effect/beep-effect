/**
 * Shared filesystem helpers for the harness-ledger command group.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import { Effect, FileSystem, Order } from "effect";
import { HarnessLedgerIoError } from "../HarnessLedger.errors.ts";

/**
 * Lists a directory's entry names sorted by name; a missing directory is empty.
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const listDirectorySorted = Effect.fn("HarnessLedger.listDirectorySorted")(function* (dir: string) {
  const fs = yield* FileSystem.FileSystem;
  const exists = yield* fs.exists(dir).pipe(Effect.mapError(HarnessLedgerIoError.wrap(`Failed to inspect ${dir}.`)));
  if (!exists) {
    return A.empty<string>();
  }
  const names = yield* fs.readDirectory(dir).pipe(Effect.mapError(HarnessLedgerIoError.wrap(`Failed to list ${dir}.`)));
  return A.sort(names, Order.String);
});
