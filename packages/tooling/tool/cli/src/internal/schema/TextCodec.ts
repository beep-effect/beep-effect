/**
 * YAML and TOML text decoders for the repo CLI.
 *
 * `effect/encoding/Yaml` and `effect/encoding/Toml` ship parsers but no schema
 * codec. The `decode*TextWith` helpers parse text with those modules and decode
 * the parsed value into a target schema; a parse failure surfaces as the same
 * `SchemaError` a schema codec would raise. Workflow files, docker-compose
 * files, reflection frontmatter, and Codex config all cross this boundary.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, SchemaIssue } from "effect";
import * as Toml from "effect/encoding/Toml";
import * as Yaml from "effect/encoding/Yaml";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const parseText =
  (format: string, parse: (text: string) => unknown) =>
  (text: string): Effect.Effect<unknown, S.SchemaError> =>
    Effect.try({
      try: () => parse(text),
      catch: (cause) =>
        new S.SchemaError(
          new SchemaIssue.InvalidValue({
            message: `Invalid ${format} input (${P.isError(cause) ? cause.message : String(cause)}).`,
          })
        ),
    });

const parseYamlText = parseText("YAML", Yaml.parse);
const parseTomlText = parseText("TOML", Toml.parse);

/**
 * Build a decoder from YAML text through a target decoder.
 *
 * **Details**
 *
 * Parses with `effect/encoding/Yaml`, then runs `decode` on the parsed value.
 * Malformed YAML fails with a `SchemaError` whose message starts with
 * `Invalid YAML input`. Pass a module-scoped `S.decodeUnknownEffect(Target)`.
 *
 * **Example** (Decode a YAML document)
 *
 * ```ts
 * import { decodeYamlTextWith } from "@beep/repo-cli/internal/schema/TextCodec"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decode = decodeYamlTextWith(S.decodeUnknownEffect(S.Struct({ name: S.String })))
 * console.log(Effect.runSync(decode("name: ci")).name) // ci
 * ```
 *
 * @param decode - Decoder the parsed YAML value must satisfy.
 * @returns A function from YAML text to the decoded value.
 * @category constructors
 * @since 0.0.0
 */
export const decodeYamlTextWith =
  <A, E, R>(decode: (input: unknown) => Effect.Effect<A, E, R>) =>
  (text: string): Effect.Effect<A, E | S.SchemaError, R> =>
    Effect.flatMap(parseYamlText(text), decode);

/**
 * Build a decoder from TOML text through a target decoder.
 *
 * **Details**
 *
 * Parses with `effect/encoding/Toml`, then runs `decode` on the parsed value.
 * Malformed TOML fails with a `SchemaError` whose message starts with
 * `Invalid TOML input`. Pass a module-scoped `S.decodeUnknownEffect(Target)`.
 *
 * **Example** (Decode a TOML document)
 *
 * ```ts
 * import { decodeTomlTextWith } from "@beep/repo-cli/internal/schema/TextCodec"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decode = decodeTomlTextWith(S.decodeUnknownEffect(S.Struct({ model: S.String })))
 * console.log(Effect.runSync(decode("model = \"o3\"")).model) // o3
 * ```
 *
 * @param decode - Decoder the parsed TOML value must satisfy.
 * @returns A function from TOML text to the decoded value.
 * @category constructors
 * @since 0.0.0
 */
export const decodeTomlTextWith =
  <A, E, R>(decode: (input: unknown) => Effect.Effect<A, E, R>) =>
  (text: string): Effect.Effect<A, E | S.SchemaError, R> =>
    Effect.flatMap(parseTomlText(text), decode);
