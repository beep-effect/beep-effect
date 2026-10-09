import { WorkflowCommand } from "../github-commands/index.ts";

/**
 * The severity of a GitHub annotation.
 *
 * @public
 */
export type AnnotationLevel = "error" | "warning" | "notice";

/**
 * What an annotation says about where it points and what it is called.
 *
 * @public
 */
export interface GithubAnnotationProperties {
	/** `error`, `warning` or `notice`. */
	readonly level: AnnotationLevel;
	/** The repository-relative path of the annotated file. */
	readonly file?: string;
	/** The first annotated line, 1-based. */
	readonly line?: number;
	/** The first annotated column, 1-based. */
	readonly col?: number;
	/** The last annotated line. */
	readonly endLine?: number;
	/** The last annotated column. */
	readonly endColumn?: number;
	/** A short title shown above the annotation. */
	readonly title?: string;
}

/**
 * GitHub Actions annotations, as workflow commands.
 *
 * @public
 */
export class GithubAnnotation {
	private constructor() {}

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
  * @param annotation - the level and the optional file, position and title
  * @param message - the annotation's text
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
