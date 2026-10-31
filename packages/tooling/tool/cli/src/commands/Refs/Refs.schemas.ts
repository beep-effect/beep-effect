/**
 * Manifest, refresh receipts, and scheduling inputs for the reference workspace.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import { SystemdUnitPath } from "../../internal/systemd/index.ts";

const $I = $RepoCliId.create("commands/Refs/Refs.schemas");
const MemberName = S.NonEmptyString.check(S.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/u));
const MemberBranch = S.NonEmptyString.check(
  S.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9_-]*(?:\/[a-zA-Z0-9][a-zA-Z0-9_-]*)*$/u)
).pipe(
  $I.annoteSchema("MemberBranch", {
    description: "Reference branch with safe slash-separated alphanumeric, dash, and underscore components.",
  })
);
/**
 * One pull-only upstream on its configured branch, defaulting to main.
 *
 * **Example** (Describe a member)
 * ```ts
 * import { ReferenceMember } from "@beep/repo-cli/commands/Refs"
 * ReferenceMember.make({ name: "effect", url: "git@github.com:Effect-TS/effect.git" }).name // => "effect"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReferenceMember extends S.Opaque<ReferenceMember, { readonly brand: unique symbol }>()(
  S.Struct({
    name: MemberName,
    url: S.NonEmptyString,
    branch: MemberBranch.pipe(
      S.withDecodingDefaultKey(Effect.succeed("main")),
      S.withConstructorDefault(Effect.succeed("main"))
    ),
  }).pipe(
    $I.annoteSchema("ReferenceMember", {
      description: "Manifest member refreshed only when clean and on its configured branch.",
    })
  )
) {
  /**
   * Strict boundary decoder with a main branch default and unknown-key rejection.
   *
   * **Example** (Decode a member)
   * ```ts
   * import { ReferenceMember } from "@beep/repo-cli/commands/Refs"
   * import * as Effect from "effect/Effect";
   * Effect.isEffect(ReferenceMember.decode({ name: "effect", url: "upstream" })) // => true
   * ```
   *
   * @category decoding
   * @since 0.0.0
   */
  static readonly decode = S.decodeUnknownEffect(ReferenceMember, { onExcessProperty: "error" });
}

/**
 * Checked-in membership and home-relative workspace location.
 *
 * **Example** (Inspect the manifest version)
 * ```ts
 * import { ReferenceWorkspaceManifest } from "@beep/repo-cli/commands/Refs"
 * const decoded = ReferenceWorkspaceManifest.decode({ schemaVersion: "beep-references/v1", theme: "effect", rootDefault: "$HOME/refs", workspaceLink: ".repos/effect-workspace", members: [] })
 * console.log(decoded)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReferenceWorkspaceManifest extends S.Opaque<
  ReferenceWorkspaceManifest,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    schemaVersion: S.tag("beep-references/v1"),
    theme: S.tag("effect"),
    rootDefault: S.NonEmptyString.check(
      S.isPattern(/^\$HOME\/[^\p{Cc}]+$/u, {
        arbitraryConstraint: { patterns: [{ source: "^\\$HOME/[a-zA-Z0-9_-]+$", flags: "" }] },
      })
    ),
    members: S.Array(ReferenceMember).check(
      S.makeFilter(
        (members) => HashSet.size(HashSet.fromIterable(A.map(members, (member) => member.name))) === A.length(members),
        $I.annote("UniqueMembers", {
          title: "Unique members",
          description: "Member names identify distinct directories.",
          message: "Member names must be unique.",
          arbitraryConstraint: { uniqueBy: (member: ReferenceMember) => member.name },
        })
      )
    ),
    workspaceLink: S.tag(".repos/effect-workspace"),
  }).pipe($I.annoteSchema("ReferenceWorkspaceManifest", { description: "The on-disk beep-references/v1 manifest." }))
) {
  /**
   * Decodes manifest input with unknown member and manifest fields rejected.
   *
   * **Example** (Use the compiled decoding codec)
   * ```ts
   * import { ReferenceWorkspaceManifest } from "@beep/repo-cli/commands/Refs"
   * import * as Effect from "effect/Effect";
   * Effect.isEffect(ReferenceWorkspaceManifest.decode({ schemaVersion: "beep-references/v1", theme: "effect", rootDefault: "$HOME/refs", workspaceLink: ".repos/effect-workspace", members: [] })) // => true
   * ```
   *
   * @category decoding
   * @since 0.0.0
   */
  static readonly decode = S.decodeUnknownEffect(ReferenceWorkspaceManifest, {
    onExcessProperty: "error",
  });

  /**
   * Serializes a validated manifest to JSON.
   *
   * **Example** (Use the compiled encoding codec)
   * ```ts
   * import { ReferenceWorkspaceManifest } from "@beep/repo-cli/commands/Refs"
   * import * as Effect from "effect/Effect";
   * const encoded = ReferenceWorkspaceManifest.decodeJson("{}").pipe(Effect.flatMap(ReferenceWorkspaceManifest.encodeJson))
   * Effect.isEffect(encoded) // => true
   * ```
   *
   * @category encoding
   * @since 0.0.0
   */
  static readonly encodeJson = S.encodeEffect(S.fromJsonString(ReferenceWorkspaceManifest));

  /**
   * Reads on-disk JSON with unknown member and manifest fields rejected.
   *
   * **Example** (Prepare strict JSON decoding)
   * ```ts
   * import { ReferenceWorkspaceManifest } from "@beep/repo-cli/commands/Refs"
   * import * as Effect from "effect/Effect";
   * Effect.isEffect(ReferenceWorkspaceManifest.decodeJson("{}")) // => true
   * ```
   *
   * @category decoding
   * @since 0.0.0
   */
  static readonly decodeJson = S.decodeEffect(S.fromJsonString(ReferenceWorkspaceManifest), {
    onExcessProperty: "error",
  });
}

