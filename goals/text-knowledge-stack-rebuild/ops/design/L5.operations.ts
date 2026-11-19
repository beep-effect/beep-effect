/**
 * L5 operations: effectful transformations as arrows with provenance by
 * construction. Every run of a wrapped operation emits a prov:Activity record.
 *
 * Target home: `@beep/nlp-processing` (foundation/capability), which absorbs
 * `nlp/Operations` and the census-surviving part of `nlp/Algebra` in P6. The
 * ActivityId and its start-time preimage live in L0 (decision 2026-11-19-p0-activity-id-minted-at-start).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { dual, flow } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import { ActivityStartFields, CanonicalHashSet, ContentHash, Instant } from "./L0.digest.ts";
import type { ActivityPin } from "./L0.digest.ts";
import type { TermIri } from "./L0.identity.ts";

const $I = $RepoCliId.create("goals/text-knowledge-stack-rebuild/ops/design/L5.operations");

/** A named arrow `A -> Effect<B, E, R>`; `E` and `R` are fixed per pipeline for the Kleisli laws (L5-1). */
export interface Operation<A, B, E, R> {
  readonly name: TermIri;
  readonly run: (input: A) => Effect.Effect<B, E, R>;
}

/**
 * One prov:Activity: the start-time facts its id hashes, plus what it
 * generated and when it ended, which stay outside the id.
 */
export class Activity extends S.Opaque<Activity, { readonly brand: unique symbol }>()(
  S.Struct({
    ...ActivityStartFields,
    generated: CanonicalHashSet(ContentHash).annotateKey({ description: "Content entities the run produced." }),
    ended: Instant,
  })
    .check(
      S.makeFilter(
        (activity: { readonly started: DateTime.Utc; readonly ended: DateTime.Utc }) =>
          DateTime.isLessThanOrEqualTo(activity.started, activity.ended),
        $I.annote("ActivityOrderCheck", {
          title: "Activity Order",
          description: "An activity never ends before it starts (L5-3).",
          message: "Expected started to be no later than ended.",
        })
      )
    )
    .pipe($I.annoteSchema("Activity", { description: "A prov:Activity record of one operation run." }))
) {}

/** A pure operation `Effect.succeed(f(a))` for a total `f`; only these are central (L5-2). */
export const pure = <A, B>(spec: {
  readonly name: TermIri;
  readonly f: (input: A) => B;
}): Operation<A, B, never, never> => ({
  name: spec.name,
  run: flow(spec.f, Effect.succeed),
});

/** Kleisli composition for a fixed `(E, R)`; the composite takes the name given. */
export const compose: {
  <B, C, E, R>(that: Operation<B, C, E, R>, name: TermIri): <A>(self: Operation<A, B, E, R>) => Operation<A, C, E, R>;
  <A, B, C, E, R>(self: Operation<A, B, E, R>, that: Operation<B, C, E, R>, name: TermIri): Operation<A, C, E, R>;
} = dual(
  3,
  <A, B, C, E, R>(self: Operation<A, B, E, R>, that: Operation<B, C, E, R>, name: TermIri): Operation<A, C, E, R> => ({
    name,
    run: flow(self.run, Effect.flatMap(that.run)),
  })
);

/** An operation output paired with the activities that produced it (the Writer log). */
export type Logged<B> = {
  readonly value: B;
  readonly activities: HashSet.HashSet<Activity>;
};

/** How `withActivity` reads entity ids from input and output; available only for types with ids. */
export type HasIds<A, B> = {
  readonly used: (input: A) => Iterable<ContentHash>;
  readonly generated: (output: B) => Iterable<ContentHash>;
  readonly pin: ActivityPin;
  readonly promptDigest: typeof ActivityStartFields.promptDigest.Type;
};

/**
 * Wrap an operation so every run emits one Activity record (L5-3: every
 * output attributed). A wall clock that steps backwards during the run never
 * fails it: `ended` is clamped to be no earlier than `started`. The L5-3 law
 * itself is that `generated` never precedes `used`.
 */
export const withActivity =
  <A, B>(ids: HasIds<A, B>) =>
  <E, R>(operation: Operation<A, B, E, R>): Operation<A, Logged<B>, E, R> => ({
    name: operation.name,
    run: Effect.fnUntraced(function* (input: A) {
      // Used ids are read before the run (decision 2026-11-19-p0-activity-id-minted-at-start), so they name what the run read.
      const used = HashSet.fromIterable(ids.used(input));
      const started = yield* DateTime.now;
      const value = yield* operation.run(input);
      const clock = yield* DateTime.now;
      const ended = DateTime.max(started, clock);
      const activity = Activity.make({
        operation: operation.name,
        used,
        generated: HashSet.fromIterable(ids.generated(value)),
        pin: ids.pin,
        promptDigest: ids.promptDigest,
        started,
        ended,
      });
      return { value, activities: HashSet.make(activity) };
    }),
  });
