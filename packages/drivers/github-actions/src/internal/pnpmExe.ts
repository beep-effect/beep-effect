import * as A from "effect/Array";
import * as Base64 from "effect/encoding/Base64";
import * as Hex from "effect/encoding/Hex";
import * as Function from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as Str from "effect/String";

/**
 * The prefix every native-binary package name carries.
 *
 * **Example** (Recognize the native package prefix)
 *
 * ```ts
 * import { PNPM_EXE_PREFIX } from "@beep/github-actions/internal/pnpmExe";
 *
 * console.log(PNPM_EXE_PREFIX) // @pnpm/exe.
 * ```
 *
 * @internal
 * @category constants
 * @since 0.0.0
 */
export const PNPM_EXE_PREFIX = "@pnpm/exe.";

const PNPM_EXE_TARGETS = HashSet.fromIterable<string>([
  "linux-x64",
  "linux-arm64",
  "linux-x64-musl",
  "linux-arm64-musl",
  "linux-riscv64",
  "linux-ppc64",
  "linux-s390x",
  "darwin-x64",
  "darwin-arm64",
  "win32-x64",
  "win32-arm64",
  "freebsd-x64",
  "android-x64",
  "android-arm64",
]);

const RUNNER_OS_TO_PLATFORM: Readonly<Record<string, string>> = {
  linux: "linux",
  macos: "darwin",
  windows: "win32",
};

/**
 * The `@pnpm/exe.*` target for a runner platform, or `None` when pnpm
 * publishes no native binary for it.
 *
 * **Details**
 *
 * `musl` only distinguishes on linux; an arch released for glibc alone
 * (riscv64, ppc64, s390x) answers `None` on a musl host, as upstream does —
 * the glibc binary cannot run there.
 *
 * **Gotchas**
 *
 * Detect native pnpm wrappers by optionalDependencies entries named @pnpm/exe.*, never by major version. pnpm 12's pnpm bin is a shebang-less placeholder normally overwritten by its lifecycle script; the installer runs no lifecycle scripts and must overlay the host executable itself. Older layouts retain Node entry points.
 *
 * **Example** (Select a Linux musl executable)
 *
 * ```ts
 * import { pnpmExeTarget } from "@beep/github-actions/internal/pnpmExe";
 * import * as O from "effect/Option";
 *
 * console.log(O.getOrUndefined(pnpmExeTarget("Linux", "x64", true))) // linux-x64-musl
 * console.log(O.isNone(pnpmExeTarget("Linux", "riscv64", true))) // true
 * ```
 *
 * @internal
 * @category queries
 * @since 0.0.0
 */
export const pnpmExeTarget: {
  (runnerOs: string, arch: string, musl: boolean): O.Option<string>;
  (arch: string, musl: boolean): (runnerOs: string) => O.Option<string>;
} = Function.dual(3, (runnerOs: string, arch: string, musl: boolean): O.Option<string> => {
  const platform = RUNNER_OS_TO_PLATFORM[Str.toLowerCase(runnerOs)];
  if (platform === undefined) {
    return O.none();
  }
  const target = `${platform}-${arch}${platform === "linux" && musl ? "-musl" : ""}`;
  return HashSet.has(PNPM_EXE_TARGETS, target) ? O.some(target) : O.none();
});

/**
 * Whether the HOST libc is musl, the way the wrapper's `native-binary.mjs`
 * decides it: a glibc build of node reports `glibcVersionRuntime` in its
 * diagnostic report header, a musl build does not. Only meaningful on a
 * linux host; anything unprobeable counts as glibc, which is what every
 * hosted runner is.
 *
 * **Details**
 *
 * `platform` is the host platform in Node's spelling; callers in Effect code
 * pass the injected `HostProcessPlatform` from `@beep/utils/HostProcess`.
 * The libc probe runs only when it is `"linux"`.
 *
 * `process.report` is a global, not a `node:` import, so this stays inside
 * the package's closed `node:` list.
 *
 * **Example** (Probe the host libc)
 *
 * ```ts
 * import { detectMusl } from "@beep/github-actions/internal/pnpmExe";
 *
 * const usesMusl = detectMusl("linux");
 * console.log(typeof usesMusl) // boolean
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const detectMusl = (platform: string): boolean => {
  if (platform !== "linux") {
    return false;
  }
  return Result.getOrElse(
    Result.try(() => {
      const report = process.report?.getReport();
      if (!P.hasProperty(report, "header") || !P.isObjectOrArray(report.header)) {
        return false;
      }
      return (
        !P.hasProperty(report.header, "glibcVersionRuntime") ||
        report.header.glibcVersionRuntime === undefined ||
        report.header.glibcVersionRuntime === ""
      );
    }),
    () => false
  );
};

const SRI_ALGORITHMS: ReadonlyArray<string> = ["sha512", "sha384", "sha256", "sha1"];

/**
 * The strongest entry of a Subresource Integrity string (`<algo>-<base64>`,
 * several separated by whitespace), as `{ algorithm, hex }` — the spelling a
 * corepack pin uses, so a mismatch reports both sides the same way. `None`
 * when nothing parseable is there.
 *
 * **Example** (Prefer the strongest parseable integrity entry)
 *
 * ```ts
 * import { strongestSri } from "@beep/github-actions/internal/pnpmExe";
 * import * as O from "effect/Option";
 *
 * const sri = strongestSri("sha1-YQ== sha512-Yg==");
 * console.log(O.getOrUndefined(O.map(sri, (entry) => `${entry.algorithm}:${entry.hex}`))) // sha512:62
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const strongestSri = (integrity: string): O.Option<{ readonly algorithm: string; readonly hex: string }> => {
  const entries = Function.pipe(
    Str.split(integrity, /\s+/),
    A.filter((entry) => entry.length > 0),
    A.flatMap((entry): ReadonlyArray<{ readonly algorithm: string; readonly hex: string }> => {
      const dash = O.getOrElse(Str.indexOf("-")(entry), () => -1);
      if (dash <= 0) {
        return [];
      }
      const algorithm = Function.pipe(entry, Str.slice(0, dash), Str.toLowerCase);
      if (!SRI_ALGORITHMS.includes(algorithm)) {
        return [];
      }
      const digest = Function.pipe(entry, Str.slice(dash + 1), Str.replace(/\?.*$/s, ""));
      const decoded = Base64.decode(digest);
      return Result.isSuccess(decoded) ? [{ algorithm, hex: Hex.encode(decoded.success) }] : [];
    })
  );
  for (const algorithm of SRI_ALGORITHMS) {
    const found = A.findFirst(entries, (entry) => entry.algorithm === algorithm);
    if (O.isSome(found)) {
      return found;
    }
  }
  return O.none();
};

/**
 * Whether a bin target is a Node script (run with `node`) rather than an executable run directly.
 *
 * **Example** (Distinguish Node scripts from native binaries)
 *
 * ```ts
 * import { isNodeScript } from "@beep/github-actions/internal/pnpmExe";
 *
 * console.log(isNodeScript("bin/pnpm.cjs")) // true
 * console.log(isNodeScript("bin/pnpm")) // false
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const isNodeScript = (target: string): boolean => /\.[cm]?js$/i.test(target);
