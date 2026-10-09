// The `devEngines` field model: a `DevEngine` class (a single runtime or
// package-manager constraint) and the `DevEnginesSchema` struct grouping the
// `packageManager` / `runtime` / `os` / `cpu` / `libc` constraint slots.

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/package-json/DevEngines");

/**
 * A single `devEngines` constraint with a name and optional `version` / `onFail`.
 *
 * **Example** (Construct a runtime constraint)
 *
 * ```ts
 * import { DevEngine } from "@beep/scratchpad/effected/package-json/DevEngines";
 *
 * const engine = DevEngine.make({ name: "node", version: ">=24", onFail: "error" });
 * console.log(engine.onFail) // "error"
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class DevEngine extends S.Class<DevEngine>($I`DevEngine`)({
	/**
	 * The engine name (e.g. `node`, `pnpm`).
	 *
	 * **Example** (Read the required engine name)
	 *
	 * ```ts
	 * import { DevEngine } from "@beep/scratchpad/effected/package-json/DevEngines";
	 *
	 * const engine = DevEngine.make({ name: "node" });
	 * console.log(engine.name) // "node"
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	name: S.String.annotateKey({ description: "The engine name (e.g. `node`, `pnpm`)." }),
	/**
	 * The optional version constraint.
	 *
	 * **Example** (Read an engine version constraint)
	 *
	 * ```ts
	 * import { DevEngine } from "@beep/scratchpad/effected/package-json/DevEngines";
	 *
	 * const engine = DevEngine.make({ name: "node", version: ">=24" });
	 * console.log(engine.version) // ">=24"
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	version: S.optionalKey(S.String).annotateKey({ description: "The optional version constraint." }),
	/**
	 * The optional behavior when the constraint is unmet.
	 *
	 * **Example** (Read the failure policy)
	 *
	 * ```ts
	 * import { DevEngine } from "@beep/scratchpad/effected/package-json/DevEngines";
	 *
	 * const engine = DevEngine.make({ name: "node", onFail: "warn" });
	 * console.log(engine.onFail) // "warn"
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	onFail: S.optionalKey(S.Literals(["warn", "error", "ignore"])).annotateKey({ description: "The optional behavior when the constraint is unmet." }),
}, $I.annote("DevEngine", { description: "A single `devEngines` constraint with a name and optional `version` / `onFail`." })) {}

/**
 * A `devEngines` constraint slot: a single {@link DevEngine} or an array of them.
 *
 * **Example** (Decode single and multiple engine constraints)
 *
 * ```ts
 * import { DevEngineOrArray } from "@beep/scratchpad/effected/package-json/DevEngines";
 * import * as S from "effect/Schema";
 *
 * const decode = S.decodeUnknownSync(DevEngineOrArray);
 * console.log(S.is(DevEngineOrArray)(decode({ name: "node" }))) // true
 * console.log(S.is(DevEngineOrArray)(decode([{ name: "node" }, { name: "bun" }]))) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
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
 * **Example** (Decode development engine slots)
 *
 * ```ts
 * import { DevEnginesSchema } from "@beep/scratchpad/effected/package-json/DevEngines";
 * import * as S from "effect/Schema";
 *
 * const engines = S.decodeUnknownSync(DevEnginesSchema)({ runtime: { name: "node", version: ">=24" } });
 * console.log(S.is(DevEnginesSchema)(engines)) // true
 * console.log(engines.runtime === undefined) // false
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
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
 * @category type-level
 * @since 0.0.0
 */
export type DevEngines = typeof DevEnginesSchema.Type;
