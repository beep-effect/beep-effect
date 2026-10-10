import { formatIssue } from "./internal/format.ts";

/**
 * Turns a `SchemaIssue` tree into lines a user can act on.
 *
 * **Details**
 *
 * A decode failure arrives as a structured tree; a person needs
 * `unknown key at groups.g.cleanup.rulesetz`. The formatters core ships for
 * this live on `SchemaIssue` rather than on `SchemaError` or `Schema`, and
 * `SchemaError.message` does not use them, so printing the error alone does not
 * give these lines.
 *
 * The lines and `CliFailure`'s tree are two views of the same rejected values (`internal/format`), so a schema
 * failure in the default report and these lines never disagree.
 *
 * **Example** (Log schema decode issues as actionable lines)
 *
 * ```ts
 * import { SchemaIssueRenderer } from "@beep/scratchpad/effected/cli/SchemaIssueRenderer"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const MySchema = S.Struct({ name: S.String })
 * const input: unknown = { name: "Ada", extra: true }
 * const result = S.decodeUnknownEffect(MySchema)(input, {
 *   onExcessProperty: "error",
 *   errors: "all",
 * })
 *
 * const reported = result.pipe(
 *   Effect.catchTag("SchemaError", (error) =>
 *     Effect.forEach(SchemaIssueRenderer.render(error.issue), (line) => Effect.logError(`  ${line}`)),
 *   ),
 * )
 * console.log(Effect.isEffect(reported)) // true
 * ```
 *
 * @public
 * @category formatting
 * @since 0.0.0
 */
export class SchemaIssueRenderer {
	private constructor() {}

	/**
	 * One line per rejected value, deepest path last.
	 *
	 * **Example** (Reject a value that is not an issue tree)
	 *
	 * ```ts
	 * import { SchemaIssueRenderer } from "@beep/scratchpad/effected/cli/SchemaIssueRenderer"
	 *
	 * console.log(SchemaIssueRenderer.render(null).length) // 0
	 * ```
	 *
	 * @param issue - a `SchemaIssue` tree, or any value
	 * @returns the lines, or empty when `issue` is not an issue tree
	 * @category formatting
	 * @since 0.0.0
	 */
	static readonly render = (issue: unknown): ReadonlyArray<string> => formatIssue(issue);
}
