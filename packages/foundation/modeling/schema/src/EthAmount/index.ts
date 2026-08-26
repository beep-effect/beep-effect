/**
 * Namespace-first public module for ETH amount schemas.
 *
 * **Example** (Import EthAmount namespace)
 *
 * ```ts
 * import * as EthAmount from "@beep/schema/EthAmount"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownOption(EthAmount.Schema)
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
export * from "./EthAmount.schema.ts";
