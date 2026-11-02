/**
 * The structured diagnostic concept: YamlDiagnostic (carried by both error
 * payloads and YamlDocument's warnings-as-data arrays), the staged error-code
 * literal unions, and the single fatal-code predicate.
 *
 * **Details**
 *
 * Cycle firewall: the internal engine emits raw
 * `{ code, message, offset, length }` records; this module materializes them into `YamlDiagnostic`,
 * deriving `line`/`character` from `offset` against the source text. The
 * dependency edge runs public modules → engine only.
 *
 * The five-field positional core (`code`/`offset`/`length`/`line`/`character`)
 * is structurally identical to `JsoncParseErrorDetail` per the jsonc/yaml
 * parity convention; `message` is yaml's additive extra.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $YamlId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Text from "@beep/utils/Text";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import {
  isFatalCode,
  YAML_COMPOSE_ERROR_CODES,
  YAML_LEX_ERROR_CODES,
  YAML_MODIFY_ERROR_CODES,
  YAML_PARSE_ERROR_CODES,
  YAML_STRINGIFY_ERROR_CODES,
} from "./internal/diagnostics.ts";
import type { RawDiagnostic } from "./internal/diagnostics.ts";

const $I = $YamlId.create("YamlDiagnostic");

/**
 * Error codes emitted by the lexer stage.
 *
 * **Example** (Validate a lexer diagnostic code)
 *
 * ```ts
 * import { YamlLexErrorCode } from "@beep/yaml/YamlDiagnostic"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(YamlLexErrorCode)("UnexpectedCharacter")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const YamlLexErrorCode = LiteralKit(YAML_LEX_ERROR_CODES).pipe(
  $I.annoteSchema("YamlLexErrorCode", { description: "Error codes emitted by the lexer stage." })
);

/**
 * The union of all lexer-stage error code string literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlLexErrorCode = typeof YamlLexErrorCode.Type;

/**
 * Error codes emitted by the CST-parser stage.
 *
 * **Example** (Validate a parser diagnostic code)
 *
 * ```ts
 * import { YamlParseErrorCode } from "@beep/yaml/YamlDiagnostic"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(YamlParseErrorCode)("DuplicateKey")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const YamlParseErrorCode = LiteralKit(YAML_PARSE_ERROR_CODES).pipe(
  $I.annoteSchema("YamlParseErrorCode", { description: "Error codes emitted by the CST-parser stage." })
);

/**
 * The union of all parser-stage error code string literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlParseErrorCode = typeof YamlParseErrorCode.Type;

/**
 * Error codes emitted by the composer stage.
 *
 * **Example** (Validate a composer diagnostic code)
 *
 * ```ts
 * import { YamlComposerErrorCode } from "@beep/yaml/YamlDiagnostic"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(YamlComposerErrorCode)("UndefinedAlias")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const YamlComposerErrorCode = LiteralKit(YAML_COMPOSE_ERROR_CODES).pipe(
  $I.annoteSchema("YamlComposerErrorCode", { description: "Error codes emitted by the composer stage." })
);

/**
 * The union of all composer-stage error code string literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlComposerErrorCode = typeof YamlComposerErrorCode.Type;

/**
 * Error codes emitted by the stringifier (the circular-reference guard).
 *
 * **Example** (Validate a stringifier diagnostic code)
 *
 * ```ts
 * import { YamlStringifyErrorCode } from "@beep/yaml/YamlDiagnostic"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(YamlStringifyErrorCode)("CircularReference")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const YamlStringifyErrorCode = LiteralKit(YAML_STRINGIFY_ERROR_CODES).pipe(
  $I.annoteSchema("YamlStringifyErrorCode", {
    description: "Error codes emitted by the stringifier (the circular-reference guard).",
  })
);

/**
 * The union of all stringifier-stage error code string literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlStringifyErrorCode = typeof YamlStringifyErrorCode.Type;

/**
 * Error codes emitted by `YamlFormat.modify`'s path navigation against an
 * already-composed AST — not raised by the parser/composer/stringifier.
 *
 * **Example** (Validate a modify diagnostic code)
 *
 * ```ts
 * import { YamlModifyErrorCode } from "@beep/yaml/YamlDiagnostic"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(YamlModifyErrorCode)("PathNotFound")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const YamlModifyErrorCode = LiteralKit(YAML_MODIFY_ERROR_CODES).pipe(
  $I.annoteSchema("YamlModifyErrorCode", {
    description:
      "Error codes emitted by `YamlFormat.modify`'s path navigation against an already-composed AST — not raised by the parser/composer/stringifier.",
  })
);

/**
 * The union of all modify-stage error code string literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlModifyErrorCode = typeof YamlModifyErrorCode.Type;

/**
 * Union of all YAML error codes across all pipeline stages. Stage
 * discrimination lives here (in the code), not in separate error classes.
 *
 * **Example** (Validate a pipeline diagnostic code)
 *
 * ```ts
 * import { YamlErrorCode } from "@beep/yaml/YamlDiagnostic"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(YamlErrorCode)("UnexpectedToken")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const YamlErrorCode = S.Union([
  YamlLexErrorCode,
  YamlParseErrorCode,
  YamlComposerErrorCode,
  YamlStringifyErrorCode,
  YamlModifyErrorCode,
]).pipe(
  $I.annoteSchema("YamlErrorCode", {
    description:
      "Union of all YAML error codes across all pipeline stages. Stage discrimination lives here (in the code), not in separate error classes.",
  })
);

/**
 * The union of all YAML error code string literals.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type YamlErrorCode = typeof YamlErrorCode.Type;

/**
 * One structured diagnostic: its {@link (YamlErrorCode:type)}, a
 * human-readable `message`, and its exact position (`offset`/`length`, plus
 * zero-based `line`/`character`). Used for both errors and warnings-as-data;
 * fatality is a property of the code — see {@link YamlDiagnostic.isFatal}.
 *
 * **Details**
 *
 * The five-field positional core (`code`/`offset`/`length`/`line`/`character`)
 * is structurally identical to `@beep/jsonc`'s parse-error detail shape;
 * `message` is this package's additive extra.
 *
 * **Example** (Construct a positioned diagnostic)
 *
 * ```ts
 * import { YamlDiagnostic } from "@beep/yaml/YamlDiagnostic"
 *
 * const diagnostic = YamlDiagnostic.make({
 *   code: "DuplicateKey", message: "Repeated mapping key",
 *   offset: 8, length: 4, line: 1, character: 0
 * })
 * console.log(diagnostic.message) // Repeated mapping key
 * ```
 *
 * @public
 * @category diagnostics
 * @since 0.0.0
 */