/**
 * Terminal outcome of one member's pull.
 *
 * **Example** (Recognize a skipped member)
 * ```ts
 * import { MemberRefreshOutcome } from "@beep/repo-cli/commands/Refs"
 * MemberRefreshOutcome.is["skipped-dirty"]("skipped-dirty") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemberRefreshOutcome = LiteralKit([
  "pulled",
  "unchanged",
  "skipped-dirty",
  "skipped-off-branch",
  "pull-failed",
]).pipe($I.annoteSchema("MemberRefreshOutcome", { description: "Result of refreshing one upstream member." }));
/**
 * Terminal member outcome.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MemberRefreshOutcome = typeof MemberRefreshOutcome.Type;

/**
 * Longest failure detail a member receipt retains, in characters.
 *
 * **Example** (Read the detail bound)
 * ```ts
 * import { MEMBER_REFRESH_DETAIL_MAX_CHARS } from "@beep/repo-cli/commands/Refs"
 * MEMBER_REFRESH_DETAIL_MAX_CHARS // => 2000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MEMBER_REFRESH_DETAIL_MAX_CHARS = 2000;

/**
 * Tail of the failing step's output, bounded so receipts stay small.
 *
 * **Details**
 * Holds the last characters of a failed pull or of the missing-checkout notice.
 *
 * **Example** (Accept a bounded detail)
 * ```ts
 * import { MemberRefreshDetail } from "@beep/repo-cli/commands/Refs"
 * import * as S from "effect/Schema"
 * S.is(MemberRefreshDetail)("git pull --ff-only origin main exited 1") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemberRefreshDetail = S.String.check(S.isMaxLength(MEMBER_REFRESH_DETAIL_MAX_CHARS)).pipe(
  $I.annoteSchema("MemberRefreshDetail", { description: "Bounded tail of a failed step's output." })
);
/**
 * Bounded member failure detail.
 *
 * @category type-level
 * @since 0.0.0
 */
export type MemberRefreshDetail = typeof MemberRefreshDetail.Type;

