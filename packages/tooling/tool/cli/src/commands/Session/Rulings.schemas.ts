/**
 * Operator rulings the orchestrator relays: dated, verbatim, with their
 * source, so `HANDOFF.md`'s "Rulings in force" section is rendered from data
 * instead of retyped at every hand-off.
 *
 * **Details**
 *
 * A ruling is quoted, never paraphrased: a paraphrase drifts into a wider
 * permission. Rows are append-only and keyed by `id`; the newest row per id is
 * the ruling's current state, and a superseded ruling drops out of the
 * rendered table while staying in the file for the record.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { JsonStringCodec } from "@beep/repo-cli-kit/schema/JsonCodec";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { newestPerKey } from "../../internal/state/JsonLinesStore.ts";
import { PrRepository } from "../Yeet/internal/Provenance.ts";

const $I = $RepoCliId.create("commands/Session/Rulings.schemas");

/**
 * Whether a ruling still governs work.
 *
 * **Example** (Narrow a state)
 *
 * ```ts
 * import { RulingState } from "@beep/repo-cli/test/Session"
 *
 * console.log(RulingState.is.superseded("superseded")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RulingState = LiteralKit(["in-force", "superseded"]).pipe(
  $I.annoteSchema("RulingState", { description: "Whether an operator ruling still governs work." })
);

/**
 * Whether a ruling still governs work.
 *
 * @category models
 * @since 0.0.0
 */
export type RulingState = typeof RulingState.Type;

/**
 * A calendar date, `YYYY-MM-DD`: the day the operator gave the ruling.
 *
 * **Example** (Decode a date)
 *
 * ```ts
 * import { RulingDate } from "@beep/repo-cli/test/Session"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(RulingDate)("2026-10-24")) // true
 * console.log(S.is(RulingDate)("Oct 24")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RulingDate = S.String.check(S.isPattern(/^\d{4}-\d{2}-\d{2}$/u)).pipe(
  $I.annoteSchema("RulingDate", { description: "The calendar day a ruling was given, YYYY-MM-DD." })
);

/**
 * A short kebab-case handle for a ruling, the key later rows supersede by.
 *
 * **Example** (Decode an id)
 *
 * ```ts
 * import { RulingId } from "@beep/repo-cli/test/Session"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(RulingId)("constrained-compute-hosted-ci")) // true
 * console.log(S.is(RulingId)("Not An Id")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RulingId = S.String.check(S.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u)).pipe(
  $I.annoteSchema("RulingId", { description: "Kebab-case handle a ruling is keyed and superseded by." })
);

/**
 * One append-only ruling row.
 *
 * **Details**
 *
 * `verbatim` is the operator's wording, quoted; an elision is written `...`
 * and a bracketed insertion marks the relayer's words. `source` says where the
 * wording is kept (an AGENTS.md section, a memory file, a packet history file).
 * `supersededBy` names the ruling that replaced this one.
 *
 * **Example** (Make a row)
 *
 * ```ts
 * import { PrRepository, RulingRow } from "@beep/repo-cli/test/Session"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const row = RulingRow.make({
 *   schemaVersion: "orchestrator-ruling/v1",
 *   repository: PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" }),
 *   id: "only-money-escalates",
 *   date: "2026-10-06",
 *   verbatim: "only money escalates",
 *   source: "AGENTS.md Autonomy",
 *   state: "in-force",
 *   supersededBy: O.none(),
 *   note: O.none(),
 *   recordedBy: O.none(),
 *   recordedAt: DateTime.makeUnsafe(0),
 * })
 * console.log(row.id) // "only-money-escalates"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RulingRow extends S.Opaque<RulingRow, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("orchestrator-ruling/v1"),
    repository: PrRepository,
    id: RulingId,
    date: RulingDate,
    verbatim: S.NonEmptyString,
    source: S.NonEmptyString,
    state: RulingState,
    supersededBy: S.OptionFromNullOr(RulingId),
    note: S.OptionFromNullOr(S.String),
    recordedBy: S.OptionFromNullOr(S.String),
    recordedAt: S.DateTimeUtcFromString,
  }).pipe(
    $I.annoteSchema("RulingRow", {
      description: "One operator ruling the orchestrator relays: dated, verbatim, with its source.",
    })
  )
) {}

/**
 * JSON Lines codec for a ruling row.
 *
 * **Example** (Decode a corrupt line)
 *
 * ```ts
 * import { RulingRowJson } from "@beep/repo-cli/test/Session"
 * import * as O from "effect/Option"
 *
 * console.log(O.isNone(RulingRowJson.decodeOption("{"))) // true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const RulingRowJson = JsonStringCodec(RulingRow);

/**
 * The rulings a successor reads: the newest row per ruling, newest date first.
 *
 * **Example** (An empty report)
 *
 * ```ts
 * import { PrRepository, RulingsReport } from "@beep/repo-cli/test/Session"
 *
 * const report = RulingsReport.make({
 *   schemaVersion: "orchestrator-rulings-report/v1",
 *   repository: PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" }),
 *   rulings: [],
 * })
 * console.log(report.rulings.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RulingsReport extends S.Opaque<RulingsReport, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("orchestrator-rulings-report/v1"),
    repository: PrRepository,
    rulings: S.Array(RulingRow),
  }).pipe($I.annoteSchema("RulingsReport", { description: "The newest row per ruling, newest date first." }))
) {}

/**
 * JSON codec for the rulings report.
 *
 * **Example** (Check the codec)
 *
 * ```ts
 * import { RulingsReportJson } from "@beep/repo-cli/test/Session"
 *
 * console.log(typeof RulingsReportJson.encode) // "function"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const RulingsReportJson = JsonStringCodec(RulingsReport);

const byDateDescending = Order.flip(Order.mapInput(Str.Order, (row: RulingRow) => row.date));

/**
 * Reduce append-only rows to the current rulings: the newest row per id,
 * newest date first, superseded rulings included.
 *
 * **Example** (Reduce no rows)
 *
 * ```ts
 * import { currentRulings } from "@beep/repo-cli/test/Session"
 *
 * console.log(currentRulings([]).length) // 0
 * ```
 *
 * @param rows - Append-only rows as read from the file.
 * @returns The current row per ruling, newest date first.
 * @category models
 * @since 0.0.0
 */
