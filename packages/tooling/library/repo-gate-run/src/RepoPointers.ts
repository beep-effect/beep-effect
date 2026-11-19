/**
 * The repo's pointer table: the repo CLI commands a console's pointer line
 * names, as data, and the check that a pointer line names only those.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { GatePointers } from "@beep/gate-report/ConsoleDocument";
import { $RepoGateRunId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { PointerTable } from "@beep/gate-report/ConsoleDocument";

const $I = $RepoGateRunId.create("RepoPointers");

/**
 * The prefix every pointer command carries: the repo CLI run from the
 * repository root.
 *
 * **Example** (Read the prefix)
 *
 * ```ts
 * import { REPO_CLI_PREFIX } from "@beep/repo-gate-run/RepoPointers";
 *
 * console.log(REPO_CLI_PREFIX.length > 0); // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const REPO_CLI_PREFIX = "bun run beep ";

/**
 * Whether a command exists in the repo CLI today or is planned.
 *
 * **Details**
 *
 * The `gate` command family is planned: its commands are named here so the
 * console can point at them, and a test fails once one is marked `live`
 * without a check against the repo CLI's command tree.
 *
 * **Example** (Match a status)
 *
 * ```ts
 * import { CommandStatus } from "@beep/repo-gate-run/RepoPointers";
 *
 * console.log(CommandStatus.is.planned("planned")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CommandStatus = LiteralKit(["live", "planned"]).pipe(
  $I.annoteSchema("CommandStatus", {
    description: "Whether a repo CLI command exists today or is planned.",
  })
);

/**
 * Type of {@link CommandStatus}.
 *
 * @category models
 * @since 0.0.0
 */
export type CommandStatus = typeof CommandStatus.Type;

/**
 * One repo CLI command: its words after the prefix and its status.
 *
 * **Example** (Build a command)
 *
 * ```ts
 * import { RepoCommand } from "@beep/repo-gate-run/RepoPointers";
 *
 * console.log(RepoCommand.make({ words: ["gate", "show", "test"], status: "planned" }).words[1]); // show
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RepoCommand extends S.Opaque<RepoCommand, { readonly brand: unique symbol }>()(
  S.Struct({
    words: S.NonEmptyString.pipe(S.NonEmptyArray),
    status: CommandStatus,
  }).pipe(
    $I.annoteSchema("RepoCommand", {
      description: "One repo CLI command: its words after the repo CLI prefix and whether it exists yet.",
    })
  )
) {}

/**
 * A command's text as the console prints it.
 *
 * **Example** (Print a command)
 *
 * ```ts
 * import { RepoCommand, commandText } from "@beep/repo-gate-run/RepoPointers";
 *
 * console.log(commandText(RepoCommand.make({ words: ["gate", "show", "test"], status: "planned" })).endsWith("gate show test")); // true
 * ```
 *
 * @param command - the repo CLI command to print
 * @returns the command line an agent can run from the repository root
 * @category projections
 * @since 0.0.0
 */
export const commandText = (command: RepoCommand): string => `${REPO_CLI_PREFIX}${A.join(command.words, " ")}`;

/**
 * The two queries of one gate: show a run's record, and show one item of it
 * in full.
 *
 * **Example** (Build a gate's queries)
 *
 * ```ts
 * import { GateQueryCommands, RepoCommand } from "@beep/repo-gate-run/RepoPointers";
 *
 * const commands = GateQueryCommands.make({
 *   showRun: RepoCommand.make({ words: ["gate", "show", "test"], status: "planned" }),
 *   showItem: RepoCommand.make({ words: ["gate", "item", "test"], status: "planned" }),
 * });
 * console.log(commands.showItem.words[1]); // item
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class GateQueryCommands extends S.Opaque<GateQueryCommands, { readonly brand: unique symbol }>()(
  S.Struct({
    showRun: RepoCommand,
    showItem: RepoCommand,
  }).pipe(
    $I.annoteSchema("GateQueryCommands", {
      description: "The repo CLI queries of one gate: show a run's record, show one item in full.",
    })
  )
) {}

const plannedQueries = (gate: ContractGate): GateQueryCommands =>
  GateQueryCommands.make({
    showRun: RepoCommand.make({ words: ["gate", "show", gate], status: "planned" }),
    showItem: RepoCommand.make({ words: ["gate", "item", gate], status: "planned" }),
  });

/**
 * The gates on the console contract in this goal: `test` and `check`.
 *
 * **Example** (Check a contract gate)
 *
 * ```ts
 * import { ContractGate } from "@beep/repo-gate-run/RepoPointers";
 *
 * console.log(ContractGate.is.check("check")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ContractGate = LiteralKit(["test", "check"]).pipe(
  $I.annoteSchema("ContractGate", {
    description: "The gates on the console contract: test and check.",
  })
);

/**
 * Type of {@link ContractGate}.
 *
 * @category models
 * @since 0.0.0
 */
export type ContractGate = typeof ContractGate.Type;

