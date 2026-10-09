// The `devEngines` field model: a `DevEngine` class (a single runtime or
// package-manager constraint) and the `DevEnginesSchema` struct grouping the
// `packageManager` / `runtime` / `os` / `cpu` / `libc` constraint slots.

import { Schema } from "effect";

/**
 * A single `devEngines` constraint with a name and optional `version` / `onFail`.
 *
 * @public
 */
export class DevEngine extends Schema.Class<DevEngine>("DevEngine")({
	/** The engine name (e.g. `node`, `pnpm`). */
	name: Schema.String,
	/** The optional version constraint. */
	version: Schema.optionalKey(Schema.String),
	/** The optional behavior when the constraint is unmet. */
	onFail: Schema.optionalKey(Schema.Literals(["warn", "error", "ignore"])),
}) {}

/**
 * A `devEngines` constraint slot: a single {@link DevEngine} or an array of them.
 *
 * @public
 */
export const DevEngineOrArray: Schema.Union<[typeof DevEngine, Schema.$Array<typeof DevEngine>]> = Schema.Union([
	DevEngine,
	Schema.Array(DevEngine),
]);

/**
 * The `devEngines` field schema, modeling runtime and package-manager
 * constraints as optional {@link DevEngine} slots.
 *
 * @public
 */
export const DevEnginesSchema: Schema.Struct<{
	readonly packageManager: Schema.optionalKey<typeof DevEngineOrArray>;
	readonly runtime: Schema.optionalKey<typeof DevEngineOrArray>;
	readonly os: Schema.optionalKey<typeof DevEngineOrArray>;
	readonly cpu: Schema.optionalKey<typeof DevEngineOrArray>;
	readonly libc: Schema.optionalKey<typeof DevEngineOrArray>;
}> = Schema.Struct({
	packageManager: Schema.optionalKey(DevEngineOrArray),
	runtime: Schema.optionalKey(DevEngineOrArray),
	os: Schema.optionalKey(DevEngineOrArray),
	cpu: Schema.optionalKey(DevEngineOrArray),
	libc: Schema.optionalKey(DevEngineOrArray),
});

/**
 * The decoded `devEngines` field type.
 *
 * @public
 */
export type DevEngines = typeof DevEnginesSchema.Type;
