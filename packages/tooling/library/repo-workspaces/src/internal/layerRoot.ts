import { $RepoWorkspacesId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { WorkspaceRootNotFoundError, WorkspaceRootShape } from "../WorkspaceRoot.ts";

const $I = $RepoWorkspacesId.create("internal/layerRoot");

/**
 * Shares the layer-level options every root-consuming service reads its root from.
 *
 * **Example** (Leave the ambient directory unresolved)
 *
 * ```ts
 * import { LayerRootOptions } from "@beep/repo-workspaces/internal/layerRoot";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(LayerRootOptions)({})); // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class LayerRootOptions extends S.Opaque<LayerRootOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    cwd: S.optionalKey(S.String).pipe(
      $I.annoteKey("LayerRootOptions.cwd", {
        description: "The starting directory, with ambient cwd read only on use when omitted.",
      })
    ),
    stopAt: S.optionalKey(S.String).pipe(
      $I.annoteKey("LayerRootOptions.stopAt", {
        description: "The inclusive root-search boundary; absent means no ceiling.",
      })
    ),
  }).pipe(
    $I.annoteSchema("LayerRootOptions", {
      description: "Plain shared root options with an unresolved ambient cwd default.",
    })
  )
) {}
/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LayerRootOptions {
  /**
   * The plain, unbranded encoded shape of a {@link LayerRootOptions}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof LayerRootOptions.Encoded;
}

/**
 * Reads a host's current directory, or `None` when the host exposes none.
 *
 * **Details**
 *
 * The seam {@link ambientCwd} reads `globalThis.process` through, so a host
 * without a `cwd` is testable without removing the test runner's own process.
 *
 * **Example** (Read a host directory)
 *
 * ```ts
 * import { cwdOf } from "@beep/repo-workspaces/internal/layerRoot";
 *
 * console.log(cwdOf({ cwd: () => "/repo" })); // Some("/repo")
 * console.log(cwdOf(undefined)); // None
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const cwdOf = (host: { readonly cwd?: (() => string) | undefined } | undefined): O.Option<string> =>
  O.fromUndefinedOr(host?.cwd?.());

/**
 * Reads the ambient current directory at use, dying when the runtime has none.
 *
 * **Gotchas**
 *
 * Upstream reads `process.cwd()` directly, so a runtime without `process`
 * throws. This keeps that failure as a defect instead of starting the root
 * ascent at `/`, where it could climb to, or match, an unrelated workspace.
 *
 * **Example** (Read the ambient directory)
 *
 * ```ts
 * import { ambientCwd } from "@beep/repo-workspaces/internal/layerRoot";
 * import * as Effect from "effect/Effect";
 *
 * console.log(Effect.runSync(ambientCwd).length > 0); // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const ambientCwd: Effect.Effect<string> = Effect.suspend(() =>
  O.match(cwdOf(globalThis.process), {
    onNone: () => Effect.die("repo-workspaces: no ambient current directory; pass an explicit cwd"),
    onSome: Effect.succeed,
  })
);

/**
 * Resolves the workspace root a layer's options name.
 *
 * **Details**
 *
 * Reads the ambient directory through {@link ambientCwd} at first use, not at
 * layer construction.
 *
 * **Example** (Resolve an explicit starting directory)
 *
 * ```ts
 * import { findLayerRoot } from "@beep/repo-workspaces/internal/layerRoot";
 * import type { WorkspaceRootShape } from "@beep/repo-workspaces/WorkspaceRoot";
 * import * as Effect from "effect/Effect";
 * import { dual } from "effect/Function";
 *
 * const roots: WorkspaceRootShape = { find: dual((args) => typeof args[0] === "string", (cwd: string) => Effect.succeed(cwd)) };
 * const program = findLayerRoot(roots, { cwd: "/repo" });
 * console.log(Effect.runSync(program)); // /repo
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const findLayerRoot: {
  (
    options: LayerRootOptions.Encoded | undefined
  ): (roots: WorkspaceRootShape) => Effect.Effect<string, WorkspaceRootNotFoundError>;
  (
    roots: WorkspaceRootShape,
    options: LayerRootOptions.Encoded | undefined
  ): Effect.Effect<string, WorkspaceRootNotFoundError>;
} = dual(
  2,
  Effect.fnUntraced(function* (roots: WorkspaceRootShape, options: LayerRootOptions.Encoded | undefined) {
    const stopAt = options?.stopAt;
    const cwd = options?.cwd === undefined ? yield* ambientCwd : options.cwd;
    return yield* roots.find(cwd, stopAt === undefined ? undefined : { stopAt });
  })
);
