// The `devEngines` field model: a `DevEngine` class (a single runtime or
// package-manager constraint) and the `DevEnginesSchema` struct grouping the
// `packageManager` / `runtime` / `os` / `cpu` / `libc` constraint slots.

import * as S from "effect/Schema";

/**
 * A single `devEngines` constraint with a name and optional `version` / `onFail`.
 *
 * @public
 */
export class DevEngine extends S.Class<DevEngine>("DevEngine")({
	/** The engine name (e.g. `node`, `pnpm`). */
	name: S.String,
	/** The optional version constraint. */
	version: S.optionalKey(S.String),
	/** The optional behavior when the constraint is unmet. */
	onFail: S.optionalKey(S.Literals(["warn", "error", "ignore"])),
}) {}

/**
 * A `devEngines` constraint slot: a single {@link DevEngine} or an array of them.
 *
 * @public
 */
export const DevEngineOrArray: S.Union<[typeof DevEngine, S.$Array<typeof DevEngine>]> = S.Union([
	DevEngine,
	S.Array(DevEngine),
]);

/**
 * The `devEngines` field schema, modeling runtime and package-manager
 * constraints as optional {@link DevEngine} slots.
 *
 * @public
 */
export const DevEnginesSchema: S.Struct<{
	readonly packageManager: S.optionalKey<typeof DevEngineOrArray>;
	readonly runtime: S.optionalKey<typeof DevEngineOrArray>;
	readonly os: S.optionalKey<typeof DevEngineOrArray>;
	readonly cpu: S.optionalKey<typeof DevEngineOrArray>;
	readonly libc: S.optionalKey<typeof DevEngineOrArray>;
}> = S.Struct({
	packageManager: S.optionalKey(DevEngineOrArray),
	runtime: S.optionalKey(DevEngineOrArray),
	os: S.optionalKey(DevEngineOrArray),
	cpu: S.optionalKey(DevEngineOrArray),
	libc: S.optionalKey(DevEngineOrArray),
});

/**
 * The decoded `devEngines` field type.
 *
 * @public
 */
export type DevEngines = typeof DevEnginesSchema.Type;
