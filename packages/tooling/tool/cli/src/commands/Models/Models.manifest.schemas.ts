/**
 * Manifest-side data model for the `beep models` command group.
 *
 * **Details**
 *
 * This module owns the *operator truth* half of model routing: the bindings
 * manifest at `$HOME/.config/beep/models.yaml` and the projection targets it
 * drives. Unlike the catalog side, this half decodes strictly — an unknown
 * role, surface, locator kind, or effort is an operator typo, and failing loud
 * is the point.
 *
 * A binding is `role x surface`, with effort carried per binding rather than
 * per model, because the same model is pinned at different efforts on
 * different surfaces. {@link SurfaceEffortDomain} is the named table that says
 * which efforts a surface admits at all; per-model ladders come from the
 * catalog.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { EffortLevel, ModelId } from "./Models.catalog.schemas.ts";
import type { EffortLevel as EffortLevelValue } from "./Models.catalog.schemas.ts";

const $I = $RepoCliId.create("commands/Models/Models.manifest.schemas");

// ── Roles and surfaces ──────────────────────────────────────────────────────

const RoutingRoleKit = LiteralKit([
  "orchestrator",
  "codex.heavy",
  "codex.plan",
  "child.lightweight",
  "research.web",
  "cursor.volume",
  "cursor.review",
  "cursor.mechanical",
  "cursor.never",
  "qa.judge",
  "graft.deep",
  "research.routine",
  "jsdoc.migrate-titles",
  "deprecated.routable",
]);

/**
 * The job a model is pinned to do, independent of which file names it.
 *
 * **Details**
 *
 * Roles are the stable vocabulary prose refers to; ids live only inside
 * generated blocks. The dotted family prefixes (`codex.`, `cursor.`,
 * `research.`) are literal characters, not structure — `LiteralKit` maps a
 * string literal to its own key verbatim, so `RoutingRoleIs["codex.heavy"]`
 * is a real derived guard. `cursor.never` is a deny list rather than a pin,
 * and `deprecated.routable` names ids kept routable by local alias config that
 * the upstream catalog cannot see.
 *
 * **Example** (Guard a routing role)
 *
 * ```ts
 * import { RoutingRole } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(RoutingRole)("codex.heavy")) // true
 * console.log(S.is(RoutingRole)("codex.medium")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RoutingRole = RoutingRoleKit.pipe(
  $I.annoteSchema("RoutingRole", {
    description: "The job a model is pinned to do, independent of which file names it.",
  })
);

/**
 * The job a model is pinned to do, independent of which file names it.
 *
 * @see {@link RoutingRole} for runtime decoding and guards.
 * @category type-level
 * @since 0.0.0
 */
export type RoutingRole = typeof RoutingRole.Type;

/**
 * Literal option tuple for {@link RoutingRole}.
 *
 * **Example** (Enumerate roles)
 *
 * ```ts
 * import { RoutingRoleOptions } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 *
 * console.log(RoutingRoleOptions.includes("qa.judge")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RoutingRoleOptions = RoutingRoleKit.Options;

/**
 * Derived per-literal guards for {@link RoutingRole}.
 *
 * **Example** (Test a dotted role guard)
 *
 * ```ts
 * import { RoutingRoleIs } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 *
 * console.log(RoutingRoleIs["codex.heavy"]("codex.heavy")) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const RoutingRoleIs = RoutingRoleKit.is;

const RoutingSurfaceKit = LiteralKit([
  "codex-cli",
  "codex-plugin",
  "proxy-workflow",
  "cursor-seat",
  "grok-cli",
  "claude-code",
  "jetbrains-codex",
]);

/**
 * The client that actually sends the request.
 *
 * **Details**
 *
 * Surfaces exist because effort vocabulary is per-client, not per-model:
 * `proxy-workflow` accepts a `model(effort)` suffix from the proxy's own level
 * vocabulary, `cursor-seat` bakes effort into the id and admits none
 * separately, and `jetbrains-codex` writes effort as a display label
 * ("Extra High") rather than a token.
 *
 * **Example** (Guard a routing surface)
 *
 * ```ts
 * import { RoutingSurface } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(RoutingSurface)("jetbrains-codex")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RoutingSurface = RoutingSurfaceKit.pipe(
  $I.annoteSchema("RoutingSurface", {
    description: "The client that sends the request and so decides the effort vocabulary.",
  })
);

/**
 * The client that sends the request and so decides the effort vocabulary.
 *
 * @see {@link RoutingSurface} for runtime decoding and guards.
 * @category type-level
 * @since 0.0.0
 */
