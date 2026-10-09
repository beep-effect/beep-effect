/**
 * Zero-dependency TOML 1.1.0 parsing and stringification as Effect schemas.
 *
 * @remarks
 * {@link Toml} is the value-level facade (`parse`/`stringify` and the schema
 * factories); {@link TomlDiagnostic} is the structured diagnostic every
 * failure carries; the `TomlNode` classes are the lossless linear CST; the
 * four `TomlDateTime` classes model TOML's date-time types. All fallible
 * entry points — parse, stringify and the codec directions — carry typed
 * errors built from {@link TomlDiagnostic}, never a collapsed string reason
 * or an unhandled defect on malformed or adversarial input.
 *
 * @packageDocumentation
 */

export type { TomlBoundCodec } from "./Toml.ts";
export { Toml, TomlParseError, TomlStringifyError, TomlStringifyOptions } from "./Toml.ts";
export { TomlLocalDate, TomlLocalDateTime, TomlLocalTime, TomlOffsetDateTime } from "./TomlDateTime.ts";
export {
	TomlDiagnostic,
	TomlErrorCode,
	TomlLexErrorCode,
	TomlParseErrorCode,
	TomlSemanticErrorCode,
	TomlStringifyErrorCode,
} from "./TomlDiagnostic.ts";
export { TomlDocument } from "./TomlDocument.ts";
export type { TomlPath, TomlSegment } from "./TomlEdit.ts";
export { TomlEdit, TomlRange } from "./TomlEdit.ts";
export type { TomlRangeLike } from "./TomlFormat.ts";
export { TomlFormat, TomlFormattingOptions, TomlModificationError } from "./TomlFormat.ts";
export {
	TomlArray,
	TomlArrayTableHeader,
	TomlBoolean,
	TomlDateTimeLiteral,
	TomlExpression,
	TomlFloat,
	TomlInlineEntry,
	TomlInlineTable,
	TomlInteger,
	TomlKey,
	TomlKeyKind,
	TomlKeyValue,
	TomlString,
	TomlStringStyle,
	TomlTableHeader,
	TomlTrivia,
	TomlValueNode,
} from "./TomlNode.ts";
export { TomlVisitor, TomlVisitorEvent } from "./TomlVisitor.ts";
