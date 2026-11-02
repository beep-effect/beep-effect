/**
 * Resolve the DuckDB native addon from the folder that holds the compiled
 * practice KG executable, whatever the launcher's working directory.
 *
 * **Details**
 *
 * `bun build --compile` keeps the `@duckdb/node-bindings-*` addons external
 * and the MCPB package ships them in `node_modules` beside the executable. A
 * compiled executable resolves bare specifiers from its embedded virtual root
 * (`B:\\~BUN\\root`, `/$bunfs/root`), so without help the addon only loads
 * through `NODE_PATH` or from a working directory that happens to hold that
 * `node_modules`. The resolver tries, in order:
 *
 * 1. `node_modules` in the directory of `process.execPath` (the executable's
 *    own folder);
 * 2. Bun's default resolution, which honours `NODE_PATH` (the manifest sets it
 *    for Claude Desktop) and finally the working directory.
 *
 * On Windows the resolved addon's folder is also added to the DLL search
 * path (`SetDllDirectoryW`), so the addon finds the `duckdb.dll` it links
 * against.
 *
 * Only `@duckdb/node-bindings-*` requests are touched; every other specifier
 * goes straight to the default resolution. When the host runs from source,
 * `process.execPath` is the `bun` binary, nothing sits beside it, and the
 * default resolution applies unchanged.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as NodeModule from "node:module";
import { currentHostPlatform } from "@beep/utils/HostProcess";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Str from "effect/String";

const NativeAddonPrefix = "@duckdb/node-bindings-";

/**
 * Whether a module request names a DuckDB native addon.
 *
 * **Example** (Recognise the addon specifier)
 *
 * ```ts
 * import { isNativeAddonRequest } from "../../src/NativeAddon.ts"
 *
 * console.log(isNativeAddonRequest("@duckdb/node-bindings-win32-x64/duckdb.node")) // true
 * console.log(isNativeAddonRequest("effect/Effect")) // false
 * ```
 *
 * @param request - The specifier passed to `require`.
 * @returns `true` for `@duckdb/node-bindings-*` requests.
 * @category predicates
 * @since 0.0.0
 */
export const isNativeAddonRequest: (request: string) => boolean = Str.startsWith(NativeAddonPrefix);

/**
 * The directory that holds an executable path, for POSIX and Windows paths.
 *
 * **Example** (Take the executable folder)
 *
 * ```ts
 * import { executableDirectory } from "../../src/NativeAddon.ts"
 *
 * console.log(executableDirectory("C:\\Ext\\practice-kg-mcp.exe")) // "C:\\Ext\\"
 * console.log(executableDirectory("/opt/ext/practice-kg-mcp")) // "/opt/ext/"
 * ```
 *
 * @param executablePath - Usually `process.execPath`.
 * @returns The directory part with its trailing separator, or `.` when the
 *   path has no separator.
 * @category utilities
 * @since 0.0.0
 */
export const executableDirectory = (executablePath: string): string => {
  const cut = O.reduceCompact([Str.lastIndexOf("/")(executablePath), Str.lastIndexOf("\\")(executablePath)], -1, N.max);
  return cut < 0 ? "." : Str.slice(0, cut + 1)(executablePath);
};

/**
 * Resolve a DuckDB native addon from the executable's own folder.
 *
 * **Details**
 *
 * The lookup checks only the exact addon path under `executablePath`'s
 * directory; neither the working directory nor ancestor folders take part.
 * `None` means the caller falls back to the
 * default resolution (`NODE_PATH`, then the working directory).
 *
 * **Example** (Resolve beside the executable)
 *
 * ```ts
 * import { resolveNativeAddon } from "../../src/NativeAddon.ts"
 * import * as O from "effect/Option"
 *
 * const resolved = resolveNativeAddon(
 *   "@duckdb/node-bindings-linux-x64/duckdb.node",
 *   "/opt/ext/practice-kg-mcp",
 *   () => true
 * )
 * console.log(O.getOrNull(resolved)) // "/opt/ext/node_modules/@duckdb/node-bindings-linux-x64/duckdb.node"
 * ```
 *
 * @param request - The specifier passed to `require`.
 * @param executablePath - Usually `process.execPath`.
 * @param exists - Checks whether the exact executable-relative addon exists.
 * @returns The resolved file, or `None` for other requests or a missing addon.
 * @category use-cases
 * @since 0.0.0
 */
export const resolveNativeAddon: {
  (executablePath: string, exists: (path: string) => boolean): (request: string) => O.Option<string>;
  (request: string, executablePath: string, exists: (path: string) => boolean): O.Option<string>;
} = dual(3, (request: string, executablePath: string, exists: (path: string) => boolean): O.Option<string> => {
  if (!isNativeAddonRequest(request)) {
    return O.none();
  }
  const directory = executableDirectory(executablePath);
  const candidate = `${directory === "." ? "./" : directory}node_modules/${request}`;
  return exists(candidate) ? O.some(candidate) : O.none();
});

