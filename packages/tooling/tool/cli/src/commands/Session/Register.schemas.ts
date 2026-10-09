/**
 * Orchestrator register rows: every unit the orchestrator session coordinates,
 * recorded so a successor can take the role over without orphaning anything.
 *
 * **Details**
 *
 * The session ledger answers "where did each checkout stop"; it is keyed by
 * checkout and only knows harness sessions. The orchestrator also coordinates
 * things that are not checkouts: in-process subagents, Codex lanes reachable
 * only through PR comments, detached jobs, user-level systemd units, and
 * people. The register is the one list of all of them, keyed by kind and
 * address, with the plan a successor follows when a unit cannot be reached.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { JsonStringCodec } from "../../internal/schema/JsonCodec.ts";
import { newestPerKey } from "../../internal/state/JsonLinesStore.ts";
import { PrRepository } from "../Yeet/internal/Provenance.ts";

const $I = $RepoCliId.create("commands/Session/Register.schemas");

/**
 * What kind of thing the orchestrator coordinates, which decides how a
 * successor reaches it and what dies with the predecessor.
 *
 * **Details**
 *
 * - `desktop-session`: a Claude desktop or Codex session; survives a hand-off
 *   and is reached by session id.
 * - `in-process-agent`: an Agent-tool subagent of the orchestrator; dies with
 *   it and must be converted to a brief plus a session or task chip before
 *   hand-off.
 * - `codex-lane`: a Codex checkout with no session; reached only through PR
 *   comments starting `orchestrator:`.
 * - `background-job`: a yeet proof job, monitor, or watcher; reached by job id.
 * - `systemd-unit`: a `systemd --user` unit; reached by unit name and survives
 *   any session.
 * - `external-person`: the operator or the attorney; reached through the
 *   fleet desk, never chat.
 *
 * **Example** (Narrow a kind)
 *
 * ```ts
 * import { RegisterUnitKind } from "@beep/repo-cli/test/Session"
 *
 * console.log(RegisterUnitKind.is["codex-lane"]("codex-lane")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RegisterUnitKind = LiteralKit([
  "desktop-session",
  "in-process-agent",
  "codex-lane",
  "background-job",
  "systemd-unit",
  "external-person",
]).pipe($I.annoteSchema("RegisterUnitKind", { description: "Kind of unit the orchestrator coordinates." }));

/**
 * Kind of unit the orchestrator coordinates.
 *
 * @category models
 * @since 0.0.0
 */
export type RegisterUnitKind = typeof RegisterUnitKind.Type;

/**
 * Where a coordinated unit stands from the orchestrator's point of view.
 *
 * **Details**
 *
 * `retired` rows drop out of the rendered register. `unreachable` is the
 * state a successor writes when a broadcast or message to the unit's address
 * fails, before executing the row's orphan plan.
 *
 * **Example** (Narrow a state)
 *
 * ```ts
 * import { RegisterUnitState } from "@beep/repo-cli/test/Session"
 *
 * console.log(RegisterUnitState.is.retired("retired")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RegisterUnitState = LiteralKit(["active", "blocked", "unreachable", "retired"]).pipe(
  $I.annoteSchema("RegisterUnitState", { description: "Coordination state of one registered unit." })
);

/**
 * Coordination state of one registered unit.
 *
 * @category models
 * @since 0.0.0
 */
export type RegisterUnitState = typeof RegisterUnitState.Type;

