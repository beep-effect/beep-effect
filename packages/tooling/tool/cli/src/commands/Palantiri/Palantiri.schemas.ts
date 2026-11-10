/**
 * Wire shapes of `beep palantiri mcp` and the hot-parcels file the Claude
 * SessionStart hook prints.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { ParcelBudget, ParcelId, ParcelKey, ParcelSource, SessionKey } from "@beep/palantiri";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Palantiri/Palantiri.schemas");

/**
 * Arguments of a parcel tool: the most items to return.
 *
 * **Example** (Ask for five items)
 *
 * ```ts
 * import { ParcelToolInput } from "@beep/repo-cli/test/Palantiri"
 *
 * console.log(ParcelToolInput.make({ budget: 5 }).budget) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParcelToolInput extends S.Opaque<ParcelToolInput, { readonly brand: unique symbol }>()(
  S.Struct({ budget: S.optionalKey(ParcelBudget) }).pipe(
    $I.annoteSchema("ParcelToolInput", {
      description: "Arguments of a parcel tool: the most items to return (1-500, default 20).",
    })
  )
) {}

/**
 * Arguments of the since-last-check tool: the budget and the session whose
 * read cursor moves.
 *
 * **Example** (Name the session)
 *
 * ```ts
 * import { SinceLastCheckToolInput } from "@beep/repo-cli/test/Palantiri"
 *
 * console.log(SinceLastCheckToolInput.make({ session: "s-1" }).session) // "s-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SinceLastCheckToolInput extends S.Opaque<SinceLastCheckToolInput, { readonly brand: unique symbol }>()(
  S.Struct({ budget: S.optionalKey(ParcelBudget), session: S.optionalKey(SessionKey) }).pipe(
    $I.annoteSchema("SinceLastCheckToolInput", {
      description:
        "Arguments of the since-last-check tool: the budget, and the session whose cursor to read and move (default: the host's CLAUDE_CODE_SESSION_ID or CODEX_THREAD_ID).",
    })
  )
) {}

/**
 * No arguments: the tool reads nothing from its caller.
 *
 * **Example** (Build the empty input)
 *
 * ```ts
 * import { NoToolInput } from "@beep/repo-cli/test/Palantiri"
 *
 * console.log(NoToolInput.make({})) // {}
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NoToolInput extends S.Opaque<NoToolInput, { readonly brand: unique symbol }>()(
  S.Struct({}).pipe($I.annoteSchema("NoToolInput", { description: "A tool that takes no arguments." }))
) {}

/**
 * One parcel as the list tool describes it: id, key, freshness bound, sources
 * and the tool that reads it.
 *
 * **Example** (Describe the account-headroom parcel)
 *
 * ```ts
 * import { ParcelListing } from "@beep/repo-cli/test/Palantiri"
 *
 * const listing = ParcelListing.make({
 *   id: "account-headroom",
 *   key: "account",
 *   freshnessBound: "300s",
 *   sources: ["accounts-poll", "accounts-retained"],
 *   tool: "palantiri_account_headroom"
 * })
 * console.log(listing.tool) // "palantiri_account_headroom"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParcelListing extends S.Opaque<ParcelListing, { readonly brand: unique symbol }>()(
  S.Struct({
    id: ParcelId,
    key: ParcelKey,
    freshnessBound: S.String,
    sources: S.Array(ParcelSource),
    tool: S.String,
  }).pipe(
    $I.annoteSchema("ParcelListing", {
      description: "A parcel's id, key, freshness bound (seconds, or none), sources and MCP tool name.",
    })
  )
) {}

/**
 * Every parcel the MCP host serves.
 *
 * **Example** (An empty catalog)
 *
 * ```ts
 * import { ParcelCatalog } from "@beep/repo-cli/test/Palantiri"
 *
 * console.log(ParcelCatalog.make({ parcels: [] }).parcels.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParcelCatalog extends S.Opaque<ParcelCatalog, { readonly brand: unique symbol }>()(
  S.Struct({ parcels: S.Array(ParcelListing) }).pipe(
    $I.annoteSchema("ParcelCatalog", { description: "Every parcel the Palantiri MCP host serves." })
  )
) {}

/**
 * The parcels `beep session open` pushes: account headroom, lane reds, host
 * pressure and GitHub headroom.
 *
 * **Example** (List the hot parcels)
 *
 * ```ts
 * import { HotParcelId } from "@beep/repo-cli/test/Palantiri"
 *
 * console.log(HotParcelId.literals) // ["account-headroom", "lane-reds", "host-pressure", "github-headroom"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HotParcelId = LiteralKit(["account-headroom", "lane-reds", "host-pressure", "github-headroom"]).pipe(
  $I.annoteSchema("HotParcelId", { description: "A parcel `beep session open` prints." })
);

/**
 * A parcel `beep session open` prints.
 *
 * @category models
 * @since 0.0.0
 */