/**
 * Encode a string as null-terminated UTF-16 code units for a Windows `W` API.
 *
 * **Details**
 *
 * Indexes code units rather than iterating code points, so a character
 * outside the Basic Multilingual Plane keeps both of its surrogates.
 *
 * **Example** (Encode a folder for `SetDllDirectoryW`)
 *
 * ```ts
 * import { toWideString } from "../../src/NativeAddon.ts"
 *
 * console.log(Array.from(toWideString("C:"))) // [67, 58, 0]
 * ```
 *
 * @param value - The text to encode.
 * @returns The UTF-16 code units followed by a 0 terminator.
 * @category utilities
 * @since 0.0.0
 */
export const toWideString = (value: string): Uint16Array =>
  Uint16Array.from({ length: Str.length(value) + 1 }, (_, index) => O.getOrElse(Str.charCodeAt(value, index), () => 0));

/**
 * Add a folder to the Windows DLL search path with `SetDllDirectoryW`.
 *
 * **Details**
 *
 * DuckDB 2's Windows addon (`duckdb.node`) links against `duckdb.dll` in the
 * same folder, which Windows does not search. `bun:ffi` is loaded
 * synchronously because the resolver runs while modules are evaluated. The
 * call never fails: when `bun:ffi`, `kernel32` or the call itself fails it
 * logs one line through `Console.error` (without the folder, which names the
 * user) and the addon load then reports the missing DLL.
 *
 * **Example** (Register the addon folder)
 *
 * ```ts
 * import { setDllDirectory } from "../../src/NativeAddon.ts"
 * import * as Effect from "effect/Effect"
 *
 * const registered: boolean = Effect.runSync(
 *   setDllDirectory("C:\\Ext\\node_modules\\@duckdb\\node-bindings-win32-x64\\")
 * )
 * ```
 *
 * @param directory - The folder that holds the addon and its DLLs.
 * @returns Whether Windows accepted the folder.
 * @category use-cases
 * @since 0.0.0
 */
export const setDllDirectory = Effect.fnUntraced(function* (directory: string) {
  const registered = yield* Effect.try(() => {
    const ffi = NodeModule.createRequire(import.meta.url)("bun:ffi") as typeof import("bun:ffi");
    const kernel32 = ffi.dlopen("kernel32.dll", { SetDllDirectoryW: { args: ["ptr"], returns: "i32" } });
    try {
      return kernel32.symbols.SetDllDirectoryW(ffi.ptr(toWideString(Str.replaceAll("/", "\\")(directory)))) !== 0;
    } finally {
      kernel32.close();
    }
  }).pipe(Effect.orElseSucceed(() => false));
  yield* Console.error(
    "practice-kg-mcp: could not add the DuckDB addon folder to the DLL search path; duckdb.dll may fail to load."
  ).pipe(Effect.when(Effect.succeed(!registered)));
  return registered;
});

type ResolveFilename = (this: unknown, request: string, ...rest: ReadonlyArray<unknown>) => string;

type ModuleResolver = {
  _resolveFilename: ResolveFilename;
};

let installed = false;
let dllDirectorySet = false;

/**
 * Route DuckDB native addon requests through {@link resolveNativeAddon}.
 *
 * **Details**
 *
 * Wraps `Module._resolveFilename` once per process; repeated calls are
 * no-ops. Must run before `@duckdb/node-bindings` is evaluated, which is why
 * `NativeAddon.install.ts` is the first import of the host entrypoint.
 *
 * **Example** (Install before DuckDB loads)
 *
 * ```ts
 * import { installNativeAddonResolver } from "../../src/NativeAddon.ts"
 *
 * installNativeAddonResolver()
 * ```
 *
 * @param registerDllDirectory - Adds the resolved addon's folder to the
 *   Windows DLL search path; `SetDllDirectoryW` through `bun:ffi` by default,
 *   replaced in tests.
 * @category use-cases
 * @since 0.0.0
 */
export const installNativeAddonResolver = (
  registerDllDirectory: (directory: string) => Effect.Effect<unknown> = setDllDirectory
): void => {
  if (installed) {
    return;
  }
  installed = true;
  const resolver = NodeModule.Module as unknown as ModuleResolver;
  const fallback = resolver._resolveFilename;
  const require = NodeModule.createRequire(import.meta.url);
  resolver._resolveFilename = function (this: unknown, request: string, ...rest: ReadonlyArray<unknown>) {
    const resolved = resolveNativeAddon(request, process.execPath, (path) =>
      O.isSome(O.liftThrowable(require.resolve)(path))
    );
    if (O.isSome(resolved) && currentHostPlatform === "win32" && !dllDirectorySet) {
      dllDirectorySet = true;
      Effect.runSync(registerDllDirectory(executableDirectory(resolved.value)));
    }
    return O.getOrElse(resolved, () => fallback.call(this, request, ...rest));
  };
};
