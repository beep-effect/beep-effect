/**
 * HTTP method literal type kit.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import { HashSet } from "effect";
import * as S from "effect/Schema";
import { LiteralKit } from "../LiteralKit/index.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";

const $I = $SchemaId.create("http/HttpMethod/HttpMethod");
const HttpMethodBase = LiteralKit(["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS", "TRACE"]);

/**
 * Base literal kit for all supported HTTP method tokens.
 *
 * @example
 * ```ts
 * import { Literal } from "@beep/schema/HttpMethod"
 *
 * console.log(Literal.Options.includes("GET"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HttpMethod_ = HttpMethodBase.pipe(
  $I.annoteSchema("HttpMethodLiteral", {
    description: "Base literal kit for all supported HTTP method tokens.",
  }),
  SchemaUtils.withLiteralKitStatics(HttpMethodBase)
);

const NoBodyBase = LiteralKit(HttpMethod_.pickOptions(["GET", "HEAD", "OPTIONS", "TRACE"]));

const NoBody = NoBodyBase.pipe(
  $I.annoteSchema("NoBody", {
    description: "HTTP method literal type for methods that do not have a body.",
  }),
  SchemaUtils.withLiteralKitStatics(NoBodyBase)
);

type NoBody = typeof NoBody.Type;

const WithBodyBase = LiteralKit(HttpMethod_.omitOptions(NoBody.Options));

const WithBody = WithBodyBase.pipe(
  $I.annoteSchema("WithBody", {
    description: "HTTP method literal type for methods that have a body.",
  }),
  SchemaUtils.withLiteralKitStatics(WithBodyBase)
);

type WithBody = typeof WithBody.Type;
type HttpMethodValue = typeof HttpMethod_.Type;
const hasBody: (method: HttpMethodValue) => method is WithBody = S.is(WithBody);

/**
 * HTTP method schema with static helpers for body support and common aliases.
 *
 * @example
 * ```ts
 * import { HttpMethod } from "@beep/schema/HttpMethod"
 *
 * console.log(HttpMethod.hasBody("POST"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const HttpMethod = HttpMethod_.pipe(
  $I.annoteSchema("HttpMethod", {
    description: "HTTP method literal type.",
  }),
  SchemaUtils.withLiteralKitStatics(HttpMethod_),
  SchemaUtils.withStatics(
    () =>
      ({
        hasBody,
        all: HashSet.fromIterable(HttpMethod_.Options),
        allShort: [
          ["GET", "get"],
          ["POST", "post"],
          ["PUT", "put"],
          ["DELETE", "del"],
          ["PATCH", "patch"],
          ["HEAD", "head"],
          ["OPTIONS", "options"],
          ["TRACE", "trace"],
        ] as const,
        NoBody,
        WithBody,
      }) as const
  )
);

/**
 * Runtime type for supported HTTP method tokens.
 *
 * @example
 * ```ts
 * import { HttpMethod } from "@beep/schema/HttpMethod"
 *
 * const method: HttpMethod = "POST"
 * console.log(HttpMethod.hasBody(method))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HttpMethod = typeof HttpMethod.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { HttpMethod as Schema, HttpMethod_ as Literal };
