/**
 * Module for HTTP protocol ("http" or "https").
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import { LiteralKit } from "../LiteralKit/index.ts";

const $I = $SchemaId.create("HttpProtocol");

/**
 * An HTTP protocol ("http" or "https")
 *
 * **Example** (Check https in options)
 *
 * ```ts
 * import { HttpProtocol } from "@beep/schema/HttpProtocol"
 *
 * console.log(HttpProtocol.Options.includes("https"))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const HttpProtocol = LiteralKit(["http", "https"]).pipe(
  $I.annoteSchema("HttpProtocol", {
    description: 'An HTTP protocol ("http" or "https")',
  })
);

/**
 * {@inheritDoc HttpProtocol}
 *
 * **Example** (Type protocol and check options)
 *
 * ```ts
 * import { HttpProtocol } from "@beep/schema/HttpProtocol"
 *
 * const protocol: HttpProtocol = "https"
 * console.log(HttpProtocol.Options.includes(protocol))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export type HttpProtocol = typeof HttpProtocol.Type;

/**
 * {@inheritDoc HttpProtocol}
 *
 * **Example** (Check https via Schema)
 *
 * ```ts
 * import { Schema } from "@beep/schema/HttpProtocol"
 *
 * console.log(Schema.Options.includes("https"))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const Schema = HttpProtocol;

/**
 * {@inheritDoc HttpProtocol}
 *
 * **Example** (Type protocol Schema value)
 *
 * ```ts
 * import type { Schema } from "@beep/schema/HttpProtocol"
 *
 * const protocol: Schema = "https"
 * console.log(protocol)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Schema = HttpProtocol;
