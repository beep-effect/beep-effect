/**
 * Callable schemas for runtime function values with schema-backed input and
 * output contracts.
 *
 * The schema itself only validates that a value is a function. The attached
 * helper methods validate payloads, results, and expected effect failures at
 * invocation time using the provided input, output, and error schemas.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity/packages";
import { Cause, Effect, Result, SchemaIssue, SchemaParser } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as SchemaUtils from "../SchemaUtils/index.ts";

const $I = $SchemaId.create("Fn");
type NoArgInputSchema = typeof S.Never | typeof S.Undefined | typeof S.Void;

const isNeverKeyword = P.isTagged("Never");
const isUndefinedKeyword = P.isTagged("Undefined");
const isVoidKeyword = P.isTagged("Void");

const isFunctionValue = <A>(value: unknown): value is A => P.isFunction(value);
const schemaIssueToError = (cause: S.SchemaError["issue"]): S.SchemaError => new S.SchemaError(cause);
const withNeverEquivalence = <Schema extends S.Top>(schema: Schema): Schema =>
  isNeverKeyword(schema.ast) ? (schema.pipe(S.overrideToEquivalence(() => () => true)) as Schema) : schema;

const validateOutputEffect = <Output extends S.Top>(
  outputSchema: Output,
  output: Output["Type"]
): Effect.Effect<Output["Type"], SchemaIssue.Issue> => SchemaParser.decodeUnknownEffect(S.toType(outputSchema))(output);

const validateErrorEffect = <Error extends S.Top>(
  errorSchema: Error,
  error: Error["Type"]
): Effect.Effect<Error["Type"], SchemaIssue.Issue> => SchemaParser.decodeUnknownEffect(S.toType(errorSchema))(error);

const decodeInputSync = <Input extends S.Top>(inputSchema: Input, input: unknown): Input["Type"] =>
  Result.getOrThrowWith(
    SchemaParser.decodeUnknownResult(S.make<S.ConstraintDecoder<Input["Type"]>>(inputSchema.ast))(input),
    schemaIssueToError
  );

const validateOutputSync = <Output extends S.Top>(outputSchema: Output, output: Output["Type"]): Output["Type"] =>
  Result.getOrThrowWith(
    SchemaParser.decodeUnknownResult(S.make<S.ConstraintDecoder<Output["Type"]>>(S.toType(outputSchema).ast))(output),
    schemaIssueToError
  );

const validateFailReasonEffect = <Error extends S.Top>(
  errorSchema: Error,
  reason: Cause.Reason<Error["Type"]>
): Effect.Effect<Cause.Reason<Error["Type"]>, SchemaIssue.Issue> => {
  if (!Cause.isFailReason(reason) || isNeverKeyword(errorSchema.ast)) {
    return Effect.succeed(reason);
  }

  return Effect.map(validateErrorEffect(errorSchema, reason.error), (error) =>
    Cause.makeFailReason(error).annotate(Cause.reasonAnnotations(reason))
  );
};

const validateErrorCauseEffect = <Error extends S.Top>(
  errorSchema: Error,
  cause: Cause.Cause<Error["Type"]>
): Effect.Effect<Cause.Cause<Error["Type"]>, SchemaIssue.Issue> =>
  Effect.map(
    Effect.forEach(cause.reasons, (reason) => validateFailReasonEffect(errorSchema, reason)),
    Cause.fromReasons
  );

const fnDeclarationAnnotations = {
  description: "Schema for runtime function values with schema-backed input, output, and error contracts.",
  expected: "Function",
  generation: {
    importDeclaration: 'import { Fn, type FnType } from "@beep/schema"',
    runtime: "Fn({ input: ?, output: ?, error: ? })",
    Type: "FnType<?, ?>",
  },
  toEquivalence:
    () =>
    <A extends Function>(self: A, that: A): boolean =>
      self === that,
  toFormatter: () => (): string => "[Function]",
  typeConstructor: {
    _tag: "@beep/schema/Fn",
  },
};

const anyFnAnnotations = {
  description: "Schema for any runtime function value.",
  expected: "Function",
  generation: {
    importDeclaration: 'import { AnyFn } from "@beep/schema"',
    runtime: "AnyFn",
    Type: "Function",
  },
  toEquivalence:
    () =>
    <A extends Function>(self: A, that: A): boolean =>
      self === that,
  toFormatter: () => (): string => "[Function]",
  typeConstructor: {
    _tag: "@beep/schema/AnyFn",
  },
};

/**
 * Function type helper used by {@link Fn}. Inputs modeled with `never`,
 * `undefined`, or `void` produce thunk (zero-argument) call signatures;
 * all other input types produce unary call signatures.
 *
 * **Example** (Thunk and unary signatures)
 *
 * ```ts
 * import type { FnType } from "@beep/schema/Fn"
 *
 * const thunk = (() => "ready") satisfies FnType<never, string>
 * const unary = ((input: number) => `${input}`) satisfies FnType<number, string>
 *
 * console.log(thunk(), unary(1))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FnType<Input, Output> = [Input] extends [never]
  ? () => Output
  : [Input] extends [void]
    ? () => Output
    : (input: Input) => Output;

type FnRuntime<Input extends S.Top, Output extends S.Top> = FnType<Input["Type"], Output["Type"]>;
type FnIso<Input extends S.Top, Output extends S.Top> = FnType<Input["Iso"], Output["Iso"]>;

type FnEffectWrapperNoArg<Output extends S.Top, E, R> = () => Effect.Effect<Output["Type"], E, R>;
type FnEffectWrapperUnary<Output extends S.Top, E, R> = (input: unknown) => Effect.Effect<Output["Type"], E, R>;
type FnSyncWrapperNoArg<Output extends S.Top> = () => Output["Type"];
type FnSyncWrapperUnary<Output extends S.Top> = (input: unknown) => Output["Type"];
type FnImplementEffectNoArg<Output extends S.Top, Error extends S.Top> = {
  <R>(
    handler: () => Effect.Effect<Output["Type"], Error["Type"], R>
  ): FnEffectWrapperNoArg<Output, Error["Type"] | SchemaIssue.Issue, R>;
  <E, R>(
    handler: [Error["Type"]] extends [never] ? () => Effect.Effect<Output["Type"], E, R> : never
  ): FnEffectWrapperNoArg<Output, E | SchemaIssue.Issue, R>;
};
type FnImplementEffectUnary<Input extends S.Top, Output extends S.Top, Error extends S.Top> = {
  <R>(
    handler: FnType<Input["Type"], Effect.Effect<Output["Type"], Error["Type"], R>>
  ): FnEffectWrapperUnary<Output, Error["Type"] | SchemaIssue.Issue, Input["DecodingServices"] | R>;
  <E, R>(
    handler: [Error["Type"]] extends [never] ? FnType<Input["Type"], Effect.Effect<Output["Type"], E, R>> : never
  ): FnEffectWrapperUnary<Output, E | SchemaIssue.Issue, Input["DecodingServices"] | R>;
};
type FnNoArgInput<Input extends S.Top> = [Input["Type"]] extends [never]
  ? typeof S.Never
  : [Input["Type"]] extends [undefined]
    ? typeof S.Undefined
    : [Input["Type"]] extends [void]
      ? typeof S.Void
      : NoArgInputSchema;

/**
 * Schema surface for zero-argument (thunk-like) functions created by {@link Fn}.
 * Provides `implement`, `implementEffect`, and `implementSync` helpers.
 *
 * **Example** (Implement zero-argument schema)
 *
 * ```ts
 * import { Fn, type FnSchemaNoArg } from "@beep/schema/Fn"
 * import * as S from "effect/Schema"
 *
 * const schema: FnSchemaNoArg<typeof S.Never, typeof S.String, typeof S.Never> = Fn({ output: S.String })
 * const getValue = schema.implementSync(() => "ready")
 *
 * console.log(getValue())
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface FnSchemaNoArg<Input extends NoArgInputSchema, Output extends S.Top, Error extends S.Top>
  extends S.declareConstructor<
    FnRuntime<Input, Output>,
    FnRuntime<Input, Output>,
    readonly [Input, Output, Error],
    FnIso<Input, Output>
  > {
  readonly errorSchema: Error;
  readonly implement: (handler: () => Output["Type"]) => FnEffectWrapperNoArg<Output, SchemaIssue.Issue, never>;
  readonly implementEffect: FnImplementEffectNoArg<Output, Error>;
  readonly implementSync: (handler: () => Output["Type"]) => FnSyncWrapperNoArg<Output>;
  readonly inputSchema: Input;
  readonly outputSchema: Output;
  readonly Rebuild: this;
}

/**
 * Schema surface for unary functions created by {@link Fn}. Provides
 * `implement`, `implementEffect`, and `implementSync` helpers that decode
 * input and validate output at invocation time.
 *
 * **Example** (Implement unary schema)
 *
 * ```ts
 * import { Fn, type FnSchemaUnary } from "@beep/schema/Fn"
 * import * as S from "effect/Schema"
 *
 * const schema: FnSchemaUnary<typeof S.Finite, typeof S.String, typeof S.Never> = Fn({
 *   input: S.Finite,
 *   output: S.String
 * })
 * const format = schema.implementSync((input) => `${input}`)
 *
 * console.log(format(1))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface FnSchemaUnary<Input extends S.Top, Output extends S.Top, Error extends S.Top>
  extends S.declareConstructor<
    FnRuntime<Input, Output>,
    FnRuntime<Input, Output>,
    readonly [Input, Output, Error],
    FnIso<Input, Output>
  > {
  readonly errorSchema: Error;
  readonly implement: (
    handler: FnType<Input["Type"], Output["Type"]>
  ) => FnEffectWrapperUnary<Output, SchemaIssue.Issue, Input["DecodingServices"]>;
  readonly implementEffect: FnImplementEffectUnary<Input, Output, Error>;
  readonly implementSync: (handler: FnType<Input["Type"], Output["Type"]>) => FnSyncWrapperUnary<Output>;
  readonly inputSchema: Input;
  readonly outputSchema: Output;
  readonly Rebuild: this;
}

/**
 * Union schema type returned by {@link Fn}. Resolves to either
 * {@link FnSchemaNoArg} or {@link FnSchemaUnary} based on the input schema.
 *
 * **Example** (Union type output schema)
 *
 * ```ts
 * import type { FnSchema } from "@beep/schema/Fn"
 * import * as S from "effect/Schema"
 *
 * type FormatCount = FnSchema<typeof S.Finite, typeof S.String>
 * const schema = S.String satisfies FormatCount["outputSchema"]
 *
 * console.log(S.isSchema(schema))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FnSchema<Input extends S.Top, Output extends S.Top, Error extends S.Top = typeof S.Never> = [
  Input["Type"],
] extends [never]
  ? FnSchemaNoArg<FnNoArgInput<Input>, Output, Error>
  : [Input["Type"]] extends [void]
    ? FnSchemaNoArg<FnNoArgInput<Input>, Output, Error>
    : FnSchemaUnary<Input, Output, Error>;

/**
 * Subset of the {@link FnSchema} surface exposing only the invocation helpers
 * and sub-schemas (`implement`, `implementEffect`, `implementSync`,
 * `inputSchema`, `outputSchema`, `errorSchema`).
 *
 * **Example** (Statics implementSync helper)
 *
 * ```ts
 * import { Fn, type FnSchemaStatics } from "@beep/schema/Fn"
 * import * as S from "effect/Schema"
 *
 * const statics = Fn({ input: S.Finite, output: S.String }) satisfies FnSchemaStatics<typeof S.Finite, typeof S.String>
 * const format = statics.implementSync((input) => `${input}`)
 *
 * console.log(format(1))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FnSchemaStatics<Input extends S.Top, Output extends S.Top, Error extends S.Top = typeof S.Never> = Pick<
  FnSchema<Input, Output, Error>,
  "implement" | "implementEffect" | "implementSync" | "inputSchema" | "outputSchema" | "errorSchema"
>;

const makeFnDeclaration = <Input extends S.Top, Output extends S.Top, Error extends S.Top>(
  inputSchema: Input,
  outputSchema: Output,
  errorSchema: Error
) =>
  S.declareConstructor<FnRuntime<Input, Output>, FnRuntime<Input, Output>, FnIso<Input, Output>>()(
    [withNeverEquivalence(inputSchema), withNeverEquivalence(outputSchema), withNeverEquivalence(errorSchema)],
    () => (value, ast) =>
      isFunctionValue<FnRuntime<Input, Output>>(value)
        ? Effect.succeed(value)
        : Effect.fail(new SchemaIssue.InvalidType(ast)),
    fnDeclarationAnnotations
  );

const makeNoArgStatics = <Input extends NoArgInputSchema, Output extends S.Top, Error extends S.Top>(
  inputSchema: Input,
  outputSchema: Output,
  errorSchema: Error
): Pick<
  FnSchemaNoArg<Input, Output, Error>,
  "implement" | "implementEffect" | "implementSync" | "inputSchema" | "outputSchema" | "errorSchema"
> => {
  const implement: FnSchemaNoArg<Input, Output, Error>["implement"] = (handler) => () =>
    Effect.flatMap(
      Effect.sync(handler),
      Effect.fnUntraced(function* (output) {
        return yield* validateOutputEffect(outputSchema, output);
      })
    );

  const implementEffect = isNeverKeyword(errorSchema.ast)
    ? <HandlerError, R>(
        handler: () => Effect.Effect<Output["Type"], HandlerError, R>
      ): FnEffectWrapperNoArg<Output, HandlerError | SchemaIssue.Issue, R> =>
        () =>
          Effect.matchCauseEffect(handler(), {
            onFailure: (cause) => Effect.failCause(cause),
            onSuccess: (output) => validateOutputEffect(outputSchema, output),
          })
    : <R>(
        handler: () => Effect.Effect<Output["Type"], Error["Type"], R>
      ): FnEffectWrapperNoArg<Output, Error["Type"] | SchemaIssue.Issue, R> =>
        () =>
          Effect.matchCauseEffect(handler(), {
            onFailure: (cause) =>
              Effect.flatMap(
                validateErrorCauseEffect(errorSchema, cause),
                Effect.fnUntraced(function* (validatedCause) {
                  return yield* Effect.failCause(validatedCause);
                })
              ),
            onSuccess: (output) => validateOutputEffect(outputSchema, output),
          });

  const implementSync: FnSchemaNoArg<Input, Output, Error>["implementSync"] = (handler) => () =>
    validateOutputSync(outputSchema, handler());

  return {
    errorSchema,
    implement,
    implementEffect: implementEffect as FnSchemaNoArg<Input, Output, Error>["implementEffect"],
    implementSync,
    inputSchema,
    outputSchema,
  };
};

const makeUnaryStatics = <Input extends S.Top, Output extends S.Top, Error extends S.Top>(
  inputSchema: Input,
  outputSchema: Output,
  errorSchema: Error
): Pick<
  FnSchemaUnary<Input, Output, Error>,
  "implement" | "implementEffect" | "implementSync" | "inputSchema" | "outputSchema" | "errorSchema"
> => {
  const implement: FnSchemaUnary<Input, Output, Error>["implement"] = (handler) => (input) =>
    Effect.flatMap(
      SchemaParser.decodeUnknownEffect(inputSchema)(input),
      Effect.fnUntraced(function* (decodedInput) {
        return yield* Effect.flatMap(
          Effect.sync(() => handler(decodedInput)),
          Effect.fnUntraced(function* (output) {
            return yield* validateOutputEffect(outputSchema, output);
          })
        );
      })
    );

  const implementEffect = isNeverKeyword(errorSchema.ast)
    ? <HandlerError, R>(
        handler: FnType<Input["Type"], Effect.Effect<Output["Type"], HandlerError, R>>
      ): FnEffectWrapperUnary<Output, HandlerError | SchemaIssue.Issue, Input["DecodingServices"] | R> =>
        (input: unknown) =>
          Effect.flatMap(
            SchemaParser.decodeUnknownEffect(inputSchema)(input),
            Effect.fnUntraced(function* (decodedInput) {
              return yield* Effect.matchCauseEffect(handler(decodedInput), {
                onFailure: (cause) => Effect.failCause(cause),
                onSuccess: (output) => validateOutputEffect(outputSchema, output),
              });
            })
          )
    : <R>(
        handler: FnType<Input["Type"], Effect.Effect<Output["Type"], Error["Type"], R>>
      ): FnEffectWrapperUnary<Output, Error["Type"] | SchemaIssue.Issue, Input["DecodingServices"] | R> =>
        (input: unknown) =>
          Effect.flatMap(
            SchemaParser.decodeUnknownEffect(inputSchema)(input),
            Effect.fnUntraced(function* (decodedInput) {
              return yield* Effect.matchCauseEffect(handler(decodedInput), {
                onFailure: (cause) =>
                  Effect.flatMap(
                    validateErrorCauseEffect(errorSchema, cause),
                    Effect.fnUntraced(function* (validatedCause) {
                      return yield* Effect.failCause(validatedCause);
                    })
                  ),
                onSuccess: (output) => validateOutputEffect(outputSchema, output),
              });
            })
          );

  const implementSync: FnSchemaUnary<Input, Output, Error>["implementSync"] = (handler) => (input) =>
    validateOutputSync(outputSchema, handler(decodeInputSync(inputSchema, input)));

  return {
    errorSchema,
    implement,
    implementEffect: implementEffect as FnSchemaUnary<Input, Output, Error>["implementEffect"],
    implementSync,
    inputSchema,
    outputSchema,
  };
};

const makeNoArgFnSchema = <Input extends NoArgInputSchema, Output extends S.Top, Error extends S.Top>(
  inputSchema: Input,
  outputSchema: Output,
  errorSchema: Error
): FnSchemaNoArg<Input, Output, Error> => {
  const declaration = makeFnDeclaration(inputSchema, outputSchema, errorSchema);

  return S.make<FnSchemaNoArg<Input, Output, Error>>(declaration.ast).pipe(
    $I.annoteSchema("Fn", {
      description: "Schema for runtime function values with schema-backed input, output, and error contracts.",
    }),
    SchemaUtils.withStatics(() => ({ ...makeNoArgStatics(inputSchema, outputSchema, errorSchema) }))
  );
};

const makeUnaryFnSchema = <Input extends S.Top, Output extends S.Top, Error extends S.Top>(
  inputSchema: Input,
  outputSchema: Output,
  errorSchema: Error
): FnSchemaUnary<Input, Output, Error> => {
  const declaration = makeFnDeclaration(inputSchema, outputSchema, errorSchema);

  return S.make<FnSchemaUnary<Input, Output, Error>>(declaration.ast).pipe(
    $I.annoteSchema("Fn", {
      description: "Schema for runtime function values with schema-backed input, output, and error contracts.",
    }),
    SchemaUtils.withStatics(() => ({ ...makeUnaryStatics(inputSchema, outputSchema, errorSchema) }))
  );
};

/**
 * Schema for any runtime function value.
 *
 * **Example** (Decode unknown function)
 *
 * ```ts
 * import { AnyFn } from "@beep/schema"
 * import * as S from "effect/Schema"
 *
 * const fn = S.decodeUnknownSync(AnyFn)(() => "hello")
 * console.log(fn)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const AnyFn = S.declare<Function>(isFunctionValue, anyFnAnnotations).pipe(
  $I.annoteSchema("AnyFn", {
    description: "Schema for any runtime function value.",
  })
);

/**
 * Type for {@link AnyFn}.
 *
 * **Example** (Typed decoded function)
 *
 * ```ts
 * import { AnyFn } from "@beep/schema"
 * import * as S from "effect/Schema"
 *
 * const fn: AnyFn = S.decodeUnknownSync(AnyFn)(() => "hello")
 * console.log(fn())
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AnyFn = typeof AnyFn.Type;

/**
 * Creates a thunk schema whose invocation output is validated against the
 * provided schema and whose `implementEffect` error channel can optionally be
 * validated against the provided error schema.
 *
 * **Example** (Implement string thunk)
 *
 * ```ts
 * import { ThunkOf } from "@beep/schema"
 * import * as S from "effect/Schema"
 *
 * const GetGreeting = ThunkOf(S.String)
 * const greeting = GetGreeting.implementSync(() => "hello")
 *
 * console.log(greeting)
 * ```
 *
 * @param output - Schema for the thunk result.
 * @param error - Optional schema for the expected effect error channel.
 * @returns A zero-argument {@link Fn} schema.
 * @category validation
 * @since 0.0.0
 */
