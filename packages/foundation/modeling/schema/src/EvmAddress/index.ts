/**
 * Namespace-first public module for EVM address schemas.
 *
 * **Example** (Import EVM address namespace)
 *
 * ```ts import.meta.vitest name="Import EVM address namespace"
 * import * as EvmAddress from "@beep/schema/EvmAddress"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownOption(EvmAddress.Schema)
 * console.log(decode)
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/**
 * Public schema module export.
 *
 * @category schemas
 * @since 0.0.0
 */
export * from "./EvmAddress.schema.ts";
