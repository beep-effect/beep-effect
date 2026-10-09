// A config-dependency pnpmfile that contributes a `peerDependencyRules` entry,
// MERGING onto whatever the threaded config already carries rather than
// replacing it — the behaviour measured against `@savvy-web/pnpm-plugin-silk`,
// and the reason the workspace file's rules are seeded rather than merged by
// kit code.
//
// It deliberately writes an UNVERSIONED key (`hooked-parent>hooked-peer`),
// the spelling a plugin uses, while the workspace file's inline block uses the
// parent-versioned spelling `pnpm:export` materializes.
export const hooks = {
	updateConfig(config) {
		const existing = config.peerDependencyRules ?? {};
		return {
			...config,
			peerDependencyRules: {
				...existing,
				allowedVersions: {
					...(existing.allowedVersions ?? {}),
					"hooked-parent>hooked-peer": "^9.0.0",
				},
			},
		};
	},
};
