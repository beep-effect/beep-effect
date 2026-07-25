/**
 * `Stdlib`
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {$ScratchpadId} from "@beep/identity";
import * as S from "effect/Schema";
import {NonEmptyTrimmedStr, NonNegativeInt, SchemaUtils} from "@beep/schema";
import { pipe} from "@beep/utils";
import {Tuple} from "effect";
import {DiagnosticKind} from "./interpreter/Interpreter.model.ts";

const $I = $ScratchpadId.create("StdLib.json");


/**
 * The `ExecutionLimits` model.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { ExecutionLimits } from "@beep/codemode";
 *
 * const thing: ExecutionLimits = ExecutionLimits.make()
 *
 * console.log(thing); // `{}`
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExecutionLimits extends S.Class<ExecutionLimits>($I`ExecutionLimits`)(
  {
    /**
     * Wall-clock milliseconds before interruption. Result delivery waits for tool cleanup.
     * No default: absent means no timeout.
     */
    timeoutMs: S.DurationFromMillis.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Wall-clock milliseconds before interruption. Result delivery waits for tool cleanup.\nNo default: absent means no timeout."
      })
    ),
    /** Maximum number of tool calls admitted by the runtime. No default: absent means unlimited. */
    maxToolCalls: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Maximum number of tool calls admitted by the runtime. No default: absent means unlimited. "
      })
    ),
    /**
     * Maximum UTF-8 bytes retained from the result and logs. Warnings have a separate equal budget;
     * truncation notices and host formatting are additional.
     */
    maxOutputBytes: S.Finite.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Maximum UTF-8 bytes retained from the result and logs. Warnings have a separate equal budget;\ntruncation notices and host formatting are additional."
      })
    )
  },
  $I.annote("ExecutionLimits", {
    description: "The `ExecutionLimits` model"
  })
) {
}

/**
 * Companion namespace for {@link ExecutionLimits}
 *
 * @since 0.0.0
 */
export declare namespace ExecutionLimits {
  /**
   * Companion encoded type for {@link ExecutionLimits}
   *
   * **Example**
   *
   * @example
   * ```ts
   * import { ExecutionLimits } from "@beep/codemode";
   * import * as S from "effect/Schema";
   * const thingEncoded: ExecutionLimits.Encoded = S.encodeSync(ExecutionLimits)(ExecutionLimits.make());
   *
   * console.log(thingEncoded); // `{}`
   * ```
   *
   * @category models
   * @since 0.0.0
   */
  export interface Encoded {
  }
}


/**
 * The `ResolvedExecutionLimits` model.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { ResolvedExecutionLimits } from "@beep/codemode";
 *
 * const thing: ResolvedExecutionLimits = ResolvedExecutionLimits.make()
 *
 * console.log(thing); // `{}`
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResolvedExecutionLimits extends S.Class<ResolvedExecutionLimits>($I`ResolvedExecutionLimits`)(
  {
    /**
     * Wall-clock milliseconds before interruption. Result delivery waits for tool cleanup.
     * No default: absent means no timeout.
     */
    timeoutMs: S.DurationFromMillis.pipe(
      S.OptionFromUndefinedOr,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Wall-clock milliseconds before interruption. Result delivery waits for tool cleanup.\nNo default: absent means no timeout."
      })
    ),
    /** Maximum number of tool calls admitted by the runtime. No default: absent means unlimited. */
    maxToolCalls: NonNegativeInt.pipe(
      S.OptionFromUndefinedOr,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Maximum number of tool calls admitted by the runtime. No default: absent means unlimited. "
      })
    ),
    /**
     * Maximum UTF-8 bytes retained from the result and logs. Warnings have a separate equal budget;
     * truncation notices and host formatting are additional.
     */
    maxOutputBytes: S.Finite.pipe(
      S.OptionFromUndefinedOr,
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Maximum UTF-8 bytes retained from the result and logs. Warnings have a separate equal budget;\ntruncation notices and host formatting are additional."
      })
    )
  },
  $I.annote("ResolvedExecutionLimits", {
    description: "The `ResolvedExecutionLimits` model"
  })
) {
}

/**
 * A JSON value that can cross the confined interpreter boundary.
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DataValue = S.Json.pipe(S.brand("DataValue"));

export type DataValue = typeof DataValue.Type;

/**
 * Schema for a host tool input containing CodeMode source.
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Input extends S.Class<Input>($I`Input`)(
  {
    code: S.String,
  },
  $I.annote("Input", {
    description: ""
  })
) {
}


export const Diagnostic = DiagnosticKind.mapMembers((members) => {
  const make = <TKind extends DiagnosticKind>(literalSchema: S.Literal<TKind>) => S.Struct({
    kind: S.tag(literalSchema.literal),
    message: S.String,
    location: S.Struct({
      line: NonNegativeInt,
      column: NonNegativeInt
    }).pipe(S.OptionFromOptionalKey),
    suggestions: S.String.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  });

  return pipe(
    members,
    Tuple.evolve(
      [
        make,
        make,
        make,
        make,
        make,
        make,
        make,
        make,
        make,
        make,
      ]
    )
  );
}).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("Diagnostic", {
    description: "TODO"
  })
);

export type Diagnostic = typeof Diagnostic.Type;


export class ToolCallSchema extends S.Class<ToolCallSchema>($I`ToolCallSchema`)(
  {
    name: NonEmptyTrimmedStr
  },
  $I.annote("ToolCallSchema", {
    description: "TODO"
  })
) {}

export class Success extends S.Class<Success>($I`Success`)(
  {
  ok: S.Literal(true),
  value: S.Json,
  warnings: Diagnostic.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  logs: S.String.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  truncated: S.Boolean.pipe(S.OptionFromOptionalKey),
  toolCalls: S.Array(ToolCallSchema),
},
  $I.annote("Success", {
    description: "TODO"
  })
) {}