/**
 * The repo's query commands by gate, for the gates on the console contract.
 *
 * **Example** (Read the test gate's run query)
 *
 * ```ts
 * import { repoGateCommands } from "@beep/repo-gate-run/RepoPointers";
 *
 * console.log(repoGateCommands.test.showRun.words.join(" ")); // gate show test
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const repoGateCommands: Readonly<Record<ContractGate, GateQueryCommands>> = {
  test: plannedQueries("test"),
  check: plannedQueries("check"),
};

/**
 * The pointer table the console renders with: each gate's pointer line names
 * its show-run query.
 *
 * **Example** (Read the check gate's pointer)
 *
 * ```ts
 * import { repoPointerTable } from "@beep/repo-gate-run/RepoPointers";
 *
 * console.log(repoPointerTable.check?.failure.endsWith("gate show check")); // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const repoPointerTable: PointerTable = R.map(repoGateCommands, (commands) =>
  GatePointers.make({ failure: commandText(commands.showRun) })
);

/**
 * Every command the pointer table names, in table order.
 *
 * **Example** (Count the commands)
 *
 * ```ts
 * import { repoCommands } from "@beep/repo-gate-run/RepoPointers";
 *
 * console.log(repoCommands.length); // 4
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const repoCommands: ReadonlyArray<RepoCommand> = A.flatMap(R.values(repoGateCommands), (commands) => [
  commands.showRun,
  commands.showItem,
]);

/**
 * Why a pointer command was refused: it names an MCP tool, a tool outside the
 * repo CLI, a document, or a repo CLI command the table does not hold.
 *
 * **Example** (Match a violation)
 *
 * ```ts
 * import { PointerViolation } from "@beep/repo-gate-run/RepoPointers";
 *
 * console.log(PointerViolation.is["mcp-tool"]("mcp-tool")); // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PointerViolation = LiteralKit(["mcp-tool", "bare-tool", "documentation", "unknown-command"]).pipe(
  $I.annoteSchema("PointerViolation", {
    description: "Why a pointer command was refused: an MCP tool, a bare tool, a document, or an unknown command.",
  })
);

/**
 * Type of {@link PointerViolation}.
 *
 * @category models
 * @since 0.0.0
 */
export type PointerViolation = typeof PointerViolation.Type;

/**
 * A pointer line named something other than a repo CLI command in the table.
 *
 * **Example** (Build the error)
 *
 * ```ts
 * import { PointerLineError } from "@beep/repo-gate-run/RepoPointers";
 *
 * console.log(PointerLineError.make({ violation: "mcp-tool", command: "list_failures" }).violation); // mcp-tool
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class PointerLineError extends S.TaggedError<PointerLineError, { readonly brand: unique symbol }>(
  $I`PointerLineError`
)(
  "PointerLineError",
  { violation: PointerViolation, command: S.String },
  $I.annoteError<PointerLineError>("PointerLineError", {
    description: "A pointer line named something other than a repo CLI command the pointer table holds.",
  })
) {}

const POINTER_PREFIX = "next: ";

const DocumentationPointer = S.String.check(
  S.isPattern(/(?:^|\s)(?:https?:\/\/|docs\/|see\s)|\.md\b/u, {
    identifier: "DocumentationPointer",
    title: "Documentation Pointer",
    description: "A pointer to a document: a URL, a docs path, a Markdown file or a 'see' reference.",
  })
);

const McpToolName = S.String.check(
  S.isPattern(/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/u, {
    identifier: "McpToolName",
    title: "MCP Tool Name",
    description: "A snake_case tool name, the shape upstream's MCP pointers used.",
  })
);

const isDocumentation = S.is(DocumentationPointer);
const isMcpTool = S.is(McpToolName);

const violationOf: (command: string) => PointerViolation = Match.type<string>().pipe(
  Match.when(isDocumentation, (): PointerViolation => "documentation"),
  Match.when(isMcpTool, (): PointerViolation => "mcp-tool"),
  Match.when(Str.startsWith(REPO_CLI_PREFIX), (): PointerViolation => "unknown-command"),
  Match.orElse((): PointerViolation => "bare-tool")
);

const resolveCommand =
  (table: ReadonlyArray<RepoCommand>) =>
  (command: string): Result.Result<RepoCommand, PointerLineError> =>
    pipe(
      A.findFirst(table, (known) => commandText(known) === command),
      Result.fromOption(() => PointerLineError.make({ violation: violationOf(command), command }))
    );

/**
 * Check one console pointer line: every command it names must be a repo CLI
 * command in the table.
 *
 * **Details**
 *
 * The line is `next: ` followed by commands joined with `; `. A command that
 * is not in the table is refused with the reason: a link or document path,
 * an MCP tool name such as `list_failures`, a tool run outside the repo CLI, or
 * a repo CLI command the table does not hold. A line without the `next: `
 * prefix is not a pointer line and is refused whole.
 *
 * **Example** (Accept the test gate's pointer)
 *
 * ```ts
 * import { repoCommands, repoPointerTable, verifyPointerLine } from "@beep/repo-gate-run/RepoPointers";
 * import * as Result from "effect/Result";
 *
 * const line = `next: ${repoPointerTable.test?.failure}`;
 * console.log(Result.isSuccess(verifyPointerLine(line, repoCommands))); // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const verifyPointerLine: {
  (line: string, table: ReadonlyArray<RepoCommand>): Result.Result<ReadonlyArray<RepoCommand>, PointerLineError>;
  (table: ReadonlyArray<RepoCommand>): (line: string) => Result.Result<ReadonlyArray<RepoCommand>, PointerLineError>;
} = dual(
  2,
  (line: string, table: ReadonlyArray<RepoCommand>): Result.Result<ReadonlyArray<RepoCommand>, PointerLineError> =>
    pipe(
      O.liftPredicate(line, Str.startsWith(POINTER_PREFIX)),
      O.map(Str.slice(POINTER_PREFIX.length)),
      Result.fromOption(() => PointerLineError.make({ violation: violationOf(line), command: line })),
      Result.flatMap((commands) => Result.all(A.map(Str.split(commands, "; "), resolveCommand(table))))
    )
);
