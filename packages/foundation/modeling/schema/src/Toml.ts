/**
 * TOML parsing and schema transforms.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { Effect, flow, SchemaGetter, SchemaIssue } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { UnknownRecord } from "./Record/index.ts";

const $I = $SchemaId.create("Toml");

const decodeUnknownRecord = S.decodeUnknownEffect(UnknownRecord);

const encodeUnsupported = (): Effect.Effect<string, SchemaIssue.Issue> =>
  Effect.fail(
    new SchemaIssue.InvalidValue({
      message: "Encoding unknown values to TOML text is not supported by TomlTextToUnknown.",
    })
  );

type TomlParse = (content: string) => unknown;

const hasMessage = (
  input: unknown
): input is {
  readonly message: string;
} => P.isObject(input) && P.hasProperty(input, "message") && P.isString(input.message);

const getTomlParse = (): O.Option<TomlParse> => {
  const bunRuntime = Reflect.get(globalThis, "Bun");
  const toml = P.isObject(bunRuntime) ? Reflect.get(bunRuntime, "TOML") : undefined;
  const parse = P.isObject(toml) ? Reflect.get(toml, "parse") : undefined;
  if (P.isFunction(parse)) {
    const parseToml: TomlParse = (content) => parse(content);
    return O.some(parseToml);
  }
  return O.none();
};

const decodeTomlUnknown = (content: string) => {
  const makeInvalid = (message: string) => new SchemaIssue.InvalidValue({ message });
  return getTomlParse().pipe(
    Effect.fromOption,
    Effect.mapError(() => makeInvalid("Bun.TOML.parse is" + " unavailable in the current runtime.")),
    Effect.flatMap((parse) =>
      Effect.try({
        try: () => parse(content),
        catch: (cause) =>
          makeInvalid(hasMessage(cause) ? `Invalid TOML input (${cause.message}).` : "Invalid TOML input."),
      })
    ),
    Effect.flatMap((parsed) =>
      decodeUnknownRecord(parsed).pipe(
        Effect.mapError(() => makeInvalid("Invalid TOML input (Expected TOML object output)."))
      )
    )
  );
};

/**
 * Schema transformation that decodes TOML text into an unknown record using
 * `Bun.TOML.parse`.
 *
 * **Example** (Decode TOML to unknown)
 *
 * ```ts import.meta.vitest name="Decode TOML to unknown"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { TomlTextToUnknown } from "@beep/schema/Toml"
 *
 * const program = S.decodeUnknownEffect(TomlTextToUnknown)("port = 8080")
 * const parsed = await Effect.runPromise(program)
 * console.log(parsed.port)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const TomlTextToUnknown = S.String.pipe(
  S.decodeTo(UnknownRecord, {
    decode: SchemaGetter.transformOrFail(decodeTomlUnknown),
    encode: SchemaGetter.transformOrFail(encodeUnsupported),
  }),
  $I.annoteSchema("TomlTextToUnknown", {
    description: "Schema transformation that parses TOML text into unknown values.",
  })
);

/**
 * {@inheritDoc TomlTextToUnknown}
 * @category models
 * @since 0.0.0
 */
export type TomlTextToUnknown = typeof TomlTextToUnknown.Type;

/**
 * Builds a decoder that parses TOML text and then decodes the result through a
 * target schema.
 *
 * **Example** (Decode TOML with schema)
 *
 * ```ts import.meta.vitest name="Decode TOML with schema"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { decodeTomlTextAs } from "@beep/schema/Toml"
 *
 * const ServerConfig = S.Struct({ port: S.Finite, host: S.String })
 * const decodeConfig = decodeTomlTextAs(S.Struct({ server: ServerConfig }))
 *
 * const program = decodeConfig("[server]\nport = 8080\nhost = \"localhost\"")
 * const config = await Effect.runPromise(program)
 * config.server.port // => 8080
 * ```
 *
 * @param schema - Target schema to decode parsed TOML document into.
 * @returns Decoder function from TOML text to the target schema type.
 * @category utilities
 * @since 0.0.0
 */
export const decodeTomlTextAs = <Schema extends S.Top>(schema: Schema) => {
  const decodeTomlUnknownText = S.decodeUnknownEffect(TomlTextToUnknown);
  const decodeTargetSchema = S.decodeUnknownEffect(schema);
  return flow(decodeTomlUnknownText, Effect.flatMap(decodeTargetSchema));
};
