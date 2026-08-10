/** Dialect-neutral model statics shared by projectors and repositories. */
import * as S from "effect/Schema";
import type * as Field from "./Field.ts";
import type * as Meta from "./Meta.ts";

/** Runtime model invariant failure. */
export class ModelInvariantError extends S.TaggedError<ModelInvariantError>(
  "@beep/effect-drizzle/ModelInvariantError",
)(
  "ModelInvariantError",
  { message: S.String, fieldName: S.String },
  {
    description: "An @beep/effect-drizzle model declaration violates a SQL invariant.",
  },
) {}

/** Dialect-neutral structural model bound. */
export interface AnyModel {
  readonly sql: {
    readonly tableName: string;
    readonly fields: Readonly<Record<string, Field.Input>>;
    readonly columns: Readonly<Record<string, Meta.Meta>>;
    readonly extras: ((columns: never) => ReadonlyArray<unknown>) | undefined;
  };
}
