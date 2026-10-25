/**
 * XDG Base Directory resolution for Effect: the resolved XDG environment
 * (`Xdg`), the base directories with their spec defaults (`XdgBase`),
 * app-namespaced directories with on-demand creation (`AppDirs`) and OS-native
 * directory mapping (`NativeDirs`), plus the shared absolute-path predicates
 * and schemas (`Absolute`). The environment is read once, at layer
 * construction, so reading a path never fails.
 *
 * **Details**
 *
 * The bridge into `@beep/config-file` discovery is the `@beep/xdg/XdgConfig`
 * subpath. The root does not re-export it, so importing the root never loads
 * config-file or its codecs.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export { AbsolutePath, AbsolutePosixPath, absolutePathPattern, isAbsolutePosix, isAbsoluteWin32 } from "./Absolute.ts";
export {
  AppDirKind,
  AppDirOverrides,
  AppDirs,
  AppDirsError,
  AppDirsNamespaceError,
  AppDirsOptions,
  AppDirsOverrideError,
  type AppDirsShape,
  ResolvedAppDirs,
} from "./AppDirs.ts";
export { NativeDirs } from "./NativeDirs.ts";
export { currentPlatform, Xdg, XdgEnvError, XdgPaths, XdgPlatform } from "./Xdg.ts";
export { XdgBase, XdgBaseKind } from "./XdgBase.ts";
