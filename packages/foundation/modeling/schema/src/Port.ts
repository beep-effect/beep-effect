/**
 * Branded schemas and codecs for transport-layer port numbers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { SchemaTransformation as ST } from "effect";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Port");

const portMinimum = 1;
const portMaximum = 65_535;
const decimalIntegerPattern = /^[0-9]+$/;

const PortRange = S.isBetween(
  {
    minimum: portMinimum,
    maximum: portMaximum,
  },
  {
    identifier: $I`PortRangeCheck`,
    title: "Port Range",
    description: "A transport-layer port number in the inclusive range 1 through 65535.",
    expected: "a transport protocol port number",
    message: "Expected a valid transport port number between 1 and 65535",
  }
);

const PortDecimalString = S.String.check(
  S.isPattern(decimalIntegerPattern, {
    identifier: $I`PortDecimalStringCheck`,
    title: "Port Decimal String",
    description: "A base-10 integer string used to decode a transport-layer port number.",
    expected: "a decimal integer string",
    message: "Port strings must contain only ASCII decimal digits",
  })
).pipe(
  $I.annoteSchema("PortDecimalString", {
    description: "A decimal integer string accepted before port number decoding.",
  })
);

/**
 * Branded schema for usable transport-layer port numbers.
 *
 * **Details**
 *
 * Transport protocols use 16-bit port-number spaces, but this schema excludes
 * port `0` because it is reserved in the IANA TCP/UDP registry and commonly
 * used by local APIs as an allocation sentinel rather than a service port.
 *
 * **Example** (Decode HTTPS port number)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Port } from "@beep/schema/Port"
 *
 * const port = await Effect.runPromise(S.decodeUnknownEffect(Port)(443))
 * console.log(port) // 443
 * ```
 *
 * @invariant Port values are integers from 1 through 65535.
 * @category validation
 * @since 0.0.0
 */
export const Port = S.Int.check(PortRange).pipe(
  S.brand("Port"),
  $I.annoteSchema("Port", {
    description: "A branded transport-layer port number in the inclusive range 1 through 65535.",
  })
);

/**
 * Type-level value inferred from {@link Port}.
 *
 * **Example** (Narrow unknown to Port)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Port } from "@beep/schema/Port"
 * import type { Port as PortValue } from "@beep/schema/Port"
 *
 * const input: unknown = 5432
 * if (S.is(Port)(input)) {
 *   const port: PortValue = input
 *   console.log(port) // 5432
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Port = typeof Port.Type;

/**
 * Codec that decodes decimal port strings into branded {@link Port} values.
 *
 * **Details**
 *
 * The encoded side accepts only ASCII decimal digits before number decoding,
 * avoiding JavaScript number-coercion forms such as whitespace or hexadecimal
 * strings.
 *
 * **Example** (Decode decimal port string)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { PortFromString } from "@beep/schema/Port"
 *
 * const port = await Effect.runPromise(S.decodeUnknownEffect(PortFromString)("8080"))
 * console.log(port) // 8080
 * ```
 *
 * @invariant Decoded values satisfy {@link Port}.
 * @category codecs
 * @since 0.0.0
 */
export const PortFromString = PortDecimalString.pipe(
  S.decodeTo(Port, ST.numberFromString),
  $I.annoteSchema("PortFromString", {
    description: "A decimal string codec for branded transport-layer port numbers.",
  })
);

/**
 * Type-level value inferred from {@link PortFromString}.
 *
 * **Example** (Decoded string as Port type)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { Port, PortFromString } from "@beep/schema/Port"
 * import type { PortFromString as PortFromStringValue } from "@beep/schema/Port"
 *
 * const input: unknown = "3000"
 * const acceptsPortStringValue = (value: PortFromStringValue) => S.is(Port)(value)
 * const value = await Effect.runPromise(S.decodeUnknownEffect(PortFromString)(input))
 * console.log(acceptsPortStringValue(value)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PortFromString = typeof PortFromString.Type;
