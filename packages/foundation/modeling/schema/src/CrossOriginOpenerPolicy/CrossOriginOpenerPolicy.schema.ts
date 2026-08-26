/**
 * Schema for the `Cross-Origin-Opener-Policy` header.
 *
 * @since 0.0.0
 * @packageDocumentation
 */
import { $SchemaId } from "@beep/identity";
import { Effect, SchemaTransformation } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as internal from "../Http/Http.headers.shared.ts";
import { LiteralKit } from "../LiteralKit/index.ts";
import * as SchemaUtils from "../SchemaUtils/index.ts";
import { CrossOriginOpenerPolicyError } from "../SecureHeaderError/index.ts";
import type { SecureHeaderError } from "../SecureHeaderError/index.ts";

const $I = $SchemaId.create("CrossOriginOpenerPolicy");

const headerName = "Cross-Origin-Opener-Policy" as const;

const CoopValueBase = LiteralKit(["unsafe-none", "same-origin-allow-popups", "same-origin", "same-origin-plus-COEP"]);

/**
 * Schema for supported `Cross-Origin-Opener-Policy` header values.
 *
 * **Example** (Decode same-origin value)
 *
 * ```ts import.meta.vitest name="Decode same-origin value"
 * import * as S from "effect/Schema"
 * import { CoopValue } from "@beep/schema/CrossOriginOpenerPolicy"
 *
 * const value = S.decodeUnknownSync(CoopValue)("same-origin")
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CoopValue = CoopValueBase.pipe(
  $I.annoteSchema("CoopValue", {
    description: "The supported `Cross-Origin-Opener-Policy` header values.",
  }),
  SchemaUtils.withLiteralKitStatics(CoopValueBase)
);

/**
 * Type-level representation of {@link CoopValue}.
 *
 * **Example** (Annotate same-origin type)
 *
 * ```ts import.meta.vitest name="Annotate same-origin type"
 * import type { CoopValue } from "@beep/schema/CrossOriginOpenerPolicy"
 *
 * const value: CoopValue = "same-origin"
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CoopValue = typeof CoopValue.Type;

const CrossOriginOpenerPolicyOptionBase = LiteralKit([false, ...CoopValueBase.Options]);

/**
 * Schema for `Cross-Origin-Opener-Policy` option values, including `false` to disable.
 *
 * **Example** (Decode disabled option)
 *
 * ```ts import.meta.vitest name="Decode disabled option"
 * import * as S from "effect/Schema"
 * import { CrossOriginOpenerPolicyOption } from "@beep/schema/CrossOriginOpenerPolicy"
 *
 * const option = S.decodeUnknownSync(CrossOriginOpenerPolicyOption)(false)
 * console.log(option)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CrossOriginOpenerPolicyOption = CrossOriginOpenerPolicyOptionBase.pipe(
  $I.annoteSchema("CrossOriginOpenerPolicyOption", {
    description: "The supported `Cross-Origin-Opener-Policy` option values.",
  }),
  SchemaUtils.withLiteralKitStatics(CrossOriginOpenerPolicyOptionBase)
);

/**
 * Type-level representation of {@link CrossOriginOpenerPolicyOption}.
 *
 * **Example** (Annotate false option type)
 *
 * ```ts import.meta.vitest name="Annotate false option type"
 * import type { CrossOriginOpenerPolicyOption } from "@beep/schema/CrossOriginOpenerPolicy"
 *
 * const option: CrossOriginOpenerPolicyOption = false
 * console.log(option)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CrossOriginOpenerPolicyOption = typeof CrossOriginOpenerPolicyOption.Type;

/**
 * Parsed `Cross-Origin-Opener-Policy` response header with name and optional value.
 *
 * **Example** (Construct response header)
 *
 * ```ts import.meta.vitest name="Construct response header"
 * import * as O from "effect/Option"
 * import { CrossOriginOpenerPolicyResponseHeader } from "@beep/schema/CrossOriginOpenerPolicy"
 *
 * const header = new CrossOriginOpenerPolicyResponseHeader({
 *   name: "Cross-Origin-Opener-Policy",
 *   value: O.some("same-origin")
 * })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CrossOriginOpenerPolicyResponseHeader extends S.Class<CrossOriginOpenerPolicyResponseHeader>(
  $I`CrossOriginOpenerPolicyResponseHeader`
)(
  {
    name: S.tag(headerName),
    value: S.OptionFromUndefinedOr(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("CrossOriginOpenerPolicyResponseHeader", {
    description: "The `Cross-Origin-Opener-Policy` response header.",
  })
) {}

type CrossOriginOpenerPolicyResponseHeaderEncoded = typeof CrossOriginOpenerPolicyResponseHeader.Encoded;

/**
 * One-way schema that decodes COOP options into the `Cross-Origin-Opener-Policy` response header.
 *
 * **Example** (Create header from option)
 *
 * ```ts import.meta.vitest name="Create header from option"
 * import { Effect } from "effect"
 * import { CrossOriginOpenerPolicyHeader } from "@beep/schema/CrossOriginOpenerPolicy"
 *
 * const program = CrossOriginOpenerPolicyHeader.create("same-origin")
 * const header = await Effect.runPromise(program)
 * console.log(header._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CrossOriginOpenerPolicyHeader = S.Union([CrossOriginOpenerPolicyOption, S.Undefined]).pipe(
  S.decodeTo(
    CrossOriginOpenerPolicyResponseHeader,
    SchemaTransformation.transformOrFail({
      decode: (input): Effect.Effect<CrossOriginOpenerPolicyResponseHeaderEncoded> =>
        Effect.succeed({
          name: headerName,
          value: P.isUndefined(input) || input === false ? undefined : input,
        }),
      encode: internal.makeHeaderEncodeForbidden("CrossOriginOpenerPolicyHeader"),
    })
  ),
  $I.annoteSchema("CrossOriginOpenerPolicyHeader", {
    description: "A one-way schema that decodes COOP options into the Cross-Origin-Opener-Policy response header.",
  }),
  SchemaUtils.withStatics(() => {
    const createValue: (
      option?: undefined | CrossOriginOpenerPolicyOption
    ) => Effect.Effect<O.Option<string>, SecureHeaderError> = Effect.fnUntraced(function* (
      option?: undefined | CrossOriginOpenerPolicyOption
    ) {
      if (P.isUndefined(option) || option === false) {
        return O.none<string>();
      }

      if (S.is(CoopValue)(option)) {
        return O.some(option);
      }

      return yield* CrossOriginOpenerPolicyError.make({
        message: `Invalid value for ${headerName}: ${option}`,
        cause: O.none(),
      });
    });

    const create: (
      option?: undefined | CrossOriginOpenerPolicyOption,
      headerValueCreator?: undefined | typeof createValue
    ) => Effect.Effect<O.Option<internal.ResponseHeader>, SecureHeaderError> = Effect.fnUntraced(function* (
      option?: undefined | CrossOriginOpenerPolicyOption,
      headerValueCreator: typeof createValue = createValue
    ) {
      const value = yield* headerValueCreator(option);

      return internal.makeResponseHeaderOption(headerName, value);
    });

    return {
      createValue,
      create,
    };
  })
);

/**
 * Type-level representation of {@link CrossOriginOpenerPolicyHeader}.
 *
 * **Example** (Annotate header instance type)
 *
 * ```ts import.meta.vitest name="Annotate header instance type"
 * import * as O from "effect/Option"
 * import { CrossOriginOpenerPolicyResponseHeader, type CrossOriginOpenerPolicyHeader } from "@beep/schema/CrossOriginOpenerPolicy"
 *
 * const header: CrossOriginOpenerPolicyHeader = new CrossOriginOpenerPolicyResponseHeader({
 *   name: "Cross-Origin-Opener-Policy",
 *   value: O.some("same-origin")
 * })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CrossOriginOpenerPolicyHeader = typeof CrossOriginOpenerPolicyHeader.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { CrossOriginOpenerPolicyOption as Option, CrossOriginOpenerPolicyResponseHeader as ResponseHeader };

/**
 * Concise alias for {@link CrossOriginOpenerPolicyHeader}.
 *
 * **Example** (Create header via alias)
 *
 * ```ts import.meta.vitest name="Create header via alias"
 * import { Effect } from "effect"
 * import { Header } from "@beep/schema/CrossOriginOpenerPolicy"
 *
 * const program = Header.create("same-origin")
 * const header = await Effect.runPromise(program)
 * console.log(header._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Header = CrossOriginOpenerPolicyHeader;

/**
 * Type-level representation of {@link Header}.
 *
 * **Example** (Annotate Header alias type)
 *
 * ```ts import.meta.vitest name="Annotate Header alias type"
 * import * as O from "effect/Option"
 * import { CrossOriginOpenerPolicyResponseHeader, type Header } from "@beep/schema/CrossOriginOpenerPolicy"
 *
 * const header: Header = new CrossOriginOpenerPolicyResponseHeader({
 *   name: "Cross-Origin-Opener-Policy",
 *   value: O.some("same-origin")
 * })
 * console.log(header.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Header = typeof Header.Type;
