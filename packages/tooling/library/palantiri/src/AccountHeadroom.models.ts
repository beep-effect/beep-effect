/**
 * Schemas for the account-headroom parcel: the accounts report it reduces
 * from, and the anonymized per-account item it serves.
 *
 * **Details**
 *
 * The input mirrors the `accounts-status/v2` document that
 * `beep accounts status --json` prints, decoded here so this library never imports the CLI. Only
 * the fields the reducer reads are declared; the rest are ignored. The served
 * item carries a provider and a per-provider ordinal, never the account label,
 * login file or identity, which are often email addresses.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PalantiriId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { Freshness } from "./Freshness.ts";
import { ParcelSource } from "./Parcel.models.ts";

const $I = $PalantiriId.create("AccountHeadroom.models");

/**
 * Which plan limit a usage window measures, the same spellings the accounts
 * report uses.
 *
 * **Example** (Narrow a window kind)
 *
 * ```ts
 * import { AccountWindowKind } from "@beep/palantiri/AccountHeadroom.models"
 *
 * console.log(AccountWindowKind.is.weekly("weekly")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AccountWindowKind = LiteralKit(["session", "weekly", "weekly-scoped", "cycle", "cycle-scoped"]).pipe(
  $I.annoteSchema("AccountWindowKind", {
    description: "Session, weekly or billing-cycle limit, optionally scoped to a model group.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type AccountWindowKind = typeof AccountWindowKind.Type;

/**
 * A subscription provider name as the accounts report spells it, such as
 * `claude` or `cursor`.
 *
 * **Example** (Guard a provider name)
 *
 * ```ts
 * import { AccountProviderName } from "@beep/palantiri/AccountHeadroom.models"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AccountProviderName)("grok-bot")) // true
 * console.log(S.is(AccountProviderName)("me@example.com")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AccountProviderName = S.String.check(
  S.isPattern(
    /^[a-z][a-z0-9-]{0,31}$/,
    $I.annote("AccountProviderNamePattern", {
      title: "Account provider name",
      description: "Lowercase letters, digits, and hyphens, starting with a letter.",
      message: "a provider name uses lowercase letters, digits, and hyphens",
    })
  )
).pipe($I.annoteSchema("AccountProviderName", { description: "Subscription provider name on an accounts report." }));

/**
 * @category models
 * @since 0.0.0
 */
export type AccountProviderName = typeof AccountProviderName.Type;

