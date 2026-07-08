/**
 * Operations/Composable - composable NLP operations as Kleisli arrows.
 *
 * An {@link OperationBuilder} wraps an effectful arrow `A -> Effect<B, E, R>` with
 * its input/output schemas, exposing the categorical combinators: `map` (Functor),
 * `flatMap` (Monad), `product`/`zipWith` (Applicative), plus traversal helpers.
 * `run` applies the arrow to a typed input; the schemas are carried as metadata.
 *
 * Effect v4 `@beep/nlp` implementation notes:
 * - the `@effect/typeclass` instances (Foldable/SemiApplicative/Traversable) are
 *   reimplemented on core `effect` (`Effect.zipWith`/`Effect.all`/`Effect.forEach`
 *   and `Monoid` from {@link @beep/nlp/Algebra/Monoid#Monoid}), since `@effect/typeclass`
 *   is not a dependency here.
 * - the builder is parameterized by the DECODED value types `A`/`B` (schemas carried
 *   as `Schema.Schema<A>`/`Schema.Schema<B>`), avoiding `any` and the v4 schema
 *   variance (`DecodingServices`/tuple optionality) that leaks through `Schema.Top`.
 * - `flatMap` takes the next operation directly, so no fake value is
 *   constructed and there are no casts.
 * - `run` applies the (already typed `A`) input directly; the input/output schemas
 *   are carried as introspection metadata. Re-decoding a typed value would leak
 *   the schema's `DecodingServices` into the requirements channel.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { A } from "@beep/utils";
import { Effect, flow } from "effect";
import { dual } from "effect/Function";
import type * as S from "effect/Schema";
import type * as Monoid from "../Algebra/Monoid.ts";
import type { OperationDefinition } from "./Definition.ts";

/**
 * An effectful arrow from `A` to `B` requiring context `R` and failing with `E`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import type { NLPOperation } from "@beep/nlp/Operations/Composable"
 *
 * const length: NLPOperation<string, number> = (input) => Effect.succeed(input.length)
 * Effect.runPromise(length("Effect")).then(console.log) // 6
 * ```
 *
 * @effects The returned `Effect` performs the operation when executed; any
 * required services and typed failures are represented by its `R` and `E`
 * channels.
 *
 * @since 0.0.0
 * @category models
 */
export type NLPOperation<A, B, R = never, E = never> = (input: A) => Effect.Effect<B, E, R>;

