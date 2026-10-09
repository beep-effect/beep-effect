// A test config-dependency pnpmfile whose OWN nested import does not resolve.
//
// The dynamic `import()` of THIS file raises `ERR_MODULE_NOT_FOUND`, but for the
// nested module below — NOT for the pnpmfile itself. Node reports the nested
// module's URL on `err.url`, which differs from the candidate pnpmfile URL, so
// the replay seam must surface this typed as a `CatalogAssemblyError`, never
// mistake it for an absent pnpmfile and silently skip it.
import "./this-module-does-not-exist.js";

export const hooks = {
	updateConfig: (config) => config,
};
