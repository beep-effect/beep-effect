/**
 * Schema for the `Cross-Origin-Embedder-Policy` header.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity";
import { O } from "@beep/utils";
import { Effect, pipe, SchemaIssue, SchemaTransformation } from "effect";
import * as Eq from "effect/Equal";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { ResponseHeader } from "../Http/Http.headers.shared.ts";
import { LiteralKit } from "../LiteralKit/index.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { CrossOriginEmbedderPolicyError } from "../SecureHeaderError/index.ts";
import type { SecureHeaderError } from "../SecureHeaderError/index.ts";

const $I = $SchemaId.create("CrossOriginEmbedderPolicy");

const headerName = "Cross-Origin-Embedder-Policy" as const;

const CoepValueBase = LiteralKit(["unsafe-none", "require-corp", "credentialless"]);

/**
 * Schema for allowed `Cross-Origin-Embedder-Policy` values.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { CoepValue } from "@beep/schema/CrossOriginEmbedderPolicy"
 *
 * console.log(S.is(CoepValue)("require-corp")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CoepValue = CoepValueBase.pipe(
  $I.annoteSchema("CoepValue", {
    description: "The value of the `Cross-Origin-Embedder-Policy` header.",
  }),
  SchemaUtils.withLiteralKitStatics(CoepValueBase)
);

/**
 * Type for allowed `Cross-Origin-Embedder-Policy` values.
 *
 * @category models
 * @since 0.0.0
 */
export type CoepValue = typeof CoepValue.Type;

const CrossOriginEmbedderPolicyOptionBase = LiteralKit([false, ...CoepValueBase.Options]);

/**
 * Schema for enabled or disabled `Cross-Origin-Embedder-Policy` options.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { CrossOriginEmbedderPolicyOption } from "@beep/schema/CrossOriginEmbedderPolicy"
 *
 * console.log(S.decodeUnknownSync(CrossOriginEmbedderPolicyOption)("require-corp"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CrossOriginEmbedderPolicyOption = CrossOriginEmbedderPolicyOptionBase.pipe(
  $I.annoteSchema("CrossOriginEmbedderPolicyOption", {
    description: "The value of the `Cross-Origin-Embedder-Policy` header.",
  }),
  SchemaUtils.withLiteralKitStatics(CrossOriginEmbedderPolicyOptionBase)
);

/**
 * Type for enabled or disabled `Cross-Origin-Embedder-Policy` options.
 *
 * @category models
 * @since 0.0.0
 */
export type CrossOriginEmbedderPolicyOption = typeof CrossOriginEmbedderPolicyOption.Type;

/**
 * Schema for the Cross-Origin-Embedder-Policy response header output.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { COEPResponseHeader } from "@beep/schema/CrossOriginEmbedderPolicy"
 *
 * const header = COEPResponseHeader.make({ name: "Cross-Origin-Embedder-Policy", value: O.some("require-corp") })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class COEPResponseHeader extends S.Class<COEPResponseHeader>($I`COEPResponseHeader`)(
  {
    name: S.tag(headerName),
    value: S.OptionFromUndefinedOr(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("COEPResponseHeader", {
    description: "The `Cross-Origin-Embedder-Policy` response header.",
  })
) {}

type COEPResponseHeaderEncoded = typeof COEPResponseHeader.Encoded;

/**
 * Schema for the Cross-Origin-Embedder-Policy response header.
 * Transforms a CrossOriginEmbedderPolicyOption input into a ResponseHeader output.
 *
 * - `false` → decodes to `{ name: "Cross-Origin-Embedder-Policy", value: undefined }`
 * - `undefined` → decodes to `{ name: "Cross-Origin-Embedder-Policy", value: undefined }` (no default)
 * - Valid COEP value → decodes to `{ name: "Cross-Origin-Embedder-Policy", value: <value> }`
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { CrossOriginEmbedderPolicyHeader } from "@beep/schema/CrossOriginEmbedderPolicy"
 *
 * const header = S.decodeUnknownSync(CrossOriginEmbedderPolicyHeader)("require-corp")
 * console.log(header.name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CrossOriginEmbedderPolicyHeader = S.Union([CrossOriginEmbedderPolicyOption, S.Undefined]).pipe(
  S.decodeTo(
    COEPResponseHeader,
    SchemaTransformation.transformOrFail({
      decode: (input): Effect.Effect<COEPResponseHeaderEncoded, SchemaIssue.Issue> =>
        Effect.succeed({
          name: headerName,
          value: input === false || input === undefined ? undefined : input,
        }),
      encode: (
        header: COEPResponseHeaderEncoded
      ): Effect.Effect<CrossOriginEmbedderPolicyOption | undefined, SchemaIssue.Issue> =>
        Effect.fail(
          new SchemaIssue.Forbidden(O.some(header), {
            message: "Encoding CrossOriginEmbedderPolicyHeader back to the original input is not supported",
          })
        ),
    })
  ),
  $I.annoteSchema("CrossOriginEmbedderPolicyHeader", {
    description: "A one-way schema that decodes COEP options into the Cross-Origin-Embedder-Policy response header.",
  }),
  SchemaUtils.withStatics(() => {
    const createValue = Effect.fnUntraced(function* (
      option?: undefined | CrossOriginEmbedderPolicyOption
    ): Effect.fn.Return<O.Option<string>, SecureHeaderError> {
      if (P.isUndefined(option)) {
        return O.none<string>();
      }
      if (Eq.equals(false)(option)) {
        return O.none<string>();
      }

      if (S.is(CoepValue)(option)) {
        return O.some(option);
      }

      return yield* CrossOriginEmbedderPolicyError.make({
        message: `Invalid value for ${headerName}: ${option}`,
        cause: O.none(),
      });
    });

    const create: (
      option?: undefined | CrossOriginEmbedderPolicyOption,
      headerValueCreator?: undefined | typeof createValue
    ) => Effect.Effect<O.Option<ResponseHeader>, SecureHeaderError> = Effect.fnUntraced(function* (
      option?: undefined | CrossOriginEmbedderPolicyOption,
      headerValueCreator: typeof createValue = createValue
    ): Effect.fn.Return<O.Option<ResponseHeader>, SecureHeaderError> {
      const value = yield* headerValueCreator(option);

      return pipe(
        value,
        O.match({
          onNone: O.none<ResponseHeader>,
          onSome: (value) =>
            O.some(
              ResponseHeader.make({
                name: headerName,
                value: O.some(value),
              })
            ),
        })
      );
    });
    return {
      createValue,
      create,
    };
  })
);

/**
 * Type for rendered `Cross-Origin-Embedder-Policy` response headers.
 *
 * @category models
 * @since 0.0.0
 */
export type CrossOriginEmbedderPolicyHeader = typeof CrossOriginEmbedderPolicyHeader.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export {
  COEPResponseHeader as ResponseHeader,
  CrossOriginEmbedderPolicyHeader as Header,
  CrossOriginEmbedderPolicyOption as Option,
};
