// Internal lexical tokens retain processed values and parser indentation columns.
// The lexer constructs typed literals without validating each token.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/yaml/internal/token");

/** The 22 token kinds produced by the YAML lexer. */
export const YamlTokenKind = LiteralKit([
	"document-start", "document-end", "directive", "tag", "anchor", "alias", "scalar",
	"block-map-start", "block-map-key", "block-map-value", "block-seq-start", "block-seq-entry",
	"flow-map-start", "flow-map-end", "flow-seq-start", "flow-seq-end", "flow-separator",
	"newline", "whitespace", "comment", "byte-order-mark", "error",
]).annotate($I.annote("YamlTokenKind", { description: "Lexical categories shared by raw and public YAML tokens." }));
export type YamlTokenKind = typeof YamlTokenKind.Type;

/** A lexer payload with a processed value and zero-based source coordinates. */
export const YamlToken = S.Struct({
	kind: YamlTokenKind.annotateKey({ description: "Lexical category assigned by the scanner." }),
	value: S.String.annotateKey({ description: "Processed token value; quoted scalars omit quotes and decode escapes." }),
	offset: S.Finite.annotateKey({ description: "Zero-based source offset in UTF-16 code units." }),
	length: S.Finite.annotateKey({ description: "Raw source span length in UTF-16 code units." }),
	line: S.Finite.annotateKey({ description: "Zero-based source line; CR, LF and CRLF each end one line." }),
	column: S.Finite.annotateKey({ description: "Zero-based source column, or construct indentation on synthetic start markers." }),
}).annotate($I.annote("YamlToken", { description: "Raw lexer token payload, constructed without per-token decoding." }));
export type YamlToken = typeof YamlToken.Type;
