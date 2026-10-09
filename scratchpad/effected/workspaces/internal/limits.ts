import * as HashSet from "effect/HashSet";

// The package's bound constants, in a shared leaf so every surface
// imports one number without an import cycle.

/**
 * Default cap on how far the `packages:` enumerator descends below a
 * wildcard's enumeration prefix.
 *
 * **Details**
 *
 * Generous for real monorepos (a `packages/**`
 * target three levels down is unusual); low enough that a symlink cycle
 * terminates promptly.
 *
 * **Example** (Inspect the traversal depth cap)
 *
 * ```ts
 * import { MAX_ENUMERATION_DEPTH } from "@beep/scratchpad/effected/workspaces/internal/limits";
 *
 * console.log(MAX_ENUMERATION_DEPTH); // 32
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const MAX_ENUMERATION_DEPTH = 32;

/**
 * Hard ceiling on directories the enumerator will visit for one pattern set.
 *
 * **Details**
 *
 * Guards the pathological case a depth cap alone does not: a wide, shallow
 * tree. Exceeding it fails typed rather than hanging.
 *
 * **Example** (Inspect the directory visit ceiling)
 *
 * ```ts
 * import { MAX_ENUMERATION_ENTRIES } from "@beep/scratchpad/effected/workspaces/internal/limits";
 *
 * console.log(MAX_ENUMERATION_ENTRIES); // 100000
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const MAX_ENUMERATION_ENTRIES = 100_000;

/**
 * Directory names never descended into.
 *
 * **Details**
 *
 * pnpm, npm, yarn and bun all ignore
 * `node_modules` when expanding workspace globs; without the prune a
 * `packages/**` in an installed repo would walk the entire store.
 *
 * **Example** (Check directories excluded from traversal)
 *
 * ```ts
 * import { PRUNED_DIRECTORIES } from "@beep/scratchpad/effected/workspaces/internal/limits";
 * import * as HashSet from "effect/HashSet";
 *
 * console.log(HashSet.has(PRUNED_DIRECTORIES, "node_modules")); // true
 * console.log(HashSet.has(PRUNED_DIRECTORIES, ".git")); // true
 * console.log(HashSet.has(PRUNED_DIRECTORIES, "packages")); // false
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const PRUNED_DIRECTORIES: HashSet.HashSet<string> = HashSet.make(".git", "node_modules");
