import type { ConfigValidationError } from "../config-file/index.ts";
import { formatIssue } from "./internal/format.ts";

/**
 * Turns a `@effected/config-file` `ConfigValidationError` into one line per rejected value.
 *
 * @remarks
 * `ConfigValidationError` carries the structured `issue` tree rather than a
 * string, so a caller holds a tree it has to turn into sentences. This is that
 * step, the same treatment {@link SchemaIssueRenderer} gives a bare issue.
 *
 * `ConfigValidationError.message` names the file but not the value, and the
 * value is the diagnostic: printing only the message tells a user their config
 * is invalid without saying which value is wrong or how it is shaped.
 *
 * `@effected/config-file` is an optional peer, and this module only
 * `import type`s it, so the import is erased at build time. A consumer without
 * the package installed can import this module without the resolver being asked
 * for it.
 *
 * @example
 * ```ts
 * import { ConfigIssueRenderer } from "./index.ts"
 * import { Effect } from "effect"
 *
 * const load = configFile.load.pipe(
 *   Effect.catchTag("ConfigValidationError", (error) =>
 *     Effect.gen(function* () {
 *       yield* Effect.logError(String(error))
 *       for (const line of ConfigIssueRenderer.render(error)) yield* Effect.logError(`  ${line}`)
 *     }),
 *   ),
 * )
 * ```
 *
 * @public
 */
export class ConfigIssueRenderer {
	private constructor() {}

	/**
	 * One line per rejected value.
	 *
	 * @remarks
	 * Takes the **error**, not its `issue`, because that is what a `catchTag`
	 * hands you and because `issue` is typed `Schema.Defect`, which every call
	 * site would otherwise have to reach into. Inside
	 * `Effect.catchTag("ConfigValidationError", …)` the error is already this
	 * type.
	 *
	 * It cannot throw on a malformed value: the issue tree is validated by
	 * a guard before it is read, so a renderer on an error path never becomes the
	 * reason a program dies.
	 */
	static readonly render = (error: ConfigValidationError): ReadonlyArray<string> =>
		formatIssue((error as { readonly issue?: unknown } | null)?.issue);
}
