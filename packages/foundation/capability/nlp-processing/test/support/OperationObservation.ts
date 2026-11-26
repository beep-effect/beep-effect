import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import type { Operation } from "@beep/nlp-processing/Operation";

export class Trace extends Context.Service<Trace, Ref.Ref<ReadonlyArray<number>>>()(
  "@beep/nlp-processing/test/support/OperationObservation/Trace"
) {}

export const appendEvent = Effect.fnUntraced(function* (event: number) {
  const trace = yield* Trace;
  yield* Ref.update(trace, A.append(event));
});

type ExitShape =
  | { readonly _tag: "Succeeded"; readonly value: unknown }
  | { readonly _tag: "Died" }
  | { readonly _tag: "Failed"; readonly error: unknown };

interface Observation {
  readonly exit: ExitShape;
  readonly trace: ReadonlyArray<number>;
}

const toExitShape = <B, E>(exit: Exit.Exit<B, E>): ExitShape =>
  Exit.isSuccess(exit)
    ? { _tag: "Succeeded", value: exit.value }
    : Cause.hasDies(exit.cause)
      ? { _tag: "Died" }
      : { _tag: "Failed", error: exit.cause.pipe(Cause.findErrorOption, O.getOrUndefined) };

export const observe = Effect.fnUntraced(function* <A, B, E>(operation: Operation<A, B, E, Trace>, input: A) {
  const trace = yield* Ref.make<ReadonlyArray<number>>([]);
  const exit = yield* Effect.exit(Effect.suspend(() => operation.run(input))).pipe(Effect.provideService(Trace, trace));
  const events = yield* Ref.get(trace);
  return { exit: toExitShape(exit), trace: events } satisfies Observation;
});
