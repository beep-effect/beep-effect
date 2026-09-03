import { it } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as References from "effect/References";
import * as Schedule from "effect/Schedule";
import { AtomRegistry } from "effect/unstable/reactivity";
import { describe, expect } from "vitest";
import {
  BrowserFailure,
  browserFailureListenersAtom,
  handledBrowserFailureAtoms,
} from "@/runtime/BrowserFailure.atoms";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";

const waitForLog = (annotations: ReadonlyArray<Record<string, unknown>>): Effect.Effect<void, string> =>
  Effect.suspend(() =>
    annotations.length > 0 ? Effect.void : Effect.fail("browser failure log has not been emitted")
  ).pipe(
    Effect.retry(
      Schedule.spaced(Duration.millis(10)).pipe(Schedule.upTo({ duration: Duration.seconds(3), times: 300 }))
    )
  );

const registryWithDelayedLogger = (annotations: Array<Record<string, unknown>>) => {
  const logger = Logger.make<unknown, void>((options) => {
    annotations.push({ ...options.fiber.getRef(References.CurrentLogAnnotations) });
  });
  return AtomRegistry.make({
    defaultIdleTTL: 0,
    timeoutResolution: 1,
    initialValues: [
      [professionalBrowserRuntime.layer, Layer.mergeAll(Layer.effectDiscard(Effect.sleep(25)), Logger.layer([logger]))],
    ],
  });
};

describe("browser failure atoms", () => {
  it.live(
    "observes a handled AsyncResult failure through the professional runtime",
    Effect.fnUntraced(function* () {
      const annotations: Array<Record<string, unknown>> = [];
      const registry = registryWithDelayedLogger(annotations);
      const failure = BrowserFailure.make({
        source: "app_registry",
        cause: new Error("token=private-value at /home/operator/workspace"),
      });
      const handled = handledBrowserFailureAtoms(failure);
      registry.mount(handled);

      yield* AtomRegistry.getResult(registry, handled);

      expect(annotations).toHaveLength(1);
      expect(annotations[0]?.["professional_desktop.renderer.source"]).toBe("app_registry");
      expect(annotations[0]?.cause_message).not.toContain("private-value");
      expect(annotations[0]?.cause_detail).not.toContain("/home/operator");
      registry.dispose();
    })
  );

  it.live(
    "keeps the delegated global-listener reporting action mounted until logging completes",
    Effect.fnUntraced(function* () {
      const annotations: Array<Record<string, unknown>> = [];
      const registry = registryWithDelayedLogger(annotations);
      registry.mount(browserFailureListenersAtom);

      window.dispatchEvent(
        new ErrorEvent("error", {
          error: new Error("token=listener-private-value at /home/operator/listener"),
        })
      );
      yield* waitForLog(annotations);

      expect(annotations[0]?.["professional_desktop.renderer.source"]).toBe("window_error");
      expect(annotations[0]?.cause_message).not.toContain("listener-private-value");
      expect(annotations[0]?.cause_detail).not.toContain("/home/operator");
      registry.dispose();
    })
  );
});
