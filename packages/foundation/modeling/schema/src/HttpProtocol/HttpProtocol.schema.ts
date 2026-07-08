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
 * @example
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
 * @example
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
 * @example
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
 * @category models
 * @since 0.0.0
 */
export type Schema = HttpProtocol;
