import * as A from "effect/Array";
import { agentCiKeys } from "./agentCi.ts";
import { colorKeys } from "./colorDepth.ts";
import { terminalKeys } from "./osc8/detect.ts";

/**
 * Every environment variable any detector reads: the union of the agent/CI, colour and terminal key lists, without
 * duplicates.
 *
 * @internal
 */
export const allKeys: ReadonlyArray<string> = A.dedupe([...agentCiKeys, ...colorKeys, ...terminalKeys]);
