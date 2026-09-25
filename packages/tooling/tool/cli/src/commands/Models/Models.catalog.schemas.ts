/**
 * Catalog-side data model for the `beep models` command group.
 *
 * **Details**
 *
 * This module owns the *external truth* half of model routing: the layered
 * catalog assembled from the CLIProxyAPI model manifest
 * (`https://models.router-for.me/models.json`), the Codex CLI model cache
 * (`$HOME/.codex/models_cache.json`), the `cursor-agent models` listing, and a
 * running proxy's `GET /v1/models`. Upstream shapes decode permissively:
 * every field except the identifier is optional, unknown keys are preserved
 * rather than rejected, and effort-shaped strings stay raw strings so a new
 * upstream level never fails a whole snapshot. Normalization into the closed
 * {@link EffortLevel} domain happens once, when a {@link CatalogModel} is
 * built.
 *
 * The manifest half lives in `Models.manifest.schemas.ts`; the report half in
 * `Models.report.schemas.ts`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Models/Models.catalog.schemas");

// ── Identifiers and shared literal domains ──────────────────────────────────

/**
 * Upstream model identifier, as written in routing configuration.
 *
 * **Details**
 *
 * The id is the bare model name (`gpt-6-astra`, `grok-4.6`,
 * `claude-fable-5-1`), never a `model(effort)` suffixed form: effort is a
 * separate axis carried by a binding. Cursor seat ids bake effort into the id
 * and are modeled separately as {@link CursorModelId}.
 *
 * **Example** (Guard an upstream id)
 *
 * ```ts
 * import { ModelId } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ModelId)("gpt-6-astra")) // true
 * console.log(S.is(ModelId)("")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ModelId = S.NonEmptyString.pipe(
  S.brand("ModelId"),
  $I.annoteSchema("ModelId", {
    description: "Bare upstream model identifier without an effort suffix.",
  })
);

/**
 * Bare upstream model identifier without an effort suffix.
 *
 * @see {@link ModelId} for runtime decoding and guards.
 * @category type-level
 * @since 0.0.0
 */
export type ModelId = typeof ModelId.Type;

const EffortLevelKit = LiteralKit(["minimal", "low", "medium", "high", "xhigh", "max", "ultra"]);

/**
 * Closed reasoning-effort domain across every routing surface.
 *
 * **Details**
 *
 * The union is the *superset*: `minimal` is accepted by the proxy's suffix
 * parser but never appears in a catalog ladder, and `ultra` is offered by the
 * Codex backend (live in `$HOME/.codex/models_cache.json` on 2026-09-22) while
 * the proxy catalog stops at `max`. Which subset a surface actually admits is
 * a manifest concern — see `SurfaceEffortDomain` in
 * `Models.manifest.schemas.ts` — not a catalog one.
 *
 * **Example** (Check the effort domain)
 *
 * ```ts
 * import { EffortLevel, EffortLevelOptions } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EffortLevel)("xhigh")) // true
 * console.log(EffortLevelOptions.includes("ultra")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EffortLevel = EffortLevelKit.pipe(
  $I.annoteSchema("EffortLevel", {
    description: "Reasoning-effort level accepted by at least one routing surface.",
  })
);

/**
 * Reasoning-effort level accepted by at least one routing surface.
 *
 * @see {@link EffortLevel} for runtime decoding and guards.
 * @category type-level
 * @since 0.0.0
 */
export type EffortLevel = typeof EffortLevel.Type;

