/**
 * `beep session`: the workstation session ledger commands.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Console, Effect } from "effect";
import * as A from "effect/Array";
import { Command, Flag } from "effect/cli";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { PrNumber } from "../Yeet/internal/Provenance.ts";
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
import {
  openSessionRows,
  SessionLedgerState,
  SessionOpenReport,
  SessionOpenReportJson,
  SessionRole,
  sessionOrchestrator,
} from "./Session.schemas.ts";
import { layerSessionLedgerLive, noteSession, SessionLedger, sessionCheckoutFacts } from "./SessionLedger.service.ts";
import type { SessionLedgerRow } from "./Session.schemas.ts";

const decodeState = S.decodeUnknownResult(SessionLedgerState);
const decodePrNumber = S.decodeUnknownResult(PrNumber);
const decodeRole = S.decodeUnknownResult(SessionRole);
const decodeUnitKind = S.decodeUnknownResult(RegisterUnitKind);
const decodeUnitState = S.decodeUnknownResult(RegisterUnitState);
const decodeInstant = S.decodeUnknownResult(S.DateTimeUtcFromString);

const usage = (message: string): SessionLedgerError => SessionLedgerError.make({ reason: "usage", message });

const reportFailure = <A, R>(effect: Effect.Effect<A, SessionLedgerError, R>) =>
  effect.pipe(Effect.catchTag("SessionLedgerError", (error) => failWithReportedExit(`[session] ${error.message}`)));

/**
 * Render one live row as the operator reads it.
 *
 * **Example** (Render a row)
 *
 * ```ts
 * import { PrRepository, renderSessionRow, SessionLedgerRow } from "@beep/repo-cli/test/Session"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const row = SessionLedgerRow.make({
 *   schemaVersion: "session-ledger/v1",
 *   repository: PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" }),
 *   clone: "/work/beep-effect",
 *   checkout: "/work/beep-effect-worktrees/lane",
 *   lane: "lane",
 *   branch: "feat/lane",
 *   state: "blocked",
 *   next: "operator merges",
 *   summary: O.some("PR is green"),
 *   pr: O.some(12),
 *   harness: "codex",
 *   sessionId: O.none(),
 *   recordedAt: DateTime.makeUnsafe(0),
 * })
 * console.log(renderSessionRow(row).split("\n")[0]) // "- blocked lane (feat/lane, PR #12) 1970-01-01T00:00:00.000Z by codex"
 * ```
 *
 * @param row - A ledger row.
 * @returns Two or three report lines.
 * @category formatting
 * @since 0.0.0
 */
export const renderSessionRow = (row: SessionLedgerRow): string =>
  A.join(
    [
      `- ${row.state} ${row.lane} (${row.branch}${O.match(row.pr, { onNone: () => "", onSome: (pr) => `, PR #${pr}` })}) ${DateTime.formatIso(row.recordedAt)} by ${row.harness}${O.match(row.role, { onNone: () => "", onSome: (role) => ` [${role}]` })}`,
      `  next: ${row.next}`,
      ...O.match(row.summary, { onNone: () => A.empty<string>(), onSome: (summary) => [`  summary: ${summary}`] }),
      `  checkout: ${row.checkout}`,
    ],
    "\n"
  );

const stateFlag = Flag.String("state").pipe(
  Flag.withDefault("open"),
  Flag.withDescription("Where this session stands: open, blocked, or done")
);
const nextFlag = Flag.String("next").pipe(
  Flag.withDescription("The one-line next step a resuming session should take")
);
const summaryFlag = Flag.String("summary").pipe(Flag.optional, Flag.withDescription("What landed, in one line"));
const prFlag = Flag.Int("pr").pipe(Flag.optional, Flag.withDescription("The pull request this checkout carries"));
const roleFlag = Flag.String("role").pipe(
  Flag.optional,
  Flag.withDescription("Fleet role this session holds: orchestrator (the one coordinating session) or member")
);
const jsonFlag = Flag.Boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Emit the report as JSON"));

