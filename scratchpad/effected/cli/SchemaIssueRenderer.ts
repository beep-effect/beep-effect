import { formatIssue } from "./internal/format.ts";

/**
 * Turns a `SchemaIssue` tree into lines a user can act on.
 *
 * @remarks
 * A decode failure arrives as a structured tree; a person needs
 * `unknown key at groups.g.cleanup.rulesetz`. The formatters core ships for
 * this live on `SchemaIssue` rather than on `SchemaError` or `Schema`, and
 * `SchemaError.message` does not use them, so printing the error alone does not
 * give these lines.
 *
 * The lines and `CliFailure`'s tree are two views of the same rejected values (`internal/format`), so a schema
 * failure in the default report and these lines never disagree.
 *
 * @example
 * ```ts
 * import { SchemaIssueRenderer } from "./index.ts"
 * import { Effect, Schema } from "effect"
 *
 * const result = Schema.decodeUnknownEffect(MySchema)(input, {
 *   onExcessProperty: "error",
 *   errors: "all",
 * })
 *
 * const reported = result.pipe(
 *   Effect.catchTag("SchemaError", (error) =>
 *     Effect.forEach(SchemaIssueRenderer.render(error.issue), (line) => Effect.logError(`  ${line}`)),
 *   ),
 * )
 * ```
 *
 * @public
 */
export class SchemaIssueRenderer {
	private constructor() {}

	/**
	 * One line per rejected value, deepest path last.
	 *
	 * @param issue - a `SchemaIssue` tree, or any value
	 * @returns the lines, or empty when `issue` is not an issue tree
	 */
	static readonly render = (issue: unknown): ReadonlyArray<string> => formatIssue(issue);
}