/**
 * One append-only register row describing a coordinated unit.
 *
 * **Details**
 *
 * Rows are keyed by `kind` plus `address` when read back; the newest row per
 * key is that unit's current state. `name` is the human label (the session
 * title, the agent's task); `owns` lists what the unit is responsible
 * for in the orchestrator's vocabulary (`PR #1464`, `lane practice-mail-tagging`,
 * `packet practice-kg-mcp`). `waitingOnOrchestrator` is what the unit is
 * blocked on, empty when it is not blocked on the orchestrator. `orphanPlan`
 * is what a successor does when it cannot reach the unit, and is mandatory
 * because a hand-off without it recreates the orphaning it exists to prevent.
 *
 * **Example** (Make a row)
 *
 * ```ts
 * import { PrRepository, RegisterRow } from "@beep/repo-cli/test/Session"
 * import * as DateTime from "effect/DateTime";
 * import * as O from "effect/Option"
 *
 * const row = RegisterRow.make({
 *   schemaVersion: "orchestrator-register/v1",
 *   repository: PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" }),
 *   kind: "codex-lane",
 *   address: "PR #1468",
 *   name: O.some("yeet REST discovery lane"),
 *   owns: ["PR #1468", "lane yeet-rest-pr-discovery"],
 *   state: "active",
 *   waitingOnOrchestrator: O.none(),
 *   lastContact: O.some(DateTime.makeUnsafe(0)),
 *   orphanPlan: "post 'orchestrator: ...' on the PR; after 2h silence take the PR over in its checkout",
 *   note: O.none(),
 *   recordedBy: O.none(),
 *   recordedAt: DateTime.makeUnsafe(0),
 * })
 * console.log(row.kind) // "codex-lane"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegisterRow extends S.Class<RegisterRow>($I`RegisterRow`)(
  {
    schemaVersion: S.Literal("orchestrator-register/v1"),
    repository: PrRepository,
    kind: RegisterUnitKind,
    address: S.NonEmptyString,
    name: S.OptionFromNullOr(S.String),
    owns: S.Array(S.String),
    state: RegisterUnitState,
    waitingOnOrchestrator: S.OptionFromNullOr(S.String),
    lastContact: S.OptionFromNullOr(S.DateTimeUtcFromString),
    orphanPlan: S.NonEmptyString,
    note: S.OptionFromNullOr(S.String),
    recordedBy: S.OptionFromNullOr(S.String),
    recordedAt: S.DateTimeUtcFromString,
  },
  $I.annote("RegisterRow", {
    description: "One coordinated unit the orchestrator session is responsible for, and how a successor reaches it.",
  })
) {}

/**
 * JSON Lines codec for a register row.
 *
 * **Example** (Encode a row)
 *
 * ```ts
 * import { RegisterRowJson } from "@beep/repo-cli/test/Session"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(RegisterRowJson.encode))
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const RegisterRowJson = JsonStringCodec(RegisterRow);

/**
 * The register as a successor reads it: one row per unit, newest first.
 *
 * **Example** (An empty report)
 *
 * ```ts
 * import { PrRepository, RegisterReport } from "@beep/repo-cli/test/Session"
 *
 * const report = RegisterReport.make({
 *   schemaVersion: "orchestrator-register-report/v1",
 *   repository: PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" }),
 *   rows: [],
 * })
 * console.log(report.rows.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegisterReport extends S.Class<RegisterReport>($I`RegisterReport`)(
  {
    schemaVersion: S.Literal("orchestrator-register-report/v1"),
    repository: PrRepository,
    rows: S.Array(RegisterRow),
  },
  $I.annote("RegisterReport", { description: "The newest non-retired register row per unit, newest first." })
) {}

/**
 * JSON codec for the register report.
 *
 * **Example** (Encode a report)
 *
 * ```ts
 * import { RegisterReportJson } from "@beep/repo-cli/test/Session"
 *
 * console.log(typeof RegisterReportJson.encode) // "function"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const RegisterReportJson = JsonStringCodec(RegisterReport);

// A unit is identified by what it is and where it is reached; the NUL byte keeps the two apart.
const registerUnitKey = (unit: RegisterRow): string => `${unit.kind}\u0000${unit.address}`;

/**
 * Reduce append-only rows to the current register: newest row per unit,
 * retired units dropped, newest first.
 *
 * **Example** (Reduce rows)
 *
 * ```ts
 * import { currentRegisterRows } from "@beep/repo-cli/test/Session"
 *
 * console.log(currentRegisterRows([]).length) // 0
 * ```
 *
 * @param rows - Append-only rows as read from the file.
 * @returns The current register, newest first.
 * @category models
 * @since 0.0.0
 */
export const currentRegisterRows = (rows: ReadonlyArray<RegisterRow>): ReadonlyArray<RegisterRow> =>
  pipe(
    rows,
    newestPerKey<RegisterRow>({ key: registerUnitKey, at: (row) => row.recordedAt }),
    A.filter((row) => !RegisterUnitState.is.retired(row.state))
  );

/**
 * Units a successor must reach first: those blocked on the orchestrator.
 *
 * **Example** (Nothing waiting)
 *
 * ```ts
 * import { registerRowsWaiting } from "@beep/repo-cli/test/Session"
 *
 * console.log(registerRowsWaiting([]).length) // 0
 * ```
 *
 * @param rows - Append-only rows as read from the file.
 * @returns Current rows blocked on the orchestrator.
 * @category models
 * @since 0.0.0
 */
export const registerRowsWaiting = (rows: ReadonlyArray<RegisterRow>): ReadonlyArray<RegisterRow> =>
  A.filter(currentRegisterRows(rows), (row) => O.isSome(row.waitingOnOrchestrator));

