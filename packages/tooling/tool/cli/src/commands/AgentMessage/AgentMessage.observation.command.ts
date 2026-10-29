/**
 * Bounded metadata recovery for existing managed-owner enrollments.
 * @packageDocumentation
 * @since 0.0.0
 */
import { ObservationClaimPopulationReport } from "@beep/repo-ai-metrics/observation-claim-population";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  AgentObservationProvisioned,
  AgentObservationRecovery,
  enrollAgentObservation,
  initializeAgentObservationClaims,
  readAgentObservationPopulation,
  recoverAgentObservation,
} from "./AgentMessage.observation.ts";

const observationDir = Flag.String("observation-dir").pipe(
  Flag.withDescription("Existing private enrollment directory; never created or repaired")
);
const run = (operation: AgentObservationRecovery["operation"]) =>
  Command.make(
    operation,
    { observationDir },
    Effect.fnUntraced(function* ({ observationDir }) {
      const report = yield* recoverAgentObservation(observationDir, operation);
      yield* Console.log(yield* S.encodeEffect(S.fromJsonString(AgentObservationRecovery))(report));
    })
  );

const requestDir = Flag.String("request-dir").pipe(
  Flag.withDescription("Private directory containing explicit request.json; no inferred epoch or attribution")
);
const initialize = Command.make(
  "initialize-claims",
  { requestDir },
  Effect.fnUntraced(function* ({ requestDir }) {
    const receipt = yield* initializeAgentObservationClaims(requestDir);
    yield* Console.log(yield* S.encodeEffect(S.fromJsonString(AgentObservationProvisioned))(receipt));
  })
).pipe(Command.withDescription("Create a NEW independent claim store; never use as recovery for missing evidence"));
const enroll = Command.make(
  "enroll",
  { requestDir, observationDir },
  Effect.fnUntraced(function* ({ requestDir, observationDir }) {
    const receipt = yield* enrollAgentObservation(requestDir, observationDir);
    yield* Console.log(yield* S.encodeEffect(S.fromJsonString(AgentObservationProvisioned))(receipt));
  })
).pipe(
  Command.withDescription("Create a new enrollment against an existing claim store; never overwrite partial output")
);

const population = Command.make(
  "population",
  { requestDir, observationDir, json: Flag.Boolean("json").pipe(Flag.withDefault(false)) },
  Effect.fnUntraced(function* ({ requestDir, observationDir, json }) {
    const report = yield* readAgentObservationPopulation(observationDir, requestDir);
    if (json)
      return yield* Console.log(yield* S.encodeEffect(S.fromJsonString(ObservationClaimPopulationReport))(report));
    yield* Console.log(
      `Managed launch cohort: claims created in [${DateTime.formatIso(report.coverage.populationWindowStart)}, ${DateTime.formatIso(report.coverage.populationWindowEnd)})`
    );
    yield* Console.log(`Independent fence: ${report.evidence.anchor.fenceId}`);
    yield* Console.log(
      `Capture interval: ${DateTime.formatIso(report.evidence.captureStartedAt)} to ${DateTime.formatIso(report.evidence.captureFinishedAt)}`
    );
    for (const row of report.rows) {
      const label = A.findFirst(report.coverage.inventory.routes, (route) => route.routeId === row.routeId).pipe(
        O.map((route) => `${route.harness} / ${route.surface}`),
        O.getOrElse(() => row.routeId)
      );
      yield* Console.log(`${label} (route ${row.routeId})`);
      yield* Console.log(`  Launch intentions: ${row.claims.length}`);
      yield* Console.log(`  Known process starts: ${row.started.length}`);
      yield* Console.log(`  Intentions with an unresolved start: ${row.unresolvedStarts.length}`);
      yield* Console.log(`  Launch denominator: ${row.unresolvedStarts.length > 0 ? "unknown" : row.started.length}`);
      yield* Console.log(`  Historical collector acknowledgments of starts: ${row.receiptedStarts.length}`);
    }
    yield* Console.log(
      "Telemetry event totals, current process liveness and backend visibility remain unknown. Unselected routes are unassessed."
    );
    yield* Console.log(
      "This cohort is limited to the declared independent store. Lifecycle facts may postdate its window; missing acknowledgments do not prove loss."
    );
  })
).pipe(
  Command.withDescription(
    "Read explicit claim-creation cohort; preserve unknown starts, telemetry and backend visibility"
  )
);

/**
 * Inspect or explicitly replay existing observations without launching an agent.
 * **Example** (Inspect the command name)
 * ```ts
 * import { agentMessageObservationCommand } from "@beep/repo-cli/commands/AgentMessage/AgentMessage.observation.command"
 * console.log(agentMessageObservationCommand.name)
 * ```
 * @category cli-commands
 * @since 0.0.0
 */
export const agentMessageObservationCommand = Command.make("observation").pipe(
  Command.withDescription("Inspect durable lifecycle evidence or reconcile at most four original facts"),
  Command.withSubcommands([
    population,
    initialize,
    enroll,
    run("status").pipe(Command.withDescription("Read local facts and historical receipts; no collector request")),
    run("reconcile").pipe(Command.withDescription("Replay exact facts once; no relaunch, epoch change or repair")),
  ])
);
