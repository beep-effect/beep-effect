/**
 * Orchestrator register rows: every unit the orchestrator session coordinates,
 * recorded so a successor can take the role over without orphaning anything.
 *
 * **Details**
 *
 * The session ledger answers "where did each checkout stop"; it is keyed by
 * checkout and only knows harness sessions. The orchestrator also coordinates
 * things that are not checkouts: in-process subagents, Codex lanes, detached
 * jobs, user-level systemd units, T3 scheduled tasks, and people. The register is the one list of all of them, keyed by kind and
 * address, with the plan a successor follows when a unit cannot be reached.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { JsonStringCodec } from "@beep/repo-cli-kit/schema/JsonCodec";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import { dual, flow } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { newestPerKey } from "../../internal/state/JsonLinesStore.ts";
import { PrRepository } from "../Yeet/internal/Provenance.ts";

const $I = $RepoCliId.create("commands/Session/Register.schemas");

/**
 * What kind of thing the orchestrator coordinates, which decides how a
 * successor reaches it and what dies with the predecessor.
 *
 * **Details**
 *
 * - `desktop-session`: a Claude, Codex or other harness session; survives a
 *   hand-off and is reached by its T3 thread link when T3 launched it.
 * - `in-process-agent`: a native subagent of the orchestrator; dies with it
 *   and must be converted (`session register convert`) to a brief plus a T3
 *   thread, job, unit or scheduled task before hand-off.
 * - `codex-lane`: a Codex checkout; reached by its T3 thread link when T3
 *   launched it, otherwise not messageable and read through its PR, brief or
 *   job receipt (PR comments are not a messaging route, 2026-11-02).
 * - `background-job`: a yeet proof job, monitor, or watcher; reached by job id.
 * - `systemd-unit`: a `systemd --user` unit; reached by unit name and survives
 *   any session.
 * - `scheduled-task`: a T3 `schedule_task` bound to the orchestrator's thread;
 *   reached by task id, and re-created on the successor's thread at take-over.
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
  "scheduled-task",
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
 *   orphanPlan: "read the PR and its job receipt; take over only after an explicit release",
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
export class RegisterRow extends S.Opaque<RegisterRow, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("orchestrator-register/v1"),
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
  }).pipe(
    $I.annoteSchema("RegisterRow", {
      description: "One coordinated unit the orchestrator session is responsible for, and how a successor reaches it.",
    })
  )
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
export class RegisterReport extends S.Opaque<RegisterReport, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("orchestrator-register-report/v1"),
    repository: PrRepository,
    rows: S.Array(RegisterRow),
  }).pipe(
    $I.annoteSchema("RegisterReport", { description: "The newest non-retired register row per unit, newest first." })
  )
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
export const currentRegisterRows: (rows: ReadonlyArray<RegisterRow>) => ReadonlyArray<RegisterRow> = flow(
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

const cell = (value: string): string => Str.replace(/\n/gu, " ")(Str.replace(/\|/gu, "\\|")(value));

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
export class RegisterNoteInput extends S.Opaque<RegisterNoteInput, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: RegisterUnitKind,
    address: S.NonEmptyString,
    name: S.Option(S.String),
    owns: S.Array(S.String),
    state: RegisterUnitState,
    waitingOnOrchestrator: S.Option(S.String),
    lastContact: S.Option(S.DateTimeUtcFromString),
    orphanPlan: S.NonEmptyString,
    note: S.Option(S.String),
  }).pipe($I.annoteSchema("RegisterNoteInput", { description: "Register append input before provenance is stamped." }))
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
export class RegisterNotePatch extends S.Opaque<RegisterNotePatch, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: RegisterUnitKind,
    address: S.NonEmptyString,
    name: S.Option(S.String),
    owns: S.String.pipe(S.Array, S.Option),
    state: S.Option(RegisterUnitState),
    waitingOnOrchestrator: S.Option(S.String),
    lastContact: S.Option(S.DateTimeUtcFromString),
    orphanPlan: S.Option(S.String),
    note: S.Option(S.String),
  }).pipe(
    $I.annoteSchema("RegisterNotePatch", { description: "A register append as typed, with omitted fields left unset." })
  )
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
export class RegisterMergeInput extends S.Opaque<RegisterMergeInput, { readonly brand: unique symbol }>()(
  S.Struct({ prior: S.Option(RegisterRow), patch: RegisterNotePatch, now: S.DateTimeUtcFromString }).pipe(
    $I.annoteSchema("RegisterMergeInput", {
      description: "A register patch with the unit's current row and the time now.",
    })
  )
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

/**
 * Why `session register convert` refused: the source unit is not registered
 * or already retired, the target would still die with the session, the
 * target is the source, or the target already has a live row.
 *
 * **Example** (Narrow a refusal)
 *
 * ```ts
 * import { RegisterConvertRefusal } from "@beep/repo-cli/test/Session"
 *
 * console.log(RegisterConvertRefusal.is["target-in-process"]("target-in-process")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RegisterConvertRefusal = LiteralKit([
  "not-registered",
  "already-retired",
  "target-in-process",
  "same-unit",
  "target-registered",
]).pipe($I.annoteSchema("RegisterConvertRefusal", { description: "Why a register conversion was refused." }));

/**
 * Why a register conversion was refused.
 *
 * @category models
 * @since 0.0.0
 */
export type RegisterConvertRefusal = typeof RegisterConvertRefusal.Type;

