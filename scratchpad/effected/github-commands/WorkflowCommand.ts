import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { flow, pipe } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $ScratchpadId.create("effected/github-commands/WorkflowCommand");

/**
 * The title and source location of a `::notice::`, `::warning::` or `::error::`
 * annotation.
 *
 * **Details**
 *
 * The field names here are the readable ones; GitHub's wire protocol uses
 * abbreviations (`line`, `col`) that this module maps on the way out, so a
 * caller never has to remember which of the six is abbreviated.
 *
 * **Example** (Validate annotation properties)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { AnnotationProperties } from "./index.ts";
 *
 * S.is(AnnotationProperties)({ file: "src/main.ts", startLine: 12 }); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const AnnotationProperties = S.Struct({
	/** A short title shown above the annotation. */
	title: S.optionalKey(S.String.annotate($I.annote("title", { description: "A short title shown above the annotation." }))),
	/** Repository-relative path of the annotated file. */
	file: S.optionalKey(S.String.annotate($I.annote("file", { description: "Repository-relative path of the annotated file." }))),
	/** First annotated line, 1-based. */
	startLine: S.optionalKey(S.Finite.annotate($I.annote("startLine", { description: "First annotated line, 1-based." }))),
	/** Last annotated line, 1-based. */
	endLine: S.optionalKey(S.Finite.annotate($I.annote("endLine", { description: "Last annotated line, 1-based." }))),
	/** First annotated column, 1-based. */
	startColumn: S.optionalKey(S.Finite.annotate($I.annote("startColumn", { description: "First annotated column, 1-based." }))),
	/** Last annotated column, 1-based. */
	endColumn: S.optionalKey(S.Finite.annotate($I.annote("endColumn", { description: "Last annotated column, 1-based." }))),
}).annotate($I.annote("AnnotationProperties", { description: "The title and source location of a GitHub Actions notice, warning or error annotation." }));

/** The readable annotation properties accepted by the workflow command helpers. */
export type AnnotationProperties = typeof AnnotationProperties.Type;

/** Property values the runner accepts on a command. */
type CommandProperties = Readonly<Record<string, string | number | boolean | undefined>>;

/**
 * Escape a command's message.
 *
 * @remarks
 * The percent sign is replaced **first**, and the order is load-bearing: doing
 * it last would re-escape the `%` of an escape sequence this function just
 * produced, turning `%0A` into `%250A`.
 */
const escapeMessage = flow(Str.replaceAll("%", "%25"), Str.replaceAll("\r", "%0D"), Str.replaceAll("\n", "%0A"));

/**
 * Escape a property value.
 *
 * @remarks
 * Everything a message escapes, plus `:` and `,` — the two characters that
 * delimit the property list and terminate it. An unescaped one truncates the
 * command or lets a value be read as a new property.
 */
const escapeProperty = flow(escapeMessage, Str.replaceAll(":", "%3A"), Str.replaceAll(",", "%2C"));

/**
 * The GitHub Actions workflow-command wire protocol: `::name key=value::message`.
 *
 * @remarks
 * **Pure.** This module renders strings and nothing else — it performs no IO
 * and holds no service — which is what makes the escaping rules testable
 * without a runner, and what lets a non-Actions consumer reuse the protocol.
 * Writing a rendered command to stdout is the caller's job (`@effected/github-actions` does it).
 *
 * The escaping is the whole point of the module. A message carrying a raw
 * newline does not merely render oddly: the runner reads the text after it as
 * a **new command**, so an unescaped log line is a command-injection vector.
 *
 * @example
 * ```ts
 * import { WorkflowCommand } from "./index.ts";
 *
 * WorkflowCommand.error("build failed", { file: "src/main.ts", startLine: 12 });
 * // "::error file=src/main.ts,line=12::build failed"
 * ```
 *
 * @public
 */
export class WorkflowCommand {
	private constructor() {}

	/**
	 * Render an arbitrary command: `::name key=value::message`, with the message and
	 * property values escaped. The primitive every other member uses.
	 *
	 * @remarks
	 * Properties whose value is `undefined` are omitted.
	 *
	 * Use a name the runner registers (`error`, `warning`, `notice`, `debug`, `group`, `endgroup`, `add-mask` and the
	 * rest of its list). The runner tries its V2 parser first and, if the name is not registered, rejects the line, and
	 * its legacy parser then reads the line for `##[` ANYWHERE in it: a `##[` in the data of a command with an
	 * unregistered name is therefore a command. {@link CommandNeutralizer} is the tool for text that is only data.
	 *
	 * @privateRemarks
	 * The property type is written out structurally rather than as the module's
	 * `CommandProperties` alias: an internal named type on a `@public` signature
	 * fails the API Extractor gate, and neither an `@internal` tag nor a second
	 * alias helps — only inlining does.
	 */
	static render(
		name: string,
		properties: Readonly<Record<string, string | number | boolean | undefined>>,
		message: string,
	): string {
		const rendered = pipe(
			R.toEntries(properties),
			A.filter((entry): entry is [string, string | number | boolean] => P.isNotUndefined(entry[1])),
			A.map(([key, value]) => `${key}=${escapeProperty(String(value))}`),
			A.join(","),
		);
		const head = rendered === "" ? `::${name}::` : `::${name} ${rendered}::`;
		return `${head}${escapeMessage(message)}`;
	}

	/** `::debug::` — shown only when `ACTIONS_STEP_DEBUG` is enabled. */
	static debug(message: string): string {
		return WorkflowCommand.render("debug", {}, message);
	}

	/** `::notice::` with optional source annotation. */
	static notice(message: string, properties: AnnotationProperties = {}): string {
		return WorkflowCommand.render("notice", WorkflowCommand.annotation(properties), message);
	}

	/** `::warning::` with optional source annotation. */
	static warning(message: string, properties: AnnotationProperties = {}): string {
		return WorkflowCommand.render("warning", WorkflowCommand.annotation(properties), message);
	}

	/** `::error::` with optional source annotation. */
	static error(message: string, properties: AnnotationProperties = {}): string {
		return WorkflowCommand.render("error", WorkflowCommand.annotation(properties), message);
	}

	/** `::group::` — opens a collapsible section in the runner log. */
	static group(name: string): string {
		return WorkflowCommand.render("group", {}, name);
	}

	/** `::endgroup::` — closes the innermost open group. */
	static endGroup(): string {
		return WorkflowCommand.render("endgroup", {}, "");
	}

	/** `::add-mask::` — registers a value for redaction in the runner log. */
	static addMask(value: string): string {
		return WorkflowCommand.render("add-mask", {}, value);
	}

	/** Map readable annotation fields onto GitHub's abbreviated wire names. */
	private static annotation(properties: AnnotationProperties): CommandProperties {
		return {
			title: properties.title,
			file: properties.file,
			line: properties.startLine,
			endLine: properties.endLine,
			col: properties.startColumn,
			endColumn: properties.endColumn,
		};
	}
}