export const currentRulings: (rows: ReadonlyArray<RulingRow>) => ReadonlyArray<RulingRow> = flow(
  newestPerKey<RulingRow>({ key: (row) => row.id, at: (row) => row.recordedAt }),
  A.sort(byDateDescending)
);

/**
 * The rulings still in force: {@link currentRulings} without the superseded ones.
 *
 * **Example** (Reduce no rows)
 *
 * ```ts
 * import { rulingsInForce } from "@beep/repo-cli/test/Session"
 *
 * console.log(rulingsInForce([]).length) // 0
 * ```
 *
 * @param rows - Append-only rows as read from the file.
 * @returns The rulings in force, newest date first.
 * @category models
 * @since 0.0.0
 */
export const rulingsInForce: (rows: ReadonlyArray<RulingRow>) => ReadonlyArray<RulingRow> = flow(
  currentRulings,
  A.filter((row) => RulingState.is["in-force"](row.state))
);

const cell: (value: string) => string = flow(Str.replace(/\|/gu, "\\|"), Str.replace(/\n/gu, " "));

/**
 * Render the rulings in force as the table `HANDOFF.md`'s "Rulings in force"
 * section carries.
 *
 * **Example** (Render no rulings)
 *
 * ```ts
 * import { renderRulingsMarkdown } from "@beep/repo-cli/test/Session"
 *
 * console.log(renderRulingsMarkdown([]).split("\n")[0]) // "| Date | Ruling (verbatim) | Source |"
 * ```
 *
 * @param rows - Append-only rows as read from the file.
 * @returns A GitHub-flavoured Markdown table, header rows first.
 * @category formatting
 * @since 0.0.0
 */
export const renderRulingsMarkdown = (rows: ReadonlyArray<RulingRow>): string =>
  A.join(
    [
      "| Date | Ruling (verbatim) | Source |",
      "| --- | --- | --- |",
      ...A.map(
        rulingsInForce(rows),
        (row) =>
          `| ${row.date} | "${cell(row.verbatim)}"${O.match(row.note, { onNone: () => "", onSome: (note) => ` (${cell(note)})` })} | ${cell(row.source)} |`
      ),
    ],
    "\n"
  );

/**
 * Input for one ruling append before provenance is stamped.
 *
 * **Example** (Describe an append)
 *
 * ```ts
 * import { RulingNoteInput } from "@beep/repo-cli/test/Session"
 * import * as O from "effect/Option"
 *
 * const input = RulingNoteInput.make({
 *   id: "only-money-escalates",
 *   date: "2026-10-06",
 *   verbatim: "only money escalates",
 *   source: "AGENTS.md Autonomy",
 *   state: "in-force",
 *   supersededBy: O.none(),
 *   note: O.none(),
 * })
 * console.log(input.state) // "in-force"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RulingNoteInput extends S.Opaque<RulingNoteInput, { readonly brand: unique symbol }>()(
  S.Struct({
    id: RulingId,
    date: RulingDate,
    verbatim: S.NonEmptyString,
    source: S.NonEmptyString,
    state: RulingState,
    supersededBy: S.Option(RulingId),
    note: S.Option(S.String),
  }).pipe($I.annoteSchema("RulingNoteInput", { description: "Ruling append input before provenance is stamped." }))
) {}
