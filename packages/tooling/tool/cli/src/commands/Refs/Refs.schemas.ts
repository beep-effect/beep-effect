/**
 * Manifest, refresh receipts, and scheduling inputs for the reference workspace.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import { SystemdUnitPath } from "../../internal/systemd/index.ts";
import { GraftDeepCoverage } from "../Graft/Graft.schemas.ts";

const $I = $RepoCliId.create("commands/Refs/Refs.schemas");
const MemberName = S.NonEmptyString.check(S.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/u));
const RelativeDirectory = S.NonEmptyString.check(S.isPattern(/^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^\p{Cc}]+$/u));

/**
 * Indexing cost selected for an upstream member.
 *
 * **Example** (Select structural indexing)
 * ```ts
 * import { ReferenceTier } from "@beep/repo-cli/commands/Refs"
 * ReferenceTier.is.structural("structural") // => true
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const ReferenceTier = LiteralKit(["deep", "structural"]).pipe(
  $I.annoteSchema("ReferenceTier", { description: "Paid meaning tier or structural-only indexing." })
);
/** Indexing tier of a reference member.
 * @category type-level
 * @since 0.0.0
 */
export type ReferenceTier = typeof ReferenceTier.Type;

/**
 * One pull-only upstream; unknown keys, including branch, are refused.
 *
 * **Example** (Describe a member)
 * ```ts
 * import { ReferenceMember } from "@beep/repo-cli/commands/Refs"
 * import * as O from "effect/Option"
 * ReferenceMember.make({ name: "effect", url: "git@github.com:Effect-TS/effect.git", tier: "deep", onlyDir: O.none() }).name // => "effect"
 * ```
 * @category models
 * @since 0.0.0
 */
export class ReferenceMember extends S.Class<ReferenceMember>($I`ReferenceMember`)(
  {
    name: MemberName,
    url: S.NonEmptyString,
    tier: ReferenceTier,
    onlyDir: RelativeDirectory.pipe(S.Array, S.OptionFromOptionalKey),
  },
  $I.annote("ReferenceMember", { description: "Manifest member refreshed only on clean main." })
) {
  /**
   * Strict boundary decoder; undeclared keys cannot describe unsupported branches.
   *
   * **Example** (Decode a member)
   * ```ts
   * import { ReferenceMember } from "@beep/repo-cli/commands/Refs"
   * import { Effect } from "effect"
   * Effect.isEffect(ReferenceMember.decode({ name: "effect", url: "upstream", tier: "deep" })) // => true
   * ```
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
 * import * as S from "effect/Schema"
 * const decoded = S.decodeUnknownEffect(ReferenceWorkspaceManifest)({ schemaVersion: "beep-references/v1", theme: "effect", rootDefault: "$HOME/refs", workspaceLink: ".repos/effect-workspace", members: [] })
 * console.log(decoded)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ReferenceWorkspaceManifest extends S.Class<ReferenceWorkspaceManifest>($I`ReferenceWorkspaceManifest`)(
  {
    schemaVersion: S.Literal("beep-references/v1"),
    theme: S.Literal("effect"),
    rootDefault: S.NonEmptyString.check(S.isPattern(/^\$HOME\/[^\p{Cc}]+$/u)),
    members: S.Array(ReferenceMember).check(
      S.makeFilter(
        (members) => HashSet.size(HashSet.fromIterable(A.map(members, (member) => member.name))) === A.length(members),
        {
          identifier: $I`UniqueMembers`,
          title: "Unique members",
          description: "Member names identify distinct directories.",
          message: "Member names must be unique.",
        }
      )
    ),
    workspaceLink: S.Literal(".repos/effect-workspace"),
  },
  $I.annote("ReferenceWorkspaceManifest", { description: "The on-disk beep-references/v1 manifest." })
) {
  /**
   * Decodes manifest input with the shared schema.
   *
   * **Example** (Use the compiled decoding codec)
   * ```ts
   * import { ReferenceWorkspaceManifest } from "@beep/repo-cli/commands/Refs"
   * import { Effect } from "effect"
   * Effect.isEffect(ReferenceWorkspaceManifest.decode({ schemaVersion: "beep-references/v1", theme: "effect", rootDefault: "$HOME/refs", workspaceLink: ".repos/effect-workspace", members: [] })) // => true
   * ```
   * @category decoding
   * @since 0.0.0
   */
  static readonly decode = S.decodeEffect(ReferenceWorkspaceManifest);

  /**
   * Serializes a validated manifest to JSON.
   *
   * **Example** (Use the compiled encoding codec)
   * ```ts
   * import { ReferenceWorkspaceManifest } from "@beep/repo-cli/commands/Refs"
   * import { Effect } from "effect"
   * const encoded = ReferenceWorkspaceManifest.decodeJson("{}").pipe(Effect.flatMap(ReferenceWorkspaceManifest.encodeJson))
   * Effect.isEffect(encoded) // => true
   * ```
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
   * import { Effect } from "effect"
   * Effect.isEffect(ReferenceWorkspaceManifest.decodeJson("{}")) // => true
   * ```
   * @category decoding
   * @since 0.0.0
   */
  static readonly decodeJson = S.decodeEffect(S.fromJsonString(ReferenceWorkspaceManifest), {
    onExcessProperty: "error",
  });
}

