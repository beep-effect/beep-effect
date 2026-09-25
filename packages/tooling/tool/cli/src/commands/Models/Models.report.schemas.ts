/**
 * Report-side data model for the `beep models` command group.
 *
 * **Details**
 *
 * A `beep models check` run answers one question per locator: does the value
 * the file holds match the value the manifest and catalog say it should hold.
 * Every answer is a {@link DriftFinding} carrying the locator that produced
 * it, so a report is reproducible without re-reading the manifest, and a
 * write-mode run can act on a finding directly.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { RunMode } from "../../internal/cli/RunMode.ts";
import { CatalogDiff, CatalogSnapshotSummary, ModelId } from "./Models.catalog.schemas.ts";
import { Locator, TargetId } from "./Models.manifest.schemas.ts";
import type { RunMode as RunModeValue } from "../../internal/cli/RunMode.ts";

const $I = $RepoCliId.create("commands/Models/Models.report.schemas");

/**
 * Command execution mode for `beep models`.
 *
 * **Details**
 *
 * Reuses the shared repo-cli run mode rather than minting a fourth private
 * copy. The default is `check`; `write` copies each touched home file to
 * `$HOME/.config-backups/` before rewriting.
 *
 * **Example** (Decode a run mode)
 *
 * ```ts
 * import { ModelsRunMode } from "@beep/repo-cli/commands/Models/Models.report.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ModelsRunMode)("dry-run")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ModelsRunMode = RunMode;

/**
 * Command execution mode for `beep models`.
 *
 * @see {@link ModelsRunMode} for runtime decoding and guards.
 * @category type-level
 * @since 0.0.0
 */
export type ModelsRunMode = RunModeValue;

const DriftKindKit = LiteralKit(["stale", "missing-file", "missing-locator", "invalid-effort", "unknown-model"]);

/**
 * Why one locator did not match the manifest.
 *
 * **Details**
 *
 * The five kinds are deliberately distinct repairs, not severities. `stale` is
 * a rewrite. `missing-file` and `missing-locator` mean the projection has
 * nowhere to write and the target definition is wrong. `invalid-effort` means
 * the manifest names an effort the surface or the model's ladder cannot
 * express — an operator edit, never an automatic fix. `unknown-model` means
 * the pinned id is absent from the catalog, which after a hard upstream delete
 * is the retirement signal.
 *
 * **Example** (Guard a drift kind)
 *
 * ```ts
 * import { DriftKind } from "@beep/repo-cli/commands/Models/Models.report.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(DriftKind)("invalid-effort")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DriftKind = DriftKindKit.pipe(
  $I.annoteSchema("DriftKind", {
    description: "Why one locator did not match the manifest, classified by the repair it needs.",
  })
);

/**
 * Why one locator did not match the manifest.
 *
 * @see {@link DriftKind} for runtime decoding and guards.
 * @category type-level
 * @since 0.0.0
 */
export type DriftKind = typeof DriftKind.Type;

/**
 * Derived per-literal guards for {@link DriftKind}.
 *
 * **Example** (Separate operator-only findings)
 *
 * ```ts
 * import { DriftKindIs } from "@beep/repo-cli/commands/Models/Models.report.schemas"
 *
 * console.log(DriftKindIs["invalid-effort"]("invalid-effort")) // true
 * console.log(DriftKindIs.stale("invalid-effort")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const DriftKindIs = DriftKindKit.is;

/**
 * Literal option tuple for {@link DriftKind}.
 *
 * **Example** (Enumerate drift kinds)
 *
 * ```ts
 * import { DriftKindOptions } from "@beep/repo-cli/commands/Models/Models.report.schemas"
 *
 * console.log(DriftKindOptions.length) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DriftKindOptions = DriftKindKit.Options;

const CatalogDiffScopeKit = LiteralKit(["full", "suppressed-offline"]);

/**
 * How much of the catalog diff a check run actually computed.
 *
 * **Details**
 *
 * `full` means the report's {@link ModelsCheckReport.diff} was computed against
 * the recorded online baseline and an empty diff therefore means the catalog
 * did not move. `suppressed-offline` means the run had no upstream layer to
 * compare with, so the diff was left empty on purpose and says nothing about
 * upstream churn.
 *
 * **Example** (Guard a diff scope)
 *
 * ```ts
 * import { CatalogDiffScope } from "@beep/repo-cli/commands/Models/Models.report.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CatalogDiffScope)("suppressed-offline")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CatalogDiffScope = CatalogDiffScopeKit.pipe(
  $I.annoteSchema("CatalogDiffScope", {
    description: "Whether a check run computed the catalog diff or suppressed it because the run was offline.",
  })
);

/**
 * How much of the catalog diff a check run actually computed.
 *
 * @see {@link CatalogDiffScope} for runtime decoding and guards.
 * @category type-level
 * @since 0.0.0
 */
export type CatalogDiffScope = typeof CatalogDiffScope.Type;

