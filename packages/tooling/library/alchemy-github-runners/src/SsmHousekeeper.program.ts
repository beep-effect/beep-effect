/**
 * The SSM housekeeper Lambda's program: delete runner tokens nobody consumed.
 *
 * Ported from `lambdas/functions/control-plane/src/scale-runners/ssm-housekeeper.ts`
 * of github-aws-runners/terraform-aws-github-runner v7.10.1 (MIT); see the
 * package README for the license notice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { SsmStore } from "./SsmStore.service.ts";
import type { HousekeeperRuntimeConfig } from "./RunnerRuntime.models.ts";

const dayMillis = 86_400_000;

/**
 * Deletes token parameters last modified more than `minimumDaysOld` days ago
 * and returns the names it deleted (or would delete, in a dry run).
 *
 * **Details**
 *
 * A runner deletes its own token as it boots, so a token that survives a day
 * belongs to an instance that never started. A parameter without a
 * modification time is kept. One failed delete does not stop the others.
 *
 * **Example** (Wire the program)
 *
 * ```ts
 * import { handleSsmHousekeeping } from "@beep/alchemy-github-runners/SsmHousekeeper.program"
 *
 * console.log(typeof handleSsmHousekeeping)
 * ```
 *
 * @param config - Token paths, age threshold and dry-run switch.
 * @returns The stale parameter names.
 * @category use-cases
 * @since 0.0.0
 */
export const handleSsmHousekeeping = Effect.fn("SsmHousekeeper.handle")(function* (config: HousekeeperRuntimeConfig) {
  const ssm = yield* SsmStore;
  const cutoff = (yield* Clock.currentTimeMillis) - config.minimumDaysOld * dayMillis;
  const listed = yield* Effect.forEach(config.tokenPaths, ssm.listByPath);
  const stale = A.map(
    A.filter(A.flatten(listed), (entry) => O.exists(entry.lastModified, (modified) => modified < cutoff)),
    (entry) => entry.name
  );
  if (!config.dryRun) {
    yield* Effect.forEach(stale, (name) => ssm.delete(name).pipe(Effect.ignore), { discard: true });
  }
  return stale;
});
