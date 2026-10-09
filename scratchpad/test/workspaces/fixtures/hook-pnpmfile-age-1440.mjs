// A config-dependency pnpmfile that sets pnpm's release-age keys to a LOW age
// (1440 minutes = 1 day) and a DISTINCT exclude list. Used two ways:
//   - alone, to prove a hook's numeric age + array exclude are surfaced;
//   - replayed AFTER `hook-pnpmfile-age-4320.mjs`, to prove last-wins threading
//     (the final 1440 / `@scope/b` overwrite the earlier 4320 / `@scope/a`).
export const hooks = {
	updateConfig(config) {
		return {
			...config,
			minimumReleaseAge: 1440,
			minimumReleaseAgeExclude: ["@scope/b"],
		};
	},
};
