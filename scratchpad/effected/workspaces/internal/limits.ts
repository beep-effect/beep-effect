// The package's bound constants, in a zero-dependency leaf so every surface
// imports one number without an import cycle.

/**
 * Default cap on how far the `packages:` enumerator descends below a
 * wildcard's enumeration prefix. Generous for real monorepos (a `packages/**`
 * target three levels down is unusual); low enough that a symlink cycle
 * terminates promptly.
 *
 * @internal
 */
export const MAX_ENUMERATION_DEPTH = 32;

/**
 * Hard ceiling on directories the enumerator will visit for one pattern set.
 * Guards the pathological case a depth cap alone does not: a wide, shallow
 * tree. Exceeding it fails typed rather than hanging.
 *
 * @internal
 */
export const MAX_ENUMERATION_ENTRIES = 100_000;

/**
 * Directory names never descended into. pnpm, npm, yarn and bun all ignore
 * `node_modules` when expanding workspace globs; without the prune a
 * `packages/**` in an installed repo would walk the entire store.
 *
 * @internal
 */
export const PRUNED_DIRECTORIES: ReadonlySet<string> = new Set([".git", "node_modules"]);
