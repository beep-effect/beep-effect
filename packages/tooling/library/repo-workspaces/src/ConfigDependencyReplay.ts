/**
 * The replay vocabulary every config-dependency hook layer shares: where a
 * replayed version was found ({@link HookReplaySource}), what the declaring
 * side recorded ({@link HookReplayContext}), and which version a replay loaded
 * ({@link HookReplay}).
 *
 * **Details**
 *
 * A leaf of its own so the resolution ladder and its fetch rung can model
 * their records without importing the hook service that imports them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoWorkspacesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";

const $I = $RepoWorkspacesId.create("ConfigDependencyReplay");

/**
 * Where a replayed config dependency's declared version was found: the
 * `node_modules/.pnpm-config` copy, the pnpm store's `links/` tree, the store
 * after `ConfigDependencyHooks.layerSubprocess` fetched it, or a
 * `ConfigDependencyHooks.layerFrom` entry.
 *
 * **Example** (Validate replay resolution sources)
 *
 * ```ts
 * import { HookReplaySource } from "@beep/repo-workspaces/ConfigDependencyReplay";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(HookReplaySource)("installed")) // true
 * console.log(S.is(HookReplaySource)("registry")) // false
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const HookReplaySource = LiteralKit(["installed", "store", "fetched", "supplied"]).pipe(
  $I.annoteSchema("HookReplaySource", {
    description: "The resolution rung supplying the declared config dependency version for replay.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type HookReplaySource = typeof HookReplaySource.Type;

/**
 * What the side whose `configDependencies` are being replayed recorded beyond
 * that map — the input the fetch rung needs to verify what it fetches.
 *
 * **Details**
 *
 * Both fields are optional, and omitting the whole context is always valid:
 * nothing here changes which version is replayed. `lockfile` matters only when
 * a replaying layer must fetch a version installed nowhere, and only
 * `ConfigDependencyHooks.layerSubprocess` fetches. Without it, a bare
 * `configDependencies` spec has no integrity to verify a fetch against, so the
 * fetch fails closed with `reason: "integrityUnavailable"`.
 *
 * `WorkspaceCatalogs` passes the working tree's lockfile, and
 * `WorkspaceSnapshots.at(ref)` passes the lockfile and the ref it read at, so
 * each side of a diff is verified against its own record.
 *
 * **Example** (Record the declaring git ref)
 *
 * ```ts
 * import { HookReplayContext } from "@beep/repo-workspaces/ConfigDependencyReplay";
 *
 * const context = HookReplayContext.make({ ref: "origin/main" });
 * console.log(context.ref) // origin/main
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class HookReplayContext extends S.Opaque<HookReplayContext, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * The declaring side's `pnpm-lock.yaml` text, whose env preamble records each
     * config dependency's integrity. `undefined` when that side has no lockfile.
     */
    lockfile: S.optionalKey(S.String).pipe(
      $I.annoteKey("HookReplayContext.lockfile", {
        description: "The declaring side's lockfile text, when available to verify a fetch.",
      })
    ),
    /**
     * The git ref whose `pnpm-workspace.yaml` declared the `configDependencies`,
     * used to name the side in error messages. `undefined` for the working tree.
     */
    ref: S.optionalKey(S.String).pipe(
      $I.annoteKey("HookReplayContext.ref", {
        description: "The declaring git ref, or undefined for the working tree.",
      })
    ),
  }).pipe(
    $I.annoteSchema("HookReplayContext", {
      description: "Optional lockfile and ref provenance used to verify and identify the declaring side of a replay.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace HookReplayContext {
  /**
   * The plain, unbranded encoded shape of a {@link HookReplayContext}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof HookReplayContext.Encoded;
}

/**
 * Which version of a config dependency a replay actually loaded, and where
 * that version came from.
 *
 * **Details**
 *
 * Recorded per dependency so a consumer diffing two refs can tell not just
 * WHAT the hooks injected but which pinned version injected it — the
 * evidence that a "range moved" row came from a config-dependency bump and
 * not from a hook edit. `installed` is the `node_modules/.pnpm-config` copy,
 * `store` the pnpm store's `links/` tree, `fetched` the store copy
 * `ConfigDependencyHooks.layerSubprocess` fetched, verified, because
 * neither held the declared version, and `supplied` a
 * `ConfigDependencyHooks.layerFrom` entry.
 *
 * **Example** (Record a supplied hook version)
 *
 * ```ts
 * import { HookReplay } from "@beep/repo-workspaces/ConfigDependencyReplay";
 *
 * const replay = HookReplay.make({ version: "1.0.0", source: "supplied" });
 * console.log(replay.source) // supplied
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class HookReplay extends S.Opaque<HookReplay, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The declared version that was resolved and replayed. */
    version: S.String.pipe(
      $I.annoteKey("HookReplay.version", { description: "The declared version resolved and replayed." })
    ),
    /** Which resolution rung answered. */
    source: HookReplaySource.pipe(
      $I.annoteKey("HookReplay.source", { description: "The resolution rung answering for this version." })
    ),
  }).pipe(
    $I.annoteSchema("HookReplay", {
      description: "The declared version and resolution provenance of one replayed config dependency.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace HookReplay {
  /**
   * The plain, unbranded encoded shape of a {@link HookReplay}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof HookReplay.Encoded;
}