const cell = (value: string): string => value.replace(/\|/gu, "\\|").replace(/\n/gu, " ");

const optionCell = (value: O.Option<string>): string => O.getOrElse(value, () => "");

/**
 * Render the current register as the Markdown table HANDOFF.md embeds.
 *
 * **Details**
 *
 * Columns follow the row fields in reading order for a successor: what it is,
 * how to reach it, what it owns, its state, what it waits on, when it was last
 * heard from, and what to do if it cannot be reached. Pipes and newlines in
 * values are escaped so a free-text orphan plan cannot break the table.
 *
 * **Example** (Render an empty register)
 *
 * ```ts
 * import { renderRegisterMarkdown } from "@beep/repo-cli/test/Session"
 *
 * console.log(renderRegisterMarkdown([]).split("\n")[0])
 * // "| kind | address | name | owns | state | waiting on orchestrator | last contact | orphan plan |"
 * ```
 *
 * @param rows - Append-only rows as read from the file.
 * @returns A GitHub-flavoured Markdown table, header rows first.
 * @category formatting
 * @since 0.0.0
 */
export const renderRegisterMarkdown = (rows: ReadonlyArray<RegisterRow>): string =>
  A.join(
    [
      "| kind | address | name | owns | state | waiting on orchestrator | last contact | orphan plan |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |",
      ...A.map(
        currentRegisterRows(rows),
        (row) =>
          `| ${row.kind} | ${cell(row.address)} | ${row.name.pipe(optionCell, cell)} | ${cell(A.join(row.owns, ", "))} | ${row.state} | ${row.waitingOnOrchestrator.pipe(optionCell, cell)} | ${row.lastContact.pipe(O.map(DateTime.formatIso), optionCell)} | ${cell(row.orphanPlan)} |`
      ),
    ],
    "\n"
  );

/**
 * Input for one register append before provenance is stamped.
 *
 * **Example** (Describe an append)
 *
 * ```ts
 * import { RegisterNoteInput } from "@beep/repo-cli/test/Session"
 *
 * console.log(typeof RegisterNoteInput.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegisterNoteInput extends S.Class<RegisterNoteInput>($I`RegisterNoteInput`)(
  {
    kind: RegisterUnitKind,
    address: S.NonEmptyString,
    name: S.Option(S.String),
    owns: S.Array(S.String),
    state: RegisterUnitState,
    waitingOnOrchestrator: S.Option(S.String),
    lastContact: S.Option(S.DateTimeUtcFromString),
    orphanPlan: S.NonEmptyString,
    note: S.Option(S.String),
  },
  $I.annote("RegisterNoteInput", { description: "Register append input before provenance is stamped." })
) {}

/**
 * One `register add` as typed: every field but the unit's key is optional, so
 * a state change does not retype or erase what the register already knows.
 *
 * **Example** (A state-only change)
 *
 * ```ts
 * import { RegisterNotePatch } from "@beep/repo-cli/test/Session"
 * import * as O from "effect/Option"
 *
 * const patch = RegisterNotePatch.make({
 *   kind: "codex-lane",
 *   address: "PR #1468",
 *   name: O.none(),
 *   owns: O.none(),
 *   state: O.some("unreachable"),
 *   waitingOnOrchestrator: O.none(),
 *   lastContact: O.none(),
 *   orphanPlan: O.none(),
 *   note: O.none(),
 * })
 * console.log(patch.address) // "PR #1468"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegisterNotePatch extends S.Class<RegisterNotePatch>($I`RegisterNotePatch`)(
  {
    kind: RegisterUnitKind,
    address: S.NonEmptyString,
    name: S.Option(S.String),
    owns: S.String.pipe(S.Array, S.Option),
    state: S.Option(RegisterUnitState),
    waitingOnOrchestrator: S.Option(S.String),
    lastContact: S.Option(S.DateTimeUtcFromString),
    orphanPlan: S.Option(S.String),
    note: S.Option(S.String),
  },
  $I.annote("RegisterNotePatch", { description: "A register append as typed, with omitted fields left unset." })
) {}

// An empty text value clears the field; an omitted one keeps the prior value.
const patchText = (patch: O.Option<string>, prior: O.Option<string>): O.Option<string> =>
  O.match(patch, { onNone: () => prior, onSome: (value) => O.liftPredicate(value, Str.isNonEmpty) });

/**
 * The question `mergeRegisterNote` answers: the unit's current row, the patch, and the time now.
 *
 * **Example** (Build the question)
 *
 * ```ts
 * import { RegisterMergeInput } from "@beep/repo-cli/test/Session"
 *
 * console.log(typeof RegisterMergeInput.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegisterMergeInput extends S.Class<RegisterMergeInput>($I`RegisterMergeInput`)(
  { prior: S.Option(RegisterRow), patch: RegisterNotePatch, now: S.DateTimeUtcFromString },
  $I.annote("RegisterMergeInput", { description: "A register patch with the unit's current row and the time now." })
) {}

/**
 * Resolve a patch against the unit's current row: omitted fields keep their
 * value, and the last contact moves only when the patch gives one.
 *
 * **Details**
 *
 * A unit seen for the first time takes `active`, no owns, and `now` as its
 * last contact, and must carry an orphan plan: the result is `None` when it
 * has none, because a registered unit without an orphan plan recreates the
 * orphaning the register exists to prevent.
 *
 * **Example** (A first registration needs an orphan plan)
 *
 * ```ts
 * import { mergeRegisterNote, RegisterMergeInput, RegisterNotePatch } from "@beep/repo-cli/test/Session"
 * import * as DateTime from "effect/DateTime";
 * import * as O from "effect/Option"
 *
 * const patch = RegisterNotePatch.make({
 *   kind: "codex-lane",
 *   address: "PR #1",
 *   name: O.none(),
 *   owns: O.none(),
 *   state: O.none(),
 *   waitingOnOrchestrator: O.none(),
 *   lastContact: O.none(),
 *   orphanPlan: O.none(),
 *   note: O.none(),
 * })
 * console.log(O.isNone(mergeRegisterNote(RegisterMergeInput.make({ prior: O.none(), patch, now: DateTime.makeUnsafe(0) })))) // true
 * ```
 *
 * @param input - The unit's current row (if any), the patch, and the time now.
 * @returns The resolved append, or `None` for a new unit with no orphan plan.
 * @category models
 * @since 0.0.0
 */