/**
 * Literal option tuple for {@link EffortLevel}.
 *
 * **Example** (Ordered effort ladder)
 *
 * ```ts
 * import { EffortLevelOptions } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 *
 * console.log(EffortLevelOptions[0]) // "minimal"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EffortLevelOptions = EffortLevelKit.Options;

/**
 * Derived per-literal guards for {@link EffortLevel}.
 *
 * **Example** (Test one effort guard)
 *
 * ```ts
 * import { EffortLevelIs } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 *
 * console.log(EffortLevelIs.ultra("ultra")) // true
 * console.log(EffortLevelIs.ultra("max")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const EffortLevelIs = EffortLevelKit.is;

const ProviderSectionKit = LiteralKit([
  "aistudio",
  "antigravity",
  "claude",
  "codex-free",
  "codex-plus",
  "codex-pro",
  "codex-team",
  "gemini",
  "gemini-cli",
  "kimi",
  "meta",
  "vertex",
  "xai",
]);

/**
 * Known top-level provider section of the upstream model manifest.
 *
 * **Details**
 *
 * These are the thirteen keys observed live on 2026-09-22. `gemini-cli` is
 * present in the JSON but read by no CLIProxyAPI struct field, and the Go
 * mirror's `devin` section lives in a different file — so the literal domain
 * is a *classification* of known sections, never a decode gate.
 * {@link UpstreamCatalog} keeps an open string key so a fourteenth section
 * cannot fail a fetch.
 *
 * **Example** (Classify a provider section)
 *
 * ```ts
 * import { ProviderSection } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ProviderSection)("codex-pro")) // true
 * console.log(S.is(ProviderSection)("openai")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProviderSection = ProviderSectionKit.pipe(
  $I.annoteSchema("ProviderSection", {
    description: "Known top-level provider section of the upstream model manifest.",
  })
);

/**
 * Known top-level provider section of the upstream model manifest.
 *
 * @see {@link ProviderSection} for runtime decoding and guards.
 * @category type-level
 * @since 0.0.0
 */
export type ProviderSection = typeof ProviderSection.Type;

/**
 * Literal option tuple for {@link ProviderSection}.
 *
 * **Example** (Count known sections)
 *
 * ```ts
 * import { ProviderSectionOptions } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 *
 * console.log(ProviderSectionOptions.length) // 13
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProviderSectionOptions = ProviderSectionKit.Options;

const CatalogSourceKit = LiteralKit(["router-for-me", "codex-cache", "grok-cache", "cursor-agent", "proxy-v1-models"]);

/**
 * One layer of the assembled catalog.
 *
 * **Details**
 *
 * `router-for-me` supplies existence and effort ladders; the other four are
 * availability overlays answering "is this routable on this box". A binding is
 * valid only when the model exists upstream *and* its surface's overlay was
 * available and listed it. `proxy-v1-models` alone is never sufficient — it
 * omitted `gpt-6-astra` on 2026-09-22.
 *
 * An overlay is also a *source of existence* in its own right: every Cursor
 * seat id and any Codex- or Grok-cache-only slug is absent from the upstream
 * manifest entirely, which is why {@link CatalogModel} records the first layer
 * that reported an id as its `origin`.
 *
 * **Example** (Classify a catalog layer)
 *
 * ```ts
 * import { CatalogSource } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CatalogSource)("codex-cache")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CatalogSource = CatalogSourceKit.pipe(
  $I.annoteSchema("CatalogSource", {
    description: "One layer of the assembled model catalog.",
  })
);

/**
 * One layer of the assembled model catalog.
 *
 * @see {@link CatalogSource} for runtime decoding and guards.
 * @category type-level
 * @since 0.0.0
 */
export type CatalogSource = typeof CatalogSource.Type;

/**
 * Literal option tuple for {@link CatalogSource}.
 *
 * **Example** (Enumerate catalog layers)
 *
 * ```ts
 * import { CatalogSourceOptions } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 *
 * console.log(CatalogSourceOptions.includes("router-for-me")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CatalogSourceOptions = CatalogSourceKit.Options;

/**
 * Optional key that also tolerates an explicit `null`.
 *
 * **Details**
 *
 * Every upstream source in this half spells "no value" both ways: the Codex
 * cache omits a field, while the Grok cache writes `"description": null` on
 * every live entry. A reader that accepted only the omission would fail a
 * whole cache read over a field it never consumes, so absence and `null` are
 * decoded to the same thing here.
 *
 * @param schema - The field schema to make optional.
 * @returns The schema as an optional key that also accepts `null`.
 */
const looseOptional = <Schema extends S.Top>(schema: Schema) => schema.pipe(S.NullOr, S.optionalKey);
// ── Upstream manifest (models.router-for.me) ────────────────────────────────