export function ThunkOf<Output extends S.Top>(output: Output): FnSchema<typeof S.Never, Output, typeof S.Never>;
/**
 * Creates a thunk schema whose effect failure channel is validated against the
 * provided error schema.
 *
 * **Example** (Thunk with error schema)
 *
 * ```ts
 * import { ThunkOf } from "@beep/schema"
 * import * as S from "effect/Schema"
 *
 * const GetCount = ThunkOf({ output: S.Finite, error: S.String })
 * console.log(S.isSchema(GetCount.errorSchema))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export function ThunkOf<Output extends S.Top, Error extends S.Top>(options: {
  readonly output: Output;
  readonly error: Error;
}): FnSchema<typeof S.Never, Output, Error>;
/**
 * Creates a thunk schema from an output schema and optional error schema.
 *
 * **Example** (Create and call thunk)
 *
 * ```ts
 * import { ThunkOf } from "@beep/schema"
 * import * as S from "effect/Schema"
 *
 * const GetName = ThunkOf(S.String)
 * const getName = GetName.implementSync(() => "Ada")
 * console.log(getName())
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export function ThunkOf<Output extends S.Top, Error extends S.Top>(
  outputOrOptions: Output | { readonly output: Output; readonly error: Error }
) {
  const { output, error } = S.isSchema(outputOrOptions)
    ? { output: outputOrOptions, error: undefined }
    : outputOrOptions;

  return makeNoArgFnSchema(S.Never, output, error ?? S.Never);
}

/**
 * Creates a zero-argument function schema whose result is validated against the
 * provided output schema.
 *
 * **Example** (Zero-argument greeting schema)
 *
 * ```ts
 * import { Fn } from "@beep/schema"
 * import * as S from "effect/Schema"
 *
 * const GetGreeting = Fn({ output: S.String })
 * const greeting = GetGreeting.implementSync(() => "hello")
 *
 * console.log(greeting())
 * ```
 *
 * @param options - Output and optional error contracts for the thunk.
 * @returns A thunk schema with invocation helpers.
 * @category validation
 * @since 0.0.0
 */
