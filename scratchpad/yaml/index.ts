/**
 * Zero-dependency YAML 1.2 parsing, editing and formatting as Effect schemas.
 *
 * **Details**
 *
 * {@link Yaml} is the value-level facade (`parse`/`parseAll`/`stringify`,
 * comment stripping, semantic equality and the schema factories);
 * {@link YamlDocument} exposes the full parsed AST plus recovered
 * diagnostics; {@link YamlFormat} computes non-mutating format/modify edits
 * that preserve comments and whitespace; {@link YamlVisitor} streams
 * SAX-style AST events. All fallible entry points — parse, stringify, encode
 * and modify — carry typed errors built from {@link YamlDiagnostic}, never a
 * collapsed string reason or an unhandled defect on malformed or adversarial
 * input.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export type { YamlBoundCodec } from "./Yaml.ts";
export {
	Yaml,
	YamlParseError,
	YamlParseOptions,
	YamlStringifyError,
	YamlStringifyOptions,
} from "./Yaml.ts";
export {
	YamlComposerErrorCode,
	YamlDiagnostic,
	YamlErrorCode,
	YamlLexErrorCode,
	YamlModifyErrorCode,
	YamlParseErrorCode,
	YamlStringifyErrorCode,
} from "./YamlDiagnostic.ts";
export { YamlDirective, YamlDocument } from "./YamlDocument.ts";
export type { YamlPath, YamlSegment } from "./YamlEdit.ts";
export { YamlEdit, YamlRange } from "./YamlEdit.ts";
export type { YamlRangeLike } from "./YamlFormat.ts";
export { YamlFormat, YamlFormattingOptions, YamlModificationError } from "./YamlFormat.ts";
export type { YamlLintInference } from "./YamlLint.ts";
export {
	StyleConflict,
	StyleEvidence,
	StyleFloorTally,
	StyleVoteTally,
	YamlLint,
	YamlLintConfig,
	YamlLintRuleSetting,
	YamlStyleConflictError,
} from "./YamlLint.ts";
export type { LintContext, LintLine, StyleObservation, YamlRule } from "./YamlLintRule.ts";
export { StyleFloor, StyleVote, YamlLintDiagnostic, YamlLintSeverity } from "./YamlLintRule.ts";
export type { YamlAliasEncoded, YamlMapEncoded, YamlScalarEncoded, YamlSeqEncoded } from "./YamlNode.ts";
export {
	CollectionStyle,
	QuoteCompat,
	QuoteStyle,
	ScalarChomp,
	ScalarStyle,
	YamlAlias,
	YamlMap,
	YamlNode,
	YamlPair,
	YamlScalar,
	YamlSeq,
} from "./YamlNode.ts";
export { YamlToken, YamlTokenKind, YamlTokens } from "./YamlToken.ts";
export { YamlVisitor, YamlVisitorEvent } from "./YamlVisitor.ts";