/**
 * A composable operation carrying its input/output schemas alongside its arrow,
 * parameterized by the decoded value types `A` (input) and `B` (output).
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { OperationBuilder } from "@beep/nlp/Operations/Composable"
 *
 * const operation = new OperationBuilder(
 *   (input: string) => Effect.succeed(input.toUpperCase()),
 *   S.String,
 *   S.String,
 *   "upper"
 * )
 *
 * Effect.runPromise(operation.run("effect")).then(console.log) // "EFFECT"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export class OperationBuilder<A, B, R = never, E = never> {
  readonly operation: NLPOperation<A, B, R, E>;
  readonly inputSchema: S.Schema<A>;
  readonly outputSchema: S.Schema<B>;
  readonly name: string;

  constructor(operation: NLPOperation<A, B, R, E>, inputSchema: S.Schema<A>, outputSchema: S.Schema<B>, name: string) {
    this.operation = operation;
    this.inputSchema = inputSchema;
    this.outputSchema = outputSchema;
    this.name = name;
  }

  /**
   * Execute the operation on a typed input.
   *
   * @example
   * ```ts
   * import { Effect } from "effect"
   * import * as S from "effect/Schema"
   * import { makePureOperation } from "@beep/nlp/Operations/Composable"
   *
   * const operation = makePureOperation("trim", S.String, S.String, (input) => input.trim())
   * Effect.runPromise(operation.run("  Effect  ")).then(console.log) // "Effect"
   * ```
   *
   * @since 0.0.0
   * @category use-cases
   */
  run(input: A): Effect.Effect<B, E, R> {
    return this.operation(input);
  }

  /**
   * Functor map: transform the result, supplying the new output schema.
   *
   * @example
   * ```ts
   * import { Effect } from "effect"
   * import * as S from "effect/Schema"
   * import { makePureOperation } from "@beep/nlp/Operations/Composable"
   *
   * const words = makePureOperation("words", S.String, S.Array(S.String), (input) => input.split(" "))
   * const count = words.map((tokens) => tokens.length, S.Finite)
   * Effect.runPromise(count.run("typed effects compose")).then(console.log) // 3
   * ```
   *
   * @since 0.0.0
   * @category combinators
   */
  map<C>(f: (b: B) => C, outputSchema: S.Schema<C>): OperationBuilder<A, C, R, E> {
    return mapOperationBuilder(this, f, outputSchema);
  }

  /**
   * Monad flatMap: sequence into a dependent operation whose input is this
   * operation's output. The next operation's output schema becomes the result's.
   *
   * @example
   * ```ts
   * import { Effect } from "effect"
   * import * as S from "effect/Schema"
   * import { makePureOperation } from "@beep/nlp/Operations/Composable"
   *
   * const trim = makePureOperation("trim", S.String, S.String, (input) => input.trim())
   * const length = makePureOperation("length", S.String, S.Finite, (input) => input.length)
   * const pipeline = trim.flatMap(length)
   * Effect.runPromise(pipeline.run(" Effect ")).then(console.log) // 6
   * ```
   *
   * @since 0.0.0
   * @category combinators
   */
  flatMap<C, R2, E2>(next: OperationBuilder<B, C, R2, E2>): OperationBuilder<A, C, R | R2, E | E2> {
    return new OperationBuilder(
      flow(this.operation, Effect.flatMap(next.operation)),
      this.inputSchema,
      next.outputSchema,
      `${this.name}.flatMap`
    );
  }

  /**
   * Applicative product: run both operations on the same input, pairing results.
   *
   * @example
   * ```ts
   * import { Effect } from "effect"
   * import * as S from "effect/Schema"
   * import { makePureOperation } from "@beep/nlp/Operations/Composable"
   *
   * const length = makePureOperation("length", S.String, S.Finite, (input) => input.length)
   * const upper = makePureOperation("upper", S.String, S.String, (input) => input.toUpperCase())
   * const summary = length.product(upper, S.Tuple([S.Finite, S.String]))
   * Effect.runPromise(summary.run("nlp")).then(console.log) // [3, "NLP"]
   * ```
   *
   * @since 0.0.0
   * @category combinators
   */
  product<C, R2, E2>(
    that: OperationBuilder<A, C, R2, E2>,
    outputSchema: S.Schema<readonly [B, C]>
  ): OperationBuilder<A, readonly [B, C], R | R2, E | E2> {
    return productOperationBuilder(this, that, outputSchema);
  }

  /**
   * Applicative zipWith: run both operations on the same input, combining results.
   *
   * @example
   * ```ts
   * import { Effect } from "effect"
   * import * as S from "effect/Schema"
   * import { makePureOperation } from "@beep/nlp/Operations/Composable"
   *
   * const length = makePureOperation("length", S.String, S.Finite, (input) => input.length)
   * const upper = makePureOperation("upper", S.String, S.String, (input) => input.toUpperCase())
   * const label = length.zipWith(upper, (size, text) => `${text}:${size}`, S.String)
   * Effect.runPromise(label.run("nlp")).then(console.log) // "NLP:3"
   * ```
   *
   * @since 0.0.0
   * @category combinators
   */
  zipWith<C, D, R2, E2>(
    that: OperationBuilder<A, C, R2, E2>,
    f: (b: B, c: C) => D,
    resultSchema: S.Schema<D>
  ): OperationBuilder<A, D, R | R2, E | E2> {
    return zipWithOperationBuilder(this, that, f, resultSchema);
  }
}

const mapOperationBuilder = <A, B, C, R, E>(
  self: OperationBuilder<A, B, R, E>,
  f: (b: B) => C,
  outputSchema: S.Schema<C>
): OperationBuilder<A, C, R, E> =>
  new OperationBuilder(
    (input) => Effect.map(self.operation(input), f),
    self.inputSchema,
    outputSchema,
    `${self.name}.map`
  );

