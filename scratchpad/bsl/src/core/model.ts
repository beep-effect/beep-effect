/**
 * Defines the dialect-neutral model statics consumed by projectors and repositories.
 *
 * The structural contract keeps table identity, original fields, resolved
 * metadata, and table extras available without coupling core services to a dialect.
 *
 * @since 0.0.0
 */
import { String as StringSchema, TaggedError } from "effect/Schema";
import type * as Field from "./Field.ts";
import type * as Meta from "./Meta.ts";

/**
 * Reports a model declaration that violates a SQL invariant at runtime.
 *
 * **Details**
 *
 * The error names the offending field when possible. It mirrors compile-time
 * validators for callers that suppress types or hand-build field metadata.
 *
 * **Example** (Inspect a model invariant)
 *
 * ```ts
 * import { ModelInvariantError } from
 *   "@beep/effect-drizzle"
 *
 * const error = ModelInvariantError.make({
 *   message: "primary keys cannot be nullable",
 *   fieldName: "id"
 * })
 *
 * error._tag // => "ModelInvariantError"
 * error.fieldName // => "id"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ModelInvariantError extends TaggedError<ModelInvariantError>(
  "@beep/effect-drizzle/ModelInvariantError",
)(
  "ModelInvariantError",
  { message: StringSchema, fieldName: StringSchema },
  {
    description: "An @beep/effect-drizzle model declaration violates a SQL invariant.",
  },
) {}

/** Internal structural model bound shared by dialect projectors. */
export interface AnyModel {
  readonly sql: {
    readonly tableName: string;
    readonly fields: Readonly<Record<string, Field.Input>>;
    readonly columns: Readonly<Record<string, Meta.Meta>>;
    readonly extras: ((columns: never) => ReadonlyArray<unknown>) | undefined;
  };
}