export type RoutingSurface = typeof RoutingSurface.Type;

/**
 * Literal option tuple for {@link RoutingSurface}.
 *
 * **Example** (Count surfaces)
 *
 * ```ts
 * import { RoutingSurfaceOptions } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 *
 * console.log(RoutingSurfaceOptions.length) // 7
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RoutingSurfaceOptions = RoutingSurfaceKit.Options;

/**
 * Derived per-literal guards for {@link RoutingSurface}.
 *
 * **Example** (Test a surface guard)
 *
 * ```ts
 * import { RoutingSurfaceIs } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 *
 * console.log(RoutingSurfaceIs["cursor-seat"]("cursor-seat")) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const RoutingSurfaceIs = RoutingSurfaceKit.is;

// ── Effort domain per surface ───────────────────────────────────────────────

const effortSet = (...levels: ReadonlyArray<EffortLevelValue>): HashSet.HashSet<EffortLevelValue> =>
  HashSet.fromIterable(levels);

/**
 * Which efforts each surface admits at all, before per-model ladders apply.
 *
 * **Details**
 *
 * This is the outer gate; the catalog's per-model ladder is the inner one. An
 * effort must pass both. `cursor-seat` maps to the empty set on purpose: its
 * effort is part of the seat id, so a `cursor-seat` binding that also names an
 * effort is malformed rather than merely wrong. `proxy-workflow` admits
 * `minimal` (the proxy's suffix parser accepts it) but not `ultra` (the
 * published catalog stops at `max`), while `codex-cli`, `codex-plugin`, and
 * `jetbrains-codex` talk to the Codex backend directly and do admit `ultra`.
 *
 * Sourcing, per surface: the three Codex rows come from the
 * `supported_reasoning_levels` ladders in `$HOME/.codex/models_cache.json`;
 * `proxy-workflow` from the published `thinking.levels` in the upstream
 * manifest; `grok-cli` from the `reasoning_efforts` list in
 * `$HOME/.grok/models_cache.json`, which offered exactly `low`, `medium`,
 * `high`, and `xhigh` on 2026-09-22.
 *
 * **Gotchas**
 *
 * The `claude-code` row is unverified. The pinned upstream Claude Code
 * settings schema in `@beep/ai-sync`
 * (`packages/tooling/library/ai-sync/src/_generated/schemas.gen.ts`) types
 * `model` as a bare string and carries no `effortLevel` enum at all, so there
 * is nothing to derive the row from. It is recorded from observed `claudex`
 * wrapper usage (`xhigh`) and should be re-sourced when that schema gains an
 * effort field.
 *
 * **Example** (Read one surface's domain)
 *
 * ```ts
 * import { SurfaceEffortDomain } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 *
 * const domain = HashMap.get(SurfaceEffortDomain, "cursor-seat")
 * console.log(O.map(domain, HashSet.size)) // Option.some(0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SurfaceEffortDomain: HashMap.HashMap<
  RoutingSurface,
  HashSet.HashSet<EffortLevelValue>
> = HashMap.fromIterable([
  ["codex-cli", effortSet("low", "medium", "high", "xhigh", "max", "ultra")],
  ["codex-plugin", effortSet("low", "medium", "high", "xhigh", "max", "ultra")],
  ["proxy-workflow", effortSet("minimal", "low", "medium", "high", "xhigh", "max")],
  ["cursor-seat", effortSet()],
  ["grok-cli", effortSet("low", "medium", "high", "xhigh")],
  ["claude-code", effortSet("low", "medium", "high", "xhigh", "max")],
  ["jetbrains-codex", effortSet("low", "medium", "high", "xhigh", "max", "ultra")],
] satisfies ReadonlyArray<readonly [RoutingSurface, HashSet.HashSet<EffortLevelValue>]>);

/**
 * True when a surface admits an effort level at all.
 *
 * **Details**
 *
 * Derived from {@link SurfaceEffortDomain} rather than written as a parallel
 * predicate, so adding a surface to the table extends the guard. A surface
 * missing from the table admits nothing, which surfaces the omission as an
 * `invalid-effort` finding instead of silently passing.
 *
 * **Example** (Reject an effort the surface cannot express)
 *
 * ```ts
 * import { isEffortAllowedOnSurface } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 *
 * console.log(isEffortAllowedOnSurface("codex-cli", "ultra")) // true
 * console.log(isEffortAllowedOnSurface("proxy-workflow", "ultra")) // false
 * console.log(isEffortAllowedOnSurface("cursor-seat", "high")) // false
 * ```
 *
 * @param surface - The client the binding targets.
 * @param effort - The effort level the binding names.
 * @returns `true` when the surface can express that effort.
 * @category guards
 * @since 0.0.0
 */
