/**
 * `beep session handoff`: render the orchestrator's `HANDOFF.md` from the
 * session ledger, the register, the rulings store, a gate table snapshot and
 * the `STATE.md` journal, keeping every hand-written section.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { XdgBase } from "@beep/xdg/XdgBase";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { HandoffRenderInput, renderHandoff } from "./Handoff.ts";
import { layerOrchestratorRegisterLive, OrchestratorRegister } from "./Register.service.ts";
import { layerOrchestratorRulingsLive, OrchestratorRulings } from "./Rulings.service.ts";
import { reportSessionFailure, SessionLedgerError, sessionStatePlatformError } from "./Session.errors.ts";
import { sessionOrchestrator } from "./Session.schemas.ts";
import { layerSessionLedgerLive, SessionLedger, sessionCheckoutFacts } from "./SessionLedger.service.ts";

/**
 * Environment variable that overrides where `HANDOFF.md` lives.
 *
 * **Example** (Read the variable name)
 *
 * ```ts
 * import { HANDOFF_FILE_ENV } from "@beep/repo-cli/test/Session"
 *
 * console.log(HANDOFF_FILE_ENV) // "BEEP_ORCHESTRATOR_HANDOFF"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const HANDOFF_FILE_ENV = "BEEP_ORCHESTRATOR_HANDOFF";

/**
 * The backup name a write moves the previous `HANDOFF.md` to:
 * `HANDOFF.<UTC instant to the second>.bak.md` beside it.
 *
 * **Example** (Name a backup)
 *
 * ```ts
 * import { handoffBackupName } from "@beep/repo-cli/test/Session"
 * import * as DateTime from "effect/DateTime"
 *
 * console.log(handoffBackupName(DateTime.makeUnsafe("2026-11-06T18:50:05.894Z")))
 * // "HANDOFF.20261106T185005Z.bak.md"
 * ```
 *
 * @param at - The write instant.
 * @returns The backup file name.
 * @category formatting
 * @since 0.0.0
 */
export const handoffBackupName = (at: DateTime.DateTime): string =>
  `HANDOFF.${at.pipe(DateTime.formatIso, Str.slice(0, 19), Str.replace(/[-:]/gu, ""))}Z.bak.md`;

/**
 * The last non-blank line of the `STATE.md` journal, the pointer a successor
 * reads the journal back from.
 *
 * **Example** (Read the last line)
 *
 * ```ts
 * import { lastJournalLine } from "@beep/repo-cli/test/Session"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(lastJournalLine("- first\n- second\n\n"))) // "- second"
 * ```
 *
 * @param journal - The journal text.
 * @returns Its last non-blank line, if any.
 * @category parsing
 * @since 0.0.0
 */
export const lastJournalLine = (journal: string): O.Option<string> =>
  A.findLast(A.map(Str.split(journal, "\n"), Str.trimEnd), Str.isNonEmpty);

const fileFlag = Flag.String("file").pipe(
  Flag.optional,
  Flag.withDescription(
    `HANDOFF.md to render (default: $${HANDOFF_FILE_ENV}, else $XDG_CACHE_HOME/beep/orchestrator/HANDOFF.md)`
  )
);
const gateSnapshotFlag = Flag.String("gate-snapshot").pipe(
  Flag.optional,
  Flag.withDescription("File holding `bun run beep yeet gate-table` output to render as the gate snapshot")
);
const writeFlag = Flag.Boolean("write").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Write the file (the previous one is kept as HANDOFF.<instant>.bak.md); default prints it")
);

const readOptionalFile = Effect.fnUntraced(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readFileString(path).pipe(
    Effect.asSome,
    Effect.catchTag("PlatformError", (error) =>
      error.reason._tag === "NotFound"
        ? Effect.succeed(O.none<string>())
        : error.pipe(sessionStatePlatformError, Effect.fail)
    )
  );
});

const resolveHandoffFile = Effect.fnUntraced(function* (file: O.Option<string>) {
  if (O.isSome(file)) return Str.trim(file.value);
  const resolved = Effect.gen(function* () {
    const configured = yield* Config.option(Config.String(HANDOFF_FILE_ENV));
    if (O.isSome(configured) && Str.isNonEmpty(Str.trim(configured.value))) return Str.trim(configured.value);
    const cache = yield* XdgBase.require("cache");
    return `${cache}/beep/orchestrator/HANDOFF.md`;
  });
  return yield* resolved.pipe(
    Effect.mapError((cause) =>
      SessionLedgerError.make({
        reason: "usage",
        message: `Could not resolve HANDOFF.md: pass --file or set ${HANDOFF_FILE_ENV}.`,
        cause,
      })
    )
  );
});

/**
 * `beep session handoff`: render `HANDOFF.md`, printing it or writing it.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { sessionHandoffCommand } from "@beep/repo-cli/test/Session"
 *
 * console.log(sessionHandoffCommand.name) // "handoff"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const sessionHandoffCommand = Command.make(
  "handoff",
  { file: fileFlag, gateSnapshot: gateSnapshotFlag, write: writeFlag },
  Effect.fn(function* ({ file, gateSnapshot, write }) {
    const program = Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const target = yield* resolveHandoffFile(file);
      const directory = path.dirname(target);
      const facts = yield* sessionCheckoutFacts(process.cwd());
      const ledger = yield* SessionLedger;
      const register = yield* OrchestratorRegister;
      const rulings = yield* OrchestratorRulings;
      const ledgerRows = yield* ledger.list(facts.repository);
      const registerRows = yield* register.list(facts.repository);
      const rulingRows = yield* rulings.list(facts.repository);
      const existing = yield* readOptionalFile(target);
      const journal = yield* readOptionalFile(path.join(directory, "STATE.md"));
      const snapshot = yield* O.match(gateSnapshot, {
        onNone: () => Effect.succeed(O.none<string>()),
        onSome: (snapshotFile) => readOptionalFile(Str.trim(snapshotFile)),
      });
      const writtenAt = yield* DateTime.now;
      const text = renderHandoff(
        HandoffRenderInput.make({
          repository: facts.repository,
          writtenAt,
          holder: sessionOrchestrator(ledgerRows),
          rulings: rulingRows,
          register: registerRows,
          gateSnapshot: snapshot,
          journalLine: O.flatMap(journal, lastJournalLine),
          existing,
        })
      );
      if (!write) {
        yield* Console.log(text);
        return;
      }
      const backup = path.join(directory, handoffBackupName(writtenAt));
      yield* Effect.gen(function* () {
        yield* fs.makeDirectory(directory, { recursive: true, mode: 0o700 });
        yield* O.match(existing, {
          onNone: () => Effect.void,
          onSome: (previous) => fs.writeFileString(backup, previous, { mode: 0o600 }),
        });
        yield* fs.writeFileString(target, text, { mode: 0o600 });
      }).pipe(Effect.mapError(sessionStatePlatformError));
      yield* Console.log(
        `[session] wrote ${target}${O.match(existing, { onNone: () => "", onSome: () => ` (previous kept as ${backup})` })}`
      );
    });
    yield* reportSessionFailure(program);
  })
).pipe(
  Command.withDescription(
    "Render the orchestrator HANDOFF.md: holder, rulings, gate snapshot, register and journal pointer from their files; every hand-written section kept verbatim"
  ),
  Command.provide(Layer.mergeAll(layerSessionLedgerLive, layerOrchestratorRegisterLive, layerOrchestratorRulingsLive))
);
