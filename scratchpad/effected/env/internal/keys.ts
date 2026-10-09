import * as A from "effect/Array";
import { agentCiKeys } from "./agentCi.ts";
import { colorKeys } from "./colorDepth.ts";
import { terminalKeys } from "./osc8/detect.ts";

/**
 * Every environment variable any detector reads: the union of the agent/CI, colour and terminal key lists, without
 * duplicates.
 *
 * **Example** (Check that detector keys are deduplicated)
 *
 * ```ts
 * import { allKeys } from "@beep/scratchpad/effected/env/internal/keys";
 * import * as A from "effect/Array";
 *
 * console.log(A.length(allKeys) === A.length(A.dedupe(allKeys))) // true
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const allKeys: ReadonlyArray<string> = A.dedupe([...agentCiKeys, ...colorKeys, ...terminalKeys]);