/**
 * The question `convertRegisterRow` answers: the source unit's current row,
 * the target's current row, where the unit moves, the brief written for it,
 * and the time now.
 *
 * **Example** (Describe a conversion)
 *
 * ```ts
 * import { RegisterConvertInput } from "@beep/repo-cli/test/Session"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const input = RegisterConvertInput.make({
 *   source: O.none(),
 *   target: O.none(),
 *   toKind: "background-job",
 *   toAddress: "yeet job 94d95b04",
 *   brief: O.none(),
 *   now: DateTime.makeUnsafe(0),
 * })
 * console.log(input.toKind) // "background-job"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegisterConvertInput extends S.Opaque<RegisterConvertInput, { readonly brand: unique symbol }>()(
  S.Struct({
    source: S.Option(RegisterRow),
    target: S.Option(RegisterRow),
    toKind: RegisterUnitKind,
    toAddress: S.NonEmptyString,
    brief: S.Option(S.NonEmptyString),
    now: S.DateTimeUtcFromString,
  }).pipe(
    $I.annoteSchema("RegisterConvertInput", {
      description: "A register conversion: the unit's rows, where it moves, its brief, and the time now.",
    })
  )
) {}

/**
 * The two appends one conversion makes: the source unit retired with a
 * pointer to where it went, and the target registered with everything the
 * source carried.
 *
 * **Example** (Read a conversion)
 *
 * ```ts
 * import { RegisterConversion } from "@beep/repo-cli/test/Session"
 *
 * console.log(typeof RegisterConversion.make) // "function"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegisterConversion extends S.Opaque<RegisterConversion, { readonly brand: unique symbol }>()(
  S.Struct({ retire: RegisterNoteInput, successor: RegisterNoteInput }).pipe(
    $I.annoteSchema("RegisterConversion", {
      description: "The retire row for the source unit and the first row for the unit it became.",
    })
  )
) {}

const describeUnit = (unit: RegisterUnitRef): string => `${unit.kind} ${unit.address}`;

const refuseWhen = (
  condition: boolean,
  refusal: RegisterConvertRefusal
): Result.Result<void, RegisterConvertRefusal> => (condition ? Result.fail(refusal) : Result.void);

/**
 * Move a unit to a new kind and address in one step, so an in-process agent
 * converted at hand-off keeps its owns, its pending ask and its orphan plan.
 *
 * **Details**
 *
 * The source row is retired with a note naming the target; the target row
 * starts `active` with the source's name, owns, waiting ask and orphan plan,
 * `now` as its last contact, and a note naming the source and the brief.
 * Refused when the source has no row or is already retired, when the target
 * kind is `in-process-agent` (that would still die with the session), when
 * source and target are the same unit, or when the target already has a live
 * row (a conversion never overwrites another unit).
 *
 * **Example** (An unregistered source is refused)
 *
 * ```ts
 * import { convertRegisterRow, RegisterConvertInput } from "@beep/repo-cli/test/Session"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 *
 * const result = convertRegisterRow(
 *   RegisterConvertInput.make({
 *     source: O.none(),
 *     target: O.none(),
 *     toKind: "background-job",
 *     toAddress: "yeet job 94d95b04",
 *     brief: O.none(),
 *     now: DateTime.makeUnsafe(0),
 *   })
 * )
 * console.log(Result.isFailure(result) ? result.failure : "converted") // "not-registered"
 * ```
 *
 * @param input - The unit's current rows, its target, its brief and the time now.
 * @returns The two appends, or why the conversion was refused.
 * @category models
 * @since 0.0.0
 */
export const convertRegisterRow = (
  input: RegisterConvertInput
): Result.Result<RegisterConversion, RegisterConvertRefusal> =>
  Result.fromOption(input.source, () => RegisterConvertRefusal.Enum["not-registered"]).pipe(
    Result.flatMap((source) => {
      const target: RegisterUnitRef = { kind: input.toKind, address: input.toAddress };
      return Result.all([
        refuseWhen(RegisterUnitState.is.retired(source.state), RegisterConvertRefusal.Enum["already-retired"]),
        refuseWhen(
          RegisterUnitKind.is["in-process-agent"](input.toKind),
          RegisterConvertRefusal.Enum["target-in-process"]
        ),
        refuseWhen(
          source.kind === target.kind && source.address === target.address,
          RegisterConvertRefusal.Enum["same-unit"]
        ),
        refuseWhen(
          O.exists(input.target, (row) => !RegisterUnitState.is.retired(row.state)),
          RegisterConvertRefusal.Enum["target-registered"]
        ),
      ]).pipe(
        Result.map(() =>
          RegisterConversion.make({
            retire: RegisterNoteInput.make({
              kind: source.kind,
              address: source.address,
              name: source.name,
              owns: source.owns,
              state: RegisterUnitState.Enum.retired,
              waitingOnOrchestrator: source.waitingOnOrchestrator,
              lastContact: source.lastContact,
              orphanPlan: source.orphanPlan,
              note: O.some(`converted to ${describeUnit(target)}`),
            }),
            successor: RegisterNoteInput.make({
              kind: target.kind,
              address: target.address,
              name: source.name,
              owns: source.owns,
              state: RegisterUnitState.Enum.active,
              waitingOnOrchestrator: source.waitingOnOrchestrator,
              lastContact: O.some(input.now),
              orphanPlan: source.orphanPlan,
              note: O.some(
                A.join(
                  [
                    `converted from ${describeUnit(source)}`,
                    ...O.match(input.brief, { onNone: A.empty<string>, onSome: (brief) => [`brief ${brief}`] }),
                  ],
                  "; "
                )
              ),
            }),
          })
        )
      );
    })
  );
