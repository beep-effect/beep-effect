/**
 * Shared harness for the hermetic provider tests: the Vercel resource
 * providers over the in-memory fake API and an in-memory state store.
 */

import * as Test from "@alchemy.run/test/Vitest";
import * as Vercel from "@beep/alchemy-vercel";
import { inMemoryState } from "alchemy/State";
import * as Cause from "effect/Cause";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FakeVercelLayer } from "./FakeVercel.ts";
import type * as Provider from "alchemy/Provider";
import type { ResourceLike } from "alchemy/Resource";
import type * as Effect from "effect/Effect";

/** A scratch stack whose deploy and destroy carry a typed error channel. */
export interface TypedStack {
  deploy<A extends ResourceLike>(
    effect: Effect.Effect<A, never, Vercel.Providers>
  ): Effect.Effect<A["Attributes"], Provider.ProviderError>;
  destroy(options?: { readonly include?: never }): Effect.Effect<void, Provider.ProviderError>;
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
