import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import { WorkflowCommand } from "../github-commands/index.ts";

const $I = $ScratchpadId.create("effected/cli/GithubAnnotation");

/**
 * The severity of a GitHub annotation.
 *
 * **Example** (Read the annotation severity vocabulary)
 *
 * ```ts
 * import { AnnotationLevel } from "@beep/scratchpad/effected/cli/GithubAnnotation"
 *
 * console.log(AnnotationLevel.literals) // ["error", "warning", "notice"]
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const AnnotationLevel = LiteralKit(["error", "warning", "notice"]).annotate(
	$I.annote("AnnotationLevel", { description: "The severity of a GitHub annotation." }),
);
/**
 * A severity accepted by GitHub Actions annotations.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AnnotationLevel = typeof AnnotationLevel.Type;

/**
 * What an annotation says about where it points and what it is called.
 *
 * **Example** (Validate annotation properties)
 *
 * ```ts
 * import { GithubAnnotationProperties } from "@beep/scratchpad/effected/cli/GithubAnnotation"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GithubAnnotationProperties)({ level: "notice", title: "Build" })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const GithubAnnotationProperties = S.Struct({
	/** `error`, `warning` or `notice`. */
	level: AnnotationLevel.annotate(
		$I.annote("GithubAnnotationProperties.level", { description: "The level field of a GitHub annotation." }),
	),
	/** The repository-relative path of the annotated file. */
	file: S.optionalKey(S.String).annotate(
		$I.annote("GithubAnnotationProperties.file", { description: "The file field of a GitHub annotation." }),
	),
	/** The first annotated line, 1-based. */
	line: S.optionalKey(S.Finite).annotate(
		$I.annote("GithubAnnotationProperties.line", { description: "The line field of a GitHub annotation." }),
	),
	/** The first annotated column, 1-based. */
	col: S.optionalKey(S.Finite).annotate(
		$I.annote("GithubAnnotationProperties.col", { description: "The col field of a GitHub annotation." }),
	),
	/** The last annotated line. */
	endLine: S.optionalKey(S.Finite).annotate(
		$I.annote("GithubAnnotationProperties.endLine", { description: "The endLine field of a GitHub annotation." }),
	),
	/** The last annotated column. */
	endColumn: S.optionalKey(S.Finite).annotate(
		$I.annote("GithubAnnotationProperties.endColumn", { description: "The endColumn field of a GitHub annotation." }),
	),
	/** A short title shown above the annotation. */
	title: S.optionalKey(S.String).annotate(
		$I.annote("GithubAnnotationProperties.title", { description: "The title field of a GitHub annotation." }),
	),
}).annotate($I.annote("GithubAnnotationProperties", { description: "A GitHub annotation level and optional source position and title." }));
/**
 * The plain metadata of a GitHub Actions annotation.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GithubAnnotationProperties = typeof GithubAnnotationProperties.Type;

/**
 * GitHub Actions annotations, as workflow commands.
 *
 * **Example** (Build a GitHub error annotation)
 *
 * ```ts
 * import { GithubAnnotation } from "@beep/scratchpad/effected/cli/GithubAnnotation"
 *
 * console.log(GithubAnnotation.format({ level: "error", file: "src/main.ts", line: 1 }, "Invalid input")) // ::error file=src/main.ts,line=1::Invalid input
 * ```
 *
 * @public
 * @category formatting
 * @since 0.0.0
 */
export abstract class GithubAnnotation {

	/**
	 * Format an annotation as a workflow command: `::error title=T,file=F,line=1,endLine=2,col=3,endColumn=4::message`.
	 *
	 * **Details**
	 *
	 * The message escapes `%`, CR and LF; a property value escapes those and `:` and `,`, per GitHub's
	 * [workflow-command documentation](https://docs.github.com/en/actions/reference/workflow-commands-for-github-actions).
	 * The percent sign is escaped first, so an escape that was just written is never escaped again. An unescaped line
	 * break in a message would let the text after it be read as a new command, which is why the escaping is not optional.
	 *
	 * A property that is not given is left out, and the properties are written in the order `title`, `file`, `line`,
	 * `endLine`, `col`, `endColumn`, the same as `@effected/github-commands`' `WorkflowCommand`, which this renders
	 * through.
	 *
	 * **Example** (Escape annotation message line breaks)
	 *
	 * ```ts
	 * import { GithubAnnotation } from "@beep/scratchpad/effected/cli/GithubAnnotation"
	 *
	 * console.log(GithubAnnotation.format({ level: "warning", title: "Check" }, "first\nsecond")) // ::warning title=Check::first%0Asecond
	 * ```
	 *
	 * @param annotation - the level and the optional file, position and title
	 * @param message - the annotation's text
	 * @category formatting
	 * @since 0.0.0
	 */
	// One escaping: this renders through `WorkflowCommand`, not a copy of it.
	static readonly format = (annotation: GithubAnnotationProperties, message: string): string => WorkflowCommand.render(
			annotation.level,
			{
				title: annotation.title,
				file: annotation.file,
				line: annotation.line,
				endLine: annotation.endLine,
				col: annotation.col,
				endColumn: annotation.endColumn,
			},
			message,
		);
}
