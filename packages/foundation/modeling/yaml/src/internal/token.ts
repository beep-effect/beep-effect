import { $YamlId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";

const $I = $YamlId.create("internal/token");

/**
 * The 22 token kinds produced by the YAML lexer.
 *
 * **Example** (Validate lexer token kinds)
 *
 * ```ts
 * import { YamlTokenKind } from "@beep/yaml/internal/token"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(YamlTokenKind)("scalar")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const YamlTokenKind = LiteralKit([
  "document-start",
  "document-end",
  "directive",
  "tag",
  "anchor",
  "alias",
  "scalar",
  "block-map-start",
  "block-map-key",
  "block-map-value",
  "block-seq-start",
  "block-seq-entry",
  "flow-map-start",
  "flow-map-end",
  "flow-seq-start",
  "flow-seq-end",
  "flow-separator",
  "newline",
  "whitespace",
  "comment",
  "byte-order-mark",
  "error",
]).pipe($I.annoteSchema("YamlTokenKind", { description: "Lexical categories shared by raw and public YAML tokens." }));
/**
 * @category type-level
 * @since 0.0.0
 */
export type YamlTokenKind = typeof YamlTokenKind.Type;

/**
 * A lexer payload with a processed value and zero-based source coordinates.
 *
 * **Details**
 *
 * Quoted scalar values omit their quotes and decode escapes. Offsets and lengths
 * count UTF-16 code units. CR, LF and CRLF each end one line; synthetic start
 * markers record construct indentation in their column.
 *
 * **Example** (Validate a processed scalar token)
 *
 * ```ts
 * import { YamlToken } from "@beep/yaml/internal/token"
 * import * as S from "effect/Schema"
 *
 * const token = { kind: "scalar", value: "hello", offset: 0, length: 5, line: 0, column: 0 }
 * console.log(S.is(YamlToken)(token)) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class YamlToken extends S.Opaque<YamlToken, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: YamlTokenKind.pipe(
      $I.annoteKey("YamlToken.kind", { description: "Lexical category assigned by the scanner." })
    ),
    value: S.String.pipe(
      $I.annoteKey("YamlToken.value", {
        description: "Processed token value; quoted scalars omit quotes and decode escapes.",
      })
    ),
    offset: S.Finite.pipe(
      $I.annoteKey("YamlToken.offset", { description: "Zero-based source offset in UTF-16 code units." })
    ),
    length: S.Finite.pipe(
      $I.annoteKey("YamlToken.length", { description: "Raw source span length in UTF-16 code units." })
    ),
    line: S.Finite.pipe(
      $I.annoteKey("YamlToken.line", { description: "Zero-based source line; CR, LF and CRLF each end one line." })
    ),
    column: S.Finite.pipe(
      $I.annoteKey("YamlToken.column", {
        description: "Zero-based source column, or construct indentation on synthetic start markers.",
      })
    ),
  }).pipe(
    $I.annoteSchema("YamlToken", { description: "Raw lexer token payload, constructed without per-token decoding." })
  )
) {}

/**
 * **Example** (Type a lexer token)
 *
 * ```ts
 * import { lexAll } from "@beep/yaml/internal/lexer"
 * import type { YamlToken } from "@beep/yaml/internal/token"
 *
 * const tokens: ReadonlyArray<YamlToken.Data> = lexAll("a: 1")
 * console.log(tokens[0]?.kind)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace YamlToken {
  /**
   * The structural token the lexer emits on its hot path — the
   * {@link YamlToken} fields without the nominal brand, so each token is a
   * plain record built without per-token decoding.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Data = S.Struct.Type<typeof YamlToken.fields>;
}
