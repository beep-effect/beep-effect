/**
 * Shared harness for the hermetic provider tests: the Vercel resource
 * providers over the in-memory fake API and an in-memory state store.
 */

import * as Test from "@alchemy.run/test/Vitest";
import * as Vercel from "@beep/alchemy-vercel";
import { inMemoryState, State } from "alchemy/State";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { FakeVercelLayer } from "./FakeVercel.ts";
import type { formatPlanLines } from "alchemy/Cli/LoggingCli";
import type * as Provider from "alchemy/Provider";
import type { ResourceLike } from "alchemy/Resource";

/** A scratch stack whose deploy and destroy carry a typed error channel. */
export interface TypedStack {
  deploy<A extends ResourceLike>(
    effect: Effect.Effect<A, never, Vercel.Providers>
  ): Effect.Effect<A["Attributes"], Provider.ProviderError>;
  destroy(options?: { readonly include?: never }): Effect.Effect<void, Provider.ProviderError>;
  plan<A extends ResourceLike>(
    effect: Effect.Effect<A, never, Vercel.Providers>
  ): Effect.Effect<Parameters<typeof formatPlanLines>[0], Provider.ProviderError>;
}

/** Narrow the harness's scratch stack to {@link TypedStack}. */
export const typed = (stack: Test.ScratchStack): TypedStack => stack;

/** The read lifecycle of a provider, with a typed error channel. */
export type TypedRead<R extends ResourceLike> = (input: {
  readonly id: string;
  readonly fqn: string;
  readonly instanceId: string;
  readonly olds: R["Props"];
  readonly output: R["Attributes"] | undefined;
}) => Effect.Effect<R["Attributes"] | undefined, Provider.ProviderError>;

/** Per-file test API backed by the fake Vercel layer. */
export const makeHarness = () =>
  Test.make({
    providers: Vercel.resources.pipe(Layer.provideMerge(FakeVercelLayer)),
    state: inMemoryState(),
    stage: "test",
  });

const Tagged = S.Struct({ _tag: S.String });

/** The `_tag` of the error or defect an exit failed with, if any. */
export const failureTag = <A, E>(exit: Exit.Exit<A, E>): O.Option<string> =>
  Exit.isFailure(exit)
    ? exit.cause.pipe(
        Cause.squash,
        S.decodeUnknownOption(Tagged),
        O.map((error) => error._tag)
      )
    : O.none();

const leafStrings = (value: unknown): ReadonlyArray<string> => {
  if (Redacted.isRedacted(value)) return pipe(value, Redacted.value, leafStrings);
  if (P.isString(value)) return [value];
  if (A.isArray(value)) return A.flatMap(value, leafStrings);
  if (P.isObject(value)) return A.flatMap(R.values(value as Record<string, unknown>), leafStrings);
  return [];
};

/**
 * Every string persisted in the harness's state store, `Redacted` envelopes
 * opened: what a reader of the state bucket would see.
 */
export const persistedStrings = Effect.gen(function* () {
  const store = yield* yield* State;
  const stacks = yield* store.listStacks();
  const rows = yield* Effect.forEach(stacks, (stack) =>
    store
      .listStages(stack)
      .pipe(
        Effect.flatMap((stages) =>
          Effect.forEach(stages, (stage) =>
            store
              .list({ stack, stage })
              .pipe(Effect.flatMap((fqns) => Effect.forEach(fqns, (fqn) => store.get({ stack, stage, fqn }))))
          )
        )
      )
  );
  return leafStrings(rows);
});

/**
 * Remove one resource's row from every stage of the scratch state store, leaving the live object:
 * the state a deploy leaves when that one resource failed.
 */
export const dropStateRow = Effect.fn("dropStateRow")(function* (fqn: string) {
  const store = yield* yield* State;
  const stacks = yield* store.listStacks();
  yield* Effect.forEach(stacks, (stack) =>
    store
      .listStages(stack)
      .pipe(Effect.flatMap((stages) => Effect.forEach(stages, (stage) => store.delete({ stack, stage, fqn }))))
  );
});
