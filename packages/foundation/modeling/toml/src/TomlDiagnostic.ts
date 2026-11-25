/**
 * The structured diagnostic concept: TomlDiagnostic and the staged
 * error-code literal unions.
 *
 * **Details**
 *
 * Cycle firewall: the internal engine emits raw records carrying `code`,
 * `message`, `offset` and `length`; this module materializes them into
 * `TomlDiagnostic`, deriving `line`/`character` from `offset` against the
 * source text. The dependency edge runs public modules → engine only.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TomlId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Text from "@beep/utils/Text";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import {
  TOML_LEX_ERROR_CODES,
  TOML_PARSE_ERROR_CODES,
  TOML_SEMANTIC_ERROR_CODES,
  TOML_STRINGIFY_ERROR_CODES,
} from "./internal/diagnostics.ts";

const $I = $TomlId.create("TomlDiagnostic");

/**
 * **Example** (Recognize a lexical error code)
 *
 * ```ts
 * import { TomlLexErrorCode } from "@beep/toml/TomlDiagnostic";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(TomlLexErrorCode)("UnterminatedString")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TomlLexErrorCode = LiteralKit(TOML_LEX_ERROR_CODES).pipe(
  $I.annoteSchema("TomlLexErrorCode", { description: "Error codes emitted by the lexer stage." })
);

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TomlLexErrorCode = typeof TomlLexErrorCode.Type;

/**
 * **Example** (Recognize a syntax error code)
 *
 * ```ts
 * import { TomlParseErrorCode } from "@beep/toml/TomlDiagnostic";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(TomlParseErrorCode)("ExpectedEquals")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TomlParseErrorCode = LiteralKit(TOML_PARSE_ERROR_CODES).pipe(
  $I.annoteSchema("TomlParseErrorCode", { description: "Error codes emitted by the parser stage." })
);

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TomlParseErrorCode = typeof TomlParseErrorCode.Type;

/**
 * **Example** (Recognize a key conflict code)
 *
 * ```ts
 * import { TomlSemanticErrorCode } from "@beep/toml/TomlDiagnostic";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(TomlSemanticErrorCode)("DuplicateKey")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TomlSemanticErrorCode = LiteralKit(TOML_SEMANTIC_ERROR_CODES).pipe(
  $I.annoteSchema("TomlSemanticErrorCode", {
    description: "Error codes emitted by the semantic (table/key conflict) stage.",
  })
);

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TomlSemanticErrorCode = typeof TomlSemanticErrorCode.Type;

/**
 * **Example** (Recognize a serialization error code)
 *
 * ```ts
 * import { TomlStringifyErrorCode } from "@beep/toml/TomlDiagnostic";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(TomlStringifyErrorCode)("UnsupportedValue")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TomlStringifyErrorCode = LiteralKit(TOML_STRINGIFY_ERROR_CODES).pipe(
  $I.annoteSchema("TomlStringifyErrorCode", { description: "Error codes emitted by the stringifier stage." })
);

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TomlStringifyErrorCode = typeof TomlStringifyErrorCode.Type;

/**
 * **Example** (Recognize a code across pipeline stages)
 *
 * ```ts
 * import { TomlErrorCode } from "@beep/toml/TomlDiagnostic";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(TomlErrorCode)("DuplicateKey")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TomlErrorCode = S.Union([
  TomlLexErrorCode,
  TomlParseErrorCode,
  TomlSemanticErrorCode,
  TomlStringifyErrorCode,
]).pipe(
  $I.annoteSchema("TomlErrorCode", {
    description:
      "Union of all TOML error codes across all pipeline stages. Stage discrimination lives here (in the code), not in separate error classes.",
  })
);

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type TomlErrorCode = typeof TomlErrorCode.Type;

/**
 * **Details**
 *
 * The five-field positional core (`code`/`offset`/`length`/`line`/`character`)
 * is structurally identical to `@beep/jsonc`'s parse-error detail shape
 * and `@beep/yaml`'s `YamlDiagnostic`; `message` is this package's
 * additive extra.
 *
 * **Example** (Construct a positioned diagnostic)
 *
 * ```ts
 * import { TomlDiagnostic } from "@beep/toml/TomlDiagnostic";
 *
 * const diagnostic = TomlDiagnostic.make({
 *   code: "ExpectedKey", message: "Expected a key",
 *   offset: 0, length: 1, line: 0, character: 0,
 * });
 * console.log(diagnostic.code) // ExpectedKey
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TomlDiagnostic extends S.Opaque<TomlDiagnostic, { readonly brand: unique symbol }>()(
  S.Struct({
    code: TomlErrorCode.pipe(
      $I.annoteKey("TomlDiagnostic.code", {
        description: "Failure category emitted during TOML lexing, parsing, semantic validation, or stringification",
      })
    ),
    message: S.String.pipe(
      $I.annoteKey("TomlDiagnostic.message", {
        description: "Human-readable explanation supplied by the TOML engine for the failure",
      })
    ),
    offset: S.Finite.pipe(
      $I.annoteKey("TomlDiagnostic.offset", {
        description:
          "Zero-based start position of the diagnostic span in source UTF-16 code units, or zero for stringification failures",
      })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("TomlDiagnostic.length", {
        description:
          "Diagnostic span length in source UTF-16 code units, with zero used for position-only or stringification failures",
      })
    ),
    line: S.Finite.pipe(
      $I.annoteKey("TomlDiagnostic.line", {
        description: "Zero-based source line derived from the diagnostic offset, counting CRLF as one line break",
      })
    ),
    character: S.Finite.pipe(
      $I.annoteKey("TomlDiagnostic.character", {
        description:
          "Zero-based position within the source line in UTF-16 code units, derived from the diagnostic offset",
      })
    ),
  }).pipe(
    $I.annoteSchema("TomlDiagnostic", {
      description:
        "One structured diagnostic: its (TomlErrorCode:type), a human-readable `message`, and its exact position (`offset`/`length`, plus zero-based `line`/`character`).",
    })
  )
) {
  /**
   * Materialize an engine record, deriving `line`/`character` (0-based)
   * from `offset` against the source text. Advanced — the parse/stringify
   * entry points call this for you.
   *
   * **Example** (Derive a position after a CRLF newline)
   *
   * ```ts
   * import { TomlDiagnostic } from "@beep/toml/TomlDiagnostic";
   *
   * const diagnostic = TomlDiagnostic.fromRaw("a = 1\r\n?", {
   *   code: "ExpectedKey", message: "Expected a key", offset: 7, length: 1,
   * });
   * console.log(`${diagnostic.line}:${diagnostic.character}`) // 1:0
   * ```
   *
   * @param source - The source text the record's `offset` indexes into.
   * @param raw - The engine record: `code`, `message`, `offset` and `length`.
   * @returns The diagnostic with `line` and `character` filled in.
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromRaw: {
    (
      source: string,
      raw: { readonly code: TomlErrorCode; readonly message: string; readonly offset: number; readonly length: number }
    ): TomlDiagnostic;
    (raw: {
      readonly code: TomlErrorCode;
      readonly message: string;
      readonly offset: number;
      readonly length: number;
    }): (source: string) => TomlDiagnostic;
  } = dual(
    2,
    (
      source: string,
      raw: { readonly code: TomlErrorCode; readonly message: string; readonly offset: number; readonly length: number }
    ): TomlDiagnostic => {
      const { line, character } = Text.lineCharacterAt(source, raw.offset);
      return TomlDiagnostic.make({
        code: raw.code,
        message: raw.message,
        offset: raw.offset,
        length: raw.length,
        line,
        character,
      });
    }
  );
}
