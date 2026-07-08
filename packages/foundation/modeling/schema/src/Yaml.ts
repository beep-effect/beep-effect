/**
 * YAML parsing and schema transforms.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { A } from "@beep/utils";
import { Effect, flow, Result, SchemaGetter, SchemaIssue } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { getGlobalYamlRuntime, loadYamlModule, makeParseYaml, makeParseYamlForSchema } from "./internal/yaml.ts";

const $I = $SchemaId.create("Yaml");
const yamlRuntime = getGlobalYamlRuntime();

const parseYamlResult = makeParseYamlForSchema(yamlRuntime, loadYamlModule);

const invalidYamlInput: {
  (content: unknown): (message: string) => SchemaIssue.InvalidValue;
  (message: string, content: unknown): SchemaIssue.InvalidValue;
} = dual(
  2,
  (message: string, content: unknown): SchemaIssue.InvalidValue =>
    new SchemaIssue.InvalidValue(O.some(content), {
      message,
    })
);

const encodeUnsupported = (value: unknown): Effect.Effect<string, SchemaIssue.Issue> =>
  Effect.fail(invalidYamlInput(value)("Encoding unknown values to YAML text is not supported by YamlTextToUnknown."));

const renderYamlIssueMessage = (messages: ReadonlyArray<string>): string =>
  `Invalid YAML input (${A.join(messages, "; ")}).`;

const renderYamlCauseMessage = (cause: unknown): string => (P.isError(cause) ? cause.message : "Invalid YAML input.");

const toYamlIssue = (input: string): ((cause: unknown) => SchemaIssue.InvalidValue) =>
  flow(renderYamlCauseMessage, invalidYamlInput(input));

const decodeYamlUnknown = (input: string): Effect.Effect<unknown, SchemaIssue.Issue> =>
  Effect.try({
    try: () => parseYamlResult(input),
    catch: toYamlIssue(input),
  }).pipe(
    Effect.flatMap(
      flow(
        Result.mapError(flow(renderYamlIssueMessage, invalidYamlInput(input))),
        Result.match({
          onSuccess: Effect.succeed,
          onFailure: Effect.fail,
        })
      )
    )
  );

/**
 * Parses a YAML string into a JavaScript value. Uses `Bun.YAML` when available
 * and otherwise falls back to the `yaml` package.
 *
 * @example
 * ```ts
 * import { parseYaml } from "@beep/schema/Yaml"
 *
 * const value = parseYaml("name: Alice\nage: 30")
 * console.log(value)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const parseYaml = makeParseYaml(yamlRuntime, loadYamlModule);

/**
 * Schema transformation that decodes YAML text into an unknown parsed value.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { YamlTextToUnknown } from "@beep/schema/Yaml"
 *
 * const program = S.decodeUnknownEffect(YamlTextToUnknown)("name: Beep")
 * const parsed = await Effect.runPromise(program)
 * console.log(parsed)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const YamlTextToUnknown = S.String.pipe(
  S.decodeTo(S.Unknown, {
    decode: SchemaGetter.transformOrFail(decodeYamlUnknown),
    encode: SchemaGetter.transformOrFail(encodeUnsupported),
  }),
  $I.annoteSchema("YamlTextToUnknown", {
    description: "Schema transformation that parses YAML text into unknown values.",
  })
);

/**
 * {@inheritDoc YamlTextToUnknown}
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { YamlTextToUnknown } from "@beep/schema/Yaml"
 *
 * const program = S.decodeUnknownEffect(YamlTextToUnknown)("name: Beep")
 * const parsed: typeof YamlTextToUnknown.Type = await Effect.runPromise(program)
 * console.log(parsed)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type YamlTextToUnknown = typeof YamlTextToUnknown.Type;

/**
 * Builds a decoder that parses YAML text and then decodes the result through a
 * target schema.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { decodeYamlTextAs } from "@beep/schema/Yaml"
 *
 * const Config = S.Struct({ name: S.String, age: S.Finite })
 * const decodeConfig = decodeYamlTextAs(Config)
 *
 * const program = decodeConfig("name: Beep\nage: 1")
 * const config = await Effect.runPromise(program)
 * console.log(config.name)
 * ```
 *
 * @param schema - Target schema to decode parsed YAML document into.
 * @returns Decoder function from YAML text to the target schema type.
 * @category utilities
 * @since 0.0.0
 */
export const decodeYamlTextAs = <Schema extends S.Top>(schema: Schema) => {
  const decodeYamlUnknownText = S.decodeUnknownEffect(YamlTextToUnknown);
  const decodeTargetSchema = S.decodeUnknownEffect(schema);

  return flow(decodeYamlUnknownText, Effect.flatMap(decodeTargetSchema));
};