/**
 * A member receipt, retaining failure detail when available.
 *
 * **Details**
 * `detail` is present for `pull-failed` and absent otherwise.
 *
 * **Example** (Record a skipped member)
 * ```ts
 * import { MemberRefreshReport } from "@beep/repo-cli/commands/Refs"
 * import * as O from "effect/Option"
 * MemberRefreshReport.make({ name: "effect", outcome: "skipped-dirty", detail: O.none() }).outcome // => "skipped-dirty"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MemberRefreshReport extends S.Opaque<MemberRefreshReport, { readonly brand: unique symbol }>()(
  S.Struct({
    name: MemberName,
    outcome: MemberRefreshOutcome,
    detail: S.OptionFromOptionalKey(MemberRefreshDetail),
  }).pipe(
    $I.annoteSchema("MemberRefreshReport", {
      description: "Member outcome and optional failure detail.",
    })
  )
) {}

/**
 * Durable receipt written after a reference refresh.
 *
 * **Example** (Inspect the receipt schema)
 * ```ts
 * import { RefsRefreshStatus } from "@beep/repo-cli/commands/Refs"
 * import * as S from "effect/Schema"
 * S.is(RefsRefreshStatus)({}) // => false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RefsRefreshStatus extends S.Opaque<RefsRefreshStatus, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("beep-refs-refresh/v2"),
    timestamp: S.String,
    root: S.NonEmptyString,
    members: S.Array(MemberRefreshReport),
  }).pipe(
    $I.annoteSchema("RefsRefreshStatus", {
      description: "One pull report per manifest member.",
    })
  )
) {
  /**
   * Decodes a saved reference refresh receipt.
   *
   * **Example** (Use the compiled decoding codec)
   * ```ts
   * import { RefsRefreshStatus } from "@beep/repo-cli/commands/Refs"
   * import * as Effect from "effect/Effect";
   * Effect.isEffect(RefsRefreshStatus.decodeJson("{}")) // => true
   * ```
   *
   * @category decoding
   * @since 0.0.0
   */
  static readonly decodeJson = S.decodeEffect(S.fromJsonString(RefsRefreshStatus));

  /**
   * Serializes a reference refresh receipt to JSON.
   *
   * **Example** (Use the compiled encoding codec)
   * ```ts
   * import { RefsRefreshStatus } from "@beep/repo-cli/commands/Refs"
   * import * as Effect from "effect/Effect";
   * const encoded = RefsRefreshStatus.decodeJson("{}").pipe(Effect.flatMap(RefsRefreshStatus.encodeJson))
   * Effect.isEffect(encoded) // => true
   * ```
   *
   * @category encoding
   * @since 0.0.0
   */
  static readonly encodeJson = S.encodeEffect(S.fromJsonString(RefsRefreshStatus));
}

/**
 * Validated paths and calendar used to render a reference refresh timer.
 *
 * **Example** (Validate a timer configuration)
 * ```ts
 * import { RefsTimerOptions } from "@beep/repo-cli/commands/Refs"
 * RefsTimerOptions.make({ owner: "/checkout", root: "/refs", home: "/home/op", calendar: "*-*-* 03:30:00", bunPath: "/usr/bin/bun" }).calendar // => "*-*-* 03:30:00"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RefsTimerOptions extends S.Opaque<RefsTimerOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    owner: SystemdUnitPath,
    root: SystemdUnitPath,
    home: SystemdUnitPath,
    calendar: SystemdUnitPath,
    bunPath: SystemdUnitPath,
  }).pipe(
    $I.annoteSchema("RefsTimerOptions", { description: "Unit-safe owner, root, home, calendar and Bun executable." })
  )
) {
  /**
   * Validates timer input before rendering systemd units.
   *
   * **Example** (Use the compiled decoding codec)
   * ```ts
   * import { RefsTimerOptions } from "@beep/repo-cli/commands/Refs"
   * import * as Effect from "effect/Effect";
   * Effect.isEffect(RefsTimerOptions.decode({ owner: "/checkout", root: "/refs", home: "/home/op", calendar: "*-*-* 03:30:00", bunPath: "/usr/bin/bun" })) // => true
   * ```
   *
   * @category decoding
   * @since 0.0.0
   */
  static readonly decode = S.decodeEffect(RefsTimerOptions);
}

/**
 * A rendered systemd unit ready for installation.
 *
 * **Example** (Name a unit)
 * ```ts
 * import { RefsTimerUnit } from "@beep/repo-cli/commands/Refs"
 * RefsTimerUnit.make({ fileName: "beep-refs-refresh.timer", text: "[Timer]\n" }).fileName // => "beep-refs-refresh.timer"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RefsTimerUnit extends S.Opaque<RefsTimerUnit, { readonly brand: unique symbol }>()(
  S.Struct({ fileName: S.NonEmptyString, text: S.String }).pipe(
    $I.annoteSchema("RefsTimerUnit", { description: "Rendered unit filename and contents." })
  )
) {}
