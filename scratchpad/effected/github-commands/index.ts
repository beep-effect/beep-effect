/**
 * The GitHub Actions workflow-command grammar as pure functions, with no
 * dependencies and no IO.
 *
 * **Details**
 *
 * {@link WorkflowCommand} renders a command (`::name key=value::message`) with
 * the runner's escaping rules, and {@link CommandNeutralizer} makes arbitrary
 * text safe to write to a log by ensuring no line of it can be read by the
 * runner as a command. Writing a rendered line to stdout is the caller's job.
 *
 * **Example** (Render a command and protect ordinary log text)
 *
 * ```ts
 * import { CommandNeutralizer, WorkflowCommand } from "@beep/scratchpad/effected/github-commands/index";
 *
 * console.log(WorkflowCommand.notice("ready")) // ::notice::ready
 * console.log(CommandNeutralizer.text("::error::x") === "\u200b::error::x") // true
 * ```
 *
 * @packageDocumentation
 * @category utilities
 * @since 0.0.0
 */

export { CommandNeutralizer } from "./CommandNeutralizer.ts";
export { AnnotationProperties, WorkflowCommand } from "./WorkflowCommand.ts";
