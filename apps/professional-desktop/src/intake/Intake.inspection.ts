/**
 * Dev-only bridge from the intake actor to the Stately inspector.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability/CauseRedaction";
import * as O from "@beep/utils/Option";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { InspectableActor } from "@beep/xstate";
import type * as Scope from "effect/Scope";

/**
 * Whether this renderer build forwards the intake actor to the Stately inspector.
 *
 * **Details**
 *
 * Only a development build started with `VITE_STATELY_INSPECT=1` inspects, so
 * a packaged app never opens the inspector relay.
 *
 * **Example** (Read the inspection toggle)
 *
 * ```ts
 * import { statelyInspectEnabled } from "@/intake/Intake.inspection"
 *
 * console.log(statelyInspectEnabled())
 * ```
 *
 * @returns `true` when the dev server was started with the inspector enabled.
 * @category configuration
 * @since 0.0.0
 */
export const statelyInspectEnabled = (): boolean => {
  // Vite types DEV as a boolean; tooling without the Vite client types sees a string.
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: Vite injects DEV and VITE_* on import.meta.env.
  const dev: unknown = import.meta.env.DEV;
  return (dev === true || dev === "true") && import.meta.env.VITE_STATELY_INSPECT === "1";
};

/**
 * Forward an intake actor to the Stately inspector for as long as the
 * enclosing scope stays open, and report the inspector URL.
 *
 * **Details**
 *
 * The inspector driver is imported on demand, so a build that never inspects
 * does not load the Stately SDK. When inspection is disabled the Effect does
 * nothing and reports no URL. When the relay rejects this producer's
 * registration, the rejection is logged redacted, the actor is not attached and
 * no URL is reported, so a developer never sees a session that cannot work.
 *
 * **Example** (Inspect an actor in a scoped program)
 *
 * ```ts
 * import { inspectIntakeActor } from "@/intake/Intake.inspection"
 * import { createEffectActor } from "@xstate/effect"
 * import * as Effect from "effect/Effect"
 * import { createMachine } from "xstate"
 *
 * const toggle = createMachine({ initial: "off", states: { off: { on: { TOGGLE: { target: "on" } } }, on: {} } })
 * const program = Effect.flatMap(createEffectActor(toggle), inspectIntakeActor)
 * console.log(program)
 * ```
 *
 * @param actor - Actor handle exposing `inspect`.
 * @returns The inspector URL when inspection is enabled and a relay URL exists.
 * @category observability
 * @since 0.0.0
 */
export const inspectIntakeActor = Effect.fn("professional_desktop.intake.inspect_actor")(function* (
  actor: InspectableActor
): Effect.fn.Return<O.Option<string>, never, Scope.Scope> {
  if (!statelyInspectEnabled()) {
    return O.none<string>();
  }
  const driver = yield* Effect.promise(() => import("@beep/xstate"));
  const services = yield* Layer.build(
    driver.StatelyInspector.makeLayer(
      driver.StatelyInspectorConfig.make({ enabled: true, name: O.some("professional-desktop document intake") })
    )
  );
  const inspector = Context.get(services, driver.StatelyInspector);
  const accepted = yield* inspector.ready.pipe(
    Effect.as(true),
    Effect.catchCause((cause) =>
      logRedactedCause(
        cause,
        LogRedactedCauseOptions.make({
          message: "Stately inspector relay rejected document intake",
          level: "Warn",
          attributes: { "professional_desktop.subsystem": "document_intake" },
        })
      ).pipe(Effect.as(false))
    )
  );
  if (!accepted) {
    return O.none<string>();
  }
  yield* inspector.attach(actor);
  yield* Effect.logInfo("Stately inspector attached to document intake").pipe(
    Effect.annotateLogs({ "professional_desktop.intake.inspector_url": O.getOrElse(inspector.inspectorUrl, () => "") })
  );
  return inspector.inspectorUrl;
});