/**
 * Terminal outcome of one member's pull and build.
 *
 * **Example** (Recognize a skipped member)
 * ```ts
 * import { MemberRefreshOutcome } from "@beep/repo-cli/commands/Refs"
 * MemberRefreshOutcome.is["skipped-dirty"]("skipped-dirty") // => true
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const MemberRefreshOutcome = LiteralKit([
  "pulled",
  "unchanged",
  "skipped-dirty",
  "skipped-off-branch",
  "pull-failed",
  "build-failed",
]).pipe($I.annoteSchema("MemberRefreshOutcome", { description: "Result of refreshing one upstream member." }));
/** Terminal member outcome.
 * @category type-level
 * @since 0.0.0
 */
export type MemberRefreshOutcome = typeof MemberRefreshOutcome.Type;

/**
 * A member receipt, retaining deep-build coverage when available.
 *
 * **Example** (Record a skipped member)
 * ```ts
 * import { MemberRefreshReport } from "@beep/repo-cli/commands/Refs"
 * import * as O from "effect/Option"
 * MemberRefreshReport.make({ name: "effect", outcome: "skipped-dirty", coverage: O.none() }).outcome // => "skipped-dirty"
 * ```
 * @category models
 * @since 0.0.0
 */
export class MemberRefreshReport extends S.Class<MemberRefreshReport>($I`MemberRefreshReport`)(
  { name: MemberName, outcome: MemberRefreshOutcome, coverage: S.OptionFromOptionalKey(GraftDeepCoverage) },
  $I.annote("MemberRefreshReport", { description: "Member outcome and optional parsed deep coverage." })
) {}

/**
 * Workspace build and check results, including bounded diagnostics.
 *
 * **Example** (Record a passing check)
 * ```ts
 * import { ReferenceWorkspaceCheck } from "@beep/repo-cli/commands/Refs"
 * ReferenceWorkspaceCheck.make({ buildExitCode: 0, exitCode: 0, output: "fresh" }).exitCode // => 0
 * ```
 * @category models
 * @since 0.0.0
 */
export class ReferenceWorkspaceCheck extends S.Class<ReferenceWorkspaceCheck>($I`ReferenceWorkspaceCheck`)(
  { buildExitCode: S.Int, exitCode: S.Int, output: S.String },
  $I.annote("ReferenceWorkspaceCheck", { description: "Parent structural build and graft check results." })
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
 * @category models
 * @since 0.0.0
 */
export class RefsRefreshStatus extends S.Class<RefsRefreshStatus>($I`RefsRefreshStatus`)(
  {
    schemaVersion: S.Literal("beep-refs-refresh/v1"),
    timestamp: S.String,
    root: S.NonEmptyString,
    members: S.Array(MemberRefreshReport),
    workspaceCheck: ReferenceWorkspaceCheck,
  },
  $I.annote("RefsRefreshStatus", { description: "One report per manifest member and the workspace check." })
) {
  /**
   * Decodes a saved reference refresh receipt.
   *
   * **Example** (Use the compiled decoding codec)
   * ```ts
   * import { RefsRefreshStatus } from "@beep/repo-cli/commands/Refs"
   * import { Effect } from "effect"
   * Effect.isEffect(RefsRefreshStatus.decodeJson("{}")) // => true
   * ```
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
   * import { Effect } from "effect"
   * const encoded = RefsRefreshStatus.decodeJson("{}").pipe(Effect.flatMap(RefsRefreshStatus.encodeJson))
   * Effect.isEffect(encoded) // => true
   * ```
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
 * @category models
 * @since 0.0.0
 */
export class RefsTimerOptions extends S.Class<RefsTimerOptions>($I`RefsTimerOptions`)(
  {
    owner: SystemdUnitPath,
    root: SystemdUnitPath,
    home: SystemdUnitPath,
    calendar: SystemdUnitPath,
    bunPath: SystemdUnitPath,
  },
  $I.annote("RefsTimerOptions", { description: "Unit-safe owner, root, home, calendar and Bun executable." })
) {
  /**
   * Validates timer input before rendering systemd units.
   *
   * **Example** (Use the compiled decoding codec)
   * ```ts
   * import { RefsTimerOptions } from "@beep/repo-cli/commands/Refs"
   * import { Effect } from "effect"
   * Effect.isEffect(RefsTimerOptions.decode({ owner: "/checkout", root: "/refs", home: "/home/op", calendar: "*-*-* 03:30:00", bunPath: "/usr/bin/bun" })) // => true
   * ```
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
 * @category models
 * @since 0.0.0
 */
export class RefsTimerUnit extends S.Class<RefsTimerUnit>($I`RefsTimerUnit`)(
  { fileName: S.NonEmptyString, text: S.String },
  $I.annote("RefsTimerUnit", { description: "Rendered unit filename and contents." })
) {}
