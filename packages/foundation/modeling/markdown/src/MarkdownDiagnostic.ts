/**
 * The structured diagnostic concept: MarkdownDiagnostic and the
 * error-code literal union.
 *
 * **Details**
 *
 * Cycle firewall: the internal engine emits raw `RawDiagnostic` records
 * (`code`, `message`, `offset`, `length`; src/internal/carriers.ts); this
 * module materializes them into MarkdownDiagnostic, deriving
 * `line`/`character` from `offset` against the source text. The dependency
 * edge runs from the public modules to the engine only (toml
 * src/TomlDiagnostic.ts precedent).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $MarkdownId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { MarkdownParseErrorCodeRaw } from "./internal/carriers.ts";
import type { RawDiagnostic } from "./internal/carriers.ts";

const $I = $MarkdownId.create("MarkdownDiagnostic");

/**
 * **Details**
 *
 * Currently exactly one, `"NestingDepthExceeded"`, the hardening-guard trip;
 * the union may widen as new fatal conditions are identified.
 *
 * **Example** (Decode a nesting guard error code)
 *
 * ```ts
 * import { MarkdownParseErrorCode } from "@beep/markdown/MarkdownDiagnostic"
 * import * as S from "effect/Schema"
 *
 * const code = S.decodeUnknownSync(MarkdownParseErrorCode)("NestingDepthExceeded")
 * console.log(code) // NestingDepthExceeded
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const MarkdownParseErrorCode = MarkdownParseErrorCodeRaw.pipe(
  $I.annoteSchema("MarkdownParseErrorCode", {
    description:
      'Error codes `Markdown.parse`/`MarkdownDocument.parse` can fail with. Currently exactly one, `"NestingDepthExceeded"`, the hardening-guard trip; the union may widen as new fatal conditions are identified.',
  })
);

/**
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MarkdownParseErrorCode = typeof MarkdownParseErrorCode.Type;

/**
 * **Details**
 *
 * The five-field positional core (`code`/`offset`/`length`/`line`/`character`)
 * is structurally identical to `@beep/toml`'s `TomlDiagnostic` (and, by
 * the same cross-package contract, `@beep/jsonc`'s parse-error detail
 * shape and `@beep/yaml`'s `YamlDiagnostic`); `message` is this
 * package's additive extra. `line`/`character` here are zero-based to match
 * that contract — a different numbering from the one-based `line`/`column`
 * unist `Point`s carried on `MarkdownNode` positions, which is a deliberate,
 * unrelated convention for the AST rather than a mismatch to reconcile.
 *
 * **Example** (Construct a diagnostic with zero-based coordinates)
 *
 * ```ts
 * import { MarkdownDiagnostic } from "@beep/markdown/MarkdownDiagnostic"
 *
 * const diagnostic = MarkdownDiagnostic.make({
 *   code: "NestingDepthExceeded",
 *   message: "Maximum nesting depth exceeded",
 *   offset: 4,
 *   length: 0,
 *   line: 1,
 *   character: 1,
 * })
 * console.log(diagnostic.line) // 1
 * console.log(diagnostic.character) // 1
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class MarkdownDiagnostic extends S.Opaque<MarkdownDiagnostic, { readonly brand: unique symbol }>()(
  S.Struct({
    code: MarkdownParseErrorCode.pipe(
      $I.annoteKey("MarkdownDiagnostic.code", {
        description: "Fatal condition identifier, currently `NestingDepthExceeded` for a nesting guard violation",
      })
    ),
    message: S.String.pipe(
      $I.annoteKey("MarkdownDiagnostic.message", {
        description: "Human-readable explanation of the reported condition",
      })
    ),
    offset: S.Finite.pipe(
      $I.annoteKey("MarkdownDiagnostic.offset", {
        description: "Zero-based UTF-16 source offset of the reported condition",
      })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("MarkdownDiagnostic.length", {
        description: "Extent of the reported source span in UTF-16 code units; nesting guard violations use zero",
      })
    ),
    line: S.Finite.pipe(
      $I.annoteKey("MarkdownDiagnostic.line", {
        description: "Zero-based source line containing the reported offset, counting CRLF as one line break",
      })
    ),
    character: S.Finite.pipe(
      $I.annoteKey("MarkdownDiagnostic.character", {
        description: "Zero-based UTF-16 position within the source line at the reported offset",
      })
    ),
  }).pipe(
    $I.annoteSchema("MarkdownDiagnostic", {
      description:
        "One structured diagnostic: its (MarkdownParseErrorCode:type), a human-readable `message`, and its exact position (`offset`/`length`, plus zero-based `line`/`character`).",
    })
  )
) {
  /**
   * Materialize an engine record, deriving zero-based `line`/`character`
   * from `offset` against the source text.
   *
   * **Details**
   *
   * Advanced — the parse entry points call this for you.
   *
   * **Example** (Locate an engine diagnostic after a CRLF line break)
   *
   * ```ts
   * import { MarkdownDiagnostic } from "@beep/markdown/MarkdownDiagnostic"
   *
   * const diagnostic = MarkdownDiagnostic.fromRaw("a\r\nbc", {
   *   code: "NestingDepthExceeded",
   *   message: "Maximum nesting depth exceeded",
   *   offset: 4,
   *   length: 0,
   * })
   * console.log(diagnostic.line) // 1
   * console.log(diagnostic.character) // 1
   * ```
   *
   * @param source - The source text the record's `offset` indexes into.
   * @param raw - The engine record: `code`, `message`, `offset` and `length`.
   * @returns The diagnostic with `line` and `character` filled in.
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromRaw: {
    (source: string, raw: RawDiagnostic.Encoded): MarkdownDiagnostic;
    (raw: RawDiagnostic.Encoded): (source: string) => MarkdownDiagnostic;
  } = dual(2, (source: string, raw: RawDiagnostic.Encoded): MarkdownDiagnostic => {
    const { line, character } = lineChar(source, raw.offset);
    return MarkdownDiagnostic.make({
      code: raw.code,
      message: raw.message,
      offset: raw.offset,
      length: raw.length,
      line,
      character,
    });
  });
}

/**
 * Compute the zero-based line/character position of `offset` within `text`.
 * Recognizes `\n`, `\r` and `\r\n` as line breaks; a CRLF pair counts as a
 * single newline (toml `TomlDiagnostic` precedent — kept independent of
 * `internal/lineIndex.ts`, which answers a different, one-based question
 * for AST positions).
 */
const lineChar: {
  (text: string, offset: number): { line: number; character: number };
  (offset: number): (text: string) => { line: number; character: number };
} = dual(2, (text: string, offset: number): { line: number; character: number } => {
  const limit = Math.min(offset, text.length);
  // Both code units of a CRLF must precede the offset before the line
  // advances, so a CR whose LF sits at the offset is left uncounted.
  const straddlesCrlf = limit > 0 && Str.slice(limit - 1, limit + 1)(text) === "\r\n";
  const prefix = Str.slice(0, straddlesCrlf ? limit - 1 : limit)(text);
  const lineBreak = /\r\n|\r|\n/g;
  let line = 0;
  let lineStart = 0;
  for (let match = lineBreak.exec(prefix); match !== null; match = lineBreak.exec(prefix)) {
    line += 1;
    lineStart = match.index + match[0].length;
  }
  return { line, character: offset - lineStart };
});
