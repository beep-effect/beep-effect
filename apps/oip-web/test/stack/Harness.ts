/**
 * Shared harness for the `OipWeb` stack tests: the in-memory cloud fakes, an
 * in-memory state store, and helpers to deploy one stage and read state.
 */

import * as Test from "@alchemy.run/test/Vitest";
import { formatPlanLines } from "alchemy/Cli/LoggingCli";
import { inMemoryState, State } from "alchemy/State";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { configForStage } from "../../stack/OipWebConfig.ts";
import { oipWebResources } from "../../stack/OipWebStack.ts";
import { FakeCloudProviders } from "./FakeCloud.ts";
import type { Input } from "alchemy/Input";
import type * as Provider from "alchemy/Provider";

/** Per-file test API over the fakes; every `test.provider` gets its own scratch state. */
export const makeHarness = () =>
  Test.make({
    providers: FakeCloudProviders,
    state: inMemoryState(),
    stage: "test",
  });

/** The declared resources of one stage, as `alchemy.run.ts` declares them. */
export const stageProgram = (stage: string) =>
  Effect.flatMap(configForStage(stage).pipe(Effect.orDie), oipWebResources);

/** A scratch stack whose deploy and destroy carry a typed error channel. */
export interface TypedStack {
  deploy<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<Input.Resolve<A>, Provider.ProviderError | E>;
  destroy(options?: { readonly include?: never }): Effect.Effect<void, Provider.ProviderError>;
  plan<A, E, R>(
    effect: Effect.Effect<A, E, R>
  ): Effect.Effect<Parameters<typeof formatPlanLines>[0], Provider.ProviderError | E>;
}

/** Narrow the harness's scratch stack to {@link TypedStack}. */
export const typed = (stack: Test.ScratchStack): TypedStack => stack;

/** Run an effect with these config values, as `op run` or a CI secret would export them. */
export const withConfig =
  (values: Record<string, string>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    Effect.provideService(effect, ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(values));

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
 * Every string persisted in the scratch state store, `Redacted` envelopes
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

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/**
 * A plan as the CI log prints it: the logger's `Plan · <stage>` title, then the summary and one
 * line per resource, color codes removed. The plan guard reads exactly this.
 */
export const renderPlanLog =
  (stage: string) =>
  (plan: Parameters<typeof formatPlanLines>[0]): string =>
    A.join([`Plan · ${stage}`, ...A.map(formatPlanLines(plan), Str.replace(ANSI, ""))], "\n");

/**
 * Turn one resource's row into the checkpoint a failed create leaves: Alchemy commits a `creating`
 * row without attributes before it calls the provider, and keeps it when the call fails (staging,
 * run 43585534113). The live object stays in place.
 */
export const checkpointAsCreating = Effect.fn("checkpointAsCreating")(function* (fqn: string) {
  const store = yield* yield* State;
  const stacks = yield* store.listStacks();
  yield* Effect.forEach(stacks, (stack) =>
    store.listStages(stack).pipe(
      Effect.flatMap((stages) =>
        Effect.forEach(stages, (stage) =>
          store.get({ stack, stage, fqn }).pipe(
            Effect.flatMap((row) =>
              row === undefined
                ? Effect.void
                : store.set({
                    stack,
                    stage,
                    fqn,
                    value: { ...row, status: "creating", attr: undefined } as typeof row,
                  })
            )
          )
        )
      )
    )
  );
});
