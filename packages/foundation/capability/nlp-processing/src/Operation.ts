/**
 * One effectful arrow for NLP operations: a named `A -> Effect<B, E, R>`.
 *
 * **Details**
 *
 * Operations form a Kleisli category at a fixed error and requirement channel
 * (law L5-1): {@link compose} is associative and a {@link pure} identity is its
 * unit. Every combinator suspends its components' `run`, so building a
 * composite runs no user code and a component that throws when called is a
 * defect of the composite's effect. Only a {@link Pure} arrow commutes with
 * every other operation (law L5-2); {@link commute} is the one interchange and
 * accepts only a `Pure` witness.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import type { TermIri } from "@beep/identity/Term";

/**
 * A named effectful arrow from `A` to `B`.
 *
 * **Example** (Declare a tokenizing operation)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { TermIri } from "@beep/identity/Term"
 * import { iri } from "@beep/identity/Registry"
 * import type { Operation } from "@beep/nlp-processing/Operation"
 *
 * const words: Operation<string, ReadonlyArray<string>> = {
 *   name: TermIri.make(iri("operation:Tokenize")),
 *   run: (text) => Effect.succeed(text.split(" ")),
 * }
 *
 * console.log(words.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface Operation<A, B, E = never, R = never> {
  readonly name: TermIri;
  readonly run: (input: A) => Effect.Effect<B, E, R>;
}

/**
 * The brand key only {@link pure} sets on an operation.
 *
 * **Example** (Read the brand key)
 *
 * ```ts import.meta.vitest name="Read the brand key"
 * import { PureTypeId } from "@beep/nlp-processing/Operation"
 *
 * PureTypeId // => "~@beep/nlp-processing/Operation/Pure"
 * ```
 *
 * @category symbols
 * @since 0.0.0
 */
export const PureTypeId = "~@beep/nlp-processing/Operation/Pure" as const;

/**
 * Type of {@link PureTypeId}.
 *
 * @category symbols
 * @since 0.0.0
 */
export type PureTypeId = typeof PureTypeId;

