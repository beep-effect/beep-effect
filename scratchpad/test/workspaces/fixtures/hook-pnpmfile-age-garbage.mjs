// A config-dependency pnpmfile that returns MALFORMED release-age values: a
// non-numeric `minimumReleaseAge` and a non-array `minimumReleaseAgeExclude`.
// The seam reads a hook's returned DATA tolerantly (only a load/replay failure
// is typed), so both garbage values are dropped and the hook contributes an
// empty release-age gate — never a typed failure.
export const hooks = {
	updateConfig(config) {
		return {
			...config,
			minimumReleaseAge: "soon",
			minimumReleaseAgeExclude: "nope",
		};
	},
};
