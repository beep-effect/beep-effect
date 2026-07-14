/**
 * Schema-backed HOME-layout payloads for Claude and Codex CLI isolation.
 *
 * Shapes ported from t3code (MIT, Copyright 2026 T3 Tools Inc.)
 * `apps/server/src/provider/Drivers/CodexHomeLayout.ts` and `ClaudeHome.ts`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AiProviderCliId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $AiProviderCliId.create("AiProviderCliHome.models");
const AiProviderCliHomeModeBase = LiteralKit(["direct", "authOverlay"]);
const AiProviderCliCodexSharedDirectoryBase = LiteralKit([
  "sessions",
  "archived_sessions",
  "sqlite",
  "shell_snapshots",
  "worktrees",
  "skills",
  "plugins",
  "cache",
  "logs",
]);
const AiProviderCliCodexPrivateEntryBase = LiteralKit(["auth.json", "models_cache.json"]);
const AiProviderCliCodexLocalEntryBase = LiteralKit(["log", "memories", "tmp"]);

/**
 * Home-layout mode for a provider CLI instance.
 *
 * @remarks
 * `direct` runs the CLI against the shared home directory as-is.
 * `authOverlay` runs it against a shadow home whose shared entries are
 * symlinked back to the shared home while credential files stay private.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { AiProviderCliHomeMode } from "@beep/ai-provider-cli"
 *
 * const mode = S.decodeUnknownSync(AiProviderCliHomeMode)("authOverlay")
 *
 * console.log(mode) // "authOverlay"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiProviderCliHomeMode = AiProviderCliHomeModeBase.pipe(
  $I.annoteSchema("AiProviderCliHomeMode", {
    description: "Provider CLI home-layout mode: direct shared home or shadow-home auth overlay.",
  }),
  SchemaUtils.withLiteralKitStatics(AiProviderCliHomeModeBase)
);

/**
 * Type for a provider CLI home-layout mode.
 *
 * @example
 * ```ts
 * import type { AiProviderCliHomeMode } from "@beep/ai-provider-cli"
 *
 * const mode: AiProviderCliHomeMode = "direct"
 *
 * console.log(mode) // "direct"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiProviderCliHomeMode = typeof AiProviderCliHomeMode.Type;

/**
 * Codex home entries shared between the shared home and every shadow home.
 *
 * @remarks
 * Each directory is created inside the shared home and symlinked from the
 * shadow home so session state, caches, and logs stay common across
 * credential overlays.
 *
 * @example
 * ```ts
 * import { AiProviderCliCodexSharedDirectory } from "@beep/ai-provider-cli"
 *
 * console.log(AiProviderCliCodexSharedDirectory.Options.length) // 9
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiProviderCliCodexSharedDirectory = AiProviderCliCodexSharedDirectoryBase.pipe(
  $I.annoteSchema("AiProviderCliCodexSharedDirectory", {
    description: "Codex home directory names symlinked from a shadow home to the shared home.",
  }),
  SchemaUtils.withLiteralKitStatics(AiProviderCliCodexSharedDirectoryBase)
);

/**
 * Type for a shared Codex home directory name.
 *
 * @example
 * ```ts
 * import type { AiProviderCliCodexSharedDirectory } from "@beep/ai-provider-cli"
 *
 * const directory: AiProviderCliCodexSharedDirectory = "sessions"
 *
 * console.log(directory) // "sessions"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiProviderCliCodexSharedDirectory = typeof AiProviderCliCodexSharedDirectory.Type;

/**
 * Credential-bearing Codex home entries that must stay private per shadow home.
 *
 * @remarks
 * Private entries must exist as real files inside the shadow home. A private
 * entry that resolves to a symlink is a hard error because it would leak one
 * instance's credentials into another home.
 *
 * @example
 * ```ts
 * import { AiProviderCliCodexPrivateEntry } from "@beep/ai-provider-cli"
 *
 * console.log(AiProviderCliCodexPrivateEntry.Options) // ["auth.json", "models_cache.json"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiProviderCliCodexPrivateEntry = AiProviderCliCodexPrivateEntryBase.pipe(
  $I.annoteSchema("AiProviderCliCodexPrivateEntry", {
    description: "Codex home entry names that must be real files private to each shadow home.",
  }),
  SchemaUtils.withLiteralKitStatics(AiProviderCliCodexPrivateEntryBase)
);

/**
 * Type for a private Codex home entry name.
 *
 * @example
 * ```ts
 * import type { AiProviderCliCodexPrivateEntry } from "@beep/ai-provider-cli"
 *
 * const entry: AiProviderCliCodexPrivateEntry = "auth.json"
 *
 * console.log(entry) // "auth.json"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiProviderCliCodexPrivateEntry = typeof AiProviderCliCodexPrivateEntry.Type;

/**
 * Codex home entries left local to each home and never linked or shared.
 *
 * @example
 * ```ts
 * import { AiProviderCliCodexLocalEntry } from "@beep/ai-provider-cli"
 *
 * console.log(AiProviderCliCodexLocalEntry.Options) // ["log", "memories", "tmp"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AiProviderCliCodexLocalEntry = AiProviderCliCodexLocalEntryBase.pipe(
  $I.annoteSchema("AiProviderCliCodexLocalEntry", {
    description: "Codex home entry names left untouched in each home, never symlinked.",
  }),
  SchemaUtils.withLiteralKitStatics(AiProviderCliCodexLocalEntryBase)
);

/**
 * Type for a local-only Codex home entry name.
 *
 * @example
 * ```ts
 * import type { AiProviderCliCodexLocalEntry } from "@beep/ai-provider-cli"
 *
 * const entry: AiProviderCliCodexLocalEntry = "tmp"
 *
 * console.log(entry) // "tmp"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AiProviderCliCodexLocalEntry = typeof AiProviderCliCodexLocalEntry.Type;

/**
 * Resolved Codex home layout for a provider CLI instance.
 *
 * @remarks
 * `sharedHomePath` is always the resolved shared Codex home. In `direct`
 * mode `effectiveHomePath` is only present when a home path was explicitly
 * configured (otherwise the ambient environment applies); in `authOverlay`
 * mode it is the resolved shadow home path.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { AiProviderCliCodexHomeLayout } from "@beep/ai-provider-cli"
 *
 * const layout = AiProviderCliCodexHomeLayout.make({
 *   effectiveHomePath: O.some("/tmp/shadow-codex"),
 *   mode: "authOverlay",
 *   sharedHomePath: "/home/dev/.codex"
 * })
 *
 * console.log(layout.mode) // "authOverlay"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiProviderCliCodexHomeLayout extends S.Class<AiProviderCliCodexHomeLayout>(
  $I`AiProviderCliCodexHomeLayout`
)(
  {
    effectiveHomePath: S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault).annotateKey({
      description: "Home path injected into the Codex child environment, when one applies.",
    }),
    mode: AiProviderCliHomeMode.annotateKey({
      description: "Whether the layout is direct or a shadow-home auth overlay.",
    }),
    sharedHomePath: S.NonEmptyString.annotateKey({
      description: "Resolved shared Codex home directory path.",
    }),
  },
  $I.annote("AiProviderCliCodexHomeLayout", {
    description: "Resolved Codex home layout with shared home and optional effective home paths.",
  })
) {}
