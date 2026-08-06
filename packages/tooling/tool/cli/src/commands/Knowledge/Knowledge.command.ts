/**
 * `beep knowledge semantic-delta` command definitions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { NonNegativeInt } from "@beep/schema";
import { Console, Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { Command, Flag } from "effect/unstable/cli";
import { KnowledgeIntroducedFindingsError, KnowledgeOperationalError } from "./Knowledge.errors.ts";
import {
  encodeKnowledgeSemanticDeltaReportJson,
  KNOWLEDGE_PROBE_DEPENDENT_KINDS,
  KnowledgeProbePolicy,
} from "./Knowledge.schemas.ts";
import { KnowledgeService, KnowledgeServiceLive } from "./Knowledge.service.ts";
import type { KnowledgeFinding, KnowledgeSemanticDeltaReport } from "./Knowledge.schemas.ts";

const baseFlag = Flag.string("base").pipe(
  Flag.withDescription("Local base ref used to resolve the merge-base; the command never fetches"),
  Flag.withDefault("origin/main")
);
const jsonFlag = Flag.boolean("json").pipe(Flag.withDescription("Render the semantic delta as JSON"));

const renderFinding = (finding: KnowledgeFinding): string =>
  `  ${finding.findingId} ${finding.kind} ${finding.location.path}: ${finding.message}`;

// A skipped run must never read as a clean one, so the missing coverage is named on the same line
// as the policy rather than left for the reader to infer from absent findings.
const renderProbePolicy = (report: KnowledgeSemanticDeltaReport): string =>
  KnowledgeProbePolicy.is.enabled(report.probePolicy)
    ? `probe-policy: ${report.probePolicy}`
    : `probe-policy: ${report.probePolicy} (not checked: ${A.join(KNOWLEDGE_PROBE_DEPENDENT_KINDS, ", ")})`;

const renderHumanReport = (report: KnowledgeSemanticDeltaReport): string => {
  const section = (label: string, findings: ReadonlyArray<KnowledgeFinding>): string =>
    A.join([`${label} (${A.length(findings)})`, ...A.map(findings, renderFinding)], "\n");
  return A.join(
    [
      renderProbePolicy(report),
      section("introduced", report.introduced),
      section("resolved", report.resolved),
      section("unchanged", report.unchanged),
    ],
    "\n"
  );
};

/**
 * The failure a semantic-delta report gates on, if any.
 *
 * **Details**
 *
 * This is the whole gate rule: only findings this branch introduced can fail the lane. Inherited
 * findings sit in `unchanged` — the corpus carries hundreds of them — and findings the branch fixed
 * sit in `resolved`; neither bucket is ever consulted here. Stage-1 evaluators mint `blocking`
 * findings only, so every introduced finding is a blocker.
 *
 * **Example** (A report with nothing introduced does not gate)
 *
 * ```ts
 * import { knowledgeSemanticDeltaFailure } from "@beep/repo-cli/commands/Knowledge/Knowledge.command"
 * import { KnowledgeSemanticDeltaReport } from "@beep/repo-cli/commands/Knowledge/Knowledge.schemas"
 * import * as O from "effect/Option"
 *
 * const report = KnowledgeSemanticDeltaReport.make({
 *   introduced: [],
 *   resolved: [],
 *   unchanged: [],
 *   probePolicy: "enabled",
 * })
 *
 * console.log(O.isNone(knowledgeSemanticDeltaFailure(report))) // true
 * ```
 *
 * @param report - Paired-archive delta produced for the branch under test.
 * @returns The typed failure when the branch introduced findings, `O.none()` otherwise.
 * @category use-cases
 * @since 0.0.0
 */
export const knowledgeSemanticDeltaFailure = (
  report: KnowledgeSemanticDeltaReport
): O.Option<KnowledgeIntroducedFindingsError> =>
  A.isReadonlyArrayNonEmpty(report.introduced)
    ? O.some(
        KnowledgeIntroducedFindingsError.make({
          message: `knowledge semantic-delta: ${A.length(report.introduced)} introduced blocking finding(s).`,
          introducedCount: NonNegativeInt.make(A.length(report.introduced)),
        })
      )
    : O.none();

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
  yield* O.match(knowledgeSemanticDeltaFailure(report), { onNone: () => Effect.void, onSome: Effect.fail });
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
 * **Gotchas**
 *
 * On a pull request from a fork the run declines to execute archive-local probes, and both the human
 * report and the JSON `probePolicy` field say so. Read that line before treating an empty
 * `introduced` bucket as full coverage.
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
