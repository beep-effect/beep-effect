import "./styles/globals.css";
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

if (root !== null) {
  createRoot(root).render(
    <StrictMode>
      <WorkbenchThemeProvider>
        <ProfessionalAtomProvider>
          <App />
        </ProfessionalAtomProvider>
      </WorkbenchThemeProvider>
    </StrictMode>
  );
}