export class YamlDiagnostic extends S.Opaque<YamlDiagnostic, { readonly brand: unique symbol }>()(
  S.Struct({
    code: YamlErrorCode.pipe(
      $I.annoteKey("YamlDiagnostic.code", {
        description: "Pipeline error identifier used to classify the diagnostic and determine whether it is fatal",
      })
    ),
    message: S.String.pipe(
      $I.annoteKey("YamlDiagnostic.message", { description: "Human-readable explanation of the YAML issue" })
    ),
    offset: S.Finite.pipe(
      $I.annoteKey("YamlDiagnostic.offset", {
        description: "Zero-based start position of the diagnostic span in source UTF-16 code units",
      })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("YamlDiagnostic.length", {
        description: "Extent of the diagnostic span in source UTF-16 code units",
      })
    ),
    line: S.Finite.pipe(
      $I.annoteKey("YamlDiagnostic.line", { description: "Zero-based source line containing the diagnostic's start" })
    ),
    character: S.Finite.pipe(
      $I.annoteKey("YamlDiagnostic.character", {
        description: "Zero-based position within the source line, measured in UTF-16 code units",
      })
    ),
  }).pipe(
    $I.annoteSchema("YamlDiagnostic", {
      description:
        "One structured diagnostic: its (YamlErrorCode:type), a human-readable `message`, and its exact position (`offset`/`length`, plus zero-based `line`/`character`). Used for both errors and warnings-as-data; fatality is a property of the code — see YamlDiagnostic.isFatal.",
    })
  )
) {
  /**
   * The single fatal-code predicate: whether diagnostics with this code
   * abort a parse (vs. being recoverable warnings-as-data). Declared once,
   * as a property of the code.
   *
   * **Example** (Distinguish fatal and recoverable codes)
   *
   * ```ts
   * import { YamlDiagnostic } from "@beep/yaml/YamlDiagnostic"
   *
   * console.log(YamlDiagnostic.isFatal("UndefinedAlias")) // true
   * console.log(YamlDiagnostic.isFatal("DuplicateKey")) // false
   * ```
   *
   * @param code - The diagnostic code to classify.
   * @returns `true` when diagnostics with `code` abort a parse.
   * @category predicates
   * @since 0.0.0
   */
  static isFatal(code: YamlErrorCode): boolean {
    return isFatalCode(code);
  }

  /**
   * Materialize a raw engine diagnostic record into a `YamlDiagnostic`,
   * deriving `line`/`character` from `offset` against the source `text`.
   * Advanced — the parse/stringify entry points call this for you.
   *
   * **Example** (Derive a position after a line break)
   *
   * ```ts
   * import { YamlDiagnostic } from "@beep/yaml/YamlDiagnostic"
   *
   * const diagnostic = YamlDiagnostic.fromRaw({
   *   code: "DuplicateKey", message: "Repeated key", offset: 5, length: 1
   * }, "a: 1\nb: 2\n")
   * console.log(diagnostic.line, diagnostic.character) // 1 0
   * ```
   *
   * @param raw - The engine record: `code`, `message`, `offset` and `length`.
   * @param text - The source text the record's `offset` indexes into.
   * @returns The diagnostic with `line` and `character` filled in.
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromRaw: {
    (
      text: string,
      index?: ReturnType<typeof YamlDiagnostic.positionIndex>
    ): (raw: {
      readonly code: YamlErrorCode;
      readonly message: string;
      readonly offset: number;
      readonly length: number;
    }) => YamlDiagnostic;
    (
      raw: { readonly code: YamlErrorCode; readonly message: string; readonly offset: number; readonly length: number },
      text: string,
      index?: ReturnType<typeof YamlDiagnostic.positionIndex>
    ): YamlDiagnostic;
  } = dual(
    (args) => P.isObjectKeyword(args[0]),
    (
      raw: { readonly code: YamlErrorCode; readonly message: string; readonly offset: number; readonly length: number },
      text: string,
      index?: ReturnType<typeof YamlDiagnostic.positionIndex>
    ): YamlDiagnostic => {
      const { line, character } =
        index === undefined ? Text.lineCharacterAt(text, raw.offset, lineGrammar) : index(raw.offset);
      return YamlDiagnostic.make({
        code: raw.code,
        message: raw.message,
        offset: raw.offset,
        length: raw.length,
        line,
        character,
      });
    }
  );

  /**
   * Index line breaks once and return a reusable binary position lookup.
   * CRLF offsets between the two code units belong to the new line at character zero.
   *
   * **Example** (Reuse positions for one source)
   *
   * ```ts
   * import { YamlDiagnostic } from "@beep/yaml/YamlDiagnostic"
   * const position = YamlDiagnostic.positionIndex("a\nb")
   * console.log(position(2).line) // 1
   * ```
   *
   * @param text - Source whose UTF-16 line breaks are indexed.
   * @returns A lookup preserving standalone diagnostic position semantics.
   * @category constructors
   * @since 0.0.0
   */
  static positionIndex(text: string): (offset: number) => { line: number; character: number } {
    return Text.lineCharacterIndex(text, lineGrammar);
  }

  /**
   * Materialize an ordered batch using one source-position index.
   *
   * **Example** (Position a batch)
   *
   * ```ts
   * import { YamlDiagnostic } from "@beep/yaml/YamlDiagnostic"
   * const diagnostics = YamlDiagnostic.fromRawBatch([
   *   { code: "DuplicateKey", message: "Repeated key", offset: 2, length: 1 }
   * ], "a\nb")
   * console.log(diagnostics[0]?.line) // 1
   * ```
   *
   * @param records - Raw diagnostics in their emitted order.
   * @param text - Source the offsets refer to.
   * @param index - An existing lookup shared by batches from one operation.
   * @returns Positioned diagnostics in the original order.
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromRawBatch: {
    (
      text: string,
      index?: ReturnType<typeof YamlDiagnostic.positionIndex>
    ): (records: ReadonlyArray<RawDiagnostic>) => ReadonlyArray<YamlDiagnostic>;
    (
      records: ReadonlyArray<RawDiagnostic>,
      text: string,
      index?: ReturnType<typeof YamlDiagnostic.positionIndex>
    ): ReadonlyArray<YamlDiagnostic>;
  } = dual(
    (args) => A.isArray(args[0]),
    (
      records: ReadonlyArray<RawDiagnostic>,
      text: string,
      index: ReturnType<typeof YamlDiagnostic.positionIndex> = YamlDiagnostic.positionIndex(text)
    ): ReadonlyArray<YamlDiagnostic> => A.map(records, YamlDiagnostic.fromRaw(text, index))
  );
}

/**
 * YAML newline grammar: LF, CR, CRLF, LS and PS, with the CRLF pair check
 * kept inside the scanned prefix for standalone diagnostic conversion.
 */
const lineGrammar = { unicodeSeparators: true, crlfLookahead: "prefix" } as const;