export function Fn<Output extends S.Top, Error extends S.Top = typeof S.Never>(options: {
  readonly output: Output;
  readonly error?: Error;
}): FnSchema<typeof S.Never, Output, Error>;

/**
 * Creates a zero-argument function schema that preserves an explicit
 * `Schema.Undefined` input contract.
 *
 * **Example** (Undefined input thunk)
 *
 * ```ts
 * import { Fn } from "@beep/schema"
 * import * as S from "effect/Schema"
 *
 * const GetTime = Fn({ input: S.Undefined, output: S.Finite })
 * const getTime = GetTime.implementSync(() => Date.now())
 * console.log(getTime())
 * ```
 *
 * @param options - Input/output contract for the thunk-like function.
 * @returns A thunk schema whose `inputSchema` remains `Schema.Undefined`.
 * @category validation
 * @since 0.0.0
 */
export function Fn<Output extends S.Top, Error extends S.Top = typeof S.Never>(options: {
  readonly input: typeof S.Undefined;
  readonly output: Output;
  readonly error?: Error;
}): FnSchema<typeof S.Undefined, Output, Error>;

/**
 * Creates a zero-argument function schema that preserves an explicit
 * `Schema.Void` input contract.
 *
 * **Example** (Void input noop)
 *
 * ```ts
 * import { Fn } from "@beep/schema"
 * import * as S from "effect/Schema"
 *
 * const Noop = Fn({ input: S.Void, output: S.Void })
 * const noop = Noop.implementSync(() => undefined)
 * console.log(noop())
 * ```
 *
 * @param options - Input/output contract for the thunk-like function.
 * @returns A thunk schema whose `inputSchema` remains `Schema.Void`.
 * @category validation
 * @since 0.0.0
 */
