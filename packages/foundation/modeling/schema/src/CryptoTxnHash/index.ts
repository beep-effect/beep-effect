/**
 * Namespace-first public module for blockchain transaction hash schemas.
 *
 * **Example** (Import CryptoTxnHash namespace)
 *
 * ```ts import.meta.vitest name="Import CryptoTxnHash namespace"
 * import * as CryptoTxnHash from "@beep/schema/CryptoTxnHash"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownOption(CryptoTxnHash.Schema)
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
export * from "./CryptoTxnHash.schema.ts";
