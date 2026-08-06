// @effect-diagnostics strictEffectProvide:skip-file
import "./styles/globals.css";
import "./styles/dock.css";
import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability";
import { O, P } from "@beep/utils";
import { invoke } from "@tauri-apps/api/core";
import { Effect } from "effect";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { ProfessionalAtomProvider } from "./runtime/ProfessionalAtomProvider.tsx";
import { ProfessionalStorageLive } from "./runtime/ProfessionalAtomRuntime.ts";
import { RendererObservabilityConfig } from "./runtime/RendererObservabilityConfig.ts";
import { migrateWorkbenchThemeMode } from "./theme/Theme.atoms.ts";
import { WorkbenchThemeProvider } from "./theme/WorkbenchThemeProvider.tsx";

// biome-ignore lint/suspicious/noUndeclaredEnvVars: Vite injects DEV on import.meta.env.
if (import.meta.env.DEV) {
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
  yield* migrateWorkbenchThemeMode().pipe(
    Effect.catchCause(
      logRedactedCause(
        LogRedactedCauseOptions.make({
          message: "professional desktop theme preference migration failed",
          level: "Warn",
          attributes: {
            "professional_desktop.bootstrap.phase": "theme_preference_migration",
            "professional_desktop.subsystem": "bootstrap",
          },
        })
      )
    ),
    Effect.withSpan("professional_desktop.bootstrap.theme_preference_migration")
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

Effect.runFork(render().pipe(Effect.provide(ProfessionalStorageLive)));
