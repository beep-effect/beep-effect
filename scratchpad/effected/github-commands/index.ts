/**
 * The GitHub Actions workflow-command grammar as pure functions, with no
 * dependencies and no IO.
 *
 * {@link WorkflowCommand} renders a command (`::name key=value::message`) with
 * the runner's escaping rules, and {@link CommandNeutralizer} makes arbitrary
 * text safe to write to a log by ensuring no line of it can be read by the
 * runner as a command. Writing a rendered line to stdout is the caller's job.
 *
 * @packageDocumentation
 */

export { CommandNeutralizer } from "./CommandNeutralizer.ts";
export { AnnotationProperties, WorkflowCommand } from "./WorkflowCommand.ts";
