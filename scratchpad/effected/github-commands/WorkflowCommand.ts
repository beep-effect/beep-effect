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
 * import { AnnotationProperties } from "@beep/scratchpad/effected/github-commands/WorkflowCommand";
 *
 * console.log(S.is(AnnotationProperties)({ file: "src/main.ts", startLine: 12 })) // true
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

/**
 * The readable annotation properties accepted by the workflow command helpers.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AnnotationProperties = typeof AnnotationProperties.Type;

/** Property values the runner accepts on a command. */
type CommandProperties = Readonly<Record<string, string | number | boolean | undefined>>;

/**
 * Escape a command's message.
 *
 * **Gotchas**
 *
 * The percent sign is replaced **first**, and the order is load-bearing: doing
 * it last would re-escape the `%` of an escape sequence this function just
 * produced, turning `%0A` into `%250A`.
 */
const escapeMessage = flow(Str.replaceAll("%", "%25"), Str.replaceAll("\r", "%0D"), Str.replaceAll("\n", "%0A"));

/**
 * Escape a property value.
 *
 * **Gotchas**
 *
 * Everything a message escapes, plus `:` and `,` — the two characters that
 * delimit the property list and terminate it. An unescaped one truncates the
 * command or lets a value be read as a new property.
 */
const escapeProperty = flow(escapeMessage, Str.replaceAll(":", "%3A"), Str.replaceAll(",", "%2C"));

/**
 * The GitHub Actions workflow-command wire protocol: `::name key=value::message`.
 *
 * **Details**
 *
 * **Pure.** This module renders strings and nothing else — it performs no IO
 * and holds no service — which is what makes the escaping rules testable
 * without a runner, and what lets a non-Actions consumer reuse the protocol.
 * Writing a rendered command to stdout is the caller's job (`@effected/github-actions` does it).
 *
 * The escaping is the whole point of the module. A message carrying a raw
 * newline does not merely render oddly: the runner reads the text after it as
 * a **new command**, so an unescaped log line is a command-injection vector.
 *
 * **Example** (Render an error annotation with a source location)
 *
 * ```ts
 * import { WorkflowCommand } from "@beep/scratchpad/effected/github-commands/WorkflowCommand";
 *
 * console.log(WorkflowCommand.error("build failed", { file: "src/main.ts", startLine: 12 })) // ::error file=src/main.ts,line=12::build failed
 * ```
 *
 * @public
 * @category formatting
 * @since 0.0.0
 */
export class WorkflowCommand {
	private constructor() {}

	/**
  * Render an arbitrary command: `::name key=value::message`, with the message and
  * property values escaped. The primitive every other member uses.
  *
  * **Details**
  *
  * The property type is written out structurally rather than as the module's
  * `CommandProperties` alias: an internal named type on a `@public` signature
  * fails the API Extractor gate, and neither an `@internal` tag nor a second
  * alias helps — only inlining does.
  *
  * **Gotchas**
  *
  * Properties whose value is `undefined` are omitted.
  *
  * Use a name the runner registers (`error`, `warning`, `notice`, `debug`, `group`, `endgroup`, `add-mask` and the
  * rest of its list). The runner tries its V2 parser first and, if the name is not registered, rejects the line, and
  * its legacy parser then reads the line for `##[` ANYWHERE in it: a `##[` in the data of a command with an
  * unregistered name is therefore a command. {@link CommandNeutralizer} is the tool for text that is only data.
  *
  * **Example** (Escape message and property delimiters)
  *
  * ```ts
  * import { WorkflowCommand } from "@beep/scratchpad/effected/github-commands/WorkflowCommand";
  *
  * console.log(WorkflowCommand.render("notice", { title: "API: v1", file: undefined }, "50%\nready")) // ::notice title=API%3A v1::50%25%0Aready
  * ```
  *
  * @category formatting
  * @since 0.0.0
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

	/**
	 * Render a `::debug::` message, shown only when `ACTIONS_STEP_DEBUG` is enabled.
	 *
	 * **Example** (Render a debug message)
	 *
	 * ```ts
	 * import { WorkflowCommand } from "@beep/scratchpad/effected/github-commands/WorkflowCommand";
	 *
	 * console.log(WorkflowCommand.debug("trace")) // ::debug::trace
	 * ```
	 *
	 * @category formatting
	 * @since 0.0.0
	 */
	static debug(message: string): string {
		return WorkflowCommand.render("debug", {}, message);
	}