export const isEffortAllowedOnSurface: {
  (effort: EffortLevelValue): (surface: RoutingSurface) => boolean;
  (surface: RoutingSurface, effort: EffortLevelValue): boolean;
} = dual(2, (surface: RoutingSurface, effort: EffortLevelValue): boolean =>
  O.match(HashMap.get(SurfaceEffortDomain, surface), {
    onNone: () => false,
    onSome: (levels) => HashSet.has(levels, effort),
  })
);

// ── Bindings ────────────────────────────────────────────────────────────────

/**
 * One `role x surface` pin: which model, at which effort.
 *
 * **Details**
 *
 * `supersedes` is the retired-id ledger for this binding, which is how a
 * generated block can carry a `superseded:` list that CI lints without
 * refetching the catalog — the upstream catalog has no deprecation field, so
 * this repo keeps its own. Absent `effort` means the surface's own default
 * applies, which is the only correct encoding for `cursor-seat`.
 *
 * **Example** (Pin a heavy Codex binding)
 *
 * ```ts
 * import { ModelId } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 * import { ModelBinding } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const asModelId = S.decodeUnknownSync(ModelId)
 *
 * const binding = ModelBinding.make({
 *   role: "codex.heavy",
 *   surface: "codex-cli",
 *   modelId: asModelId("gpt-6-astra"),
 *   effort: O.some("medium"),
 *   supersedes: [asModelId("gpt-daybreak-blue-latest")],
 *   note: O.none()
 * })
 * console.log(O.getOrNull(binding.effort)) // "medium"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModelBinding extends S.Class<ModelBinding>($I`ModelBinding`)(
  {
    role: RoutingRole,
    surface: RoutingSurface,
    modelId: ModelId,
    effort: S.OptionFromOptionalKey(EffortLevel),
    supersedes: S.Array(ModelId).pipe(S.withDecodingDefaultKey(Effect.succeed([]))),
    note: S.OptionFromOptionalKey(S.String),
  },
  $I.annote("ModelBinding", {
    description: "One role-by-surface pin naming a model and, where the surface expresses one, an effort.",
  })
) {}

// ── Projection targets ──────────────────────────────────────────────────────

const TargetRootKit = LiteralKit(["repo", "home"]);

/**
 * Which tree a projection target's path is resolved against.
 *
 * **Details**
 *
 * `home` is a parameter, never `os.homedir()` at a call site, which is why the
 * root is part of the manifest rather than implied by the path. A `home` path
 * is written `$HOME/...`, never an absolute home path, so a manifest stays
 * portable and safe to paste into a public repo.
 *
 * **Example** (Guard a target root)
 *
 * ```ts
 * import { TargetRoot } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(TargetRoot)("home")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TargetRoot = TargetRootKit.pipe(
  $I.annoteSchema("TargetRoot", {
    description: "Whether a projection target resolves against the repo checkout or the operator's home.",
  })
);

/**
 * Whether a projection target resolves against the repo checkout or home.
 *
 * @see {@link TargetRoot} for runtime decoding and guards.
 * @category type-level
 * @since 0.0.0
 */
export type TargetRoot = typeof TargetRoot.Type;

/**
 * Derived per-literal guards for {@link TargetRoot}.
 *
 * **Example** (Test the home guard)
 *
 * ```ts
 * import { TargetRootIs } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 *
 * console.log(TargetRootIs.home("home")) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const TargetRootIs = TargetRootKit.is;

/**
 * Stable identifier for one projection target.
 *
 * **Example** (Guard a target id)
 *
 * ```ts
 * import { TargetId } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(TargetId)("home.claude.rules.working-style")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TargetId = S.NonEmptyString.pipe(
  S.brand("TargetId"),
  $I.annoteSchema("TargetId", {
    description: "Stable identifier for one projection target, used in reports and findings.",
  })
);

/**
 * Stable identifier for one projection target.
 *
 * @see {@link TargetId} for runtime decoding and guards.
 * @category type-level
 * @since 0.0.0
 */
