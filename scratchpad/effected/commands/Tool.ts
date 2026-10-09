import { LiteralKit } from "@beep/schema/LiteralKit";
import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/commands/Tool");

/**
 * Where a tool must be found for a resolution to succeed.
 *
 * **Details**
 *
 * `"any"` (the default) accepts either location, preferring the project-local
 * one; `"local"` and `"global"` require that location specifically; `"both"`
 * requires the tool in both places.
 *
 * **Example** (Accept a project-local tool source)
 *
 * ```ts
 * import { ToolSource } from "@beep/scratchpad/effected/commands/Tool";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeUnknownSync(ToolSource)("local")) // local
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ToolSource = LiteralKit(["any", "global", "local", "both"]).pipe($I.annoteSchema("ToolSource", { description: "Where a tool must be found for a resolution to succeed." }));

/**
 * The decoded type of {@link (ToolSource:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ToolSource = typeof ToolSource.Type;

/**
 * What to do when the global and project-local copies report different
 * versions.
 *
 * **Details**
 *
 * `"preferLocal"` and `"preferGlobal"` pick a winner; `"fail"` refuses to
 * resolve. The fact of a mismatch is reported by `ResolvedTool.mismatch`
 * whichever policy is in force, so no separate "report only" policy exists.
 *
 * **Example** (Reject conflicting tool versions)
 *
 * ```ts
 * import { MismatchPolicy } from "@beep/scratchpad/effected/commands/Tool";
 * import * as S from "effect/Schema";
 *
 * console.log(S.decodeUnknownSync(MismatchPolicy)("fail")) // fail
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const MismatchPolicy = LiteralKit(["preferLocal", "preferGlobal", "fail"]).pipe($I.annoteSchema("MismatchPolicy", { description: "What to do when the global and project-local copies report different versions." }));

/**
 * The decoded type of {@link (MismatchPolicy:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type MismatchPolicy = typeof MismatchPolicy.Type;

/**
 * Ask the tool for its version with a flag and read the answer out of stdout.
 *
 * **Example** (Configure a version flag and capture pattern)
 *
 * ```ts
 * import { VersionFlag } from "@beep/scratchpad/effected/commands/Tool";
 *
 * const probe = VersionFlag.make({ flag: "--version", pattern: "v([0-9.]+)" });
 *
 * console.log(probe.flag) // --version
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class VersionFlag extends S.TaggedClass<VersionFlag>($I`VersionFlag`)("VersionFlag", {
	/** The flag to pass, e.g. `"--version"`. Split on spaces into argv. */
	flag: S.String.annotateKey({ description: "The flag to pass, e.g. `\"--version\"`. Split on spaces into argv." }),
	/**
  * A regular-expression source whose **first capture group** is the version.
  *
  * **Details**
  *
  * Omitted, the default pattern takes the first version-shaped token in the
  * output, which handles the common noisy forms (`Version: 2.3.1 (build …)`,
  * `v22.1.0`) without configuration. The pattern is developer-supplied and
  * therefore trusted; it is never built from a tool's output.
  */
	pattern: S.optionalKey(S.String).annotateKey({ description: "A regular-expression source whose **first capture group** is the version." }),
}, $I.annote("VersionFlag", { description: "Ask the tool for its version with a flag and read the answer out of stdout." })) {}

/**
 * Ask the tool for JSON and read the version from a dotted path within it.
 *
 * **Example** (Read a version from JSON output)
 *
 * ```ts
 * import { VersionJson } from "@beep/scratchpad/effected/commands/Tool";
 *
 * const probe = VersionJson.make({ flag: "info --json", path: "deno.version" });
 *
 * console.log(probe.path) // deno.version
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class VersionJson extends S.TaggedClass<VersionJson>($I`VersionJson`)("VersionJson", {
	/** The flag(s) to pass, e.g. `"info --json"`. Split on spaces into argv. */
	flag: S.String.annotateKey({ description: "The flag(s) to pass, e.g. `\"info --json\"`. Split on spaces into argv." }),
	/** Dotted path to the version, e.g. `"deno.version"`. */
	path: S.String.annotateKey({ description: "Dotted path to the version, e.g. `\"deno.version\"`." }),
}, $I.annote("VersionJson", { description: "Ask the tool for JSON and read the version from a dotted path within it." })) {}

/**
 * Do not ask for a version; presence is the only question.
 *
 * **Example** (Configure a presence-only probe)
 *
 * ```ts
 * import { VersionNone } from "@beep/scratchpad/effected/commands/Tool";
 *
 * const probe = VersionNone.make({});
 *
 * console.log(probe._tag) // VersionNone
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class VersionNone extends S.TaggedClass<VersionNone>($I`VersionNone`)("VersionNone", {}, $I.annote("VersionNone", { description: "Do not ask for a version; presence is the only question." })) {}

/**
 * How to learn a tool's version.
 *
 * **Details**
 *
 * A probe is plain data, so it is serializable and inspectable. A capture
 * `pattern` on {@link VersionFlag} handles unusual output formats, and the
 * default pattern handles most tools with no configuration at all.
 *
 * **Example** (Validate a flag-based version probe)
 *
 * ```ts
 * import { VersionFlag, VersionProbe } from "@beep/scratchpad/effected/commands/Tool";
 * import * as S from "effect/Schema";
 *
 * const probe = VersionFlag.make({ flag: "--version" });
 *
 * console.log(S.is(VersionProbe)(probe)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const VersionProbe = S.Union([VersionFlag, VersionJson, VersionNone]).pipe($I.annoteSchema("VersionProbe", { description: "How to learn a tool's version." }));

/**
 * The decoded type of {@link (VersionProbe:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type VersionProbe = typeof VersionProbe.Type;

/**
 * A CLI tool to resolve, and the constraints resolution must satisfy.
 *
 * **Example** (Describe a project-local CLI tool)
 *
 * ```ts
 * import { Tool, VersionFlag } from "@beep/scratchpad/effected/commands/Tool";
 *
 * const biome = Tool.make({
 *   name: "biome",
 *   version: VersionFlag.make({ flag: "--version" }),
 *   source: "local",
 *   onMismatch: "preferLocal",
 * });
 *
 * console.log(biome.name) // biome
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Tool extends S.Class<Tool>($I`Tool`)({
	/** The executable name, e.g. `"biome"`. */
	name: S.String.annotateKey({ description: "The executable name, e.g. `\"biome\"`." }),
	/** How to learn its version. */
	version: VersionProbe.annotateKey({ description: "How to learn its version." }),
	/** Where it must be found. */
	source: ToolSource.annotateKey({ description: "Where it must be found." }),
	/** What to do when the two locations disagree on the version. */
	onMismatch: MismatchPolicy.annotateKey({ description: "What to do when the two locations disagree on the version." }),
}, $I.annote("Tool", { description: "A CLI tool to resolve, and the constraints resolution must satisfy." })) {
	/**
  * Builds a `Tool` from a name, with defaults for everything else
  * (`--version`, `source: "any"`, `onMismatch: "preferLocal"`).
  *
  * **Example** (Define Biome tools with default and local sources)
  *
  * ```ts
  * import { Tool } from "@beep/scratchpad/effected/commands/Tool";
  *
  * const biome = Tool.named("biome");
  * const localOnly = Tool.named("biome", { source: "local" });
  *
  * console.log(biome.source) // any
  * console.log(localOnly.source) // local
  * ```
  *
  * @category constructors
  * @since 0.0.0
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