/**
 * `beep session note`: append where this session stopped.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { sessionNoteCommand } from "@beep/repo-cli/test/Session"
 *
 * console.log(sessionNoteCommand.name) // "note"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const sessionNoteCommand = Command.make(
  "note",
  { state: stateFlag, next: nextFlag, summary: summaryFlag, pr: prFlag, role: roleFlag },
  Effect.fn(function* ({ state, next, summary, pr, role }) {
    const program = Effect.gen(function* () {
      const decodedState = decodeState(state);
      if (decodedState._tag === "Failure") {
        return yield* usage(`--state must be one of ${A.join(SessionLedgerState.literals, ", ")}; got "${state}".`);
      }
      if (Str.isEmpty(Str.trim(next))) {
        return yield* usage("--next must say what a resuming session should do.");
      }
      const prNumber = O.flatMap(pr, (value) => {
        const decoded = decodePrNumber(value);
        return decoded._tag === "Success" ? O.some(decoded.success) : O.none();
      });
      if (O.isSome(pr) && O.isNone(prNumber)) {
        return yield* usage(`--pr must be a positive integer; got ${pr.value}.`);
      }
      const decodedRole = O.map(role, decodeRole);
      if (O.exists(decodedRole, (result) => result._tag === "Failure")) {
        return yield* usage(
          `--role must be one of ${A.join(SessionRole.literals, ", ")}; got "${O.getOrThrow(role)}".`
        );
      }
      const row = yield* noteSession({
        role: O.flatMap(decodedRole, (result) => (result._tag === "Success" ? O.some(result.success) : O.none())),
        cwd: process.cwd(),
        state: decodedState.success,
        next: Str.trim(next),
        summary: O.map(summary, Str.trim),
        pr: prNumber,
      });
      yield* Console.log(
        `[session] noted ${row.state}${O.match(row.role, { onNone: () => "", onSome: (value) => ` [${value}]` })} for ${row.lane} (${row.branch}): ${row.next}`
      );
    });
    yield* reportFailure(program);
  })
).pipe(
  Command.withDescription("Append where this session stopped and what comes next to the workstation ledger"),
  Command.provide(layerSessionLedgerLive)
);

/**
 * `beep session open`: the live rows for this repository, newest first.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { sessionOpenCommand } from "@beep/repo-cli/test/Session"
 *
 * console.log(sessionOpenCommand.name) // "open"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const sessionOpenCommand = Command.make(
  "open",
  { json: jsonFlag },
  Effect.fn(function* ({ json }) {
    const program = Effect.gen(function* () {
      const facts = yield* sessionCheckoutFacts(process.cwd());
      const ledger = yield* SessionLedger;
      const rows = openSessionRows(yield* ledger.list(facts.repository));
      if (json) {
        const report = SessionOpenReport.make({ schemaVersion: "session-open/v1", repository: facts.repository, rows });
        const encoded = yield* SessionOpenReportJson.encode(report).pipe(
          Effect.mapError((cause) =>
            SessionLedgerError.make({ reason: "decode", message: "Failed to encode the session report.", cause })
          )
        );
        // One document on the console, like the other `--json` surfaces that
        // automation decodes as a whole.
        yield* Console.log(encoded);
        return;
      }
      if (!A.isReadonlyArrayNonEmpty(rows)) {
        yield* Console.log(
          `[session] no live sessions recorded for ${facts.repository.owner}/${facts.repository.name}`
        );
        return;
      }
      yield* Console.log(
        `[session] ${A.length(rows)} live session(s) for ${facts.repository.owner}/${facts.repository.name}:`
      );
      yield* Console.log(
        O.match(sessionOrchestrator(rows), {
          onNone: () => "[session] orchestrator: none recorded (take the role with `session note --role orchestrator`)",
          onSome: (row) =>
            `[session] orchestrator: ${row.lane} (${row.branch}) session ${O.getOrElse(row.sessionId, () => "unknown")} since ${DateTime.formatIso(row.recordedAt)}`,
        })
      );
      yield* Effect.forEach(rows, (row) => Console.log(renderSessionRow(row)), { discard: true });
    });
    yield* reportFailure(program);
  })
).pipe(
  Command.withDescription("List where every session on this machine stopped in this repository"),
  Command.provide(layerSessionLedgerLive)
);

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
      const contact = O.map(lastContact, decodeInstant);
      if (O.exists(contact, (result) => result._tag === "Failure")) {
        return yield* usage(`--last-contact must be an ISO instant; got "${O.getOrThrow(lastContact)}".`);
      }
      const now = yield* DateTime.now;
      const row = yield* noteRegister(process.cwd(), {
        kind: decodedKind.success,
        address: Str.trim(address),
        name: O.map(name, Str.trim),
        owns: splitOwns(owns),
        state: decodedState.success,
        waitingOnOrchestrator: O.map(waiting, Str.trim),
        lastContact: O.some(
          O.match(contact, {
            onNone: () => now,
            onSome: (result) => (result._tag === "Success" ? result.success : now),
          })
        ),
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
 * The register command group.
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

/**
 * `beep session`: the session ledger command family.
 *
 * **Example** (Read the family name)
 *
 * ```ts
 * import { sessionCommand } from "@beep/repo-cli/test/Session"
 *
 * console.log(sessionCommand.name) // "session"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const sessionCommand = Command.make("session", {}, () =>
  Console.log(
    A.join(
      [
        "Session commands:",
        '- bun run beep session note --state <open|blocked|done> --next "<one line>" [--summary "<one line>"] [--pr <n>] [--role orchestrator|member]',
        "- bun run beep session open [--json]",
        "- bun run beep session register add|list",
      ],
      "\n"
    )
  )
).pipe(
  Command.withDescription("Record and read where harness sessions stopped across every clone on this machine"),
  Command.withSubcommands([sessionNoteCommand, sessionOpenCommand, sessionRegisterCommand])
);
