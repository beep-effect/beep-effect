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
import { SessionLedgerError } from "./Session.errors.ts";
import { openSessionRows, SessionLedgerState, SessionOpenReport, SessionOpenReportJson } from "./Session.schemas.ts";
import { layerSessionLedgerLive, noteSession, SessionLedger, sessionCheckoutFacts } from "./SessionLedger.service.ts";
import type { SessionLedgerRow } from "./Session.schemas.ts";

const decodeState = S.decodeUnknownResult(SessionLedgerState);
const decodePrNumber = S.decodeUnknownResult(PrNumber);

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
 * import { DateTime } from "effect"
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
      `- ${row.state} ${row.lane} (${row.branch}${O.match(row.pr, { onNone: () => "", onSome: (pr) => `, PR #${pr}` })}) ${DateTime.formatIso(row.recordedAt)} by ${row.harness}`,
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
  { state: stateFlag, next: nextFlag, summary: summaryFlag, pr: prFlag },
  Effect.fn(function* ({ state, next, summary, pr }) {
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
      const row = yield* noteSession({
        cwd: process.cwd(),
        state: decodedState.success,
        next: Str.trim(next),
        summary: O.map(summary, Str.trim),
        pr: prNumber,
      });
      yield* Console.log(`[session] noted ${row.state} for ${row.lane} (${row.branch}): ${row.next}`);
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
      yield* Effect.forEach(rows, (row) => Console.log(renderSessionRow(row)), { discard: true });
    });
    yield* reportFailure(program);
  })
).pipe(
  Command.withDescription("List where every session on this machine stopped in this repository"),
  Command.provide(layerSessionLedgerLive)
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
        '- bun run beep session note --state <open|blocked|done> --next "<one line>" [--summary "<one line>"] [--pr <n>]',
        "- bun run beep session open [--json]",
      ],
      "\n"
    )
  )
).pipe(
  Command.withDescription("Record and read where harness sessions stopped across every clone on this machine"),
  Command.withSubcommands([sessionNoteCommand, sessionOpenCommand])
);
