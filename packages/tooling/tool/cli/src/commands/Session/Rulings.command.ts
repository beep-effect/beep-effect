/**
 * The `session ruling` command group: record and list the operator rulings
 * the orchestrator relays, verbatim and dated.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  currentRulings,
  RulingDate,
  RulingId,
  RulingNoteInput,
  RulingsReport,
  RulingsReportJson,
  renderRulingsMarkdown,
  rulingsInForce,
} from "./Rulings.schemas.ts";
import { layerOrchestratorRulingsLive, noteRuling, OrchestratorRulings } from "./Rulings.service.ts";
import { reportSessionFailure, SessionLedgerError, sessionUsageError } from "./Session.errors.ts";
import { sessionCheckoutFacts } from "./SessionLedger.service.ts";

const isRulingId = S.is(RulingId);
const isRulingDate = S.is(RulingDate);

const idFlag = Flag.String("id").pipe(
  Flag.withDescription("Kebab-case handle for the ruling, the key a later ruling supersedes it by")
);
const dateFlag = Flag.String("date").pipe(Flag.withDescription("The day the operator gave the ruling, YYYY-MM-DD"));
const verbatimFlag = Flag.String("verbatim").pipe(
  Flag.withDescription("The operator's wording, quoted; mark elisions with ... and insertions with [brackets]")
);
const sourceFlag = Flag.String("source").pipe(
  Flag.withDescription("Where the wording is kept: an AGENTS.md section, a memory file, a packet history file")
);
const supersedesFlag = Flag.String("supersedes").pipe(
  Flag.optional,
  Flag.withDescription("Id of the ruling this one replaces; it is recorded superseded by this one")
);
const noteFlag = Flag.String("note").pipe(
  Flag.optional,
  Flag.withDescription("What the ruling governs, in the relayer's words")
);
const allFlag = Flag.Boolean("all").pipe(Flag.withDefault(false), Flag.withDescription("Include superseded rulings"));
const jsonFlag = Flag.Boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Emit the report as JSON"));
const markdownFlag = Flag.Boolean("markdown").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Render the rulings in force as the table HANDOFF.md carries")
);

const nonEmptyFlag = (value: string, flag: string) =>
  Str.isEmpty(Str.trim(value))
    ? Effect.fail(sessionUsageError(`--${flag} must not be empty.`))
    : Effect.succeed(Str.trim(value));

/**
 * Record one operator ruling, optionally superseding an earlier one.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { sessionRulingAddCommand } from "@beep/repo-cli/test/Session"
 *
 * console.log(sessionRulingAddCommand.name) // "add"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const sessionRulingAddCommand = Command.make(
  "add",
  {
    id: idFlag,
    date: dateFlag,
    verbatim: verbatimFlag,
    source: sourceFlag,
    supersedes: supersedesFlag,
    note: noteFlag,
  },
  Effect.fn(function* ({ id, date, verbatim, source, supersedes, note }) {
    const program = Effect.gen(function* () {
      const rulingId = Str.trim(id);
      if (!isRulingId(rulingId)) {
        return yield* sessionUsageError(`--id must be kebab-case (a-z, 0-9, hyphens); got "${id}".`);
      }
      const rulingDate = Str.trim(date);
      if (!isRulingDate(rulingDate)) {
        return yield* sessionUsageError(`--date must be YYYY-MM-DD; got "${date}".`);
      }
      const wording = yield* nonEmptyFlag(verbatim, "verbatim");
      const where = yield* nonEmptyFlag(source, "source");
      const replaced = O.map(supersedes, Str.trim);
      const facts = yield* sessionCheckoutFacts(process.cwd());
      const rulings = yield* OrchestratorRulings;
      const rows = yield* rulings.list(facts.repository);
      const prior = O.flatMap(replaced, (replacedId) =>
        A.findFirst(currentRulings(rows), (row) => row.id === replacedId)
      );
      if (O.isSome(replaced) && O.isNone(prior)) {
        return yield* sessionUsageError(`--supersedes names "${replaced.value}", which is not recorded.`);
      }
      const row = yield* noteRuling(
        process.cwd(),
        RulingNoteInput.make({
          id: rulingId,
          date: rulingDate,
          verbatim: wording,
          source: where,
          state: "in-force",
          supersededBy: O.none(),
          note: O.filter(O.map(note, Str.trim), Str.isNonEmpty),
        })
      );
      yield* O.match(prior, {
        onNone: () => Effect.void,
        onSome: (old) =>
          noteRuling(
            process.cwd(),
            RulingNoteInput.make({
              id: old.id,
              date: old.date,
              verbatim: old.verbatim,
              source: old.source,
              state: "superseded",
              supersededBy: O.some(row.id),
              note: old.note,
            })
          ),
      });
      yield* Console.log(
        `[session] recorded ruling ${row.id} (${row.date})${O.match(prior, { onNone: () => "", onSome: (old) => `; ${old.id} superseded` })}`
      );
    });
    yield* reportSessionFailure(program);
  })
).pipe(
  Command.withDescription("Record an operator ruling verbatim with its date and source"),
  Command.provide(layerOrchestratorRulingsLive)
);

/**
 * List the rulings in force, newest date first.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { sessionRulingListCommand } from "@beep/repo-cli/test/Session"
 *
 * console.log(sessionRulingListCommand.name) // "list"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const sessionRulingListCommand = Command.make(
  "list",
  { all: allFlag, json: jsonFlag, markdown: markdownFlag },
  Effect.fn(function* ({ all, json, markdown }) {
    const program = Effect.gen(function* () {
      const facts = yield* sessionCheckoutFacts(process.cwd());
      const store = yield* OrchestratorRulings;
      const rows = yield* store.list(facts.repository);
      const shown = all ? currentRulings(rows) : rulingsInForce(rows);
      if (json) {
        const encoded = yield* RulingsReportJson.encode(
          RulingsReport.make({
            schemaVersion: "orchestrator-rulings-report/v1",
            repository: facts.repository,
            rulings: shown,
          })
        ).pipe(
          Effect.mapError((cause) =>
            SessionLedgerError.make({ reason: "decode", message: "Failed to encode the rulings report.", cause })
          )
        );
        yield* Console.log(encoded);
        return;
      }
      if (markdown) {
        yield* Console.log(renderRulingsMarkdown(rows));
        return;
      }
      if (!A.isReadonlyArrayNonEmpty(shown)) {
        yield* Console.log(`[session] no rulings recorded for ${facts.repository.owner}/${facts.repository.name}`);
        return;
      }
      yield* Console.log(`[session] ${A.length(shown)} ruling(s):`);
      yield* Effect.forEach(
        shown,
        (row) =>
          Console.log(
            `- ${row.date} ${row.id} [${row.state}${O.match(row.supersededBy, { onNone: () => "", onSome: (by) => ` by ${by}` })}] "${row.verbatim}" (${row.source})`
          ),
        { discard: true }
      );
    });
    yield* reportSessionFailure(program);
  })
).pipe(
  Command.withDescription("List the operator rulings in force, newest first"),
  Command.provide(layerOrchestratorRulingsLive)
);

/**
 * The `session ruling` group: `add` and `list`.
 *
 * **Example** (Read the group name)
 *
 * ```ts
 * import { sessionRulingCommand } from "@beep/repo-cli/test/Session"
 *
 * console.log(sessionRulingCommand.name) // "ruling"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const sessionRulingCommand = Command.make("ruling", {}, () =>
  Console.log(
    A.join(
      [
        "Ruling commands:",
        '- bun run beep session ruling add --id <kebab-id> --date YYYY-MM-DD --verbatim "<operator wording>" --source "<where it is kept>" [--supersedes <id>] [--note "<scope>"]',
        "- bun run beep session ruling list [--all] [--json|--markdown]",
      ],
      "\n"
    )
  )
).pipe(
  Command.withDescription("Operator rulings the orchestrator relays, verbatim and dated"),
  Command.withSubcommands([sessionRulingAddCommand, sessionRulingListCommand])
);
