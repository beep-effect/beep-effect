/**
 * Browser-global failure capture for the Professional Desktop renderer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ProfessionalDesktopId } from "@beep/identity";
import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability";
import { LiteralKit } from "@beep/schema";
import { Effect, Metric } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
import { professionalBrowserRuntime } from "./ProfessionalAtomRuntime.ts";

const $I = $ProfessionalDesktopId.create("runtime/BrowserFailure.atoms");

const BrowserFailureSource = LiteralKit(["window_error", "unhandled_rejection"]).pipe(
  $I.annoteSchema("BrowserFailureSource", {
    description: "Browser-global renderer failure sources captured by the desktop runtime.",
  })
);

class BrowserFailure extends S.Class<BrowserFailure>($I`BrowserFailure`)(
  {
    source: BrowserFailureSource,
    cause: S.Unknown,
  },
  $I.annote("BrowserFailure", {
    description: "One browser-global failure awaiting sanitized telemetry reporting.",
  })
) {}

const browserFailures = Metric.counter("desktop_renderer_failures_total", { incremental: true });

const reportBrowserFailureAtom = professionalBrowserRuntime.fn<BrowserFailure>()(
  Effect.fn("ProfessionalDesktop.reportBrowserFailure")(function* (failure) {
    yield* Metric.update(Metric.withAttributes(browserFailures, { source: failure.source }), 1);
    yield* logRedactedCause(
      failure.cause,
      LogRedactedCauseOptions.make({
        message: "professional desktop renderer failure",
        level: "Error",
        attributes: { source: failure.source, subsystem: "renderer" },
      })
    );
  })
);

/**
 * Mounted Atom that registers browser-global error and rejected-Promise
 * listeners and removes them when the renderer registry is disposed.
 *
 * @example
 * ```tsx
 * import { browserFailureListenersAtom } from "@/runtime/BrowserFailure.atoms"
 * import { useAtomMount } from "@effect/atom-react"
 *
 * function BrowserFailureListeners(): null {
 *   useAtomMount(browserFailureListenersAtom)
 *   return null
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const browserFailureListenersAtom = Atom.make((get) => {
  if (typeof window === "undefined") return undefined;

  const onError = (event: ErrorEvent): void => {
    const eventError: unknown = event.error;
    get.set(
      reportBrowserFailureAtom,
      BrowserFailure.make({
        source: "window_error",
        cause: O.getOrElse(O.fromNullOr(eventError), () => event.message),
      })
    );
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent): void => {
    const reason: unknown = event.reason;
    get.set(reportBrowserFailureAtom, BrowserFailure.make({ source: "unhandled_rejection", cause: reason }));
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
  get.addFinalizer(() => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  });
  return undefined;
});
