// A config-dependency pnpmfile that sets pnpm's release-age keys to a HIGH age
// (4320 minutes = 3 days). Paired with `hook-pnpmfile-age-1440.mjs` to prove
// last-wins threading across hooks: replayed FIRST, its 4320 must be overwritten
// by the later hook's lower 1440 (not maxed to 4320).
export const hooks = {
	updateConfig(config) {
		return {
			...config,
			minimumReleaseAge: 4320,
			minimumReleaseAgeExclude: ["@scope/a", "typescript"],
		};
	},
};
