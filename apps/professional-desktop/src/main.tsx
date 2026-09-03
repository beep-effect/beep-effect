import "./styles/globals.css";
import "./styles/dock.css";
import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability/CauseRedaction";
import * as O from "@beep/utils/Option";
import * as P from "@beep/utils/Predicate";
import { invoke } from "@tauri-apps/api/core";
import * as Effect from "effect/Effect";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { ProfessionalAtomProvider } from "./runtime/ProfessionalAtomProvider.tsx";
import { RendererObservabilityConfig } from "./runtime/RendererObservabilityConfig.ts";
import { WorkbenchThemeProvider } from "./theme/WorkbenchThemeProvider.tsx";

// react-grab is a dev-only element picker; `VITE_REACT_GRAB=0` keeps its
// pointer-capturing overlay out of recorded browser-QA runs.
// biome-ignore lint/suspicious/noUndeclaredEnvVars: Vite injects DEV and VITE_* on import.meta.env.
if (import.meta.env.DEV && import.meta.env.VITE_REACT_GRAB !== "0") {
  void import("react-grab");
}

const root = document.getElementById("root");

const setRuntimeString = (key: string, value: string): void => {
  Reflect.set(globalThis, key, value);
};

const setOptionalRuntimeString = (key: string, value: O.Option<string>): void => {
  O.map(value, (present) => setRuntimeString(key, present));
};

const loadRendererObservabilityConfig = Effect.fn("professional_desktop.bootstrap.load_renderer_observability_config")(
  function* () {
    if (!("__TAURI_INTERNALS__" in globalThis)) return;

    const wire = yield* Effect.tryPromise(() => invoke("renderer_observability_config"));
    const config = yield* RendererObservabilityConfig.decode(wire);
    setOptionalRuntimeString("__BEEP_BUILD_COMMIT__", config.buildCommit);
    setRuntimeString("__BEEP_DEPLOYMENT_ENVIRONMENT__", config.deploymentEnvironment);
    setRuntimeString("__BEEP_LAUNCH_ID__", config.launchId);
    setRuntimeString("__BEEP_LOG_LEVEL__", config.logLevel);
    setOptionalRuntimeString("__BEEP_OTLP_URL__", config.otlpUrl);
    setRuntimeString("__BEEP_QA_SESSION_ID__", config.qaSessionId);
  }
);

const render = Effect.fn("professional_desktop.bootstrap.render")(function* () {
  yield* loadRendererObservabilityConfig().pipe(
    Effect.catchCause(
      logRedactedCause(
        LogRedactedCauseOptions.make({
          message: "professional desktop renderer observability bootstrap failed",
          level: "Warn",
          attributes: {
            "professional_desktop.bootstrap.phase": "renderer_observability",
            "professional_desktop.subsystem": "bootstrap",
          },
        })
      )
    ),
    Effect.withSpan("professional_desktop.bootstrap.renderer_observability")
  );
  if (P.isNull(root)) return;

  createRoot(root).render(
    <StrictMode>
      <ProfessionalAtomProvider>
        <WorkbenchThemeProvider>
          <App />
        </WorkbenchThemeProvider>
      </ProfessionalAtomProvider>
    </StrictMode>
  );
});

Effect.runFork(render());