const productOperationBuilder = <A, B, C, R1, E1, R2, E2>(
  self: OperationBuilder<A, B, R1, E1>,
  that: OperationBuilder<A, C, R2, E2>,
  outputSchema: S.Schema<readonly [B, C]>
): OperationBuilder<A, readonly [B, C], R1 | R2, E1 | E2> =>
  new OperationBuilder(
    (input) => Effect.all([self.operation(input), that.operation(input)]),
    self.inputSchema,
    outputSchema,
    `${self.name}x${that.name}`
  );

const zipWithOperationBuilder = <A, B, C, D, R1, E1, R2, E2>(
  self: OperationBuilder<A, B, R1, E1>,
  that: OperationBuilder<A, C, R2, E2>,
  f: (b: B, c: C) => D,
  resultSchema: S.Schema<D>
): OperationBuilder<A, D, R1 | R2, E1 | E2> =>
  new OperationBuilder(
    (input) => Effect.zipWith(self.operation(input), that.operation(input), f),
    self.inputSchema,
    resultSchema,
    `${self.name}zip${that.name}`
  );

/**
 * Build an {@link OperationBuilder} from name, schemas, and an effectful arrow.
 *
 * @example
 * ```ts
 * import { makeOperation } from "@beep/nlp/Operations/Composable"
 * import * as S from "effect/Schema"
 * import { Effect } from "effect"
 *
 * const length = makeOperation("len", S.String, S.Finite, (s) => Effect.succeed(s.length))
 * Effect.runPromise(length.run("Effect")).then(console.log) // 6
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const makeOperation = <A, B, R = never, E = never>(
  name: string,
  inputSchema: S.Schema<A>,
  outputSchema: S.Schema<B>,
  f: NLPOperation<A, B, R, E>
): OperationBuilder<A, B, R, E> => new OperationBuilder(f, inputSchema, outputSchema, name);

/**
 * Build an {@link OperationBuilder} from a structured {@link OperationDefinition}.
 *
 * @example
 * ```ts
 * import { fromDefinition } from "@beep/nlp/Operations/Composable"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const operation = fromDefinition({
 *   name: "id",
 *   inputSchema: S.String,
 *   outputSchema: S.String,
 *   implementation: Effect.succeed
 * })
 *
 * Effect.runPromise(operation.run("Effect")).then(console.log) // "Effect"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const fromDefinition = <A, B, R, E>(definition: OperationDefinition<A, B, R, E>): OperationBuilder<A, B, R, E> =>
  new OperationBuilder(definition.implementation, definition.inputSchema, definition.outputSchema, definition.name);

/**
 * Build a pure (context-free, infallible) operation from a plain function.
 *
 * @example
 * ```ts
 * import { makePureOperation } from "@beep/nlp/Operations/Composable"
 * import * as S from "effect/Schema"
 * import { Effect } from "effect"
 *
 * const upper = makePureOperation("upper", S.String, S.String, (s) => s.toUpperCase())
 * Effect.runPromise(upper.run("effect")).then(console.log) // "EFFECT"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const makePureOperation = <A, B>(
  name: string,
  inputSchema: S.Schema<A>,
  outputSchema: S.Schema<B>,
  f: (input: A) => B
): OperationBuilder<A, B> => new OperationBuilder(flow(f, Effect.succeed), inputSchema, outputSchema, name);

/**
 * Functor map for {@link OperationBuilder}, exposed as a dual helper for
 * data-first and data-last use.
 *
 * @example
 * ```ts
 * import { Effect, pipe } from "effect"
 * import * as S from "effect/Schema"
 * import { makePureOperation, map } from "@beep/nlp/Operations/Composable"
 *
 * const length = makePureOperation("length", S.String, S.Finite, (input) => input.length)
 *
 * const dataFirst = map(length, { f: (n) => n + 1, outputSchema: S.Finite })
 * const dataLast = pipe(length, map({ f: (n) => n * 2, outputSchema: S.Finite }))
 *
 * Effect.runPromise(dataFirst.run("nlp")).then(console.log) // 4
 * Effect.runPromise(dataLast.run("nlp")).then(console.log) // 6
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const map: {
  <B, C>(options: {
    readonly f: (b: B) => C;
    readonly outputSchema: S.Schema<C>;
  }): <A, R, E>(self: OperationBuilder<A, B, R, E>) => OperationBuilder<A, C, R, E>;
  <A, B, C, R, E>(
    self: OperationBuilder<A, B, R, E>,
    options: { readonly f: (b: B) => C; readonly outputSchema: S.Schema<C> }
  ): OperationBuilder<A, C, R, E>;
} = dual(
  2,
  <A, B, C, R, E>(
    self: OperationBuilder<A, B, R, E>,
    options: { readonly f: (b: B) => C; readonly outputSchema: S.Schema<C> }
  ): OperationBuilder<A, C, R, E> => mapOperationBuilder(self, options.f, options.outputSchema)
);

/**
 * Applicative product for {@link OperationBuilder}, exposed as a dual helper for
 * data-first and data-last use.
 *
 * @example
 * ```ts
 * import { Effect, pipe } from "effect"
 * import * as S from "effect/Schema"
 * import { makePureOperation, product } from "@beep/nlp/Operations/Composable"
 *
 * const length = makePureOperation("length", S.String, S.Finite, (input) => input.length)
 * const upper = makePureOperation("upper", S.String, S.String, (input) => input.toUpperCase())
 *
 * const dataFirst = product(length, { that: upper, outputSchema: S.Tuple([S.Finite, S.String]) })
 * const dataLast = pipe(length, product({ that: upper, outputSchema: S.Tuple([S.Finite, S.String]) }))
 *
 * Effect.runPromise(dataFirst.run("nlp")).then(console.log) // [3, "NLP"]
 * Effect.runPromise(dataLast.run("nlp")).then(console.log) // [3, "NLP"]
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const product: {
  <A, B, C, R2, E2>(options: {
    readonly that: OperationBuilder<A, C, R2, E2>;
    readonly outputSchema: S.Schema<readonly [B, C]>;
  }): <R1, E1>(self: OperationBuilder<A, B, R1, E1>) => OperationBuilder<A, readonly [B, C], R1 | R2, E1 | E2>;
  <A, B, C, R1, E1, R2, E2>(
    self: OperationBuilder<A, B, R1, E1>,
    options: { readonly that: OperationBuilder<A, C, R2, E2>; readonly outputSchema: S.Schema<readonly [B, C]> }
  ): OperationBuilder<A, readonly [B, C], R1 | R2, E1 | E2>;
} = dual(
  2,
  <A, B, C, R1, E1, R2, E2>(
    self: OperationBuilder<A, B, R1, E1>,
    options: { readonly that: OperationBuilder<A, C, R2, E2>; readonly outputSchema: S.Schema<readonly [B, C]> }
  ): OperationBuilder<A, readonly [B, C], R1 | R2, E1 | E2> =>
    productOperationBuilder(self, options.that, options.outputSchema)
);

/**
 * Applicative zipWith for {@link OperationBuilder}, exposed as a dual helper for
 * data-first and data-last use.
 *
 * @example
 * ```ts
 * import { Effect, pipe } from "effect"
 * import * as S from "effect/Schema"
 * import { makePureOperation, zipWith } from "@beep/nlp/Operations/Composable"
 *
 * const length = makePureOperation("length", S.String, S.Finite, (input) => input.length)
 * const upper = makePureOperation("upper", S.String, S.String, (input) => input.toUpperCase())
 *
 * const dataFirst = zipWith(length, { that: upper, f: (size, text) => `${text}:${size}`, resultSchema: S.String })
 * const dataLast = pipe(length, zipWith({ that: upper, f: (size, text) => `${text}:${size}`, resultSchema: S.String }))
 *
 * Effect.runPromise(dataFirst.run("nlp")).then(console.log) // "NLP:3"
 * Effect.runPromise(dataLast.run("nlp")).then(console.log) // "NLP:3"
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const zipWith: {
  <A, B, C, D, R2, E2>(options: {
    readonly that: OperationBuilder<A, C, R2, E2>;
    readonly f: (b: B, c: C) => D;
    readonly resultSchema: S.Schema<D>;
  }): <R1, E1>(self: OperationBuilder<A, B, R1, E1>) => OperationBuilder<A, D, R1 | R2, E1 | E2>;
  <A, B, C, D, R1, E1, R2, E2>(
    self: OperationBuilder<A, B, R1, E1>,
    options: {
      readonly that: OperationBuilder<A, C, R2, E2>;
      readonly f: (b: B, c: C) => D;
      readonly resultSchema: S.Schema<D>;
    }
  ): OperationBuilder<A, D, R1 | R2, E1 | E2>;
} = dual(
  2,
  <A, B, C, D, R1, E1, R2, E2>(
    self: OperationBuilder<A, B, R1, E1>,
    options: {
      readonly that: OperationBuilder<A, C, R2, E2>;
      readonly f: (b: B, c: C) => D;
      readonly resultSchema: S.Schema<D>;
    }
  ): OperationBuilder<A, D, R1 | R2, E1 | E2> =>
    zipWithOperationBuilder(self, options.that, options.f, options.resultSchema)
);

/**
 * Sequential composition: feed the first operation's output into the second.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { compose, makePureOperation } from "@beep/nlp/Operations/Composable"
 *
 * const trim = makePureOperation("trim", S.String, S.String, (input) => input.trim())
 * const length = makePureOperation("length", S.String, S.Finite, (input) => input.length)
 * const pipeline = compose(trim, length)
 *
 * Effect.runPromise(pipeline.run(" Effect ")).then(console.log) // 6
 * ```
 *
 * @since 0.0.0
 * @category combinators
 */