export type TargetId = typeof TargetId.Type;

const LocatorFieldKit = LiteralKit(["model", "effort", "model-effort-suffix"]);

/**
 * Which of a binding's values one locator writes.
 *
 * **Details**
 *
 * A binding carries a model and, on most surfaces, an effort; a locator writes
 * exactly one value, so the field is part of the selector rather than implied.
 * `$HOME/.codex/config.toml` needs two locators over the same
 * `codex.heavy x codex-cli` binding — one `model` and one `effort` — while a
 * `proxy-workflow` target writes the single fused token `gpt-6-astra(xhigh)`,
 * which is `model-effort-suffix`. A `cursor-seat` target writes `model`
 * alone, because the seat id already bakes the effort in.
 *
 * **Example** (Guard a locator field)
 *
 * ```ts
 * import { LocatorField } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(LocatorField)("model-effort-suffix")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LocatorField = LocatorFieldKit.pipe(
  $I.annoteSchema("LocatorField", {
    description: "Which of a binding's values one locator writes: the model, the effort, or the fused suffix.",
  })
);

/**
 * Which of a binding's values one locator writes.
 *
 * @see {@link LocatorField} for runtime decoding and guards.
 * @category type-level
 * @since 0.0.0
 */
export type LocatorField = typeof LocatorField.Type;

/**
 * Derived per-literal guards for {@link LocatorField}.
 *
 * **Example** (Detect an effort-bearing field)
 *
 * ```ts
 * import { LocatorFieldIs } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 *
 * console.log(LocatorFieldIs.effort("effort")) // true
 * console.log(LocatorFieldIs.model("effort")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const LocatorFieldIs = LocatorFieldKit.is;

/**
 * Which binding, and which of its values, a locator projects.
 *
 * **Gotchas**
 *
 * A `field` of `effort` or `model-effort-suffix` is only renderable when the
 * selected binding's `effort` is `Some`, and that pairing cannot be checked
 * here: a locator names a binding by `role x surface`, so the check needs the
 * whole manifest to resolve the reference. The service validates it after
 * decoding and reports a mismatch as an `invalid-effort` finding rather than a
 * decode failure, which is the right blame — the manifest is well-formed, the
 * operator's pairing is not.
 *
 * **Example** (Name the value a locator writes)
 *
 * ```ts
 * import { LocatorBinding } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 *
 * const binding = LocatorBinding.make({ role: "research.web", surface: "grok-cli", field: "effort" })
 * console.log(binding.field) // "effort"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LocatorBinding extends S.Class<LocatorBinding>($I`LocatorBinding`)(
  {
    role: RoutingRole,
    surface: RoutingSurface,
    field: LocatorField,
  },
  $I.annote("LocatorBinding", {
    description: "The role-by-surface binding, and which of its values, a locator writes.",
  })
) {}

/**
 * Which bindings a generated block renders, by role and surface.
 *
 * **Details**
 *
 * A generated block renders a *table*, not one value, so it selects a set
 * rather than naming a binding. An empty `roles` or `surfaces` list means "all
 * of them", which keeps the common manifest entry — the whole routing table —
 * to an empty filter instead of an enumeration that goes stale every time a
 * role is added.
 *
 * **Example** (Select every cursor seat binding)
 *
 * ```ts
 * import { BindingFilter } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 *
 * const filter = BindingFilter.make({ roles: [], surfaces: ["cursor-seat"] })
 * console.log(filter.roles.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BindingFilter extends S.Class<BindingFilter>($I`BindingFilter`)(
  {
    roles: S.Array(RoutingRole).pipe(S.withDecodingDefaultKey(Effect.succeed([]))),
    surfaces: S.Array(RoutingSurface).pipe(S.withDecodingDefaultKey(Effect.succeed([]))),
  },
  $I.annote("BindingFilter", {
    description: "Which bindings a generated block renders; an empty list on either axis means all of them.",
  })
) {}

/**
 * One effort level's spelling in a surface that writes labels, not tokens.
 *
 * **Example** (Map an effort to a display label)
 *
 * ```ts
 * import { EffortDisplayLabel } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 *
 * const label = EffortDisplayLabel.make({ effort: "xhigh", label: "Extra High" })
 * console.log(label.label) // "Extra High"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EffortDisplayLabel extends S.Class<EffortDisplayLabel>($I`EffortDisplayLabel`)(
  {
    effort: EffortLevel,
    label: S.NonEmptyString,
  },
  $I.annote("EffortDisplayLabel", {
    description: "How one effort level is spelled in a surface that stores display labels.",
  })
) {}

/**
 * How a locator's value is spelled once the binding is resolved.
 *
 * **Details**
 *
 * `verbatim` writes the id or effort token as-is and covers every surface
 * except JetBrains, whose launcher XML stores `modelReasoningEffort` as a
 * human label ("Extra High"). Modeling the label map as a tagged case rather
 * than an optional field keeps a locator from carrying a label map it will
 * never consult.
 *
 * **Example** (Choose a render strategy)
 *
 * ```ts
 * import { LocatorRender } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(LocatorRender)({ _tag: "verbatim" })) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LocatorRender = LiteralKit(["verbatim", "effort-display-label"])
  .toTaggedUnion("_tag")({
    verbatim: {},
    "effort-display-label": {
      labels: S.Array(EffortDisplayLabel),
    },
  })
  .pipe(
    $I.annoteSchema("LocatorRender", {
      description: "How a locator spells a resolved value: verbatim, or through an effort display-label map.",
    })
  );

/**
 * How a locator spells a resolved value.
 *
 * @see {@link LocatorRender} for runtime decoding and tag discrimination.
 * @category type-level
 * @since 0.0.0
 */
