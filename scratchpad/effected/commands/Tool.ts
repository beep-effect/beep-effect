import { Schema } from "effect";

/**
 * Where a tool must be found for a resolution to succeed.
 *
 * @remarks
 * `"any"` (the default) accepts either location, preferring the project-local
 * one; `"local"` and `"global"` require that location specifically; `"both"`
 * requires the tool in both places.
 *
 * @public
 */
export const ToolSource = Schema.Literals(["any", "global", "local", "both"]);

/**
 * The decoded type of {@link (ToolSource:variable)}.
 *
 * @public
 */
export type ToolSource = typeof ToolSource.Type;

/**
 * What to do when the global and project-local copies report different
 * versions.
 *
 * @remarks
 * `"preferLocal"` and `"preferGlobal"` pick a winner; `"fail"` refuses to
 * resolve. The fact of a mismatch is reported by `ResolvedTool.mismatch`
 * whichever policy is in force, so no separate "report only" policy exists.
 *
 * @public
 */
export const MismatchPolicy = Schema.Literals(["preferLocal", "preferGlobal", "fail"]);

/**
 * The decoded type of {@link (MismatchPolicy:variable)}.
 *
 * @public
 */
export type MismatchPolicy = typeof MismatchPolicy.Type;

/**
 * Ask the tool for its version with a flag and read the answer out of stdout.
 *
 * @public
 */
export class VersionFlag extends Schema.TaggedClass<VersionFlag>()("VersionFlag", {
	/** The flag to pass, e.g. `"--version"`. Split on spaces into argv. */
	flag: Schema.String,
	/**
	 * A regular-expression source whose **first capture group** is the version.
	 *
	 * @remarks
	 * Omitted, the default pattern takes the first version-shaped token in the
	 * output, which handles the common noisy forms (`Version: 2.3.1 (build …)`,
	 * `v22.1.0`) without configuration. The pattern is developer-supplied and
	 * therefore trusted; it is never built from a tool's output.
	 */
	pattern: Schema.optionalKey(Schema.String),
}) {}

/**
 * Ask the tool for JSON and read the version from a dotted path within it.
 *
 * @public
 */
export class VersionJson extends Schema.TaggedClass<VersionJson>()("VersionJson", {
	/** The flag(s) to pass, e.g. `"info --json"`. Split on spaces into argv. */
	flag: Schema.String,
	/** Dotted path to the version, e.g. `"deno.version"`. */
	path: Schema.String,
}) {}

/**
 * Do not ask for a version; presence is the only question.
 *
 * @public
 */
export class VersionNone extends Schema.TaggedClass<VersionNone>()("VersionNone", {}) {}

/**
 * How to learn a tool's version.
 *
 * @remarks
 * A probe is plain data, so it is serializable and inspectable. A capture
 * `pattern` on {@link VersionFlag} handles unusual output formats, and the
 * default pattern handles most tools with no configuration at all.
 *
 * @public
 */
export const VersionProbe = Schema.Union([VersionFlag, VersionJson, VersionNone]);

/**
 * The decoded type of {@link (VersionProbe:variable)}.
 *
 * @public
 */
export type VersionProbe = typeof VersionProbe.Type;

/**
 * A CLI tool to resolve, and the constraints resolution must satisfy.
 *
 * @public
 */
export class Tool extends Schema.Class<Tool>("Tool")({
	/** The executable name, e.g. `"biome"`. */
	name: Schema.String,
	/** How to learn its version. */
	version: VersionProbe,
	/** Where it must be found. */
	source: ToolSource,
	/** What to do when the two locations disagree on the version. */
	onMismatch: MismatchPolicy,
}) {
	/**
	 * Builds a `Tool` from a name, with defaults for everything else
	 * (`--version`, `source: "any"`, `onMismatch: "preferLocal"`).
	 *
	 * @example
	 * ```ts
	 * const biome = Tool.named("biome");
	 * const localOnly = Tool.named("biome", { source: "local" });
	 * ```
	 */
	static readonly named = (
		name: string,
		overrides?: {
			readonly version?: VersionProbe | undefined;
			readonly source?: ToolSource | undefined;
			readonly onMismatch?: MismatchPolicy | undefined;
		},
	): Tool =>
		Tool.make({
			name,
			version: overrides?.version ?? VersionFlag.make({ flag: "--version" }),
			source: overrides?.source ?? "any",
			onMismatch: overrides?.onMismatch ?? "preferLocal",
		});
}