/**
 * Upstream `thinking` block describing a model's reasoning support.
 *
 * **Details**
 *
 * Every field is optional because the three observed variants are disjoint: a
 * token-budget block (`min`/`max`/`zero_allowed`), a dynamic block
 * (`dynamic_allowed`), and a discrete-level block (`levels`). `levels` stays
 * `Array<string>` rather than `Array<EffortLevel>` so an upstream level this
 * repo has not modeled yet degrades to an unknown level instead of failing the
 * catalog fetch; {@link CatalogModel} carries the normalized subset.
 *
 * **Example** (Read a discrete effort ladder)
 *
 * ```ts
 * import { UpstreamThinkingSupport } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 *
 * const thinking = UpstreamThinkingSupport.make({ levels: ["low", "medium", "high", "xhigh", "max"] })
 * console.log(thinking.levels?.length) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const UpstreamThinkingSupport = S.StructWithRest(
  S.Struct({
    min: looseOptional(S.Finite),
    max: looseOptional(S.Finite),
    zero_allowed: looseOptional(S.Boolean),
    dynamic_allowed: looseOptional(S.Boolean),
    levels: S.Array(S.String).pipe(looseOptional),
  }),
  [S.Record(S.String, S.Unknown)]
).pipe(
  $I.annoteSchema("UpstreamThinkingSupport", {
    description: "Upstream reasoning-support block: token budget, dynamic flag, or discrete levels.",
  })
);

/**
 * Decoded external UpstreamThinkingSupport payload, including unrecognized fields.
 *
 * @see {@link UpstreamThinkingSupport} for lossless boundary decoding.
 * @category type-level
 * @since 0.0.0
 */
export type UpstreamThinkingSupport = typeof UpstreamThinkingSupport.Type;

/**
 * One model entry inside an upstream provider section.
 *
 * **Details**
 *
 * `id` is the only required field. Unknown fields survive decoding and
 * re-encoding, including nested thinking metadata (R1). This external wire
 * boundary uses an open struct; normalized snapshots still persist only
 * {@link CatalogModel}, never the raw payload.
 *
 * **Example** (Read an upstream entry)
 *
 * ```ts
 * import { UpstreamModelEntry } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 *
 * const entry = UpstreamModelEntry.make({ id: "gpt-6-astra", display_name: "GPT 6.0 Astra" })
 * console.log(entry.id) // "gpt-6-astra"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const UpstreamModelEntry = S.StructWithRest(
  S.Struct({
    id: S.NonEmptyString,
    object: looseOptional(S.String),
    created: looseOptional(S.Finite),
    owned_by: looseOptional(S.String),
    type: looseOptional(S.String),
    display_name: looseOptional(S.String),
    name: looseOptional(S.String),
    version: looseOptional(S.String),
    description: looseOptional(S.String),
    context_length: looseOptional(S.Finite),
    max_completion_tokens: looseOptional(S.Finite),
    inputTokenLimit: looseOptional(S.Finite),
    outputTokenLimit: looseOptional(S.Finite),
    supportedGenerationMethods: S.Array(S.String).pipe(looseOptional),
    supportedInputModalities: S.Array(S.String).pipe(looseOptional),
    supportedOutputModalities: S.Array(S.String).pipe(looseOptional),
    supported_parameters: S.Array(S.String).pipe(looseOptional),
    supports_web_search: looseOptional(S.Boolean),
    thinking: looseOptional(UpstreamThinkingSupport),
  }),
  [S.Record(S.String, S.Unknown)]
).pipe(
  $I.annoteSchema("UpstreamModelEntry", {
    description: "One model entry inside an upstream provider section; only the id is required.",
  })
);

/**
 * Decoded external UpstreamModelEntry payload, including unrecognized fields.
 *
 * @see {@link UpstreamModelEntry} for lossless boundary decoding.
 * @category type-level
 * @since 0.0.0
 */
export type UpstreamModelEntry = typeof UpstreamModelEntry.Type;

/**
 * The whole upstream manifest: provider section to model entries.
 *
 * **Details**
 *
 * The key stays an open `string` rather than {@link ProviderSection} so a new
 * upstream section never fails the fetch. Callers classify with
 * `S.is(ProviderSection)` and record anything else as an unknown section.
 *
 * **Example** (Guard the manifest envelope)
 *
 * ```ts
 * import { UpstreamCatalog } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(UpstreamCatalog)({ xai: [] })) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const UpstreamCatalog = S.Record(S.String, S.Array(UpstreamModelEntry)).pipe(
  $I.annoteSchema("UpstreamCatalog", {
    description: "Upstream model manifest keyed by provider section, with unknown sections tolerated.",
  })
);

/**
 * Upstream model manifest keyed by provider section.
 *
 * @see {@link UpstreamCatalog} for runtime decoding and guards.
 * @category type-level
 * @since 0.0.0
 */