export function Fn<Output extends S.Top, Error extends S.Top = typeof S.Never>(options: {
  readonly input: typeof S.Void;
  readonly output: Output;
  readonly error?: Error;
}): FnSchema<typeof S.Void, Output, Error>;

/**
 * Creates a unary function schema. Invocation helpers decode incoming payloads
 * with `options.input` and validate handler results against `options.output`.
 *
 * **Example** (Unary format count)
 *
 * ```ts
 * import { Fn } from "@beep/schema"
 * import * as S from "effect/Schema"
 *
 * const FormatCount = Fn({
 *   input: S.Finite,
 *   output: S.String
 * })
 *
 * const formatCount = FormatCount.implementSync((count) => `${count}`)
 *
 * console.log(formatCount(1))
 * ```
 *
 * @param options - Input, output, and optional error contracts for the function.
 * @returns A unary function schema with invocation helpers.
 * @category validation
 * @since 0.0.0
 */
export function Fn<Input extends S.Top, Output extends S.Top, Error extends S.Top = typeof S.Never>(options: {
  readonly input: Input;
  readonly output: Output;
  readonly error?: Error;
}): FnSchema<Input, Output, Error>;

/**
 * Creates a function schema from the canonical options object.
 *
 * **Example** (Canonical options schema)
 *
 * ```ts
 * import { Fn } from "@beep/schema"
 * import * as S from "effect/Schema"
 *
 * const FormatCount = Fn({ input: S.Finite, output: S.String })
 * const formatCount = FormatCount.implementSync((count) => `${count}`)
 *
 * console.log(formatCount(1))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export function Fn<Output extends S.Top, Error extends S.Top = typeof S.Never>(options: {
  readonly input?: S.Top;
  readonly output: Output;
  readonly error?: Error;
}):
  | FnSchemaNoArg<typeof S.Never, Output, typeof S.Never | Error>
  | FnSchemaNoArg<typeof S.Undefined, Output, typeof S.Never | Error>
  | FnSchemaNoArg<typeof S.Void, Output, typeof S.Never | Error>
  | FnSchemaUnary<S.Top, Output, typeof S.Never | Error> {
  const errorSchema = options.error ?? S.Never;

  if (options.input === undefined) {
    return makeNoArgFnSchema(S.Never, options.output, errorSchema);
  }

  if (isNeverKeyword(options.input.ast)) {
    return makeNoArgFnSchema(S.Never, options.output, errorSchema);
  }

  if (isUndefinedKeyword(options.input.ast)) {
    return makeNoArgFnSchema(S.Undefined, options.output, errorSchema);
  }

  if (isVoidKeyword(options.input.ast)) {
    return makeNoArgFnSchema(S.Void, options.output, errorSchema);
  }

  return makeUnaryFnSchema(options.input, options.output, errorSchema);
}
