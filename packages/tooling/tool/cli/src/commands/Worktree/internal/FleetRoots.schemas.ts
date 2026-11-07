/**
 * Schema-first models for the per-repository fleet discovery roots.
 *
 * The fleet mirror, the residue janitor and Yeet economics all ask "where is
 * the fleet?". The answer is one ordered list of discovery roots, read from
 * `BEEP_FLEET_ROOTS` or `~/.local/state/beep/fleet/<repo-key>/roots.json`, and
 * derived from the invoking checkout when neither is set.
 *
 * Module graph: a leaf. It imports no command module, so the Worktree schema
 * leaf can reference {@link FleetRootEntry} without a cycle.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Worktree/internal/FleetRoots.schemas");

/**
 * One discovery root: a directory whose immediate children are fleet
 * candidates.
 *
 * **Details**
 *
 * Discovery reads exactly one directory level under `path`, never recurses and
 * never follows symlinks. `path` must be absolute: a relative entry (for
 * example an unexpanded `~/projects` in a timer unit's environment) is
 * refused at decode instead of resolving against the process cwd and silently
 * shrinking the fleet. A child counts only when its origin matches the
 * invoking repository. `namePrefix`, when present, also filters children by
 * name: the legacy projects directory uses `beep-effect` so unrelated projects
 * next to the clones are never probed.
 *
 * **Example** (The legacy projects root)
 *
 * ```ts
 * import { FleetRootEntry } from "@beep/repo-cli/test/Worktree"
 *
 * const legacy = FleetRootEntry.make({ path: "/home/user/projects", namePrefix: "beep-effect" })
 * console.log(legacy.namePrefix) // "beep-effect"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetRootEntry extends S.Opaque<FleetRootEntry, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.String.check(
      S.isPattern(/^\//u, { description: "An absolute path; a relative root would resolve against the cwd." })
    ),
    namePrefix: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("FleetRootEntry", {
      description: "One fleet discovery root: an absolute directory and an optional child-name prefix.",
    })
  )
) {}

/**
 * The authored `roots.json` document.
 *
 * **Example** (A three-root fleet)
 *
 * ```ts
 * import { FleetRootsDocument } from "@beep/repo-cli/test/Worktree"
 * import * as S from "effect/Schema"
 *
 * const document = S.decodeUnknownSync(FleetRootsDocument)({
 *   schemaVersion: "fleet-roots/v1",
 *   roots: [
 *     { path: "/home/user/projects", namePrefix: "beep-effect" },
 *     { path: "/home/user/projects/beep/seats" },
 *     { path: "/home/user/projects/beep/lanes" },
 *   ],
 * })
 * console.log(document.roots.length) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FleetRootsDocument extends S.Opaque<FleetRootsDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("fleet-roots/v1"),
    roots: S.NonEmptyArray(FleetRootEntry),
  }).pipe(
    $I.annoteSchema("FleetRootsDocument", {
      description: "Per-repository ordered list of fleet discovery roots, authored in roots.json.",
    })
  )
) {}

/**
 * Where a resolved roots list came from.
 *
 * **Details**
 *
 * `option` is a caller-supplied list (`FleetScanOptions.roots`), `env` is
 * `BEEP_FLEET_ROOTS`, `file` is `roots.json`, and `derived` is the single root
 * computed from the invoking checkout (or `FleetScanOptions.fleetRoot`) when
 * none of those is set.
 *
 * **Example** (Recognize the derived source)
 *
 * ```ts
 * import { FleetRootsSource } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(FleetRootsSource.Enum.derived) // "derived"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FleetRootsSource = LiteralKit(["option", "env", "file", "derived"]).pipe(
  $I.annoteSchema("FleetRootsSource", {
    description: "Origin of a resolved fleet roots list: caller option, BEEP_FLEET_ROOTS, roots.json, or derived.",
  })
);

/**
 * Origin of a resolved fleet roots list.
 *
 * @category type-level
 * @since 0.0.0
 */
export type FleetRootsSource = typeof FleetRootsSource.Type;

/**
 * A configured roots list together with its source.
 *
 * **Example** (A list read from the environment)
 *
 * ```ts
 * import { ConfiguredFleetRoots, FleetRootEntry } from "@beep/repo-cli/test/Worktree"
 *
 * const configured = ConfiguredFleetRoots.make({
 *   source: "env",
 *   roots: [FleetRootEntry.make({ path: "/fleet/seats" })],
 * })
 * console.log(configured.source) // "env"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConfiguredFleetRoots extends S.Opaque<ConfiguredFleetRoots, { readonly brand: unique symbol }>()(
  S.Struct({
    source: FleetRootsSource,
    roots: S.NonEmptyArray(FleetRootEntry),
  }).pipe(
    $I.annoteSchema("ConfiguredFleetRoots", {
      description: "A fleet roots list and the source it was resolved from.",
    })
  )
) {}