export const compose: {
  <B, C, R2, E2>(
    second: OperationBuilder<B, C, R2, E2>
  ): <A, R1, E1>(first: OperationBuilder<A, B, R1, E1>) => OperationBuilder<A, C, R1 | R2, E1 | E2>;
  <A, B, C, R1, E1, R2, E2>(
    first: OperationBuilder<A, B, R1, E1>,
    second: OperationBuilder<B, C, R2, E2>
  ): OperationBuilder<A, C, R1 | R2, E1 | E2>;
} = dual(
  2,
  <A, B, C, R1, E1, R2, E2>(
    first: OperationBuilder<A, B, R1, E1>,
    second: OperationBuilder<B, C, R2, E2>
  ): OperationBuilder<A, C, R1 | R2, E1 | E2> => first.flatMap(second)
);

/**
 * The identity operation: returns its input unchanged.
 *
 * @example
 * ```ts
 * import { identity } from "@beep/nlp/Operations/Composable"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * Effect.runPromise(identity(S.String).run("same")).then(console.log) // "same"
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const identity = <A>(schema: S.Schema<A>): OperationBuilder<A, A> =>
  makePureOperation("identity", schema, schema, (a) => a);

/**
 * Traverse an array of inputs through an operation, collecting decoded results.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { makePureOperation, traverse } from "@beep/nlp/Operations/Composable"
 *
 * const length = makePureOperation("length", S.String, S.Finite, (input) => input.length)
 * const program = traverse(length)(["typed", "nlp"])
 *
 * Effect.runPromise(program).then(console.log) // [5, 3]
 * ```
 *
 * @since 0.0.0
 * @category sequencing
 */