export const mergeRegisterNote = (input: RegisterMergeInput): O.Option<RegisterNoteInput> => {
  const { prior, patch } = input;
  const from = <A>(pick: (row: RegisterRow) => O.Option<A>): O.Option<A> => O.flatMap(prior, pick);
  return O.map(
    patchText(
      patch.orphanPlan,
      O.map(prior, (row) => row.orphanPlan)
    ),
    (orphanPlan) =>
      RegisterNoteInput.make({
        kind: patch.kind,
        address: patch.address,
        name: patchText(
          patch.name,
          from((row) => row.name)
        ),
        owns: O.getOrElse(patch.owns, () => O.match(prior, { onNone: A.empty<string>, onSome: (row) => row.owns })),
        state: O.getOrElse(patch.state, () =>
          O.match(prior, { onNone: () => RegisterUnitState.Enum.active, onSome: (row) => row.state })
        ),
        waitingOnOrchestrator: patchText(
          patch.waitingOnOrchestrator,
          from((row) => row.waitingOnOrchestrator)
        ),
        lastContact: O.orElse(patch.lastContact, () =>
          O.isSome(prior) ? from((row) => row.lastContact) : O.some(input.now)
        ),
        orphanPlan,
        note: patchText(
          patch.note,
          from((row) => row.note)
        ),
      })
  );
};

/**
 * What identifies a unit in the register: its kind and its address.
 *
 * @category models
 * @since 0.0.0
 */
export type RegisterUnitRef = Pick<RegisterRow, "kind" | "address">;

/**
 * The current row for one unit, if the register has one.
 *
 * **Example** (Nothing registered)
 *
 * ```ts
 * import { currentRegisterRow } from "@beep/repo-cli/test/Session"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(currentRegisterRow([], { kind: "codex-lane", address: "PR #1" }))) // true
 * ```
 *
 * @param rows - Append-only rows as read from the file.
 * @param unit - The unit's kind and address.
 * @returns The newest row for that unit, retired units included.
 * @category models
 * @since 0.0.0
 */
export const currentRegisterRow: {
  (unit: RegisterUnitRef): (rows: ReadonlyArray<RegisterRow>) => O.Option<RegisterRow>;
  (rows: ReadonlyArray<RegisterRow>, unit: RegisterUnitRef): O.Option<RegisterRow>;
} = dual(2, (rows: ReadonlyArray<RegisterRow>, unit: RegisterUnitRef) =>
  A.findFirst(
    newestPerKey<RegisterRow>({ key: registerUnitKey, at: (row) => row.recordedAt })(rows),
    (row) => row.kind === unit.kind && row.address === unit.address
  )
);
