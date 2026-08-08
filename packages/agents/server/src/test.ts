/**
 * Agents server test surface.
 *
 * @packageDocumentation
 * @category testing
 * @since 0.0.0
 */

import { initialScanState } from "./AssistantTurn/index.ts";

/**
 * Deterministic seed scan state re-exported for tests and fixtures.
 *
 * **Example** (Scan chunk with seed state)
 *
 * ```ts
 * import { AgentsServerInitialScanState } from "@beep/agents-server/test"
 * import { scanChunk } from "@beep/agents-server/AssistantTurn"
 *
 * const [, completed] = scanChunk(AgentsServerInitialScanState, '{"blocks":[{"type":"paragraph"}]}')
 * console.log(completed.length) // 1
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const AgentsServerInitialScanState = initialScanState;
