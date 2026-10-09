// The `devEngines` field model: a `DevEngine` class (a single runtime or
// package-manager constraint) and the `DevEnginesSchema` struct grouping the
// `packageManager` / `runtime` / `os` / `cpu` / `libc` constraint slots.

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/package-json/DevEngines");

/**
 * A single `devEngines` constraint with a name and optional `version` / `onFail`.
 *
 * @public
 */
export class DevEngine extends S.Class<DevEngine>($I`DevEngine`)({
	/** The engine name (e.g. `node`, `pnpm`). */
	name: S.String.annotateKey({ description: "The engine name (e.g. `node`, `pnpm`)." }),
	/** The optional version constraint. */
	version: S.optionalKey(S.String).annotateKey({ description: "The optional version constraint." }),
	/** The optional behavior when the constraint is unmet. */
	onFail: S.optionalKey(S.Literals(["warn", "error", "ignore"])).annotateKey({ description: "The optional behavior when the constraint is unmet." }),
}, $I.annote("DevEngine", { description: "A single `devEngines` constraint with a name and optional `version` / `onFail`." })) {}

/**
 * A `devEngines` constraint slot: a single {@link DevEngine} or an array of them.
 *
 * @public
 */
export const DevEngineOrArray: S.Union<[typeof DevEngine, S.$Array<typeof DevEngine>]> = S.Union<
	[typeof DevEngine, S.$Array<typeof DevEngine>]
>([
	DevEngine,
	S.Array(DevEngine),
]).annotate($I.annote("DevEngineOrArray", { description: "A `devEngines` constraint slot: a single DevEngine or an array of them." }));

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
	packageManager: S.optionalKey(DevEngineOrArray).annotateKey({ description: "Package-manager constraints for development, with optional versions and behavior when unmet" }),
	runtime: S.optionalKey(DevEngineOrArray).annotateKey({ description: "Runtime constraints for development, with optional versions and behavior when unmet" }),
	os: S.optionalKey(DevEngineOrArray).annotateKey({ description: "Operating-system constraints for development, with optional versions and behavior when unmet" }),
	cpu: S.optionalKey(DevEngineOrArray).annotateKey({ description: "CPU architecture constraints for development, with optional versions and behavior when unmet" }),
	libc: S.optionalKey(DevEngineOrArray).annotateKey({ description: "C standard library constraints for development, with optional versions and behavior when unmet" }),
}).pipe($I.annoteSchema("DevEnginesSchema", { description: "The `devEngines` field schema, modeling runtime and package-manager constraints as optional DevEngine slots." }));

/**
 * The decoded `devEngines` field type.
 *
 * @public
 */
export type DevEngines = typeof DevEnginesSchema.Type;
