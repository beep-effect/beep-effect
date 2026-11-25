/**
 * The `devEngines` field model: a `DevEngine` record (a single runtime or
 * package-manager constraint) and the `DevEnginesSchema` record grouping the
 * `packageManager` / `runtime` / `os` / `cpu` / `libc` constraint slots.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PackageJsonId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $PackageJsonId.create("DevEngines");

/**
 * **Example** (Construct a runtime constraint)
 *
 * ```ts
 * import { DevEngine } from "@beep/package-json/DevEngines";
 *
 * const engine = DevEngine.make({ name: "node", version: ">=24", onFail: "error" });
 * console.log(engine.onFail) // "error"
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class DevEngine extends S.Opaque<DevEngine, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * The engine name (e.g. `node`, `pnpm`).
     *
     * **Example** (Read the required engine name)
     *
     * ```ts
     * import { DevEngine } from "@beep/package-json/DevEngines";
     *
     * const engine = DevEngine.make({ name: "node" });
     * console.log(engine.name) // "node"
     * ```
     *
     * @category getters
     * @since 0.0.0
     */
    name: S.String.pipe($I.annoteKey("DevEngine.name", { description: "The engine name (e.g. `node`, `pnpm`)." })),
    /**
     * The optional version constraint.
     *
     * **Example** (Read an engine version constraint)
     *
     * ```ts
     * import { DevEngine } from "@beep/package-json/DevEngines";
     *
     * const engine = DevEngine.make({ name: "node", version: ">=24" });
     * console.log(engine.version) // ">=24"
     * ```
     *
     * @category getters
     * @since 0.0.0
     */
    version: S.optionalKey(S.String).pipe(
      $I.annoteKey("DevEngine.version", { description: "The optional version constraint." })
    ),
    /**
     * The optional behavior when the constraint is unmet.
     *
     * **Details**
     *
     * npm documents `warn`, `error` and `ignore`, treating an absent value as
     * `error`. `download` comes from the OpenJS package-metadata
     * interoperability `devEngines` proposal, which pnpm implements for
     * `runtime` and `packageManager`: the tool remedies the mismatch by
     * downloading a satisfying version. Tools without it, npm included,
     * treat it as a failure.
     *
     * **Example** (Read the failure policy)
     *
     * ```ts
     * import { DevEngine } from "@beep/package-json/DevEngines";
     *
     * const engine = DevEngine.make({ name: "node", onFail: "warn" });
     * console.log(engine.onFail) // "warn"
     * ```
     *
     * @category getters
     * @since 0.0.0
     */
    onFail: S.optionalKey(S.Literals(["warn", "error", "ignore", "download"])).pipe(
      $I.annoteKey("DevEngine.onFail", {
        description:
          "The optional behavior when the constraint is unmet: `warn`, `error` or `ignore` (npm), or `download` (pnpm, per the OpenJS devEngines proposal).",
      })
    ),
  }).pipe(
    $I.annoteSchema("DevEngine", {
      description: "A single `devEngines` constraint with a name and optional `version` / `onFail`.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DevEngine {
  /**
   * The plain wire object a {@link DevEngine} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof DevEngine.Encoded;
}

/**
 * **Example** (Decode single and multiple engine constraints)
 *
 * ```ts
 * import { DevEngineOrArray } from "@beep/package-json/DevEngines";
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
>([DevEngine, S.Array(DevEngine)]).pipe(
  $I.annoteSchema("DevEngineOrArray", {
    description: "A `devEngines` constraint slot: a single DevEngine or an array of them.",
  })
);

/**
 * **Example** (Decode development engine slots)
 *
 * ```ts
 * import { DevEnginesSchema } from "@beep/package-json/DevEngines";
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
export class DevEnginesSchema extends S.Opaque<DevEnginesSchema, { readonly brand: unique symbol }>()(
  S.Struct({
    packageManager: S.optionalKey(DevEngineOrArray).pipe(
      $I.annoteKey("DevEnginesSchema.packageManager", {
        description: "Package-manager constraints for development, with optional versions and behavior when unmet",
      })
    ),
    runtime: S.optionalKey(DevEngineOrArray).pipe(
      $I.annoteKey("DevEnginesSchema.runtime", {
        description: "Runtime constraints for development, with optional versions and behavior when unmet",
      })
    ),
    os: S.optionalKey(DevEngineOrArray).pipe(
      $I.annoteKey("DevEnginesSchema.os", {
        description: "Operating-system constraints for development, with optional versions and behavior when unmet",
      })
    ),
    cpu: S.optionalKey(DevEngineOrArray).pipe(
      $I.annoteKey("DevEnginesSchema.cpu", {
        description: "CPU architecture constraints for development, with optional versions and behavior when unmet",
      })
    ),
    libc: S.optionalKey(DevEngineOrArray).pipe(
      $I.annoteKey("DevEnginesSchema.libc", {
        description: "C standard library constraints for development, with optional versions and behavior when unmet",
      })
    ),
  }).pipe(
    $I.annoteSchema("DevEnginesSchema", {
      description:
        "The `devEngines` field schema, modeling runtime and package-manager constraints as optional DevEngine slots.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DevEnginesSchema {
  /**
   * The plain wire object a {@link DevEnginesSchema} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof DevEnginesSchema.Encoded;
}

/**
 * The decoded `devEngines` field type.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type DevEngines = DevEnginesSchema;
