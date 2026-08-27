/**
 * One Effect Schema plus `$id`/`path` publication wiring for SchemaStore emit.
 *
 * A repo generating SchemaStore artifacts declares one target per emitted
 * document. Versioned catalog naming requires `name` whenever `version` is
 * set; the typed overloads make that pairing unrepresentable to omit.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import * as O from "@beep/utils/Option";
import { Schema } from "effect";
import type { SchemaVersion } from "./SchemaVersioning.ts";

const $I = $ScratchpadId.create("schemastore/SchemaTarget");

class InvalidSchemaTarget extends Schema.TaggedError<InvalidSchemaTarget>($I`InvalidSchemaTarget`)(
  "InvalidSchemaTarget",
  { field: Schema.Literals(["$id", "path", "name", "version"]), detail: Schema.NonEmptyString }
) {}

/**
 * A single schema publication target: an Effect Schema source paired with
 * the identity and destination it is serialized under. A repo generating
 * SchemaStore artifacts declares one target per emitted document (the
 * extraction source's `{schema, $id, path}` triples, generalized).
 *
 * Not a `Schema.Class`: a target carries a live Effect Schema value, which
 * is program wiring rather than serializable data.
 *
 * @see {@link SchemaTarget.make} for the constructor that builds this shape.
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface SchemaTarget {
  /** The Effect Schema source the document is generated from. */
  readonly schema: Schema.Constraint;
  /** The canonical `$id` URL the generated document declares. */
  readonly $id: string;
  /**
   * The catalog/file base name (`name.json` / `name-<version>.json`).
   *
   * Only the catalog path consumes it — a target that merely emits a file
   * to `path` needs no name, and inventing one to
   * satisfy the constructor duplicates the basename with no invariant
   * tying the two together. Required whenever `version` is present, since
   * versioned catalog naming is defined in terms of it.
   */
  readonly name?: string;
  /** The destination path the document is written to (`SchemaFile`). */
  readonly path: string;
  /** The version label, for versioned catalog mode. Omit for unversioned. */
  readonly version?: SchemaVersion;
}

/**
 * Builds a publication target, making versioned catalog naming (`name`
 * required with `version`) unrepresentable in the typed overloads.
 *
 * **Gotchas**
 *
 * Empty `$id` or `path`, an empty `name` when one is given, and `version`
 * without `name` throw a bare `Error` outside any tagged channel. The
 * `name`-with-`version` invariant is also enforced at runtime for untyped
 * callers.
 *
 * **Example** (Make unversioned and versioned targets)
 *
 * ```ts
 * import { SchemaTarget, SchemaVersioning } from "@beep/scratchpad/schemastore"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const Config = S.Struct({ name: S.String })
 * const unversioned = SchemaTarget.make({
 *   schema: Config,
 *   $id: "https://example.com/config.schema.json",
 *   path: "schemas/config.schema.json",
 * })
 *
 * console.log(unversioned.version)
 * // => undefined
 *
 * const parsed = SchemaVersioning.parseResult("1.0.0")
 * if (Result.isSuccess(parsed)) {
 *   const versioned = SchemaTarget.make({
 *     schema: Config,
 *     $id: "https://example.com/config.schema.json",
 *     name: "config",
 *     path: "schemas/config-1.0.0.schema.json",
 *     version: parsed.success,
 *   })
 *   console.log(versioned.name)
 *   // => "config"
 * }
 * ```
 *
 * @throws Throws `Error` when `$id` or `path` is empty, when `name` is given
 * but empty, or when `version` is given without `name`.
 * @see {@link SchemaPipeline.run} for the emit loop that consumes these targets.
 * @see {@link SchemaVersion} for the branded version label a versioned target carries.
 * @public
 * @category constructors
 * @since 0.0.0
 */
// biome-ignore lint/suspicious/noUnsafeDeclarationMerging: deliberate — the class carries only statics and a private constructor, so it contributes no instance members to the merge; the interface (above) remains the sole shape of a SchemaTarget value.
export class SchemaTarget {
  private constructor() {}

  /**
   * Builds an unversioned target. `name` is optional — only catalog
   * naming reads it, so a target that merely emits a file needs none.
   *
   * **Example** (Make an unversioned emit target)
   *
   * ```ts
   * import { SchemaTarget } from "@beep/scratchpad/schemastore"
   * import * as S from "effect/Schema"
   *
   * const target = SchemaTarget.make({
   *   schema: S.Struct({ name: S.String }),
   *   $id: "https://example.com/config.schema.json",
   *   path: "schemas/config.schema.json",
   * })
   * console.log(target.version)
   * // => undefined
   * ```
   *
   * @since 0.0.0
   */
  static make(options: {
    readonly schema: Schema.Constraint;
    readonly $id: string;
    readonly name?: string;
    readonly path: string;
  }): SchemaTarget;
  /**
   * Builds a versioned target. `name` is **required** here: versioned
   * catalog naming is `name-<version>.json`, so a version without a name
   * cannot be resolved — the overload pair makes that unrepresentable
   * rather than a runtime throw.
   */
  static make(options: {
    readonly schema: Schema.Constraint;
    readonly $id: string;
    readonly name: string;
    readonly path: string;
    readonly version: SchemaVersion;
  }): SchemaTarget;
  /**
   * Builds a target. `$id` and `path` must be non-empty — an empty
   * identity is a wiring mistake and throws, as does an empty `name` when
   * one is given. The `name`-with-`version` invariant is enforced by the
   * overloads above; the runtime check remains for untyped callers.
   */
  static make(options: {
    readonly schema: Schema.Constraint;
    readonly $id: string;
    readonly name?: string;
    readonly path: string;
    readonly version?: SchemaVersion;
  }): SchemaTarget {
    for (const key of ["$id", "path"] as const) {
      if (options[key].length === 0) {
        throw InvalidSchemaTarget.make({ field: key, detail: `SchemaTarget.make requires a non-empty "${key}"` });
      }
    }
    if (options.name !== undefined && options.name.length === 0) {
      throw InvalidSchemaTarget.make({
        field: "name",
        detail: 'SchemaTarget.make requires a non-empty "name" when one is given',
      });
    }
    if (options.version !== undefined && options.name === undefined) {
      throw InvalidSchemaTarget.make({
        field: "version",
        detail: 'SchemaTarget.make requires a "name" when "version" is given (catalog naming is name-<version>.json)',
      });
    }
    return {
      schema: options.schema,
      $id: options.$id,
      path: options.path,
      ...O.getSomesStruct({
        name: O.fromUndefinedOr(options.name),
        version: O.fromUndefinedOr(options.version),
      }),
    };
  }
}