/**
 * An operation built by {@link pure} from a total function.
 *
 * **Details**
 *
 * The brand is what lets {@link commute} reorder it; no effectful arrow can
 * carry it, because only {@link pure} sets it.
 *
 * **Example** (Accept only a pure witness)
 *
 * ```ts
 * import type { Pure } from "@beep/nlp-processing/Operation"
 *
 * const nameOf = (witness: Pure<string, number>) => witness.name
 *
 * console.log(nameOf)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface Pure<A, B> extends Operation<A, B> {
  readonly [PureTypeId]: PureTypeId;
}

/**
 * Lift a total function into a {@link Pure} operation.
 *
 * **Details**
 *
 * The run is `Effect.sync(() => f(input))`, so a throwing `f` is a defect inside
 * the effect rather than an exception at call time.
 *
 * **Example** (Lift a string length)
 *
 * ```ts import.meta.vitest name="Lift a string length"
 * import * as Effect from "effect/Effect"
 * import { TermIri } from "@beep/identity/Term"
 * import { iri } from "@beep/identity/Registry"
 * import { pure } from "@beep/nlp-processing/Operation"
 *
 * const trim = pure({ name: TermIri.make(iri("operation:Trim")), f: (text: string) => text.trim() })
 *
 * Effect.runSync(trim.run("  word  ")) // => "word"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const pure = <A, B>(spec: { readonly name: TermIri; readonly f: (input: A) => B }): Pure<A, B> => ({
  [PureTypeId]: PureTypeId,
  name: spec.name,
  run: (input) => Effect.sync(() => spec.f(input)),
});

/**
 * Kleisli composition at a fixed error and requirement channel.
 *
 * **Details**
 *
 * The composite runs `self`, then `that` on its value, and takes the name given.
 *
 * **Example** (Trim then lowercase)
 *
 * ```ts import.meta.vitest name="Trim then lowercase"
 * import * as Effect from "effect/Effect"
 * import { TermIri } from "@beep/identity/Term"
 * import { iri } from "@beep/identity/Registry"
 * import { compose, pure } from "@beep/nlp-processing/Operation"
 *
 * const trim = pure({ name: TermIri.make(iri("operation:Trim")), f: (text: string) => text.trim() })
 * const lower = pure({ name: TermIri.make(iri("operation:ToLowerCase")), f: (text: string) => text.toLowerCase() })
 * const normalize = compose(trim, lower, TermIri.make(iri("operation:ToLowerCase")))
 *
 * Effect.runSync(normalize.run("  WORD ")) // => "word"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const compose: {
  <B, C, E, R>(that: Operation<B, C, E, R>, name: TermIri): <A>(self: Operation<A, B, E, R>) => Operation<A, C, E, R>;
  <A, B, C, E, R>(self: Operation<A, B, E, R>, that: Operation<B, C, E, R>, name: TermIri): Operation<A, C, E, R>;
} = dual(
  3,
  <A, B, C, E, R>(self: Operation<A, B, E, R>, that: Operation<B, C, E, R>, name: TermIri): Operation<A, C, E, R> => ({
    name,
    run: (input) =>
      Effect.suspend(() => self.run(input)).pipe(Effect.flatMap((value) => Effect.suspend(() => that.run(value)))),
  })
);

/**
 * Map the value of an operation with a total function, keeping its name.
 *
 * **Example** (Count tokens)
 *
 * ```ts import.meta.vitest name="Count tokens"
 * import * as Effect from "effect/Effect"
 * import { TermIri } from "@beep/identity/Term"
 * import { iri } from "@beep/identity/Registry"
 * import { map, pure } from "@beep/nlp-processing/Operation"
 *
 * const words = pure({ name: TermIri.make(iri("operation:Tokenize")), f: (text: string) => text.split(" ") })
 *
 * Effect.runSync(map(words, (tokens) => tokens.length).run("a b c")) // => 3
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const map: {
  <B, C>(f: (value: B) => C): <A, E, R>(self: Operation<A, B, E, R>) => Operation<A, C, E, R>;
  <A, B, C, E, R>(self: Operation<A, B, E, R>, f: (value: B) => C): Operation<A, C, E, R>;
} = dual(
  2,
  <A, B, C, E, R>(self: Operation<A, B, E, R>, f: (value: B) => C): Operation<A, C, E, R> => ({
    name: self.name,
    run: (input) => Effect.suspend(() => self.run(input)).pipe(Effect.map(f)),
  })
);

/**
 * Run two operations on the same input, left first, and pair their values.
 *
 * **Example** (Pair two views of one input)
 *
 * ```ts import.meta.vitest name="Pair two views of one input"
 * import * as Effect from "effect/Effect"
 * import { TermIri } from "@beep/identity/Term"
 * import { iri } from "@beep/identity/Registry"
 * import { product, pure } from "@beep/nlp-processing/Operation"
 *
 * const lower = pure({ name: TermIri.make(iri("operation:ToLowerCase")), f: (text: string) => text.toLowerCase() })
 * const upper = pure({ name: TermIri.make(iri("operation:ToUpperCase")), f: (text: string) => text.toUpperCase() })
 *
 * Effect.runSync(product(lower, upper, lower.name).run("Ab")) // => ["ab", "AB"]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const product: {
  <A, C, E, R>(
    that: Operation<A, C, E, R>,
    name: TermIri
  ): <B>(self: Operation<A, B, E, R>) => Operation<A, readonly [B, C], E, R>;
  <A, B, C, E, R>(
    self: Operation<A, B, E, R>,
    that: Operation<A, C, E, R>,
    name: TermIri
  ): Operation<A, readonly [B, C], E, R>;
} = dual(
  3,
  <A, B, C, E, R>(
    self: Operation<A, B, E, R>,
    that: Operation<A, C, E, R>,
    name: TermIri
  ): Operation<A, readonly [B, C], E, R> => ({
    name,
    run: (input) =>
      Effect.all([Effect.suspend(() => self.run(input)), Effect.suspend(() => that.run(input))], { concurrency: 1 }),
  })
);

/**
 * Run `q` before the pure `p` and return the pair in {@link product} order.
 *
 * **Details**
 *
 * This is the interchange a caller may claim only with a {@link Pure} witness:
 * for a pure `p`, `commute(p, q)` observes the same as `product(p, q)`.
 *
 * **Example** (Reorder around a pure witness)
 *
 * ```ts import.meta.vitest name="Reorder around a pure witness"
 * import * as Effect from "effect/Effect"
 * import { TermIri } from "@beep/identity/Term"
 * import { iri } from "@beep/identity/Registry"
 * import { commute, pure } from "@beep/nlp-processing/Operation"
 *
 * const lower = pure({ name: TermIri.make(iri("operation:ToLowerCase")), f: (text: string) => text.toLowerCase() })
 * const upper = pure({ name: TermIri.make(iri("operation:ToUpperCase")), f: (text: string) => text.toUpperCase() })
 *
 * Effect.runSync(commute(lower, upper, lower.name).run("Ab")) // => ["ab", "AB"]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const commute: {
  <A, C, E, R>(q: Operation<A, C, E, R>, name: TermIri): <B>(p: Pure<A, B>) => Operation<A, readonly [B, C], E, R>;
  <A, B, C, E, R>(p: Pure<A, B>, q: Operation<A, C, E, R>, name: TermIri): Operation<A, readonly [B, C], E, R>;
} = dual(
  3,
  <A, B, C, E, R>(p: Pure<A, B>, q: Operation<A, C, E, R>, name: TermIri): Operation<A, readonly [B, C], E, R> => ({
    name,
    run: (input) =>
      Effect.zipWith(
        Effect.suspend(() => q.run(input)),
        Effect.suspend(() => p.run(input)),
        (c, b): readonly [B, C] => [b, c]
      ),
  })
);

/**
 * Run an operation over every element, left to right, one at a time.
 *
 * **Example** (Trim every line)
 *
 * ```ts import.meta.vitest name="Trim every line"
 * import * as Effect from "effect/Effect"
 * import { TermIri } from "@beep/identity/Term"
 * import { iri } from "@beep/identity/Registry"
 * import { pure, traverse } from "@beep/nlp-processing/Operation"
 *
 * const trim = pure({ name: TermIri.make(iri("operation:Trim")), f: (text: string) => text.trim() })
 *
 * Effect.runSync(traverse(trim, trim.name).run([" a", "b "])) // => ["a", "b"]
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const traverse: {
  (name: TermIri): <A, B, E, R>(self: Operation<A, B, E, R>) => Operation<ReadonlyArray<A>, ReadonlyArray<B>, E, R>;
  <A, B, E, R>(self: Operation<A, B, E, R>, name: TermIri): Operation<ReadonlyArray<A>, ReadonlyArray<B>, E, R>;
} = dual(
  2,
  <A, B, E, R>(self: Operation<A, B, E, R>, name: TermIri): Operation<ReadonlyArray<A>, ReadonlyArray<B>, E, R> => ({
    name,
    run: (inputs) => Effect.forEach(inputs, (input) => Effect.suspend(() => self.run(input)), { concurrency: 1 }),
  })
);
