import "./styles/globals.css";
import { $ProfessionalDesktopId } from "@beep/identity";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.js";
import { ProfessionalAtomProvider } from "./runtime/ProfessionalAtomProvider.tsx";
import { WorkbenchThemeProvider } from "./theme/WorkbenchThemeProvider.tsx";

// biome-ignore lint/suspicious/noUndeclaredEnvVars: Vite injects DEV on import.meta.env.
if (import.meta.env.DEV) {
  void import("react-grab");
}

const root = document.getElementById("root");

const $I = $ProfessionalDesktopId.create("main");

class RendererObservabilityConfig extends S.Class<RendererObservabilityConfig>($I`RendererObservabilityConfig`)(
  {
    buildCommit: S.optional(S.String),
    deploymentEnvironment: S.String,
    launchId: S.String,
    logLevel: S.String,
    otlpUrl: S.optional(S.String),
    qaSessionId: S.String,
  },
  $I.annote("RendererObservabilityConfig", {
    description: "Observability context supplied by the native desktop shell to the renderer runtime.",
  })
) {}

const setRuntimeString = (key: string, value: string | undefined): void => {
  if (value !== undefined && value.length > 0) Reflect.set(globalThis, key, value);
};

const loadRendererObservabilityConfig = Effect.fnUntraced(function* () {
  if (!("__TAURI_INTERNALS__" in globalThis)) return;

  const { invoke } = yield* Effect.tryPromise(() => import("@tauri-apps/api/core"));
  const wire = yield* Effect.tryPromise(() => invoke("renderer_observability_config"));
  const config = yield* S.decodeUnknownEffect(RendererObservabilityConfig)(wire);
  setRuntimeString("__BEEP_BUILD_COMMIT__", config.buildCommit);
  setRuntimeString("__BEEP_DEPLOYMENT_ENVIRONMENT__", config.deploymentEnvironment);
  setRuntimeString("__BEEP_LAUNCH_ID__", config.launchId);
  setRuntimeString("__BEEP_LOG_LEVEL__", config.logLevel);
  setRuntimeString("__BEEP_OTLP_URL__", config.otlpUrl);
  setRuntimeString("__BEEP_QA_SESSION_ID__", config.qaSessionId);
});

const render = Effect.fnUntraced(function* () {
  yield* loadRendererObservabilityConfig().pipe(Effect.catchCause(Effect.logWarning));
  if (root === null) return;

  createRoot(root).render(
    <StrictMode>
      <WorkbenchThemeProvider>
        <ProfessionalAtomProvider>
          <App />
        </ProfessionalAtomProvider>
      </WorkbenchThemeProvider>
    </StrictMode>
  );
});

Effect.runFork(render());
