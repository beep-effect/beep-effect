// The zero-dependency leaf every guard imports — no import cycle is possible
// through here (toml/yaml/jsonc/glob precedent).

/**
 * House parity constant for depth guards across every `@effected` format
 * package (jsonc/yaml/toml precedent).
 *
 * **Details**
 *
 * Exceeding it during block-container
 * nesting or the recursive `MarkdownNode` schema decode trips a guard.
 *
 * **Example** (Inspect the shared nesting limit)
 *
 * ```ts
 * import { MAX_NESTING_DEPTH } from "@beep/scratchpad/effected/markdown/internal/limits"
 *
 * console.log(MAX_NESTING_DEPTH) // 256
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_NESTING_DEPTH = 256;