export type LocatorRender = typeof LocatorRender.Type;

/**
 * Where inside a target file one binding's value lives.
 *
 * **Details**
 *
 * The tag is the file grammar, not the file format, because the same format
 * needs different surgery in different places: `toml-top-level-key` must never
 * rewrite a whole TOML file that a machine appends `[projects.*]` tables to,
 * while `toml-table-key` is line-anchored inside one table.
 * `md-generated-block` is the one member that selects a set rather than a
 * single value: it owns a fenced region and renders the whole filtered routing
 * table into it, plus — when `includeSuperseded` is set — the `superseded:`
 * list that the model-id lint keys on, which is what lets CI flag a retired id
 * in prose without refetching the catalog. `xml-escaped-json-attribute`
 * exists for the JetBrains rollout files, whose attribute holds a
 * `&quot;`-escaped JSON array. `ts-literal` names an exported symbol in source
 * and is the one locator whose edits can move a docgen ratchet.
 *
 * **Example** (Guard a generated-block locator)
 *
 * ```ts
 * import { Locator } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Locator)({
 *   _tag: "md-generated-block",
 *   blockId: "volume-pools",
 *   filter: { roles: [], surfaces: [] },
 *   includeSuperseded: true
 * })) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Locator = LiteralKit([
  "md-generated-block",
  "toml-top-level-key",
  "toml-table-key",
  "yaml-path",
  "json-key",
  "env-key",
  "shell-assign",
  "xml-attribute",
  "xml-escaped-json-attribute",
  "ts-literal",
])
  .toTaggedUnion("_tag")({
    "md-generated-block": {
      blockId: S.NonEmptyString,
      filter: BindingFilter,
      includeSuperseded: S.Boolean.pipe(S.withDecodingDefaultKey(Effect.succeed(false))),
    },
    "toml-top-level-key": {
      binding: LocatorBinding,
      render: LocatorRender,
      key: S.NonEmptyString,
    },
    "toml-table-key": {
      binding: LocatorBinding,
      render: LocatorRender,
      table: S.NonEmptyString,
      key: S.NonEmptyString,
    },
    "yaml-path": {
      binding: LocatorBinding,
      render: LocatorRender,
      path: S.Array(S.Union([S.String, S.Int])),
    },
    "json-key": {
      binding: LocatorBinding,
      render: LocatorRender,
      pointer: S.Array(S.String),
    },
    "env-key": {
      binding: LocatorBinding,
      render: LocatorRender,
      key: S.NonEmptyString,
    },
    "shell-assign": {
      binding: LocatorBinding,
      render: LocatorRender,
      variable: S.NonEmptyString,
      within: S.OptionFromOptionalKey(S.String),
    },
    "xml-attribute": {
      binding: LocatorBinding,
      render: LocatorRender,
      elementSelector: S.NonEmptyString,
      attribute: S.NonEmptyString,
    },
    "xml-escaped-json-attribute": {
      binding: LocatorBinding,
      render: LocatorRender,
      elementSelector: S.NonEmptyString,
      attribute: S.NonEmptyString,
      jsonPointer: S.Array(S.String),
    },
    "ts-literal": {
      binding: LocatorBinding,
      render: LocatorRender,
      symbol: S.NonEmptyString,
    },
  })
  .pipe(
    $I.annoteSchema("Locator", {
      description: "Where inside a target file one binding's value lives, tagged by file grammar.",
    })
  );

/**
 * Where inside a target file one binding's value lives.
 *
 * @see {@link Locator} for runtime decoding and tag discrimination.
 * @category type-level
 * @since 0.0.0
 */