/**
 * **Example** (Decode a report window)
 *
 * ```ts
 * import { AccountsReportWindow } from "@beep/palantiri/AccountHeadroom.models"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const window = await Effect.runPromise(
 *   S.decodeUnknownEffect(AccountsReportWindow)({ kind: "weekly", scope: null, usedPercent: 40, resetsAt: null })
 * )
 * console.log(window.usedPercent) // 40
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AccountsReportWindow extends S.Opaque<AccountsReportWindow, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: AccountWindowKind,
    scope: S.OptionFromNullOr(S.String),
    usedPercent: S.Finite,
    resetsAt: S.OptionFromNullOr(S.DateTimeUtcFromString),
  }).pipe(
    $I.annoteSchema("AccountsReportWindow", {
      description: "One plan-limit window from the accounts report: how full it is and when it resets.",
    })
  )
) {}

/**
 * What one poll of one account produced, as the accounts report carries it.
 *
 * **Details**
 *
 * `Ok.asOf` is set when the reading is not from this poll: a collector
 * snapshot, or the last good reading of an account whose poll just failed.
 * `NeedsLogin` and `Failed` details are not read, because they can name
 * login files.
 *
 * **Example** (Build a failed outcome)
 *
 * ```ts
 * import { AccountsReportOutcome } from "@beep/palantiri/AccountHeadroom.models"
 *
 * console.log(AccountsReportOutcome.cases.Failed.make({})._tag) // "Failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AccountsReportOutcome = S.TaggedUnion({
  Ok: {
    windows: S.Array(AccountsReportWindow),
    asOf: S.OptionFromNullOr(S.DateTimeUtcFromString),
  },
  NeedsLogin: {},
  Failed: {},
}).pipe(
  $I.annoteSchema("AccountsReportOutcome", {
    description: "Result of polling one account, as the accounts report carries it.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type AccountsReportOutcome = typeof AccountsReportOutcome.Type;

/**
 * The account a report row describes. The label is read only to order a
 * provider's accounts; it never leaves the reducer.
 *
 * **Example** (Make a report account)
 *
 * ```ts
 * import { AccountsReportAccount } from "@beep/palantiri/AccountHeadroom.models"
 *
 * console.log(AccountsReportAccount.make({ provider: "codex", label: "work" }).provider) // "codex"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AccountsReportAccount extends S.Opaque<AccountsReportAccount, { readonly brand: unique symbol }>()(
  S.Struct({ provider: AccountProviderName, label: S.NonEmptyString }).pipe(
    $I.annoteSchema("AccountsReportAccount", { description: "Provider and label of one accounts report row." })
  )
) {}

/**
 * **Example** (Make a report row)
 *
 * ```ts
 * import { AccountsReportAccount, AccountsReportOutcome, AccountsReportRow } from "@beep/palantiri/AccountHeadroom.models"
 *
 * const row = AccountsReportRow.make({
 *   usage: { account: AccountsReportAccount.make({ provider: "claude", label: "a" }), outcome: AccountsReportOutcome.cases.Failed.make({}) },
 *   estimated: false
 * })
 * console.log(row.usage.outcome._tag) // "Failed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AccountsReportRow extends S.Opaque<AccountsReportRow, { readonly brand: unique symbol }>()(
  S.Struct({
    usage: S.Struct({ account: AccountsReportAccount, outcome: AccountsReportOutcome }),
    estimated: S.Boolean,
  }).pipe(
    $I.annoteSchema("AccountsReportRow", {
      description: "One accounts report row: the account, its poll outcome, and whether its figures are estimated.",
    })
  )
) {}

/**
 * **Example** (Make an empty panel)
 *
 * ```ts
 * import { AccountsReportGroup } from "@beep/palantiri/AccountHeadroom.models"
 *
 * console.log(AccountsReportGroup.make({ rows: [] }).rows.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AccountsReportGroup extends S.Opaque<AccountsReportGroup, { readonly brand: unique symbol }>()(
  S.Struct({ rows: S.Array(AccountsReportRow) }).pipe(
    $I.annoteSchema("AccountsReportGroup", { description: "One provider panel of the accounts report." })
  )
) {}

/**
 * The accounts report the account-headroom parcel reduces from: the
 * `accounts-status/v2` document, decoded locally.
 *
 * **Example** (Decode a report)
 *
 * ```ts
 * import { AccountsReportInput } from "@beep/palantiri/AccountHeadroom.models"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const report = await Effect.runPromise(
 *   S.decodeUnknownEffect(AccountsReportInput)({
 *     schemaVersion: "accounts-status/v2",
 *     generatedAt: "2026-10-14T12:00:00.000Z",
 *     groups: []
 *   })
 * )
 * console.log(report.groups.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AccountsReportInput extends S.Opaque<AccountsReportInput, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("accounts-status/v2"),
    generatedAt: S.DateTimeUtcFromString,
    groups: S.Array(AccountsReportGroup),
  }).pipe(
    $I.annoteSchema("AccountsReportInput", {
      description: "The accounts-status/v2 report the account-headroom parcel reduces from.",
    })
  )
) {}

/**
 * JSON-string codec for {@link AccountsReportInput}, for snapshot files.
 *
 * **Example** (Decode report text)
 *
 * ```ts
 * import { AccountsReportInputJson } from "@beep/palantiri/AccountHeadroom.models"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const report = await Effect.runPromise(
 *   S.decodeUnknownEffect(AccountsReportInputJson)(
 *     '{"schemaVersion":"accounts-status/v2","generatedAt":"2026-10-14T12:00:00.000Z","groups":[]}'
 *   )
 * )
 * console.log(report.schemaVersion) // "accounts-status/v2"
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const AccountsReportInputJson = S.fromJsonString(AccountsReportInput).pipe(
  $I.annoteSchema("AccountsReportInputJson", { description: "Accounts report decoded from JSON text." })
);

/**
 * What the account-headroom source port serves: the accounts report, and the
 * providers the host has configured, so a provider with no row is caught.
 *
 * **Details**
 *
 * `expectedProviders` are the providers of the host's logins and collector
 * snapshots at read time, or `None` when that listing failed. A provider
 * listed there with no report row, or a missing listing, makes the parcel
 * `Unknown{attribution-incomplete}`.
 *
 * **Example** (Make an input)
 *
 * ```ts
 * import { AccountHeadroomInput, AccountsReportInput } from "@beep/palantiri/AccountHeadroom.models"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const input = AccountHeadroomInput.make({
 *   report: AccountsReportInput.make({ schemaVersion: "accounts-status/v2", generatedAt: DateTime.makeUnsafe(0), groups: [] }),
 *   expectedProviders: O.some(["claude"])
 * })
 * console.log(O.isSome(input.expectedProviders)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AccountHeadroomInput extends S.Opaque<AccountHeadroomInput, { readonly brand: unique symbol }>()(
  S.Struct({ report: AccountsReportInput, expectedProviders: AccountProviderName.pipe(S.Array, S.Option) }).pipe(
    $I.annoteSchema("AccountHeadroomInput", {
      description: "The accounts report and the providers the host has configured, when that listing succeeded.",
    })
  )
) {}

/**
 * **Example** (Narrow an account state)
 *
 * ```ts
 * import { AccountState } from "@beep/palantiri/AccountHeadroom.models"
 *
 * console.log(AccountState.Enum["needs-login"]) // "needs-login"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AccountState = LiteralKit(["ok", "needs-login", "failed"]).pipe(
  $I.annoteSchema("AccountState", {
    description: "Whether an account's poll produced usage, needs a fresh login, or failed.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type AccountState = typeof AccountState.Type;

/**
 * One plan-limit window of a headroom item: how much is left and when it
 * resets.
 *
 * **Example** (Make a headroom window)
 *
 * ```ts
 * import { HeadroomWindow } from "@beep/palantiri/AccountHeadroom.models"
 * import * as O from "effect/Option"
 *
 * const window = HeadroomWindow.make({ kind: "weekly", scope: O.none(), remainingPercent: 60, resetsAt: O.none() })
 * console.log(window.remainingPercent) // 60
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HeadroomWindow extends S.Opaque<HeadroomWindow, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: AccountWindowKind,
    scope: S.OptionFromNullOr(S.String),
    remainingPercent: S.Finite.check(S.isBetween({ minimum: 0, maximum: 100 })),
    resetsAt: S.OptionFromNullOr(S.DateTimeUtcFromString),
  }).pipe(
    $I.annoteSchema("HeadroomWindow", {
      description: "One plan-limit window: percent still unused and when it resets.",
    })
  )
) {}

/**
 * Account-headroom parcel item: one account's remaining quota, identified by
 * provider and a 1-based ordinal within that provider.
 *
 * **Details**
 *
 * The ordinal is the account's position in its provider's label order, so it
 * is stable while the set of logins is stable. No label, login path or
 * identity is carried. `freshness` is the item's own: `Fresh` when its
 * reading is within the parcel bound, `Unknown{stale}` when older, and
 * `Unknown{unreachable}` when the account's poll failed or needs a login.
 *
 * **Example** (Make a headroom item)
 *
 * ```ts
 * import { AccountHeadroom } from "@beep/palantiri/AccountHeadroom.models"
 * import { Freshness } from "@beep/palantiri/Freshness"
 * import * as O from "effect/Option"
 *
 * const item = AccountHeadroom.make({
 *   provider: "claude",
 *   account: 1,
 *   state: "needs-login",
 *   windows: [],
 *   asOf: O.none(),
 *   freshness: Freshness.cases.Unknown.make({ reason: "unreachable", asOf: O.none(), detail: O.some("needs login") }),
 *   sources: ["accounts-poll"]
 * })
 * console.log(item._tag) // "AccountHeadroom"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AccountHeadroom extends S.Opaque<AccountHeadroom, { readonly brand: unique symbol }>()(
  S.TaggedStruct("AccountHeadroom", {
    provider: AccountProviderName,
    account: S.Int.check(S.isGreaterThanOrEqualTo(1)),
    state: AccountState,
    windows: S.Array(HeadroomWindow),
    asOf: S.OptionFromNullOr(S.DateTimeUtcFromString),
    freshness: Freshness,
    sources: S.NonEmptyArray(ParcelSource),
  }).pipe(
    $I.annoteSchema("AccountHeadroom", {
      description: "One account's remaining plan quota, identified by provider and ordinal only.",
    })
  )
) {}
