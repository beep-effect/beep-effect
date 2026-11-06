/**
 * The `session register` command group: record and list the units the
 * orchestrator session coordinates.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  convertRegisterRow,
  currentRegisterRow,
  currentRegisterRows,
  mergeRegisterNote,
  RegisterConvertInput,
  RegisterMergeInput,
  RegisterNotePatch,
  RegisterReport,
  RegisterReportJson,
  RegisterUnitKind,
  RegisterUnitState,
  renderRegisterMarkdown,
} from "./Register.schemas.ts";
import { layerOrchestratorRegisterLive, noteRegister, OrchestratorRegister } from "./Register.service.ts";
import { reportSessionFailure, SessionLedgerError, sessionUsageError } from "./Session.errors.ts";
import { sessionCheckoutFacts } from "./SessionLedger.service.ts";

const decodeUnitKind = S.decodeUnknownResult(RegisterUnitKind);
const decodeUnitState = S.decodeUnknownResult(RegisterUnitState);
const decodeInstant = S.decodeUnknownResult(S.DateTimeUtcFromString);

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
  Flag.optional,
  Flag.withDescription(`Coordination state: ${A.join(RegisterUnitState.literals, ", ")}`)
);
const waitingFlag = Flag.String("waiting").pipe(
  Flag.optional,
  Flag.withDescription("What the unit is waiting on the orchestrator for, if anything")
);
const lastContactFlag = Flag.String("last-contact").pipe(
  Flag.optional,
  Flag.withDescription('ISO instant of the last message from or to the unit, or "now"; omitted keeps the current value')
);
const orphanPlanFlag = Flag.String("orphan-plan").pipe(
  Flag.optional,
  Flag.withDescription("What a successor does when it cannot reach the unit; required the first time a unit is added")
);
const noteFlag = Flag.String("note").pipe(Flag.optional, Flag.withDescription("Free text for the successor"));
const markdownFlag = Flag.Boolean("markdown").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Render the register as the Markdown table HANDOFF.md embeds")
);

const splitOwns = (owns: string): ReadonlyArray<string> =>
  A.filter(A.map(Str.split(owns, ","), Str.trim), Str.isNonEmpty);

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
        return yield* sessionUsageError(
          `--kind must be one of ${A.join(RegisterUnitKind.literals, ", ")}; got "${kind}".`
        );
      }
      const decodedState = O.map(state, decodeUnitState);
      const stateValue = O.flatMap(decodedState, Result.getSuccess);
      if (O.isSome(state) && O.isNone(stateValue)) {
        return yield* sessionUsageError(
          `--state must be one of ${A.join(RegisterUnitState.literals, ", ")}; got "${state.value}".`
        );
      }
      if (Str.isEmpty(Str.trim(address))) {
        return yield* sessionUsageError("--address must say how the orchestrator reaches the unit.");
      }
      const now = yield* DateTime.now;
      const contact = O.map(lastContact, (value) =>
        Str.trim(value) === "now" ? O.some(now) : Result.getSuccess(decodeInstant(value))
      );
      if (O.exists(contact, O.isNone)) {
        return yield* sessionUsageError(
          `--last-contact must be an ISO instant or "now"; got "${O.getOrNull(lastContact)}".`
        );
      }
      const patch = RegisterNotePatch.make({
        kind: decodedKind.success,
        address: Str.trim(address),
        name: O.map(name, Str.trim),
        owns: O.map(owns, splitOwns),
        state: stateValue,
        waitingOnOrchestrator: O.map(waiting, Str.trim),
        lastContact: O.flatten(contact),
        orphanPlan: O.map(orphanPlan, Str.trim),
        note: O.map(note, Str.trim),
      });
      const facts = yield* sessionCheckoutFacts(process.cwd());
      const register = yield* OrchestratorRegister;
      const list1 = yield* register.list(facts.repository);
      const prior = currentRegisterRow(list1, patch);
      const resolved = mergeRegisterNote(RegisterMergeInput.make({ prior, patch, now }));
      if (O.isNone(resolved)) {
        return yield* sessionUsageError("--orphan-plan must say what a successor does when it cannot reach the unit.");
      }
      const row = yield* noteRegister(process.cwd(), resolved.value);
      yield* Console.log(`[session] registered ${row.kind} ${row.address} (${row.state})`);
    });
    yield* reportSessionFailure(program);
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
      const list2 = yield* register.list(facts.repository);
      const rows = currentRegisterRows(list2);
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
                  onNone: A.empty<string>,
                  onSome: (waiting) => [`  waiting on orchestrator: ${waiting}`],
                }),
                `  last contact: ${O.match(row.lastContact, { onNone: () => "never", onSome: DateTime.formatIso })}`,
                `  orphan plan: ${row.orphanPlan}`,
              ],
              "\n"
            )
          ),
        { discard: true }
      );
    });
    yield* reportSessionFailure(program);
  })
).pipe(
  Command.withDescription("List every unit the orchestrator coordinates, newest first"),
  Command.provide(layerOrchestratorRegisterLive)
);

const toKindFlag = Flag.String("to-kind").pipe(
  Flag.withDescription(
    `What the unit becomes: ${A.join(
      A.filter(RegisterUnitKind.literals, (kind) => kind !== "in-process-agent"),
      ", "
    )}`
  )
);
const toAddressFlag = Flag.String("to-address").pipe(
  Flag.withDescription("How the successor reaches it now: T3 thread link, job id, unit name, scheduled task id")
);
const briefFlag = Flag.String("brief").pipe(
  Flag.optional,
  Flag.withDescription("Path of the brief written for the unit (task, state, what it owes, how to resume)")
);

const convertRefusalText = {
  "not-registered": "is not registered; add it first",
  "already-retired": "is already retired",
  "target-in-process": "cannot become an in-process-agent: that still dies with this session",
  "same-unit": "is already that unit",
  "target-registered": "cannot take a target that already has a live row",
} as const;

/**
 * Convert a registered unit to a new kind and address: retire the old row and
 * register the new one with the same owns, waiting ask and orphan plan.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { sessionRegisterConvertCommand } from "@beep/repo-cli/test/Session"
 *
 * console.log(sessionRegisterConvertCommand.name) // "convert"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const sessionRegisterConvertCommand = Command.make(
  "convert",
  { kind: kindFlag, address: addressFlag, toKind: toKindFlag, toAddress: toAddressFlag, brief: briefFlag },
  Effect.fn(function* ({ kind, address, toKind, toAddress, brief }) {
    const program = Effect.gen(function* () {
      const from = decodeUnitKind(kind);
      const to = decodeUnitKind(toKind);
      if (from._tag === "Failure" || to._tag === "Failure") {
        return yield* sessionUsageError(
          `--kind and --to-kind must be one of ${A.join(RegisterUnitKind.literals, ", ")}; got "${kind}" and "${toKind}".`
        );
      }
      const source = { kind: from.success, address: Str.trim(address) };
      const targetAddress = Str.trim(toAddress);
      if (Str.isEmpty(source.address) || Str.isEmpty(targetAddress)) {
        return yield* sessionUsageError("--address and --to-address must say how the unit is reached.");
      }
      const facts = yield* sessionCheckoutFacts(process.cwd());
      const register = yield* OrchestratorRegister;
      const rows = yield* register.list(facts.repository);
      const conversion = convertRegisterRow(
        RegisterConvertInput.make({
          source: currentRegisterRow(rows, source),
          target: currentRegisterRow(rows, { kind: to.success, address: targetAddress }),
          toKind: to.success,
          toAddress: targetAddress,
          brief: O.filter(O.map(brief, Str.trim), Str.isNonEmpty),
          now: yield* DateTime.now,
        })
      );
      if (Result.isFailure(conversion)) {
        return yield* sessionUsageError(`${source.kind} ${source.address} ${convertRefusalText[conversion.failure]}.`);
      }
      yield* noteRegister(process.cwd(), conversion.success.retire);
      const row = yield* noteRegister(process.cwd(), conversion.success.successor);
      yield* Console.log(
        `[session] converted ${source.kind} ${source.address} -> ${row.kind} ${row.address} (${row.state})`
      );
    });
    yield* reportSessionFailure(program);
  })
).pipe(
  Command.withDescription(
    "Move a unit that dies with this session (an in-process agent, a poller) to the thread, job, unit or scheduled task that replaced it, keeping its owns, ask and orphan plan"
  ),
  Command.provide(layerOrchestratorRegisterLive)
);

/**
 * The `session register` group: `add`, `list` and `convert`.
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
        '- bun run beep session register add --kind <kind> --address <addr> [--name <label>] [--owns "PR #n, lane x"] [--orphan-plan "<what a successor does>"] [--state active|blocked|unreachable|retired] [--waiting "<ask>"] [--last-contact <iso>|now] [--note "<text>"]',
        "  omitted flags keep the unit's current values; empty text clears a field; --orphan-plan is required the first time",
        "- bun run beep session register list [--json|--markdown]",
        "- bun run beep session register convert --kind <kind> --address <addr> --to-kind <kind> --to-address <addr> [--brief <path>]",
      ],
      "\n"
    )
  )
).pipe(
  Command.withDescription("The orchestrator register: every coordinated unit and its orphan plan"),
  Command.withSubcommands([sessionRegisterAddCommand, sessionRegisterListCommand, sessionRegisterConvertCommand])
);
