/**
 * Maximum collection-nesting depth accepted by the package's recursive
 * document walks (the `$ref` rewrite, the document lint and the canonical
 * JSON emitter).
 *
 * The kit-wide parity constant (matching `@effected/yaml`, `@effected/jsonc`
 * and `@effected/toml`): deeply-nested hostile input must fail through a
 * typed channel — or degrade to a lint finding — rather than overflowing the
 * call stack as an unhandled defect.
 */
export const MAX_NESTING_DEPTH = 256;
