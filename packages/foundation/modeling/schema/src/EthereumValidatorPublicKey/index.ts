/**
 * Namespace-first public module for Ethereum validator public key schemas.
 *
 * **Example** (Import public key namespace)
 *
 * ```ts import.meta.vitest name="Import public key namespace"
 * import * as EthereumValidatorPublicKey from "@beep/schema/EthereumValidatorPublicKey"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownOption(EthereumValidatorPublicKey.Schema)
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
export * from "./EthereumValidatorPublicKey.schema.ts";
