// A test config-dependency pnpmfile in ES-module form — pnpm 11 ships the
// config-dependency pnpmfile as an `.mjs`, and a pnpm-11-native config dep may
// carry ONLY this file.
//
// Its `updateConfig` hook writes a marker file (path from `HOOK_MARKER`) as a
// detectable side effect proving it executed, and injects DISTINCT catalog
// entries — so a test can prove the `.mjs` was the file actually loaded, not a
// stray `.cjs` sibling.
import * as NodeFS from "node:fs";

export const hooks = {
  updateConfig(config) {
    // biome-ignore lint/suspicious/noUndeclaredEnvVars: pnpm executes this fixture pnpmfile from a temp tree outside any Turbo task; the test sets HOOK_MARKER via vi.stubEnv. Owner: @beep/repo-workspaces. Exit: the hook-replay tests pass the marker path through pnpm config instead of the environment.
    const marker = process.env.HOOK_MARKER;
    if (marker) NodeFS.writeFileSync(marker, "loaded-mjs");
    return {
      ...config,
      catalog: { ...(config.catalog ?? {}), "mjs-dep": "^2.0.0" },
      catalogs: { ...(config.catalogs ?? {}), mjsExtra: { "mjs-extra-dep": "^3.4.5" } },
    };
  },
};
