// The pnpm native-binary layout: from pnpm 12 the `pnpm` registry package is a
// thin wrapper whose `pnpm` bin is a shebang-less placeholder that the
// package's own install script overwrites with the host's native executable,
// fetched as an optional dependency named `@pnpm/exe.<os>-<arch>[-musl]`.
// The installer never runs lifecycle scripts, so it performs that overlay
// itself; the pure pieces of that live here, where they are testable without
// a tarball.
//
// Detection is by LAYOUT (the manifest's `optionalDependencies` naming an
// `@pnpm/exe.*` package), never by major version — pnpm 11 and earlier ship
// no such dependency and keep their Node entry points.

import { Option, Result } from "effect";
import * as Base64 from "effect/encoding/Base64";
import * as Hex from "effect/encoding/Hex";

/** The prefix every native-binary package name carries. @internal */
export const PNPM_EXE_PREFIX = "@pnpm/exe.";

/**
 * The targets pnpm publishes a native binary for — the `PLATFORMS` table of
 * the wrapper's own `native-binary.mjs`, flattened to the spellings that
 * follow the prefix. Only linux x64/arm64 have a musl twin.
 */
const PNPM_EXE_TARGETS: ReadonlySet<string> = new Set([
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

/** `RUNNER_OS` spellings (lower-cased) onto Node's `process.platform` spellings, which the targets use. */
const RUNNER_OS_TO_PLATFORM: Readonly<Record<string, string>> = {
	linux: "linux",
	macos: "darwin",
	windows: "win32",
};

/**
 * The `@pnpm/exe.*` target for a runner platform, or `None` when pnpm
 * publishes no native binary for it.
 *
 * `musl` only distinguishes on linux; an arch released for glibc alone
 * (riscv64, ppc64, s390x) answers `None` on a musl host, as upstream does —
 * the glibc binary cannot run there.
 *
 * @internal
 */
export const pnpmExeTarget = (runnerOs: string, arch: string, musl: boolean): Option.Option<string> => {
	const platform = RUNNER_OS_TO_PLATFORM[runnerOs.toLowerCase()];
	if (platform === undefined) {
		return Option.none();
	}
	const target = `${platform}-${arch}${platform === "linux" && musl ? "-musl" : ""}`;
	return PNPM_EXE_TARGETS.has(target) ? Option.some(target) : Option.none();
};

/**
 * Whether the HOST libc is musl, the way the wrapper's `native-binary.mjs`
 * decides it: a glibc build of node reports `glibcVersionRuntime` in its
 * diagnostic report header, a musl build does not. Only meaningful on a
 * linux host; anything unprobeable counts as glibc, which is what every
 * hosted runner is.
 *
 * `process.report` is a global, not a `node:` import, so this stays inside
 * the package's closed `node:` list.
 *
 * @internal
 */
export const detectMusl = (): boolean => {
	if (process.platform !== "linux") {
		return false;
	}
	try {
		const report = process.report?.getReport() as { readonly header?: { readonly glibcVersionRuntime?: unknown } };
		if (report === undefined || report.header === undefined) {
			return false;
		}
		return report.header.glibcVersionRuntime === undefined || report.header.glibcVersionRuntime === "";
	} catch {
		return false;
	}
};

/** The SRI algorithms a registry may list, strongest first. */
const SRI_ALGORITHMS: ReadonlyArray<string> = ["sha512", "sha384", "sha256", "sha1"];

/**
 * The strongest entry of a Subresource Integrity string (`<algo>-<base64>`,
 * several separated by whitespace), as `{ algorithm, hex }` — the spelling a
 * corepack pin uses, so a mismatch reports both sides the same way. `None`
 * when nothing parseable is there.
 *
 * @internal
 */
export const strongestSri = (
	integrity: string,
): Option.Option<{ readonly algorithm: string; readonly hex: string }> => {
	const entries = integrity
		.split(/\s+/)
		.filter((entry) => entry.length > 0)
		.flatMap((entry) => {
			const dash = entry.indexOf("-");
			if (dash <= 0) {
				return [];
			}
			const algorithm = entry.slice(0, dash).toLowerCase();
			if (!SRI_ALGORITHMS.includes(algorithm)) {
				return [];
			}
			// Options (`?opt`) may trail the digest per the SRI grammar; drop them.
			const digest = entry.slice(dash + 1).split("?")[0] ?? "";
			const decoded = Base64.decode(digest);
			return Result.isSuccess(decoded) ? [{ algorithm, hex: Hex.encode(decoded.success) }] : [];
		});
	for (const algorithm of SRI_ALGORITHMS) {
		const found = entries.find((entry) => entry.algorithm === algorithm);
		if (found !== undefined) {
			return Option.some(found);
		}
	}
	return Option.none();
};

/** Whether a bin target is a Node script (run with `node`) rather than an executable run directly. @internal */
export const isNodeScript = (target: string): boolean => /\.[cm]?js$/i.test(target);
