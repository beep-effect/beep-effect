/**
 * Whether the GitHub budget ledger is on for this process, kept apart from the
 * ledger's wiring so the CLI root can skip loading that wiring (and its
 * GitHub client) when the ledger is off.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { configStringOption, isCi } from "@beep/repo-cli-kit/cli/EnvConfig";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";

/**
 * Whether the ledger is off for this process: under CI, or with `BEEP_GITHUB_LEDGER=off`.
 *
 * **Example** (Build the check)
 *
 * ```ts
 * import { githubLedgerDisabled } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(githubLedgerDisabled)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const githubLedgerDisabled: Effect.Effect<boolean> = Effect.gen(function* () {
  const setting = yield* configStringOption("BEEP_GITHUB_LEDGER");
  const ci = yield* isCi;
  return ci || O.exists(setting, (value) => Str.trim(value) === "off");
});
