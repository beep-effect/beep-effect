/**
 * The `session register` command group: record and list the units the
 * orchestrator session coordinates.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Console, Effect } from "effect";
import * as A from "effect/Array";
import { Command, Flag } from "effect/cli";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import {
  currentRegisterRows,
  RegisterReport,
  RegisterReportJson,
  RegisterUnitKind,
  RegisterUnitState,
  renderRegisterMarkdown,
} from "./Register.schemas.ts";
import { layerOrchestratorRegisterLive, noteRegister, OrchestratorRegister } from "./Register.service.ts";
import { SessionLedgerError } from "./Session.errors.ts";
import { sessionCheckoutFacts } from "./SessionLedger.service.ts";

const decodeUnitKind = S.decodeUnknownResult(RegisterUnitKind);
const decodeUnitState = S.decodeUnknownResult(RegisterUnitState);
const decodeInstant = S.decodeUnknownResult(S.DateTimeUtcFromString);

const usage = (message: string): SessionLedgerError => SessionLedgerError.make({ reason: "usage", message });

const reportFailure = <A, R>(effect: Effect.Effect<A, SessionLedgerError, R>) =>
  effect.pipe(Effect.catchTag("SessionLedgerError", (error) => failWithReportedExit(`[session] ${error.message}`)));

const jsonFlag = Flag.Boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Emit the report as JSON"));

const kindFlag = Flag.String("kind").pipe(
  Flag.withDescription(`What the unit is: ${A.join(RegisterUnitKind.literals, ", ")}`)
);
const addressFlag = Flag.String("address").pipe(
  Flag.withDescription("How the orchestrator reaches it: session id, agent id, PR #n, job id, unit name, person")
);
const nameFlag = Flag.String("name").pipe(
  Flag.optional,
  Flag.withDescription("Human label: the session title or the agent's task")
);
const ownsFlag = Flag.String("owns").pipe(
  Flag.optional,
  Flag.withDescription("Comma-separated list of what it owns: PR #n, lane <name>, packet <slug>")
);
const unitStateFlag = Flag.String("state").pipe(
  Flag.withDefault("active"),
  Flag.withDescription(`Coordination state: ${A.join(RegisterUnitState.literals, ", ")}`)
);
const waitingFlag = Flag.String("waiting").pipe(
  Flag.optional,
  Flag.withDescription("What the unit is waiting on the orchestrator for, if anything")
);
const lastContactFlag = Flag.String("last-contact").pipe(
  Flag.optional,
  Flag.withDescription("ISO instant of the last message from or to the unit; defaults to now")
);
const orphanPlanFlag = Flag.String("orphan-plan").pipe(
  Flag.withDescription("What a successor does when it cannot reach the unit")
);
const noteFlag = Flag.String("note").pipe(Flag.optional, Flag.withDescription("Free text for the successor"));
const markdownFlag = Flag.Boolean("markdown").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Render the register as the Markdown table HANDOFF.md embeds")
);

const splitOwns = (owns: O.Option<string>): ReadonlyArray<string> =>
  O.match(owns, {
    onNone: () => A.empty<string>(),
    onSome: (value) => A.filter(A.map(Str.split(value, ","), Str.trim), Str.isNonEmpty),
  });

/**
 * Append one register row for a unit the orchestrator coordinates.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { sessionRegisterAddCommand } from "@beep/repo-cli/test/Session"
 *
 * console.log(sessionRegisterAddCommand.name) // "add"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const sessionRegisterAddCommand = Command.make(
  "add",
  {
    kind: kindFlag,
    address: addressFlag,
    name: nameFlag,
    owns: ownsFlag,
    state: unitStateFlag,
    waiting: waitingFlag,
    lastContact: lastContactFlag,
    orphanPlan: orphanPlanFlag,
    note: noteFlag,
  },
  Effect.fn(function* ({ kind, address, name, owns, state, waiting, lastContact, orphanPlan, note }) {
    const program = Effect.gen(function* () {
      const decodedKind = decodeUnitKind(kind);
      if (decodedKind._tag === "Failure") {
        return yield* usage(`--kind must be one of ${A.join(RegisterUnitKind.literals, ", ")}; got "${kind}".`);
      }
      const decodedState = decodeUnitState(state);
      if (decodedState._tag === "Failure") {
        return yield* usage(`--state must be one of ${A.join(RegisterUnitState.literals, ", ")}; got "${state}".`);
      }
      if (Str.isEmpty(Str.trim(address))) {
        return yield* usage("--address must say how the orchestrator reaches the unit.");
      }
      if (Str.isEmpty(Str.trim(orphanPlan))) {
        return yield* usage("--orphan-plan must say what a successor does when it cannot reach the unit.");
      }
      const contact = O.flatMap(O.map(lastContact, decodeInstant), Result.getSuccess);
      if (O.isSome(lastContact) && O.isNone(contact)) {
        return yield* usage(`--last-contact must be an ISO instant; got "${lastContact.value}".`);
      }
      const now = yield* DateTime.now;
      const row = yield* noteRegister(process.cwd(), {
        kind: decodedKind.success,
        address: Str.trim(address),
        name: O.map(name, Str.trim),
        owns: splitOwns(owns),
        state: decodedState.success,
        waitingOnOrchestrator: O.map(waiting, Str.trim),
        lastContact: O.some(O.getOrElse(contact, () => now)),
        orphanPlan: Str.trim(orphanPlan),
        note: O.map(note, Str.trim),
      });
      yield* Console.log(`[session] registered ${row.kind} ${row.address} (${row.state})`);
    });
    yield* reportFailure(program);
  })
).pipe(
  Command.withDescription(
    "Record a unit the orchestrator coordinates and the plan a successor follows if it is unreachable"
  ),
  Command.provide(layerOrchestratorRegisterLive)
);

/**
 * List the current register: newest row per unit, retired units dropped.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { sessionRegisterListCommand } from "@beep/repo-cli/test/Session"
 *
 * console.log(sessionRegisterListCommand.name) // "list"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const sessionRegisterListCommand = Command.make(
  "list",
  { json: jsonFlag, markdown: markdownFlag },
  Effect.fn(function* ({ json, markdown }) {
    const program = Effect.gen(function* () {
      const facts = yield* sessionCheckoutFacts(process.cwd());
      const register = yield* OrchestratorRegister;
      const rows = currentRegisterRows(yield* register.list(facts.repository));
      if (json) {
        const report = RegisterReport.make({
          schemaVersion: "orchestrator-register-report/v1",
          repository: facts.repository,
          rows,
        });
        const encoded = yield* RegisterReportJson.encode(report).pipe(
          Effect.mapError((cause) =>
            SessionLedgerError.make({ reason: "decode", message: "Failed to encode the register report.", cause })
          )
        );
        yield* Console.log(encoded);
        return;
      }
      if (markdown) {
        yield* Console.log(renderRegisterMarkdown(rows));
        return;
      }
      if (!A.isReadonlyArrayNonEmpty(rows)) {
        yield* Console.log(`[session] register is empty for ${facts.repository.owner}/${facts.repository.name}`);
        return;
      }
      yield* Console.log(`[session] ${A.length(rows)} registered unit(s):`);
      yield* Effect.forEach(
        rows,
        (row) =>
          Console.log(
            A.join(
              [
                `- ${row.kind} ${row.address}${O.match(row.name, { onNone: () => "", onSome: (name) => ` (${name})` })} [${row.state}] owns: ${A.join(row.owns, ", ")}`,
                ...O.match(row.waitingOnOrchestrator, {
                  onNone: () => A.empty<string>(),
                  onSome: (waiting) => [`  waiting on orchestrator: ${waiting}`],
                }),
                `  orphan plan: ${row.orphanPlan}`,
              ],
              "\n"
            )
          ),
        { discard: true }
      );
    });
    yield* reportFailure(program);
  })
).pipe(
  Command.withDescription("List every unit the orchestrator coordinates, newest first"),
  Command.provide(layerOrchestratorRegisterLive)
);

/**
 * The `session register` group: `add` and `list`.
 *
 * **Example** (Read the group name)
 *
 * ```ts
 * import { sessionRegisterCommand } from "@beep/repo-cli/test/Session"
 *
 * console.log(sessionRegisterCommand.name) // "register"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const sessionRegisterCommand = Command.make("register", {}, () =>
  Console.log(
    A.join(
      [
        "Register commands:",
        '- bun run beep session register add --kind <kind> --address <addr> [--name <label>] --owns "PR #n, lane x" --orphan-plan "<what a successor does>" [--state active|blocked|unreachable|retired] [--waiting "<ask>"] [--note "<text>"]',
        "- bun run beep session register list [--json|--markdown]",
      ],
      "\n"
    )
  )
).pipe(
  Command.withDescription("The orchestrator register: every coordinated unit and its orphan plan"),
  Command.withSubcommands([sessionRegisterAddCommand, sessionRegisterListCommand])
);
