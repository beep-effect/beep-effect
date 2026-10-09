/**
 * XDG Base Directory resolution for Effect: the resolved XDG environment
 * (`Xdg`), app-namespaced directories with on-demand creation (`AppDirs`),
 * OS-native directory mapping (`NativeDirs`), and the bridge into
 * `@effected/config-file` discovery (`XdgConfig`). The environment is read once,
 * at layer construction, so reading a path never fails.
 *
 * @packageDocumentation
 */

export {
	AppDirKind,
	type AppDirOverrides,
	AppDirs,
	AppDirsError,
	type AppDirsOptions,
	type AppDirsShape,
	ResolvedAppDirs,
} from "./AppDirs.ts";
export { NativeDirs } from "./NativeDirs.ts";
export { CurrentPlatform, Xdg, XdgEnvError, XdgPaths, XdgPlatform } from "./Xdg.ts";
export { XdgConfig } from "./XdgConfig.ts";