export type UpstreamCatalog = typeof UpstreamCatalog.Type;

// ── Codex CLI model cache overlay ───────────────────────────────────────────

const CodexVisibilityKit = LiteralKit(["list", "hide"]);

/**
 * Whether the Codex CLI offers a cached slug in its own model picker.
 *
 * **Details**
 *
 * `hide` slugs (`gpt-reserve`, `codex-auto-review` on 2026-09-22) exist in the
 * cache but are not operator-selectable, so they must not be counted as Codex
 * availability for a binding.
 *
 * **Example** (Classify a cached slug)
 *
 * ```ts
 * import { CodexVisibility } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CodexVisibility)("list")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CodexVisibility = CodexVisibilityKit.pipe(
  $I.annoteSchema("CodexVisibility", {
    description: "Whether the Codex CLI lists or hides a cached model slug.",
  })
);

/**
 * Whether the Codex CLI lists or hides a cached model slug.
 *
 * @see {@link CodexVisibility} for runtime decoding and guards.
 * @category type-level
 * @since 0.0.0
 */
export type CodexVisibility = typeof CodexVisibility.Type;

/**
 * Derived per-literal guards for {@link CodexVisibility}.
 *
 * **Example** (Keep only operator-selectable slugs)
 *
 * ```ts
 * import { CodexVisibilityIs } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 *
 * console.log(CodexVisibilityIs.list("list")) // true
 * console.log(CodexVisibilityIs.list("hide")) // false
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const CodexVisibilityIs = CodexVisibilityKit.is;

/**
 * One rung of a Codex slug's reasoning ladder.
 *
 * **Details**
 *
 * `effort` stays a raw string for the same reason {@link
 * UpstreamThinkingSupport}'s `levels` does: the Codex backend ships new rungs
 * (`ultra`, live on 2026-09-22) ahead of this repo's domain, and a cache read
 * must survive one.
 *
 * **Example** (Read a ladder rung)
 *
 * ```ts
 * import { CodexReasoningLevel } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 *
 * const rung = CodexReasoningLevel.make({ effort: "xhigh" })
 * console.log(rung.effort) // "xhigh"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CodexReasoningLevel = S.StructWithRest(
  S.Struct({
    effort: S.NonEmptyString,
    description: looseOptional(S.String),
  }),
  [S.Record(S.String, S.Unknown)]
).pipe(
  $I.annoteSchema("CodexReasoningLevel", {
    description: "One reasoning-effort rung offered for a cached Codex model slug.",
  })
);

/**
 * Decoded external CodexReasoningLevel payload, including unrecognized fields.
 *
 * @see {@link CodexReasoningLevel} for lossless boundary decoding.
 * @category type-level
 * @since 0.0.0
 */
export type CodexReasoningLevel = typeof CodexReasoningLevel.Type;

/**
 * One model slug in the Codex CLI's cached model list.
 *
 * **Details**
 *
 * The cache keys models by `slug`, not `id` — its `id` field is `null` on
 * every live entry — so the slug is the join key against {@link ModelId}.
 *
 * **Example** (Read a cached slug)
 *
 * ```ts
 * import { CodexCacheEntry } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 *
 * const entry = CodexCacheEntry.make({ slug: "gpt-6-astra", default_reasoning_level: "medium" })
 * console.log(entry.slug) // "gpt-6-astra"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CodexCacheEntry = S.StructWithRest(
  S.Struct({
    slug: S.NonEmptyString,
    display_name: looseOptional(S.String),
    description: looseOptional(S.String),
    default_reasoning_level: looseOptional(S.String),
    supported_reasoning_levels: S.Array(CodexReasoningLevel).pipe(looseOptional),
    visibility: looseOptional(S.String),
    context_window: looseOptional(S.Finite),
  }),
  [S.Record(S.String, S.Unknown)]
).pipe(
  $I.annoteSchema("CodexCacheEntry", {
    description: "One cached Codex CLI model slug with its reasoning ladder and picker visibility.",
  })
);

/**
 * Decoded external CodexCacheEntry payload, including unrecognized fields.
 *
 * @see {@link CodexCacheEntry} for lossless boundary decoding.
 * @category type-level
 * @since 0.0.0
 */
export type CodexCacheEntry = typeof CodexCacheEntry.Type;