export type HotParcelId = typeof HotParcelId.Type;

/**
 * How many times a staged hot line may be carried over a failed or timed-out
 * read before it is replaced by an `Unknown` line.
 *
 * **Example** (Read the carry cap)
 *
 * ```ts
 * import { MAX_HOT_LINE_CARRIES } from "@beep/repo-cli/test/Palantiri"
 *
 * console.log(MAX_HOT_LINE_CARRIES) // 3
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_HOT_LINE_CARRIES = 3;

/**
 * How a hot parcel's line came about: read now, timed out, failed, or
 * carried over from an earlier read because this one timed out or failed.
 *
 * **Example** (Narrow a state)
 *
 * ```ts
 * import { HotLineState } from "@beep/repo-cli/test/Palantiri"
 *
 * console.log(HotLineState.is["timed-out"]("timed-out")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HotLineState = LiteralKit(["read", "timed-out", "failed", "carried"]).pipe(
  $I.annoteSchema("HotLineState", {
    description: "How a hot parcel's line came about: read now, timed out, failed, or carried from an earlier read.",
  })
);

/**
 * How a hot parcel's line came about.
 *
 * @category models
 * @since 0.0.0
 */
export type HotLineState = typeof HotLineState.Type;

/**
 * One hot parcel as one line: its summary and freshness, or why it is
 * unknown.
 *
 * **Details**
 *
 * A read line keeps the parcel's summary and its reading's as-of time (the
 * freshness `asOf`, else the read time), so a later timed-out or failed read
 * can carry it as `stale since <asOf>`; `carries` counts how
 * many reads in a row it has been carried, up to
 * {@link MAX_HOT_LINE_CARRIES}.
 *
 * **Example** (A timed-out read)
 *
 * ```ts
 * import { HotParcelLine } from "@beep/repo-cli/test/Palantiri"
 *
 * const line = HotParcelLine.make({ parcel: "lane-reds", state: "timed-out", text: "Unknown (timed out after 2s)" })
 * console.log(line.parcel) // "lane-reds"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HotParcelLine extends S.Opaque<HotParcelLine, { readonly brand: unique symbol }>()(
  S.Struct({
    parcel: HotParcelId,
    state: HotLineState,
    text: S.String,
    summary: S.OptionFromNullOr(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    asOf: S.OptionFromNullOr(S.DateTimeUtcFromString).pipe(S.withConstructorDefault(Effect.succeedNone)),
    carries: S.Int.check(S.isBetween({ minimum: 0, maximum: MAX_HOT_LINE_CARRIES })).pipe(
      S.withConstructorDefault(Effect.succeed(0))
    ),
  }).pipe(
    $I.annoteSchema("HotParcelLine", {
      description:
        "One hot parcel as one line, how it came about, the summary and as-of time of the reading behind it, and how many times it has been carried.",
    })
  )
) {}

/**
 * The hot-parcels file `beep session open` stages for the SessionStart hook,
 * which prints it without running the CLI.
 *
 * **Details**
 *
 * Version 2 added each line's state `carried`, summary, as-of time and carry
 * count. A version 1 file does not decode; it is treated as no previous file,
 * so nothing from it is carried, and the hook skips it.
 *
 * **Example** (Stage one line)
 *
 * ```ts
 * import { HotParcelLine, HotParcels } from "@beep/repo-cli/test/Palantiri"
 * import * as DateTime from "effect/DateTime"
 *
 * const hot = HotParcels.make({
 *   schemaVersion: "palantiri-hot/v2",
 *   writtenAt: DateTime.makeUnsafe("2026-10-15T12:00:00Z"),
 *   lines: [HotParcelLine.make({ parcel: "host-pressure", state: "read", text: "cpu 1.8% stalled" })]
 * })
 * console.log(hot.lines.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HotParcels extends S.Opaque<HotParcels, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("palantiri-hot/v2"),
    writtenAt: S.DateTimeUtcFromString,
    lines: S.Array(HotParcelLine),
  }).pipe(
    $I.annoteSchema("HotParcels", {
      description: "The hot parcels `beep session open` last printed, staged for the SessionStart hook.",
    })
  )
) {}

/**
 * {@link HotParcels} as the JSON text of the staged file.
 *
 * **Example** (Encode a staged file)
 *
 * ```ts
 * import { HotParcels, HotParcelsJson } from "@beep/repo-cli/test/Palantiri"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const text = S.encodeEffect(HotParcelsJson)(
 *   HotParcels.make({ schemaVersion: "palantiri-hot/v2", writtenAt: DateTime.makeUnsafe("2026-10-15T12:00:00Z"), lines: [] })
 * )
 * console.log(Effect.isEffect(text)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HotParcelsJson = S.fromJsonString(HotParcels);
