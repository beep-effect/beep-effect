/**
 * The presentation and boundary layer of a command-line program built on `effect/cli`.
 *
 * `effect/cli` owns argument parsing, flags, the command tree and help. This package owns what surrounds it: who is
 * running the program (an audience), what the terminal can do (colour, width, hyperlinks, interactivity), how
 * output is themed, how a failure is reported and exits, and how diagnostics are kept apart from a program's
 * output. It adds no parser and no command model.
 *
 * What the pieces have in common: **a consumer only discovers the need by shipping bad output to a person or a
 * machine.** None of it fails a type-check or a review of the code in isolation; the default behaviour is wrong in
 * a way the author cannot see from the call site.
 *
 * @example
 * ```ts
 * import { CliAudience, CliRuntime } from "./index.ts"
 * import { NodeRuntime, NodeServices } from "@effect/platform-node"
 * import { Command } from "effect/cli"
 *
 * const root = Command.make("tool").pipe(
 *   Command.withSharedFlags(CliAudience.flags()),
 *   Command.withSubcommands([init, verify]),
 * )
 *
 * NodeRuntime.runMain(
 *   CliRuntime.main(CliAudience.run(root, { version: "1.0.0" }), {
 *     platform: NodeServices.layer,
 *     env: { audienceEnvVar: "TOOL_AUDIENCE", log: { envVar: "TOOL_LOG_LEVEL" } },
 *   }),
 * )
 * ```
 *
 * @packageDocumentation
 */

export { Cancelled } from "./Cancelled.ts";
export {
	type AudienceFlagInput,
	CliAudience,
	type CliAudienceFlagsOptions,
	type RequiresAudienceFlags,
} from "./CliAudience.ts";
export { CliColor } from "./CliColor.ts";
export {
	CliEnv,
	type CliEnvOptions,
	type CliEnvServices,
	type CliEnvTestOptions,
	type CliEnvTestServices,
} from "./CliEnv.ts";
export { CliExit, type CliExitShape } from "./CliExit.ts";
export { CliDoc, type CliDocSource, CliFailure, type CliFailureOptions } from "./CliFailure.ts";
export { CliInteractive } from "./CliInteractive.ts";
export {
	CliLinks,
	type CliLinksLinkerOptions,
	type CliLinksOptions,
	type CliLinksShape,
	type EditorLinks,
} from "./CliLinks.ts";
export {
	CliLog,
	type CliLogFile,
	type CliLogFileOptions,
	type CliLogOptions,
	type CliLogStatusOptions,
} from "./CliLog.ts";
export { CliLogger, type CliLoggerOptions } from "./CliLogger.ts";
export { CliMessage, type CliMessageOptions } from "./CliMessage.ts";
export {
	CliPrompt,
	type CliPromptFallbackOptions,
	type CliPromptTarget,
} from "./CliPrompt.ts";
export { CliRuntime, type FailureDetails, type MainOptions, type ReportFailuresOptions } from "./CliRuntime.ts";
export {
	CliTheme,
	type CliThemeOptions,
	type CliThemeShape,
	type CliThemeTestOptions,
	type StreamTheme,
} from "./CliTheme.ts";
export { ConfigIssueRenderer } from "./ConfigIssueRenderer.ts";
export {
	type AnnotationOptions,
	type Block,
	type BlockOf,
	type Column,
	type Counter,
	type CountsOptions,
	type CountsRow,
	type CountsTableOptions,
	Doc,
	type DocPrintOptions,
	type Document,
	type Inline,
	type InlineInput,
	type InlineOf,
	type LinkOptions,
	type LinkTarget,
	type ListOptions,
	type OverflowOptions,
	type StatusRef,
	type TableOptions,
	type TreeInput,
	type TreeNode,
} from "./Doc.ts";
export { Fmt, type PercentOptions, type TruncateOptions } from "./Fmt.ts";
export { type AnnotationLevel, GithubAnnotation, type GithubAnnotationProperties } from "./GithubAnnotation.ts";
export { type GlyphSelectOptions, type GlyphSet, Glyphs } from "./Glyphs.ts";
export { NotInteractive } from "./NotInteractive.ts";
export { Render, type RenderContext, type RenderContextOfOptions, type RenderContextOptions } from "./Render.ts";
export { SchemaIssueRenderer } from "./SchemaIssueRenderer.ts";
export { type CoreStatusName, Status, type StatusDef } from "./Status.ts";
export { type NamedColor, type Style, Token, type TokenName } from "./Token.ts";
