/**
 * Browser-global failure capture for the Professional Desktop renderer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability/CauseRedaction";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Effect from "effect/Effect";
import * as Metric from "effect/Metric";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
import { professionalBrowserRuntime } from "./ProfessionalAtomRuntime.ts";

const $I = $ProfessionalDesktopId.create("runtime/BrowserFailure.atoms");

/**
 * Closed set of renderer boundaries that can report a browser failure.
 *
 * **Example** (Check workspace source)
 *
 * ```ts
 * import { BrowserFailureSource } from "@/runtime/BrowserFailure.atoms"
 *
 * console.log(BrowserFailureSource.is.workspace("workspace")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BrowserFailureSource = LiteralKit([
  "window_error",
  "unhandled_rejection",
  "app_registry",
  "desktop_transport",
  "workspace",
  "cosmos_spike",
]).annotate(
  $I.annote("BrowserFailureSource", {
    description: "Browser-global renderer failure sources captured by the desktop runtime.",
  })
);

/**
 * Browser boundary that reported a handled failure.
 *
 * **Example** (Assign typed source)
 *
 * ```ts
 * import type { BrowserFailureSource } from "@/runtime/BrowserFailure.atoms"
 *
 * const source: BrowserFailureSource = "workspace"
 * console.log(source)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BrowserFailureSource = typeof BrowserFailureSource.Type;

/**
 * A browser-side failure that must be reported without exposing its cause to
 * the rendered UI.
 *
 * **Example** (Create browser failure)
 *
 * ```ts
 * import { BrowserFailure } from "@/runtime/BrowserFailure.atoms"
 *
 * const failure = BrowserFailure.make({
 *   source: "workspace",
 *   cause: new Error("workspace failed"),
 * })
 * console.log(failure.source) // "workspace"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BrowserFailure extends S.Class<BrowserFailure>($I`BrowserFailure`)(
  {
    source: BrowserFailureSource,
    cause: S.Unknown,
  },
  $I.annote("BrowserFailure", {
    description: "One browser-global failure awaiting sanitized telemetry reporting.",
  })
) {}

const browserFailures = Metric.counter("desktop_renderer_failures_total", { incremental: true });

const reportBrowserFailure = Effect.fn("professional_desktop.renderer.report_failure")(function* (
  failure: BrowserFailure
) {
  yield* Metric.update(Metric.withAttributes(browserFailures, { source: failure.source }), 1);
  yield* logRedactedCause(
    failure.cause,
    LogRedactedCauseOptions.make({
      message: "professional desktop renderer failure",
      level: "Error",
      attributes: {
        "professional_desktop.renderer.source": failure.source,
        subsystem: "renderer",
      },
    })
  );
});

const reportBrowserFailureAtom = professionalBrowserRuntime.fn<BrowserFailure>()(reportBrowserFailure);

/**
 * Runtime-observed failure family for failures already represented by an
 * `AsyncResult` UI branch.
 *
 * **Details**
 *
 * Mount the family member beside the rendered fallback so the technical Cause
 * is logged once through the professional runtime while the UI renders only its
 * redacted client message.
 *
 * **Example** (Mount reported failure)
 *
 * ```tsx
 * import { reportedBrowserFailureAtoms } from "@/runtime/BrowserFailure.atoms"
 * import { useAtomMount } from "@effect/atom-react"
 *
 * function WorkspaceFailureReporter({ cause }: { cause: unknown }): null {
 *   useAtomMount(reportedBrowserFailureAtoms("workspace")(cause))
 *   return null
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const reportedBrowserFailureAtoms = Atom.family((source: BrowserFailureSource) =>
  Atom.family((cause: unknown) =>
    professionalBrowserRuntime.atom(reportBrowserFailure(BrowserFailure.make({ source, cause })))
  )
);

/**
 * Compatibility family for callers that already hold a complete failure.
 *
 * **Example** (Mount handled failure)
 *
 * ```tsx
 * import { BrowserFailure, handledBrowserFailureAtoms } from "@/runtime/BrowserFailure.atoms"
 * import { useAtomMount } from "@effect/atom-react"
 *
 * const failure = BrowserFailure.make({
 *   source: "app_registry",
 *   cause: new Error("registry failed"),
 * })
 *
 * function BrowserFailureReporter(): null {
 *   useAtomMount(handledBrowserFailureAtoms(failure))
 *   return null
 * }
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const handledBrowserFailureAtoms = Atom.family((failure: BrowserFailure) =>
  reportedBrowserFailureAtoms(failure.source)(failure.cause)
);

/**
 * Mounted Atom that registers browser-global error and rejected-Promise
 * listeners and removes them when the renderer registry is disposed.
 *
 * **Example** (Mount global listeners)
 *
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
  get.mount(reportBrowserFailureAtom);

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