/**
 * The Codex CLI model cache at `$HOME/.codex/models_cache.json`.
 *
 * **Details**
 *
 * Known routing fields are validated; every other cache field is retained
 * for lossless round trips. Account-scoped metadata is never projected into
 * catalog snapshots or reports.
 *
 * **Example** (Read a cache envelope)
 *
 * ```ts
 * import { CodexModelsCache } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 *
 * const cache = CodexModelsCache.make({ models: [] })
 * console.log(cache.models.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CodexModelsCache = S.StructWithRest(
  S.Struct({
    models: S.Array(CodexCacheEntry),
    client_version: looseOptional(S.String),
    etag: looseOptional(S.String),
    fetched_at: looseOptional(S.String),
  }),
  [S.Record(S.String, S.Unknown)]
).pipe(
  $I.annoteSchema("CodexModelsCache", {
    description: "Codex CLI model cache envelope read from $HOME/.codex/models_cache.json.",
  })
);

/**
 * Decoded external CodexModelsCache payload, including unrecognized fields.
 *
 * @see {@link CodexModelsCache} for lossless boundary decoding.
 * @category type-level
 * @since 0.0.0
 */
export type CodexModelsCache = typeof CodexModelsCache.Type;

// ── Cursor seat overlay ─────────────────────────────────────────────────────

/**
 * A Cursor seat identifier, with effort and speed tier baked into the id.
 *
 * **Details**
 *
 * `cursor-agent models` prints `<id> - <label>` per line; the id alone is what
 * `cursor-agent --model` accepts. Effort is part of the id (`-high`, `-xhigh`)
 * and so is the speed tier (`-fast`), which is why the `cursor-seat` surface
 * admits no separate effort in a binding.
 *
 * **Example** (Guard a seat id)
 *
 * ```ts
 * import { CursorModelId } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CursorModelId)("gpt-5.6-sol-xhigh")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CursorModelId = S.NonEmptyString.pipe(
  S.brand("CursorModelId"),
  $I.annoteSchema("CursorModelId", {
    description: "Cursor seat identifier with effort and speed tier baked into the id.",
  })
);

/**
 * Cursor seat identifier with effort and speed tier baked into the id.
 *
 * @see {@link CursorModelId} for runtime decoding and guards.
 * @category type-level
 * @since 0.0.0
 */
export type CursorModelId = typeof CursorModelId.Type;

/**
 * The seat ids `cursor-agent models` reports on this box.
 *
 * **Example** (Guard a parsed seat list)
 *
 * ```ts
 * import { CursorModelList } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(CursorModelList)(["composer-2.5", "claude-opus-5-thinking-high"])) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CursorModelList = S.Array(CursorModelId).pipe(
  $I.annoteSchema("CursorModelList", {
    description: "Seat ids parsed from the cursor-agent model listing.",
  })
);

/**
 * Seat ids parsed from the cursor-agent model listing.
 *
 * @see {@link CursorModelList} for runtime decoding and guards.
 * @category type-level
 * @since 0.0.0
 */
export type CursorModelList = typeof CursorModelList.Type;

// ── Grok CLI model cache overlay ────────────────────────────────────────────