export const traverse =
  <A, B, R, E>(operation: OperationBuilder<A, B, R, E>) =>
  (inputs: ReadonlyArray<A>): Effect.Effect<ReadonlyArray<B>, E, R> =>
    Effect.forEach(inputs, (input) => operation.run(input));

/**
 * Aggregate an array of values into a single value using a {@link Monoid.Monoid}.
 *
 * @example
 * ```ts
 * import * as Monoid from "@beep/nlp/Algebra/Monoid"
 * import { aggregate } from "@beep/nlp/Operations/Composable"
 *
 * const totalCharacters = aggregate(Monoid.NumberSum, (text: string) => text.length)
 *
 * console.log(totalCharacters(["typed", "nlp"])) // 8
 * ```
 *
 * @since 0.0.0
 * @category folding
 */
export const aggregate: {
  <A, M>(monoid: Monoid.Monoid<M>, f: (a: A) => M): (values: ReadonlyArray<A>) => M;
  <A, M>(values: ReadonlyArray<A>, monoid: Monoid.Monoid<M>, f: (a: A) => M): M;
} = dual(
  3,
  <A, M>(values: ReadonlyArray<A>, monoid: Monoid.Monoid<M>, f: (a: A) => M): M =>
    A.reduce(values, monoid.empty, (acc, a) => monoid.combine(acc, f(a)))
);
