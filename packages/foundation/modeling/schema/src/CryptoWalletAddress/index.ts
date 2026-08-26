/**
 * Namespace-first public module for blockchain wallet address schemas.
 *
 * **Example** (Import CryptoWalletAddress namespace)
 *
 * ```ts import.meta.vitest name="Import CryptoWalletAddress namespace"
 * import * as CryptoWalletAddress from "@beep/schema/CryptoWalletAddress"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownOption(CryptoWalletAddress.Schema)
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
export * from "./CryptoWalletAddress.schema.ts";