/**
 * One rung of a Grok model's reasoning ladder.
 *
 * **Details**
 *
 * The Grok cache spells a rung as an object rather than a bare string, with
 * `value` the token the CLI accepts and `label` its display spelling. `value`
 * stays a raw string for the same reason every other overlay's effort field
 * does: a new rung must not fail a cache read.
 *
 * **Example** (Read a Grok ladder rung)
 *
 * ```ts
 * import { GrokReasoningEffort } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 *
 * const rung = GrokReasoningEffort.make({ value: "xhigh", label: "Extra High" })
 * console.log(rung.value) // "xhigh"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GrokReasoningEffort extends S.Class<GrokReasoningEffort>($I`GrokReasoningEffort`)(
  {
    value: S.NonEmptyString,
    id: looseOptional(S.String),
    label: looseOptional(S.String),
    description: looseOptional(S.String),
    default: looseOptional(S.Boolean),
  },
  $I.annote("GrokReasoningEffort", {
    description: "One reasoning-effort rung offered for a cached Grok model.",
  })
) {}

/**
 * The `info` block describing one cached Grok model.
 *
 * **Example** (Read a cached Grok model)
 *
 * ```ts
 * import { GrokModelInfo } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 *
 * const info = GrokModelInfo.make({ id: "grok-4.7", reasoning_effort: "high" })
 * console.log(info.id) // "grok-4.7"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GrokModelInfo extends S.Class<GrokModelInfo>($I`GrokModelInfo`)(
  {
    id: S.NonEmptyString,
    model: looseOptional(S.String),
    model_family: looseOptional(S.String),
    name: looseOptional(S.String),
    description: looseOptional(S.String),
    context_window: looseOptional(S.Finite),
    hidden: looseOptional(S.Boolean),
    supported_in_api: looseOptional(S.Boolean),
    reasoning_effort: looseOptional(S.String),
    supports_reasoning_effort: looseOptional(S.Boolean),
    reasoning_efforts: S.Array(GrokReasoningEffort).pipe(looseOptional),
  },
  $I.annote("GrokModelInfo", {
    description: "The info block of one cached Grok model: identity, context window, and reasoning ladder.",
  })
) {}

/**
 * One entry of the Grok CLI model cache.
 *
 * **Details**
 *
 * The entry wraps its `info` block alongside per-model credential overrides
 * (`api_key`, `env_key`, `api_base_url`) that this command never reads and so
 * never decodes — the excess keys are dropped rather than carried.
 *
 * **Example** (Read a cache entry)
 *
 * ```ts
 * import { GrokCacheEntry, GrokModelInfo } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 *
 * const entry = GrokCacheEntry.make({ info: GrokModelInfo.make({ id: "grok-4.6" }) })
 * console.log(entry.info.id) // "grok-4.6"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GrokCacheEntry extends S.Class<GrokCacheEntry>($I`GrokCacheEntry`)(
  {
    info: GrokModelInfo,
  },
  $I.annote("GrokCacheEntry", {
    description: "One Grok CLI model cache entry, reduced to the info block this command reads.",
  })
) {}

/**
 * The Grok CLI model cache at `$HOME/.grok/models_cache.json`.
 *
 * **Details**
 *
 * Unlike the Codex cache, `models` is an *object keyed by model id*
 * (`grok-4.5`, `grok-4.6`, `grok-4.7`, `grok-4.7-build-fast` on 2026-09-22),
 * not an array, so the key is the join key against {@link ModelId} and the
 * entry's own `info.id` merely repeats it. The cache's `identity` and
 * `auth_method` blocks are account-scoped and deliberately left undecoded.
 *
 * **Example** (Read a cache envelope)
 *
 * ```ts
 * import { GrokModelsCache } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 *
 * const cache = GrokModelsCache.make({ models: {} })
 * console.log(Object.keys(cache.models).length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GrokModelsCache extends S.Class<GrokModelsCache>($I`GrokModelsCache`)(
  {
    models: S.Record(S.String, GrokCacheEntry),
    grok_version: looseOptional(S.String),
    etag: looseOptional(S.String),
    fetched_at: looseOptional(S.String),
  },
  $I.annote("GrokModelsCache", {
    description: "Grok CLI model cache envelope read from $HOME/.grok/models_cache.json.",
  })
) {}

// ── Proxy overlay ───────────────────────────────────────────────────────────

/**
 * One entry of a running proxy's `GET /v1/models` response.
 *
 * **Example** (Read a proxy entry)
 *
 * ```ts
 * import { ProxyModelEntry } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 *
 * const entry = ProxyModelEntry.make({ id: "grok-4.6" })
 * console.log(entry.id) // "grok-4.6"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProxyModelEntry extends S.Class<ProxyModelEntry>($I`ProxyModelEntry`)(
  {
    id: S.NonEmptyString,
    object: looseOptional(S.String),
    created: looseOptional(S.Finite),
    owned_by: looseOptional(S.String),
  },
  $I.annote("ProxyModelEntry", {
    description: "One model entry from a running proxy's OpenAI-compatible model listing.",
  })
) {}

/**
 * A running proxy's `GET /v1/models` response envelope.
 *
 * **Details**
 *
 * This overlay reflects *admitted credentials*, not model existence: a model
 * the proxy can route only once an OAuth credential is admitted is absent
 * until then. Treating an absence here as a removal would have retired
 * `gpt-6-astra` on 2026-09-22, so this layer may only ever weaken
 * availability, never existence.
 *
 * **Example** (Read a proxy listing)
 *
 * ```ts
 * import { ProxyModelsResponse } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 *
 * const listing = ProxyModelsResponse.make({ data: [] })
 * console.log(listing.data.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProxyModelsResponse extends S.Class<ProxyModelsResponse>($I`ProxyModelsResponse`)(
  {
    data: S.Array(ProxyModelEntry),
    object: looseOptional(S.String),
  },
  $I.annote("ProxyModelsResponse", {
    description: "OpenAI-compatible model listing returned by a running proxy.",
  })
) {}

// ── Normalized catalog ──────────────────────────────────────────────────────

/**
 * Where a catalog model is actually routable on this box.
 *
 * **Example** (Read an availability triple)
 *
 * ```ts
 * import { CatalogAvailability } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 *
 * const availability = CatalogAvailability.make({
 *   proxy: true,
 *   codexCli: true,
 *   grokCli: false,
 *   cursor: false
 * })
 * console.log(availability.cursor) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CatalogAvailability extends S.Class<CatalogAvailability>($I`CatalogAvailability`)(
  {
    proxy: S.Boolean,
    codexCli: S.Boolean,
    grokCli: S.Boolean,
    cursor: S.Boolean,
  },
  $I.annote("CatalogAvailability", {
    description: "Per-overlay routability of one model on this workstation.",
  })
) {}

/**
 * One model after the layers are merged and normalized.
 *
 * **Details**
 *
 * `levels` is the normalized intersection of the upstream ladder with
 * {@link EffortLevel}: upstream strings this repo does not model are dropped
 * here rather than at decode time, so a new upstream level shows up as a
 * levels-changed diff instead of a failed fetch.
 *
 * `provider` is `None` for every id that no upstream manifest section
 * contains. That is not an edge case: no Cursor seat id (`composer-2.5`,
 * `cursor-grok-4.6-xhigh`) appears in `models.json` at all, and a Codex- or
 * Grok-cache-only slug need not either. `origin` names the first layer that
 * reported the id, so an overlay-only model is a first-class catalog member
 * rather than an unrepresentable one.
 *
 * **Example** (Build a catalog model)
 *
 * ```ts
 * import {
 *   CatalogAvailability,
 *   CatalogModel,
 *   ModelId
 * } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const model = CatalogModel.make({
 *   id: S.decodeUnknownSync(ModelId)("gpt-6-astra"),
 *   provider: O.some("codex-pro"),
 *   origin: "router-for-me",
 *   levels: ["low", "medium", "high", "xhigh", "max"],
 *   availability: CatalogAvailability.make({
 *     proxy: true,
 *     codexCli: true,
 *     grokCli: false,
 *     cursor: false
 *   })
 * })
 * console.log(model.levels.length) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CatalogModel extends S.Class<CatalogModel>($I`CatalogModel`)(
  {
    id: ModelId,
    provider: S.OptionFromOptionalKey(ProviderSection),
    origin: CatalogSource,
    levels: S.Array(EffortLevel),
    upstreamLevels: S.Array(S.String).pipe(
      S.withDecodingDefaultKey(Effect.succeed([])),
      S.withConstructorDefault(Effect.succeed([]))
    ),
    codexLevels: S.Array(S.String).pipe(
      S.withDecodingDefaultKey(Effect.succeed([])),
      S.withConstructorDefault(Effect.succeed([]))
    ),
    grokLevels: S.Array(S.String).pipe(
      S.withDecodingDefaultKey(Effect.succeed([])),
      S.withConstructorDefault(Effect.succeed([]))
    ),
    availability: CatalogAvailability,
  },
  $I.annote("CatalogModel", {
    description: "One merged catalog model with its normalized effort ladder and per-overlay availability.",
  })
) {}

/**
 * Provenance of one dated catalog snapshot.
 *
 * **Details**
 *
 * `sources` records which overlays actually answered, so a check run can say
 * "cursor was unavailable" rather than silently reporting every seat as
 * removed. `contentSha256` digests the normalized snapshot, not the upstream
 * bytes, so an upstream reformat that changes nothing we consume is not drift.
 *
 * **Example** (Build a snapshot summary)
 *
 * ```ts
 * import { CatalogSnapshotSummary } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 * import * as DateTime from "effect/DateTime"
 *
 * const summary = CatalogSnapshotSummary.make({
 *   fetchedAt: DateTime.makeUnsafe("2026-09-22T00:00:00Z"),
 *   contentSha256: "0".repeat(64),
 *   sources: ["router-for-me", "codex-cache"],
 *   modelCount: 134
 * })
 * console.log(summary.modelCount) // 134
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CatalogSnapshotSummary extends S.Class<CatalogSnapshotSummary>($I`CatalogSnapshotSummary`)(
  {
    fetchedAt: S.DateTimeUtcFromString,
    contentSha256: S.NonEmptyString,
    sources: S.Array(CatalogSource),
    modelCount: S.Int,
  },
  $I.annote("CatalogSnapshotSummary", {
    description: "Provenance of one dated catalog snapshot: when, from which layers, and how large.",
  })
) {}

/**
 * A dated catalog snapshot written to the home ledger.
 *
 * **Details**
 *
 * `models` stays an ordered array in the encoded form so a snapshot file
 * diffs readably; the service derives a `HashMap` keyed by
 * {@link ModelId} when it needs lookups.
 *
 * **Example** (Build an empty snapshot)
 *
 * ```ts
 * import { CatalogSnapshot, CatalogSnapshotSummary } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 * import * as DateTime from "effect/DateTime"
 *
 * const snapshot = CatalogSnapshot.make({
 *   summary: CatalogSnapshotSummary.make({
 *     fetchedAt: DateTime.makeUnsafe("2026-09-22T00:00:00Z"),
 *     contentSha256: "0".repeat(64),
 *     sources: ["router-for-me"],
 *     modelCount: 0
 *   }),
 *   models: []
 * })
 * console.log(snapshot.models.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CatalogSnapshot extends S.Class<CatalogSnapshot>($I`CatalogSnapshot`)(
  {
    summary: CatalogSnapshotSummary,
    models: S.Array(CatalogModel),
  },
  $I.annote("CatalogSnapshot", {
    description: "A dated, normalized catalog snapshot persisted to the home ledger.",
  })
) {}

/**
 * A model whose effort ladder moved between two snapshots.
 *
 * **Example** (Record a ladder change)
 *
 * ```ts
 * import { CatalogLevelsChange, ModelId } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 * import * as S from "effect/Schema"
 *
 * const change = CatalogLevelsChange.make({
 *   id: S.decodeUnknownSync(ModelId)("grok-4.6"),
 *   before: ["low", "medium", "high"],
 *   after: ["low", "medium", "high", "xhigh"]
 * })
 * console.log(change.after.length) // 4
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CatalogLevelsChange extends S.Class<CatalogLevelsChange>($I`CatalogLevelsChange`)(
  {
    id: ModelId,
    before: S.Array(EffortLevel),
    after: S.Array(EffortLevel),
    upstreamBefore: CatalogModel.fields.upstreamLevels,
    upstreamAfter: CatalogModel.fields.upstreamLevels,
    codexBefore: CatalogModel.fields.codexLevels,
    codexAfter: CatalogModel.fields.codexLevels,
    grokBefore: CatalogModel.fields.grokLevels,
    grokAfter: CatalogModel.fields.grokLevels,
  },
  $I.annote("CatalogLevelsChange", {
    description: "One model whose normalized or source-specific effort ladders differ between two snapshots.",
  })
) {}

/**
 * What changed between the previous snapshot and the current one.
 *
 * **Details**
 *
 * The upstream catalog carries no deprecation field, so a retirement arrives
 * as a hard delete and lands in `removed`. This command proposes only: a diff
 * never edits the manifest, and `removed` ids that still back a binding become
 * an `unknown-model` finding for the operator.
 *
 * **Example** (Build an empty diff)
 *
 * ```ts
 * import { CatalogDiff } from "@beep/repo-cli/commands/Models/Models.catalog.schemas"
 *
 * const diff = CatalogDiff.make({ added: [], removed: [], levelsChanged: [] })
 * console.log(diff.added.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CatalogDiff extends S.Class<CatalogDiff>($I`CatalogDiff`)(
  {
    added: S.Array(ModelId),
    removed: S.Array(ModelId),
    levelsChanged: S.Array(CatalogLevelsChange),
  },
  $I.annote("CatalogDiff", {
    description: "Added, removed, and levels-changed models between two catalog snapshots.",
  })
) {}
