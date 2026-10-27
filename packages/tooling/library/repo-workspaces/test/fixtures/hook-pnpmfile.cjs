// A test config-dependency pnpmfile, copied into a temp
// `node_modules/.pnpm-config/<name>/pnpmfile.cjs` tree by the hook-replay test.
//
// Its `updateConfig` hook writes a marker file (path from `HOOK_MARKER`) as a
// detectable side effect proving it executed, and injects a catalog entry into
// both the default and a named catalog so the replay is observable.
"use strict";
const fs = require("node:fs");

exports.hooks = {
  updateConfig(config) {
    // biome-ignore lint/suspicious/noUndeclaredEnvVars: pnpm executes this fixture pnpmfile from a temp tree outside any Turbo task; the test sets HOOK_MARKER via vi.stubEnv. Owner: @beep/repo-workspaces. Exit: the hook-replay tests pass the marker path through pnpm config instead of the environment.
    const marker = process.env.HOOK_MARKER;
    if (marker) fs.writeFileSync(marker, "loaded");
    return {
      ...config,
      catalog: { ...(config.catalog ?? {}), "hooked-dep": "^9.9.9" },
      catalogs: { ...(config.catalogs ?? {}), extra: { "extra-dep": "^1.2.3" } },
    };
  },
};
