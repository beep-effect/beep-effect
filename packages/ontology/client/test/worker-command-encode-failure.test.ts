import { ontologyGraphErrorAtom, ontologyGraphWorkerBridgeAtom } from "@beep/ontology-client/aggregates/Session";
import { describe, expect, it } from "@effect/vitest";
import { Duration, Effect, Schedule } from "effect";
import * as O from "effect/Option";
import { AtomRegistry } from "effect/reactivity";
import { vi } from "vitest";

// The parent encodes every command before it crosses the worker boundary. A
// command the codec refuses must fail the graph out loud instead of posting
// nothing; forcing the codec is the only way to reach that arm, because a
// command built from session state always encodes.
vi.mock("@beep/ontology-use-cases/aggregates/Session", (importOriginal) =>
  Promise.all([
    importOriginal<typeof import("@beep/ontology-use-cases/aggregates/Session")>(),
    import("effect/Result"),
    import("effect/Data"),
  ]).then(([actual, ResultModule, DataModule]) => {
    class ForcedWorkerCommandEncodeFailure extends DataModule.TaggedError("ForcedWorkerCommandEncodeFailure")<{
      readonly message: string;
    }> {}
    return {
      ...actual,
      encodeWorkerCommand: () =>
        ResultModule.fail(new ForcedWorkerCommandEncodeFailure({ message: "forced worker command encode failure" })),
    };
  })
);

const waitUntil = (label: string, predicate: () => boolean): Effect.Effect<void, string> =>
  Effect.suspend(() => (predicate() ? Effect.void : Effect.fail(`condition not met: ${label}`))).pipe(
    Effect.retry(
      Schedule.spaced(Duration.millis(1)).pipe(Schedule.upTo({ duration: Duration.seconds(3), times: 3_000 }))
    )
  );

class FakeWorker {
  readonly messages: Array<unknown> = [];
  terminated = false;

  addEventListener(): void {}

  postMessage(message: unknown): void {
    this.messages.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }
}

describe("ontology graph worker command encoding", () => {
  it.live(
    "fails the graph when a command cannot be encoded for the worker boundary",
    Effect.fnUntraced(function* () {
      const workers: Array<FakeWorker> = [];
      yield* Effect.acquireUseRelease(
        Effect.sync(() =>
          vi.stubGlobal(
            "Worker",
            class extends FakeWorker {
              constructor() {
                super();
                workers.push(this);
              }
            }
          )
        ),
        () =>
          Effect.gen(function* () {
            const registry = AtomRegistry.make();
            registry.mount(ontologyGraphWorkerBridgeAtom);
            registry.get(ontologyGraphWorkerBridgeAtom);
            yield* waitUntil("graph error surfaced", () => O.isSome(registry.get(ontologyGraphErrorAtom)));

            expect(O.getOrElse(registry.get(ontologyGraphErrorAtom), () => "")).toBe(
              "The graph worker command could not be encoded for the worker boundary."
            );
            expect(workers.every((worker) => worker.messages.length === 0)).toBe(true);
            registry.dispose();
          }),
        () => Effect.sync(() => vi.unstubAllGlobals())
      );
    })
  );
});