export type Locator = typeof Locator.Type;

/**
 * One file the projection writes, and every locator inside it.
 *
 * **Details**
 *
 * `optional` marks a target that may legitimately be absent on a given box —
 * a JetBrains options file for an IDE version that is not installed — so a
 * missing file is a skip rather than a `missing-file` finding.
 *
 * **Example** (Declare a home target)
 *
 * ```ts
 * import { ModelSyncTarget, TargetId } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 * import * as S from "effect/Schema"
 *
 * const target = ModelSyncTarget.make({
 *   id: S.decodeUnknownSync(TargetId)("home.grok.config"),
 *   root: "home",
 *   path: "$HOME/.grok/config.toml",
 *   optional: true,
 *   locators: []
 * })
 * console.log(target.path) // "$HOME/.grok/config.toml"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModelSyncTarget extends S.Class<ModelSyncTarget>($I`ModelSyncTarget`)(
  {
    id: TargetId,
    root: TargetRoot,
    path: S.NonEmptyString,
    optional: S.Boolean.pipe(S.withDecodingDefaultKey(Effect.succeed(false))),
    locators: S.Array(Locator),
  },
  $I.annote("ModelSyncTarget", {
    description: "One projection target file, its root, and the locators the projection writes inside it.",
  })
) {}

/**
 * A retired model id and what replaced it.
 *
 * **Details**
 *
 * The upstream catalog hard-deletes retired ids, so this ledger is the only
 * record that a name ever meant something. It is what `beep lint model-ids`
 * consults to flag a superseded id appearing in prose outside a generated
 * block.
 *
 * **Example** (Record a supersession)
 *
 * ```ts
 * import { ModelId } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 * import { SupersededModel } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const asModelId = S.decodeUnknownSync(ModelId)
 *
 * const retired = SupersededModel.make({
 *   id: asModelId("grok-4.5"),
 *   retiredAt: DateTime.makeUnsafe("2026-09-22T00:00:00Z"),
 *   replacedBy: O.some(asModelId("grok-4.6")),
 *   note: O.none()
 * })
 * console.log(O.isSome(retired.replacedBy)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SupersededModel extends S.Class<SupersededModel>($I`SupersededModel`)(
  {
    id: ModelId,
    retiredAt: S.DateTimeUtcFromString,
    replacedBy: S.OptionFromOptionalKey(ModelId),
    note: S.OptionFromOptionalKey(S.String),
  },
  $I.annote("SupersededModel", {
    description: "A retired model id, when it was retired, and what replaced it.",
  })
) {}

/**
 * The operator's whole routing manifest.
 *
 * **Details**
 *
 * One manifest at `$HOME/.config/beep/models.yaml` is the single place an
 * operator edits; every repo file and dotfile is a projection of it. The
 * version literal is a hard gate rather than a hint: a manifest written for a
 * later shape must fail loud instead of being half-understood.
 *
 * **Example** (Build an empty manifest)
 *
 * ```ts
 * import { ModelsManifest } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 *
 * const manifest = ModelsManifest.make({
 *   version: "beep-models/v1",
 *   bindings: [],
 *   targets: [],
 *   superseded: []
 * })
 * console.log(manifest.version) // "beep-models/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModelsManifest extends S.Class<ModelsManifest>($I`ModelsManifest`)(
  {
    version: S.Literal("beep-models/v1"),
    bindings: S.Array(ModelBinding),
    targets: S.Array(ModelSyncTarget),
    superseded: S.Array(SupersededModel).pipe(S.withDecodingDefaultKey(Effect.succeed([]))),
  },
  $I.annote("ModelsManifest", {
    description: "The operator's routing manifest: bindings, projection targets, and the superseded ledger.",
  })
) {}