	/**
	 * Render a `::notice::` message with optional source annotation.
	 *
	 * **Example** (Render a notice with a title)
	 *
	 * ```ts
	 * import { WorkflowCommand } from "@beep/scratchpad/effected/github-commands/WorkflowCommand";
	 *
	 * console.log(WorkflowCommand.notice("ready", { title: "Build" })) // ::notice title=Build::ready
	 * ```
	 *
	 * @category formatting
	 * @since 0.0.0
	 */
	static notice(message: string, properties: AnnotationProperties = {}): string {
		return WorkflowCommand.render("notice", WorkflowCommand.annotation(properties), message);
	}

	/**
	 * Render a `::warning::` message with optional source annotation.
	 *
	 * **Example** (Render a warning at a source column)
	 *
	 * ```ts
	 * import { WorkflowCommand } from "@beep/scratchpad/effected/github-commands/WorkflowCommand";
	 *
	 * console.log(WorkflowCommand.warning("deprecated", { startColumn: 3 })) // ::warning col=3::deprecated
	 * ```
	 *
	 * @category formatting
	 * @since 0.0.0
	 */
	static warning(message: string, properties: AnnotationProperties = {}): string {
		return WorkflowCommand.render("warning", WorkflowCommand.annotation(properties), message);
	}

	/**
	 * Render a `::error::` message with optional source annotation.
	 *
	 * **Example** (Render an error at a source line)
	 *
	 * ```ts
	 * import { WorkflowCommand } from "@beep/scratchpad/effected/github-commands/WorkflowCommand";
	 *
	 * console.log(WorkflowCommand.error("failed", { startLine: 12 })) // ::error line=12::failed
	 * ```
	 *
	 * @category formatting
	 * @since 0.0.0
	 */
	static error(message: string, properties: AnnotationProperties = {}): string {
		return WorkflowCommand.render("error", WorkflowCommand.annotation(properties), message);
	}

	/**
	 * Render `::group::` to open a collapsible section in the runner log.
	 *
	 * **Example** (Open a named log group)
	 *
	 * ```ts
	 * import { WorkflowCommand } from "@beep/scratchpad/effected/github-commands/WorkflowCommand";
	 *
	 * console.log(WorkflowCommand.group("Build")) // ::group::Build
	 * ```
	 *
	 * @category formatting
	 * @since 0.0.0
	 */
	static group(name: string): string {
		return WorkflowCommand.render("group", {}, name);
	}

	/**
	 * Render `::endgroup::` to close the innermost open group.
	 *
	 * **Example** (Close the current log group)
	 *
	 * ```ts
	 * import { WorkflowCommand } from "@beep/scratchpad/effected/github-commands/WorkflowCommand";
	 *
	 * console.log(WorkflowCommand.endGroup()) // ::endgroup::
	 * ```
	 *
	 * @category formatting
	 * @since 0.0.0
	 */
	static endGroup(): string {
		return WorkflowCommand.render("endgroup", {}, "");
	}

	/**
	 * Render `::add-mask::` to register a value for redaction in the runner log.
	 *
	 * **Example** (Render a redaction registration)
	 *
	 * ```ts
	 * import { WorkflowCommand } from "@beep/scratchpad/effected/github-commands/WorkflowCommand";
	 *
	 * console.log(WorkflowCommand.addMask("secret")) // ::add-mask::secret
	 * ```
	 *
	 * @category formatting
	 * @since 0.0.0
	 */
	static addMask(value: string): string {
		return WorkflowCommand.render("add-mask", {}, value);
	}

	/**
	 * Map readable annotation fields onto GitHub's abbreviated wire names.
	 *
	 * **Example** (Map readable source coordinates to wire names)
	 *
	 * ```ts
	 * import { WorkflowCommand } from "@beep/scratchpad/effected/github-commands/WorkflowCommand";
	 *
	 * console.log(WorkflowCommand.error("failed", { startLine: 2, startColumn: 3 })) // ::error line=2,col=3::failed
	 * ```
	 *
	 * @category formatting
	 * @since 0.0.0
	 */
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
