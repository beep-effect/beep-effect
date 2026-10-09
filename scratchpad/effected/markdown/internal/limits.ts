// The zero-dependency leaf every guard imports — no import cycle is possible
// through here (toml/yaml/jsonc/glob precedent).

/**
 * House parity constant for depth guards across every `@effected` format
 * package (jsonc/yaml/toml precedent). Exceeding it during block-container
 * nesting or the recursive `MarkdownNode` schema decode trips a guard.
 */
export const MAX_NESTING_DEPTH = 256;
