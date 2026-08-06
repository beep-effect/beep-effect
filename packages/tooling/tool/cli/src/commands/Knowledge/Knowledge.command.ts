/**
 * `beep knowledge semantic-delta` command definitions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { NonNegativeInt } from "@beep/schema";
import { Console, Effect } from "effect";
import * as A from "effect/Array";
import { Command, Flag } from "effect/unstable/cli";
import { KnowledgeIntroducedFindingsError, KnowledgeOperationalError } from "./Knowledge.errors.ts";
import { encodeKnowledgeSemanticDeltaReportJson } from "./Knowledge.schemas.ts";
import { KnowledgeService, KnowledgeServiceLive } from "./Knowledge.service.ts";
import type { KnowledgeFinding, KnowledgeSemanticDeltaReport } from "./Knowledge.schemas.ts";

const baseFlag = Flag.string("base").pipe(
  Flag.withDescription("Local base ref used to resolve the merge-base; the command never fetches"),
  Flag.withDefault("origin/main")
);
const jsonFlag = Flag.boolean("json").pipe(Flag.withDescription("Render the semantic delta as JSON"));

const renderFinding = (finding: KnowledgeFinding): string =>
  `  ${finding.findingId} ${finding.kind} ${finding.location.path}: ${finding.message}`;

const renderHumanReport = (report: KnowledgeSemanticDeltaReport): string => {
  const section = (label: string, findings: ReadonlyArray<KnowledgeFinding>): string =>
    A.join([`${label} (${A.length(findings)})`, ...A.map(findings, renderFinding)], "\n");
  return A.join(
    [
      section("introduced", report.introduced),
      section("resolved", report.resolved),
      section("unchanged", report.unchanged),
    ],
    "\n"
  );
};

const runSemanticDelta = Effect.fn("KnowledgeCommand.runSemanticDelta")(function* (options: {
  readonly base: string;
  readonly json: boolean;
}) {
  const knowledge = yield* KnowledgeService;
  const report = yield* knowledge.semanticDelta(options.base);
  if (options.json) {
    const json = yield* encodeKnowledgeSemanticDeltaReportJson(report).pipe(
      KnowledgeOperationalError.mapError("Failed to encode the semantic-delta JSON report.")
    );
    yield* Console.log(json);
  } else {
    yield* Console.log(renderHumanReport(report));
  }
  if (A.isReadonlyArrayNonEmpty(report.introduced)) {
    return yield* KnowledgeIntroducedFindingsError.make({
      message: `knowledge semantic-delta: ${A.length(report.introduced)} introduced blocking finding(s).`,
      introducedCount: NonNegativeInt.make(A.length(report.introduced)),
    });
  }
});

/**
 * The `beep knowledge semantic-delta` subcommand.
 *
 * **Details**
 *
 * The report always prints — human-readable by default, one JSON line under `--json` — before the
 * exit status is decided, so a failing run still shows its findings. Introduced blocking findings
 * then fail the command; resolved and unchanged findings never do. `--base` names a purely local
 * ref: the command resolves a merge-base against it and never fetches.
 *
 * **Example** (Read the subcommand identity)
 *
 * ```ts
 * import { knowledgeSemanticDeltaCommand } from "@beep/repo-cli/commands/Knowledge/Knowledge.command"
 *
 * console.log(knowledgeSemanticDeltaCommand.name) // "semantic-delta"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const knowledgeSemanticDeltaCommand = Command.make(
  "semantic-delta",
  { base: baseFlag, json: jsonFlag },
  runSemanticDelta
).pipe(
  Command.withDescription("Report findings introduced between merge-base and HEAD archives"),
  Command.provide(KnowledgeServiceLive)
);

/**
 * The `beep knowledge` command family root.
 *
 * **Details**
 *
 * Running it without a subcommand lists the available knowledge-surface verifications rather than
 * scanning, so the family root stays cheap and side-effect free.
 *
 * **Example** (Reach the semantic-delta subcommand from the family root)
 *
 * ```ts
 * import { knowledgeCommand } from "@beep/repo-cli/commands/Knowledge/Knowledge.command"
 * import * as A from "effect/Array"
 *
 * const subcommands = A.flatMap(knowledgeCommand.subcommands, (group) => group.commands)
 *
 * console.log(knowledgeCommand.name) // "knowledge"
 * console.log(A.map(subcommands, (command) => command.name)) // [ "semantic-delta" ]
 * ```
 *
 * @see {@link knowledgeSemanticDeltaCommand} for the only Stage-1 subcommand it exposes.
 * @category cli-commands
 * @since 0.0.0
 */
export const knowledgeCommand = Command.make("knowledge", {}, () =>
  Console.log("Knowledge commands: semantic-delta [--base <ref>] [--json]")
).pipe(
  Command.withDescription("Knowledge-surface verification commands"),
  Command.withSubcommands([knowledgeSemanticDeltaCommand])
);
