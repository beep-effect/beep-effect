/**
 * Branded schema for canonical mainnet EVM wallet addresses.
 *
 * Accepts lowercase or EIP-55 checksummed addresses.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity/packages";
import { flow, Redacted } from "effect";
import * as S from "effect/Schema";
import { isCanonicalEvmAddress } from "../internal/crypto.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";

const $I = $SchemaId.create("EvmAddress");

const EvmAddressChecks = S.makeFilterGroup(
  [
    S.makeFilter(isCanonicalEvmAddress, {
      identifier: $I`EvmAddressFormatCheck`,
      title: "EVM Address Format",
      description: "A canonical mainnet EVM address in lowercase or valid EIP-55 checksum form.",
      message: "EvmAddress must be a canonical mainnet EVM address",
    }),
  ],
  {
    identifier: $I`EvmAddressChecks`,
    title: "EvmAddress",
    description: "Checks for canonical mainnet EVM addresses.",
  }
);

/**
 * Branded schema for canonical mainnet EVM wallet addresses.
 *
 * @example
 * ```ts
 * import { EvmAddress } from "@beep/schema/EvmAddress"
 * import * as S from "effect/Schema"
 *
 * const address = S.decodeUnknownSync(EvmAddress)("0x0000000000000000000000000000000000000000")
 * console.log(address)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const EvmAddress = S.NonEmptyString.check(EvmAddressChecks).pipe(
  S.brand("EvmAddress"),
  $I.annoteSchema("EvmAddress", {
    description: "Canonical mainnet EVM address in lowercase or valid EIP-55 checksum form.",
  })
);

/**
 * Type for {@link EvmAddress}.
 *
 * @example
 * ```ts
 * import { EvmAddress } from "@beep/schema/EvmAddress"
 * import * as S from "effect/Schema"
 *
 * const address: EvmAddress = S.decodeUnknownSync(EvmAddress)("0x0000000000000000000000000000000000000000")
 * console.log(address)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type EvmAddress = typeof EvmAddress.Type;

/**
 * Redacted schema for canonical mainnet EVM wallet addresses.
 *
 * @example
 * ```ts
 * import { EvmAddressRedacted } from "@beep/schema/EvmAddress"
 *
 * const address = EvmAddressRedacted.makeRedacted("0x0000000000000000000000000000000000000000")
 * console.log(address)
 * ```
 *
 * @since 0.0.0
 * @category validation
 */
export const EvmAddressRedacted = EvmAddress.pipe(
  S.RedactedFromValue,
  SchemaUtils.withStatics(() => ({
    makeRedacted: flow(EvmAddress.make, Redacted.make),
  })),
  $I.annoteSchema("EvmAddressRedacted", {
    description: "Redacted canonical mainnet EVM address in lowercase or valid EIP-55 checksum form.",
  })
);

/**
 * Type for {@link EvmAddressRedacted}.
 *
 * @example
 * ```ts
 * import { EvmAddressRedacted } from "@beep/schema/EvmAddress"
 *
 * const address: EvmAddressRedacted = EvmAddressRedacted.makeRedacted("0x0000000000000000000000000000000000000000")
 * console.log(address)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type EvmAddressRedacted = typeof EvmAddressRedacted.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { EvmAddress as Schema, EvmAddressRedacted as Redacted };
