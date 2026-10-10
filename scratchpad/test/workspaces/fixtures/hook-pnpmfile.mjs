// A test config-dependency pnpmfile in ES-module form — pnpm 11 ships the
// config-dependency pnpmfile as an `.mjs`, and a pnpm-11-native config dep may
// carry ONLY this file.
//
// Its `updateConfig` hook writes a marker file (path from `HOOK_MARKER`) as a
// detectable side effect proving it executed, and injects DISTINCT catalog
// entries — so a test can prove the `.mjs` was the file actually loaded, not a
// stray `.cjs` sibling.
import { writeFileSync } from "node:fs";

export const hooks = {
	updateConfig(config) {
		const marker = process.env.HOOK_MARKER;
		if (marker) writeFileSync(marker, "loaded-mjs");
		return {
			...config,
			catalog: { ...(config.catalog ?? {}), "mjs-dep": "^2.0.0" },
			catalogs: { ...(config.catalogs ?? {}), mjsExtra: { "mjs-extra-dep": "^3.4.5" } },
		};
	},
};
