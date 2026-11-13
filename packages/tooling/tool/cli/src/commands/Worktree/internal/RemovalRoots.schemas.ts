/**
 * Schema-first models for the worktree roots the removal fence admits.
 *
 * `beep worktree remove` and `beep yeet sweep --retire` remove only a
 * registered linked worktree that sits directly under one of its clone's
 * worktree roots. This module names those roots and where each came from.
 *
 * Module graph: a leaf; it imports no command module.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Worktree/internal/RemovalRoots.schemas");

/**
 * Where a removal root comes from.
 *
 * **Details**
 *
 * `managed` is the clone's sibling `-worktrees` directory, `nested` is the
 * clone's Claude Code worktrees directory, `t3` is `<home>/.t3/worktrees/<clone
 * name>`, and `fleet` is a root listed in `BEEP_FLEET_ROOTS` or the
 * repository's `roots.json`.
 *
 * **Example** (Recognize the T3 root)
 *
 * ```ts
 * import { WorktreeRemovalRootKind } from "@beep/repo-cli/test/Worktree"
 *
 * console.log(WorktreeRemovalRootKind.Enum.t3) // "t3"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const WorktreeRemovalRootKind = LiteralKit(["managed", "nested", "t3", "fleet"]).pipe(
  $I.annoteSchema("WorktreeRemovalRootKind", {
    description: "Origin of a worktree removal root: sibling, Claude Code nested, T3 Code, or a configured fleet root.",
  })
);

/**
 * Origin of a worktree removal root.
 *
 * @category type-level
 * @since 0.0.0
 */
export type WorktreeRemovalRootKind = typeof WorktreeRemovalRootKind.Type;

/**
 * One directory whose immediate children may be removed as linked worktrees.
 *
 * **Details**
 *
 * The root admits only a child that is a registered worktree of the same Git
 * common directory; the root alone never makes a path removable. A
 * `namePrefix` (carried over from a fleet root) further limits the children to
 * names that start with it.
 *
 * **Example** (The T3 root of a clone)
 *
 * ```ts
 * import { WorktreeRemovalRoot } from "@beep/repo-cli/test/Worktree"
 *
 * const root = WorktreeRemovalRoot.make({ kind: "t3", path: "/home/user/.t3/worktrees/beep-effect" })
 * console.log(root.kind) // "t3"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorktreeRemovalRoot extends S.Opaque<WorktreeRemovalRoot, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: WorktreeRemovalRootKind,
    path: S.String.check(S.isPattern(/^\//u, { description: "An absolute directory." })),
    namePrefix: S.optionalKey(S.String),
  }).pipe(
    $I.annoteSchema("WorktreeRemovalRoot", {
      description: "A directory whose registered linked-worktree children the removal fence admits.",
    })
  )
) {}