/**
 * Derived per-literal guards for {@link CatalogDiffScope}.
 *
 * **Example** (Separate a suppressed diff from a real one)
 *
 * ```ts
 * import { CatalogDiffScopeIs } from "@beep/repo-cli/commands/Models/Models.report.schemas"
 *
 * console.log(CatalogDiffScopeIs["suppressed-offline"]("suppressed-offline")) // true
 * console.log(CatalogDiffScopeIs.full("suppressed-offline")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const CatalogDiffScopeIs = CatalogDiffScopeKit.is;

/**
 * Literal option tuple for {@link CatalogDiffScope}.
 *
 * **Example** (Enumerate diff scopes)
 *
 * ```ts
 * import { CatalogDiffScopeOptions } from "@beep/repo-cli/commands/Models/Models.report.schemas"
 *
 * console.log(CatalogDiffScopeOptions.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CatalogDiffScopeOptions = CatalogDiffScopeKit.Options;

/**
 * One locator whose file value does not match the manifest.
 *
 * **Details**
 *
 * `current` is `None` when there is nothing to compare — a missing file or a
 * locator that matched nothing — which is what keeps `missing-*` findings from
 * having to invent an empty-string "current value".
 *
 * **Example** (Record a stale pin)
 *
 * ```ts
 * import { DriftFinding } from "@beep/repo-cli/commands/Models/Models.report.schemas"
 * import { TargetId } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const finding = DriftFinding.make({
 *   targetId: S.decodeUnknownSync(TargetId)("home.codex.config"),
 *   path: "$HOME/.codex/config.toml",
 *   locator: {
 *     _tag: "toml-top-level-key",
 *     binding: { role: "codex.heavy", surface: "codex-cli", field: "effort" },
 *     render: { _tag: "verbatim" },
 *     key: "model_reasoning_effort"
 *   },
 *   current: O.some("xhigh"),
 *   expected: "medium",
 *   kind: "stale"
 * })
 * console.log(finding.kind) // "stale"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DriftFinding extends S.Class<DriftFinding>($I`DriftFinding`)(
  {
    targetId: TargetId,
    path: S.NonEmptyString,
    locator: Locator,
    current: S.OptionFromOptionalKey(S.String),
    expected: S.NonEmptyString,
    kind: DriftKind,
  },
  $I.annote("DriftFinding", {
    description: "One locator whose file value does not match the manifest, with the repair it needs.",
  })
) {}

/**
 * The whole result of a `beep models check` run.
 *
 * **Details**
 *
 * `hasDrift` is carried rather than recomputed from `findings` because the
 * systemd timer reads a persisted report and fires a critical notification on
 * that one field; a consumer must not have to re-derive the verdict from a
 * shape that may grow more finding kinds.
 * `candidates` names routable Codex ids without any manifest binding (R2).
 * These are informational proposals and never make a clean report drift.
 *
 * **Gotchas**
 *
 * An empty `diff` is only meaningful together with `diffScope`. An offline run
 * suppresses the catalog diff — the overlays report different effort ladders
 * than upstream, so a projected diff would be a wall of phantom
 * `levelsChanged` — and reports `diffScope: "suppressed-offline"`. Read
 * `diffScope` before treating an empty `diff` as "no upstream churn".
 *
 * **Example** (Build a clean report)
 *
 * ```ts
 * import { CatalogDiff, CatalogSnapshotSummary } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 * import { ModelsCheckReport } from "@beep/repo-cli/commands/Models/Models.report.schemas"
 * import * as DateTime from "effect/DateTime"
 *
 * const report = ModelsCheckReport.make({
 *   catalog: CatalogSnapshotSummary.make({
 *     fetchedAt: DateTime.makeUnsafe("2026-09-22T00:00:00Z"),
 *     contentSha256: "0".repeat(64),
 *     sources: ["router-for-me"],
 *     modelCount: 134
 *   }),
 *   diff: CatalogDiff.make({ added: [], removed: [], levelsChanged: [] }),
 *   diffScope: "full",
 *   findings: [],
 *   hasDrift: false
 * })
 * console.log(report.hasDrift) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModelsCheckReport extends S.Class<ModelsCheckReport>($I`ModelsCheckReport`)(
  {
    catalog: CatalogSnapshotSummary,
    diff: CatalogDiff,
    diffScope: CatalogDiffScope.pipe(S.withDecodingDefaultKey(Effect.succeed<CatalogDiffScope>("full"))),
    findings: S.Array(DriftFinding),
    candidates: S.Array(ModelId).pipe(
      S.withDecodingDefaultKey(Effect.succeed([])),
      S.withConstructorDefault(Effect.succeed([]))
    ),
    hasDrift: S.Boolean,
  },
  $I.annote("ModelsCheckReport", {
    description: "Catalog provenance, snapshot diff, and per-locator drift findings from one check run.",
  })
) {}
