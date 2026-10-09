/**
 * Provisions exact package-manager versions through the runner's tool cache.
 *
 * @packageDocumentation
 */
import { $ScratchpadId } from "@beep/identity/packages";
import type { IntegrityHashBrand } from "../npm/index.ts";
import { CorepackIntegrityHash, DEFAULT_REGISTRY, PackageManagerPin, PackageManagerPinName } from "../npm/index.ts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as R from "effect/Record";
import * as O from "@beep/utils/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { ActionEnvironment } from "./ActionEnvironment.ts";
import { digestFileHex } from "./internal/digest.ts";
import { typeAt } from "./internal/fsProbe.ts";
import { PNPM_EXE_PREFIX, detectMusl, isNodeScript, pnpmExeTarget, strongestSri } from "./internal/pnpmExe.ts";
import { isWindowsRunner } from "./internal/runner.ts";
import { unstubbed } from "./internal/unstubbed.ts";
import type { ToolInstallerError } from "./ToolInstaller.ts";
import { ToolInstaller } from "./ToolInstaller.ts";

const $I = $ScratchpadId.create("effected/github-actions/PackageManagerInstaller");

const Json = S.fromJsonString(S.Unknown);

const BinName = S.String.check(S.isPattern(/^(?!\.{1,2}$)[^/\\:\x00]+$/, {
	identifier: "BinName",
	title: "Package manager bin name",
	description: "A nonempty filename component without path separators, drive prefixes or NUL bytes.",
})).pipe($I.annoteSchema("BinName", { description: "A package manager command name confined to one shim filename." }));
const isBinName = S.is(BinName);

/**
 * Raised when a package manager cannot be provisioned on the runner.
 *
 * **Example** (Inspect an integrity requirement failure)
 *
 * ```ts
 * import { PackageManagerInstallerError } from "@beep/scratchpad/effected/github-actions/PackageManagerInstaller";
 *
 * const error = PackageManagerInstallerError.make({
 *   reason: "integrityMissing", name: "pnpm", version: "10.13.1",
 * });
 * console.log(error.reason) // integrityMissing
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class PackageManagerInstallerError extends S.TaggedError<PackageManagerInstallerError>($I`PackageManagerInstallerError`)(
	"PackageManagerInstallerError",
	{
		/**
		 * `downloadFailed`, `extractFailed` and `cacheFailed` mirror the
		 * {@link ToolInstallerError} that caused them, preserved on `cause`
		 * (`cacheFailed` also covers a shim that could not be written into the
		 * entry). `integrityMismatch` — the downloaded artifact does not hash to
		 * what the pin or the `integrity` option (or, for pnpm 12's native
		 * binary, the registry or the caller's `nativeIntegrity`) declares;
		 * nothing was cached. Also raised before anything runs when the
		 * `integrity` option is malformed or disagrees with the pin (see
		 * {@link PackageManagerInstallOptions.integrity}).
		 * `integrityMissing` — neither the pin nor the `integrity` option
		 * carries integrity and the caller asked for `requireIntegrity`, or —
		 * with `subject` naming the package — the
		 * caller supplied `nativeIntegrity` without an entry for the host's
		 * `@pnpm/exe.*` package.
		 * `unsupportedPlatform` — no build exists for this runner's
		 * OS/architecture pair: bun publishes none, or pnpm 12 ships no
		 * `@pnpm/exe.*` native binary for it. `layoutUnexpected` — the artifact
		 * extracted, but its contents are not shaped like the package manager it
		 * claims to be.
		 */
		reason: S.Literals([
			"downloadFailed",
			"extractFailed",
			"integrityMismatch",
			"integrityMissing",
			"unsupportedPlatform",
			"layoutUnexpected",
			"cacheFailed",
		]).annotateKey({ description: "`downloadFailed`, `extractFailed` and `cacheFailed` mirror the ToolInstallerError that caused them, preserved on `cause` (`cacheFailed` also covers a shim that could not be written into the entry). `integrityMismatch` — the downloaded artifact does not hash to what the pin or the `integrity` option (or, for pnpm 12's native binary, the registry or the caller's `nativeIntegrity`) declares; nothing was cached. Also raised before anything runs when the `integrity` option is malformed or disagrees with the pin (see PackageManagerInstallOptions.integrity). `integrityMissing` — neither the pin nor the `integrity` option carries integrity and the caller asked for `requireIntegrity`, or — with `subject` naming the package — the caller supplied `nativeIntegrity` without an entry for the host's `@pnpm/exe.*` package. `unsupportedPlatform` — no build exists for this runner's OS/architecture pair: bun publishes none, or pnpm 12 ships no `@pnpm/exe.*` native binary for it. `layoutUnexpected` — the artifact extracted, but its contents are not shaped like the package manager it claims to be." }),
		/** The package manager being installed. */
		name: PackageManagerPinName.annotateKey({ description: "The package manager being installed." }),
		/** The exact version being installed, in string form. */
		version: S.String.annotateKey({ description: "The exact version being installed, in string form." }),
		/** What was being worked on — a url, a path, or an OS/arch pair. */
		subject: S.optionalKey(S.String).annotateKey({ description: "What was being worked on — a url, a path, or an OS/arch pair." }),
		/** The integrity the pin declares (`<algo>.<hex>`), on a mismatch. */
		expected: S.optionalKey(S.String).annotateKey({ description: "The integrity the pin declares (`<algo>.<hex>`), on a mismatch." }),
		/** The integrity the artifact actually hashed to, on a mismatch. */
		actual: S.optionalKey(S.String).annotateKey({ description: "The integrity the artifact actually hashed to, on a mismatch." }),
		/** The underlying failure, preserved structurally. */
		cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying failure, preserved structurally." }),
	}, $I.annote("PackageManagerInstallerError", { description: "Raised when a package manager cannot be provisioned on the runner." }),
) {
	/**
	 * Explains the provisioning failure using the manager pin and available diagnostic fields.
	 *
	 * **Example** (Read a download failure explanation)
	 *
	 * ```ts
	 * import { PackageManagerInstallerError } from "@beep/scratchpad/effected/github-actions/PackageManagerInstaller";
	 *
	 * const error = PackageManagerInstallerError.make({
	 *   reason: "downloadFailed", name: "pnpm", version: "10.13.1",
	 * });
	 * console.log(error.message) // Could not download pnpm@10.13.1
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	override get message(): string {
		const pin = `${this.name}@${this.version}`;
		return Match.value(this.reason).pipe(
			Match.when("downloadFailed", () => `Could not download ${pin}${this.subject === undefined ? "" : ` from ${this.subject}`}`),
			Match.when("extractFailed", () => `Could not extract ${pin}${this.subject === undefined ? "" : ` (${this.subject})`}`),
			Match.when("integrityMismatch", () =>
			// Both hashes are absent on the path where the digest itself could
			// not be computed, which is a failure to VERIFY rather than a
			// verified mismatch. Saying so beats "expected undefined, got
			// undefined", which reads as a mismatch that was actually measured.
			this.expected === undefined || this.actual === undefined
				? `Could not verify the integrity of ${pin}${this.subject === undefined ? "" : ` (${this.subject})`}`
				: `Integrity mismatch for ${pin}: expected ${this.expected}, got ${this.actual}`,
			),
			Match.when("integrityMissing", () => this.subject === undefined
				? `Neither the pin for ${pin} nor the integrity option carries an integrity hash, and requireIntegrity is set`
				: `No integrity was supplied for ${this.subject}, which ${pin} needs on this runner`),
			Match.when("unsupportedPlatform", () => `No ${pin} build is published for ${this.subject}`),
			Match.when("layoutUnexpected", () => `The ${pin} artifact does not have the expected layout${this.subject === undefined ? "" : `: ${this.subject}`}`),
			Match.when("cacheFailed", () => `Could not cache ${pin} into the tool cache${this.subject === undefined ? "" : `: ${this.subject}`}`),
			Match.exhaustive,
		);
	}
}

/**
 * How {@link PackageManagerInstallerShape.install} should behave.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface PackageManagerInstallOptions {
	/**
	 * Fail with `integrityMissing` when neither the pin nor the `integrity`
	 * option carries an integrity hash, instead of proceeding with a logged
	 * warning. Off by default, because in-the-wild `devEngines` pins routinely
	 * carry no integrity.
	 *
	 * @since 0.0.0
	 */
	readonly requireIntegrity?: boolean | undefined;
	/**
	 * The expected integrity of the manager's own artifact, supplied beside
	 * the pin rather than through its `+<integrity>` tail — for a caller whose
	 * digest comes from somewhere other than the pin (a lockfile, or the
	 * registry's `dist.integrity`) and that should not have to rewrite the pin
	 * to carry it.
	 *
	 * **Details**
	 *
	 * Corepack form only (`<algo>.<hex>`), the same brand the pin's own
	 * `integrity` carries; convert a registry or lockfile SRI string with
	 * `CorepackIntegrityHash.fromSri` from `@effected/npm`. It verifies
	 * exactly what a pin integrity verifies — the registry tarball for npm,
	 * pnpm and yarn 1.x, the standalone `yarn.js` for yarn 2+, the platform zip
	 * for bun — and stands in for the pin's in every rule: it silences the
	 * "carries no integrity hash" warning, satisfies `requireIntegrity`, and a
	 * tool-cache hit is answered without re-verifying, exactly as it is for an
	 * integrity-carrying pin.
	 *
	 * Fail-closed, before any cache lookup or download: a value not in corepack
	 * form (an SRI or yarn hash) fails with `integrityMismatch` on its
	 * could-not-verify arm (no `expected`, no `actual`, `subject` naming the
	 * option); and when the pin also carries an integrity and the two differ,
	 * the install fails with `integrityMismatch` (`expected` is this option,
	 * `subject` names the pin's value) — neither is chosen silently. Equal
	 * values verify once. It governs the wrapper only; pnpm 12's native
	 * binary is `nativeIntegrity`'s business.
	 *
	 * @since 0.0.0
	 */
	readonly integrity?: IntegrityHashBrand | undefined;
	/**
	 * The npm registry host the npm, pnpm and yarn tarballs download from.
	 * Defaults to `https://registry.npmjs.org`. A corporate mirror qualifies
	 * when it serves the standard `/<name>/-/<basename>-<version>.tgz` tarball
	 * route and — for pnpm 12 and later, whose native binary is a second
	 * artifact verified against the registry's own integrity — the
	 * `/<name>/<version>` packument route as JSON carrying `dist.integrity`.
	 * A tarball-only proxy fails a pnpm 12 pin with `downloadFailed` naming
	 * that packument url — unless `nativeIntegrity` vouches for the host's
	 * native package, which skips the packument. bun does not ship through a
	 * registry — its per-platform zip always comes from GitHub releases.
	 *
	 * @since 0.0.0
	 */
	readonly registry?: string | undefined;
	/**
	 * The expected Subresource Integrity of each pnpm native-binary package,
	 * keyed by bare package name with no version (`"@pnpm/exe.linux-x64"`) —
	 * usually read straight from the lockfile, which records every platform's
	 * entry.
	 *
	 * **Details**
	 *
	 * Consulted only for a pin whose wrapper overlays a native binary (pnpm 12
	 * and later); every other pin ignores it. When supplied, the installer
	 * verifies the host's `@pnpm/exe.<target>` tarball against this map's entry
	 * (its strongest listed algorithm) INSTEAD of the registry's packument, so
	 * the packument route is never requested and a tarball-only mirror
	 * suffices. Fail-closed throughout: a map with no entry for the host's
	 * package fails with `integrityMissing` naming that package, an entry
	 * carrying no parseable SRI fails with `integrityMismatch` (the
	 * could-not-verify arm), and a tarball that hashes to anything else fails
	 * with `integrityMismatch` naming the tarball url. Absent, the registry's
	 * own `dist.integrity` is the authority. A tool-cache hit is
	 * answered without re-verifying, exactly as the pin's own integrity is.
	 *
	 * @since 0.0.0
	 */
	readonly nativeIntegrity?: Readonly<Record<string, string>> | undefined;
	/**
	 * Whether an npm pin may be answered by the runner's own ambient npm.
	 * Defaults to `true`.
	 *
	 * **Gotchas**
	 *
	 * Set `false` when the run REPLACES node: a consumer that installs a pinned
	 * node in the same run puts that node's bundled npm ahead of the runner's on
	 * every path that matters afterward (the install child's `PATH`, and every
	 * later workflow step via `GITHUB_PATH`). The ambient probe interrogates the
	 * RUNNER's npm, so its exact-version match can diverge from the npm that
	 * actually executes once the pinned node shadows it. Suppressing the probe
	 * skips it entirely — no `npm --version` is ever spawned — and the install
	 * goes straight to the tool-cache/dist path, answering
	 * `source: "tool-cache"` with its own `binDir` as usual.
	 *
	 * @since 0.0.0
	 */
	readonly allowAmbient?: boolean | undefined;
}

/**
 * A package manager the runner's own toolchain already had: nothing was
 * downloaded and nothing was cached, so there is no directory to publish.
 *
 * **Details**
 *
 * `bins` values are bare command names (`npm`, `npx`) resolved through the
 * ambient `PATH` — the toolchain already put them there.
 *
 * **Example** (Construct an ambient npm record)
 *
 * ```ts
 * import { AmbientPackageManager } from "@beep/scratchpad/effected/github-actions/PackageManagerInstaller";
 *
 * const manager = AmbientPackageManager.make({
 *   name: "npm", version: "11.0.0", bins: { npm: "npm", npx: "npx" },
 * });
 * console.log(manager.bins.npm) // npm
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class AmbientPackageManager extends S.Class<AmbientPackageManager>($I`AmbientPackageManager`)({
	/** The discriminant: the runner's own toolchain answered. */
	source: S.tag("ambient").annotateKey({ description: "The discriminant: the runner's own toolchain answered." }),
	/** The package-manager name (`npm`, `pnpm`, `yarn` or `bun`). */
	name: PackageManagerPinName.annotateKey({ description: "The package-manager name (`npm`, `pnpm`, `yarn` or `bun`)." }),
	/** The exact installed version, in string form. */
	version: S.String.annotateKey({ description: "The exact installed version, in string form." }),
	/** Bin name → the ambient command name that invokes it. */
	bins: S.Record(S.String, S.String).annotateKey({ description: "Bin name → the ambient command name that invokes it." }),
}, $I.annote("AmbientPackageManager", { description: "A package manager the runner's own toolchain already had: nothing was downloaded and nothing was cached, so there is no directory to publish." })) {}

/**
 * A package manager living in the runner's tool cache — found there, or
 * installed into it by this call.
 *
 * **Details**
 *
 * `binDir` is the directory a consumer hands to `ActionOutputs.addPath` to
 * make the manager invokable by name in subsequent workflow steps. For the
 * npm-registry managers it is the entry's `.bin` directory of executable
 * shims this installer writes (`#!/bin/sh` exec wrappers, or `.cmd` wrappers
 * on Windows); for bun it is the entry directory itself, because the cached
 * `bun` binary is directly executable and a shim would add nothing but a
 * fork. `bins` still maps each published bin name to the underlying entry —
 * a Node script to run with `node` for npm, yarn and pnpm 11 and earlier; an
 * executable to run directly for bun and for pnpm 12+, whose `pnpm` is the
 * host's native binary (overlaid onto the cached wrapper the way pnpm's own
 * install script does) and whose `pn`/`pnpx`/`pnx` are shell aliases of it.
 * Each shim already applies that distinction. Calling `addPath` remains
 * deliberately the consumer's move, and note that `addPath` targets
 * *subsequent* steps: a same-process probe must use the absolute paths in
 * `bins` or `binDir`.
 *
 * **Example** (Locate cached executable shims)
 *
 * ```ts
 * import { CachedPackageManager } from "@beep/scratchpad/effected/github-actions/PackageManagerInstaller";
 *
 * const manager = CachedPackageManager.make({
 *   name: "pnpm", version: "10.13.1", directory: "/tools/pnpm/10.13.1/x64",
 *   binDir: "/tools/pnpm/10.13.1/x64/.bin",
 *   bins: { pnpm: "/tools/pnpm/10.13.1/x64/bin/pnpm.cjs" },
 * });
 * console.log(manager.binDir) // /tools/pnpm/10.13.1/x64/.bin
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class CachedPackageManager extends S.Class<CachedPackageManager>($I`CachedPackageManager`)({
	/** The discriminant: the manager lives in the tool cache. */
	source: S.tag("tool-cache").annotateKey({ description: "The discriminant: the manager lives in the tool cache." }),
	/** The package-manager name (`npm`, `pnpm`, `yarn` or `bun`). */
	name: PackageManagerPinName.annotateKey({ description: "The package-manager name (`npm`, `pnpm`, `yarn` or `bun`)." }),
	/** The exact installed version, in string form. */
	version: S.String.annotateKey({ description: "The exact installed version, in string form." }),
	/** The cached entry: `<tool-cache>/<name>/<version>/<arch>`. */
	directory: S.String.annotateKey({ description: "The cached entry: `<tool-cache>/<name>/<version>/<arch>`." }),
	/** The directory to `addPath` — executable shims, or bun's own directory. */
	binDir: S.String.annotateKey({ description: "The directory to `addPath` — executable shims, or bun's own directory." }),
	/** Bin name → the absolute path of the underlying entry point. */
	bins: S.Record(S.String, S.String).annotateKey({ description: "Bin name → the absolute path of the underlying entry point." }),
}, $I.annote("CachedPackageManager", { description: "A package manager living in the runner's tool cache — found there, or installed into it by this call." })) {}

/**
 * An installed package manager, discriminated by `source`: `ambient` carries
 * no directory, `tool-cache` carries the cached `directory` and the
 * `addPath`-able `binDir`. The union is a `Schema`, so the record round-trips
 * through `ActionState` for a later phase to read back.
 *
 * **Gotchas**
 *
 * **Construct the variant classes, never the union.** The union's inherited
 * `make` typechecks against *both* variants at once, so a wrong field yields
 * a confusing two-branch error instead of "this variant wants X" — reach for
 * {@link AmbientPackageManager}`.make` / {@link CachedPackageManager}`.make`,
 * whose `Schema.tag` fills `source` for you. The same tag is why an
 * overrides-style test helper should be typed
 * `Partial<Omit<typeof CachedPackageManager.Type, "source">>` — a plain
 * `Partial` offers `source`, which `make` auto-fills and rejects as input.
 *
 * **Example** (Validate an ambient variant)
 *
 * ```ts
 * import { AmbientPackageManager, InstalledPackageManager } from "@beep/scratchpad/effected/github-actions/PackageManagerInstaller";
 * import * as S from "effect/Schema";
 *
 * const manager = AmbientPackageManager.make({
 *   name: "npm", version: "11.0.0", bins: { npm: "npm", npx: "npx" },
 * });
 * console.log(S.is(InstalledPackageManager)(manager)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const InstalledPackageManager = S.Union([AmbientPackageManager, CachedPackageManager]).pipe($I.annoteSchema("InstalledPackageManager", { description: "An installed package manager, discriminated by `source`: `ambient` carries no directory, `tool-cache` carries the cached `directory` and the `addPath`-able `binDir`. The union is a `Schema`, so the record round-trips through `ActionState` for a later phase to read back." }));

/**
 * The decoded type of {@link (InstalledPackageManager:variable)}:
 * {@link AmbientPackageManager} `|` {@link CachedPackageManager}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type InstalledPackageManager = typeof InstalledPackageManager.Type;

/**
 * The members of the {@link PackageManagerInstaller} service: `install` the
 * exact package-manager version a pin names.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface PackageManagerInstallerShape {
	/**
	 * Provision the exact package-manager version a pin names, answering with
	 * where it landed and how to invoke it.
	 *
	 * @since 0.0.0
	 */
	readonly install: (
		pin: PackageManagerPin,
		options?: PackageManagerInstallOptions,
	) => Effect.Effect<InstalledPackageManager, PackageManagerInstallerError>;
}

/** Where the npm-registry managers' artifacts come from, resolved once by `install`. */
interface RegistrySource {
	/**
	 * The registry host, trailing slashes stripped.
	 *
	 * @since 0.0.0
	 */
	readonly registry: string;
	/**
	 * The caller's native-binary integrity map, when one was supplied.
	 *
	 * @since 0.0.0
	 */
	readonly nativeIntegrity: Readonly<Record<string, string>> | undefined;
}

/** What a package directory's own manifest declares, normalized. */
interface PackageManifest {
	readonly bins: Record<string, string>;
	readonly nativePackages: Record<string, string>;
}

/** An expected digest, split into its algorithm and hex. */
interface ExpectedDigest {
	readonly algorithm: string;
	readonly hex: string;
}

/** The shim directory name inside a cached npm-registry-manager entry. */
const SHIM_DIR = ".bin";

/**
 * The POSIX shim body: an `exec` wrapper so the shim's process *becomes* the
 * target, and `"$@"` so arguments survive quoting intact. A Node script
 * (`.js`/`.mjs`/`.cjs`) runs under `node`; anything else — pnpm 12's native
 * binary, its `#!/bin/sh` alias scripts — is exec'd directly, because handing
 * a shell script or a Mach-O to node is exactly the "Invalid or unexpected
 * token" failure this rule exists to prevent.
 */
const posixShim = (target: string): string =>
	isNodeScript(target) ? `#!/bin/sh\nexec node "${target}" "$@"\n` : `#!/bin/sh\nexec "${target}" "$@"\n`;

/** The Windows shim body, CRLF-terminated as cmd expects; same node-vs-direct rule. */
const cmdShim = (target: string): string =>
	isNodeScript(target) ? `@echo off\r\nnode "${target}" %*\r\n` : `@echo off\r\n"${target}" %*\r\n`;

/** The bin names pnpm's wrapper publishes, every one of which becomes the native binary on Windows. */
const PNPM_NATIVE_BIN_NAMES: ReadonlyArray<string> = ["pnpm", "pn", "pnpx", "pnx"];

/**
 * The bun release asset name for a runner platform, or `None` when bun
 * publishes no build for it.
 *
 * **Details**
 *
 * Asset names verified against the `bun-v1.3.14` release: `bun-{linux,darwin,
 * windows}-{x64,aarch64}.zip`, with the runner's `RUNNER_OS` values mapped to
 * bun's spelling (`macOS` → `darwin`) and the Node arch spelling to bun's
 * (`arm64` → `aarch64`).
 */
const BUN_OS: Readonly<Record<string, string>> = { linux: "linux", macos: "darwin", windows: "windows" };
const BUN_CPU: Readonly<Record<string, string>> = { x64: "x64", arm64: "aarch64" };
const bunTarget = (runnerOs: string, arch: string): O.Option<string> => {
	const os = BUN_OS[runnerOs.toLowerCase()];
	const cpu = BUN_CPU[arch];
	return os === undefined || cpu === undefined ? O.none() : O.some(`bun-${os}-${cpu}`);
};

/**
 * The registry tarball url for an npm-registry-distributed manager.
 *
 * **Details**
 *
 * The yarn split is corepack's own: `<2.0.0` is the `yarn` package, `>=2.0.0`
 * (Berry) ships as `@yarnpkg/cli-dist` — a scoped package, whose tarball
 * basename drops the scope (`/@yarnpkg/cli-dist/-/cli-dist-<v>.tgz`).
 */
const registryTarballUrl = (name: string, version: string, major: number, registry: string): string =>
	name === "yarn" && major >= 2
		? `${registry}/@yarnpkg/cli-dist/-/cli-dist-${version}.tgz`
		: `${registry}/${name}/-/${name}-${version}.tgz`;

/** Normalize a package.json `bin` value into name → relative path entries. */
const normalizeBins = (bin: unknown, fallbackName: string): O.Option<Record<string, string>> => {
	if (P.isString(bin)) {
		return O.some({ [fallbackName]: bin.replace(/^\.\//, "") });
	}
	if (!P.isObjectOrArray(bin)) {
		return O.none();
	}
	const entries: Record<string, string> = {};
	const properties: ReadonlyArray<[string, unknown]> = R.toEntries<never, unknown>(bin);
	for (const [name, value] of properties) {
		if (!P.isString(value)) {
			return O.none();
		}
		entries[name] = value.replace(/^\.\//, "");
	}
	return R.keys(entries).length === 0 ? O.none() : O.some(entries);
};

/** Map a `RUNNER_ARCH` value (`X64`, `ARM64`) onto the Node arch spelling. */
const archFromRunner = (runnerArch: string): string => {
	const lowered = runnerArch.toLowerCase();
	return lowered === "x64" || lowered === "arm64" ? lowered : runnerArch;
};

const make = Effect.gen(function* () {
	const env = yield* ActionEnvironment;
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const installer = yield* ToolInstaller;

	// Resolved once, at construction — the platform comes from `RUNNER_OS` and
	// `RUNNER_ARCH`, the runner's own answers, per the ToolInstaller precedent.
	// `arch` selects the native binary target (pnpm exe, bun); the CACHE path's
	// arch segment is ToolInstaller's business, asked via `installer.cachePath`.
	// Off a runner `RUNNER_ARCH` is absent and the host's `process.arch` is the
	// honest fallback; that read exists only for the fallback, everything else
	// routes through ActionEnvironment.
	const runnerOs = yield* Effect.map(env.getOptional("RUNNER_OS"), (found) => O.getOrElse(found, () => ""));
	const arch = yield* Effect.map(env.getOptional("RUNNER_ARCH"), (found) =>
		O.match(found, { onNone: (): string => process.arch, onSome: archFromRunner }),
	);
	const windows = yield* isWindowsRunner(env);
	// The host libc, read once here beside the platform: it decides between
	// pnpm's glibc and musl native binaries on linux and nothing else.
	const musl = detectMusl();
	const bunBinaryName = windows ? "bun.exe" : "bun";
	const shimFileName = (name: string): string => (windows ? `${name}.cmd` : name);
	const shimBody = windows ? cmdShim : posixShim;

	const errorFor =
		(pin: PackageManagerPin) =>
		(fields: {
			readonly reason: PackageManagerInstallerError["reason"];
			readonly subject?: string;
			readonly expected?: string;
			readonly actual?: string;
			readonly cause?: unknown;
		}): PackageManagerInstallerError =>
			PackageManagerInstallerError.make({ name: pin.name, version: pin.version.toString(), ...fields });

	/** Map a ToolInstaller failure onto this surface; the reasons line up 1:1. */
	const fromInstaller =
		(pin: PackageManagerPin) =>
		(cause: ToolInstallerError): PackageManagerInstallerError =>
			errorFor(pin)({
				reason: cause.reason,
				...O.getSomesStruct({ subject: O.fromUndefinedOr(cause.subject) }),
				cause,
			});

	/** The hex digest of a file's bytes, streamed rather than buffered. */
	const hashFile = (
		pin: PackageManagerPin,
		file: string,
		algorithm: string,
	): Effect.Effect<string, PackageManagerInstallerError> =>
		// The pin grammar admits sha1/sha256/sha384/sha512 only, all of which
		// `node:crypto` supports.
		digestFileHex(fs, file, algorithm).pipe(
			Effect.mapError((cause) => errorFor(pin)({ reason: "integrityMismatch", subject: file, cause })),
		);

	/**
	 * Verify a downloaded artifact against the settled pin's integrity,
	 * fail-closed.
	 *
	 * **Details**
	 *
	 * An integrity-less pin proceeds with a logged warning — in-the-wild
	 * `devEngines` pins routinely carry none, and the opt-in strictness lives in
	 * `requireIntegrity`, checked before anything is downloaded.
	 */
	const verifyIntegrity = Effect.fnUntraced(function* (pin: PackageManagerPin, file: string): Effect.fn.Return<void, PackageManagerInstallerError> {
		const integrity = pin.integrity;
		if (integrity === undefined) {
			yield* Effect.logWarning(
				`The pin ${pin.toString()} carries no integrity hash and none was supplied; the downloaded artifact was not verified.`,
			);
			return;
		}
		const dot = integrity.indexOf(".");
		const algorithm = integrity.slice(0, dot);
		const expectedHex = integrity.slice(dot + 1);
		const actualHex = yield* hashFile(pin, file, algorithm);
		if (actualHex !== expectedHex) {
			return yield* errorFor(pin)({
					reason: "integrityMismatch",
					subject: file,
					expected: integrity,
					actual: `${algorithm}.${actualHex}`,
				});
		}
	});

	/**
	 * The ambient `npm --version`, or `None` when the probe cannot answer.
	 *
	 * **Details**
	 *
	 * A failed probe is not an error — there is nothing a caller could do about
	 * it that the dist path does not already do.
	 */
	const ambientNpmVersion: Effect.Effect<O.Option<string>> = Effect.map(
		Effect.result(spawner.string(ChildProcess.make("npm", ["--version"]))),
		(result) => (result._tag === "Success" ? O.some(result.success.trim()) : O.none()),
	);

	const assertFile = Effect.fnUntraced(function* (
		pin: PackageManagerPin,
		file: string,
		subject: string,
	): Effect.fn.Return<void, PackageManagerInstallerError> {
		if ((yield* typeAt(fs, file)) !== "File") {
			return yield* errorFor(pin)({ reason: "layoutUnexpected", subject });
		}
	});

	const validateShimDestinations = Effect.fnUntraced(function* (
		pin: PackageManagerPin,
		into: string,
		bins: Record<string, string>,
	): Effect.fn.Return<void, PackageManagerInstallerError> {
		const shimDir = path.resolve(into, SHIM_DIR);
		for (const name of R.keys(bins)) {
			const shim = path.resolve(shimDir, shimFileName(name));
			const containment = path.relative(shimDir, shim);
			if (!isBinName(name) || containment === "" || containment === ".." ||
				Str.startsWith(`..${path.sep}`)(containment) || path.isAbsolute(containment)) {
				return yield* errorFor(pin)({
					reason: "layoutUnexpected",
					subject: `bin ${name} does not name a shim inside ${SHIM_DIR}`,
				});
			}
		}
	});

	/**
	 * What a package directory's own manifest says about its entry points: the
	 * `bin` map, plus the `@pnpm/exe.*` optional dependencies that mark the
	 * pnpm 12 native-binary layout (empty for every other manager and version).
	 *
	 * **Details**
	 *
	 * Read from the artifact rather than hardcoded per manager, because the
	 * layouts genuinely move — corepack's own table has pnpm's entry at
	 * `bin/pnpm.cjs` through v10 and `bin/pnpm.mjs` from v11, and from v12 the
	 * `pnpm` bin is a placeholder for a native binary shipped as a separate
	 * package. Both maps are attacker-supplied bytes and are normalized to
	 * string → string before anything downstream reads them.
	 */
	const readPackageManifest = Effect.fnUntraced(function* (
		pin: PackageManagerPin,
		packageDir: string,
	): Effect.fn.Return<PackageManifest, PackageManagerInstallerError> {
		const manifestPath = path.join(packageDir, "package.json");
		const raw = yield* fs
			.readFileString(manifestPath)
			.pipe(
				Effect.mapError((cause) => errorFor(pin)({ reason: "layoutUnexpected", subject: "no package.json", cause })),
			);
		const manifest = yield* Effect.try({
			try: () => Result.getOrThrowWith(S.decodeResult(Json)(raw), (error) => error),
			catch: (cause) => errorFor(pin)({ reason: "layoutUnexpected", subject: "unparseable package.json", cause }),
		});
		const bins = O.getOrUndefined(normalizeBins(P.hasProperty(manifest, "bin") ? manifest.bin : undefined, pin.name));
		if (bins === undefined) {
			return yield* errorFor(pin)({ reason: "layoutUnexpected", subject: "package.json names no bin" });
		}
		yield* validateShimDestinations(pin, packageDir, bins);
		for (const [name, relative] of R.toEntries(bins)) {
			const target = path.join(packageDir, relative);
			// The manifest is attacker-supplied bytes: a bin of "../../payload.js"
			// resolves OUTSIDE the package directory, and everything downstream —
			// the existence check, the shim target, the published `bins` paths —
			// would then chmod and execute a file the tarball never legitimately
			// owned. Containment is checked on the resolved path, so `..` smuggled
			// through any spelling is caught.
			const containment = path.relative(packageDir, target);
			if (containment === ".." || containment.startsWith(`..${path.sep}`) || path.isAbsolute(containment)) {
				return yield* errorFor(pin)({
						reason: "layoutUnexpected",
						subject: `bin ${name} (${relative}) escapes the package directory`,
					});
			}
			yield* assertFile(pin, target, `bin ${name} (${relative}) is missing`);
		}
		return {
			bins,
			nativePackages: nativePackagesOf(P.hasProperty(manifest, "optionalDependencies") ? manifest.optionalDependencies : undefined),
		};
	});

	/**
	 * The `@pnpm/exe.<target>` → version entries of an `optionalDependencies`
	 * value, and nothing else: only well-formed string pairs under that prefix
	 * survive, so a hostile or malformed map cannot smuggle a package name
	 * into a registry url.
	 */
	const nativePackagesOf = (optionalDependencies: unknown): Record<string, string> => {
		if (!P.isObjectOrArray(optionalDependencies)) {
			return {};
		}
		const entries: Record<string, string> = {};
		const properties: ReadonlyArray<[string, unknown]> = R.toEntries<never, unknown>(optionalDependencies);
		for (const [name, version] of properties) {
			if (name.startsWith(PNPM_EXE_PREFIX) && P.isString(version)) {
				entries[name] = version;
			}
		}
		return entries;
	};

	/**
	 * pnpm's Windows overlay places the native binary as `<name>.exe` for every
	 * wrapper bin and repoints `bin` at those; this is that repoint, applied to
	 * the in-memory map (the shims and the record) rather than the manifest.
	 */
	const nativeWindowsBins = (bins: Record<string, string>): Record<string, string> =>
		R.fromEntries(
			R.toEntries(bins).map(([name, relative]): [string, string] =>
				[name, PNPM_NATIVE_BIN_NAMES.includes(name) ? `${relative}.exe` : relative],
			),
		);

	/**
	 * Whether a file is still pnpm's shebang-less placeholder (a `#`-led text
	 * file that is not a `#!` script) rather than the native binary meant to
	 * overlay it — the mark of an entry written without the overlay, by an
	 * older writer or a foreign one that ran no lifecycle scripts. Anything else (a shebang, an executable's magic, an unreadable
	 * or empty file) is left to the ordinary layout checks.
	 */
	const isPlaceholder = (file: string): Effect.Effect<boolean> =>
		Effect.scoped(Effect.flatMap(fs.open(file), (handle) => handle.readAlloc(2))).pipe(
			Effect.map((head) =>
				O.match(head, {
					onNone: () => false,
					onSome: (bytes) => bytes.length >= 1 && bytes[0] === 0x23 && bytes[1] !== 0x21,
				}),
			),
			Effect.orElseSucceed(() => false),
		);

	const rootBins = (bins: Record<string, string>, directory: string): Record<string, string> =>
		R.fromEntries(R.toEntries(bins).map(([name, relative]): [string, string] => [name, path.join(directory, relative)]));

	/**
  * Write one executable shim per bin into `<into>/.bin`, each invoking
  * `node <finalDirectory>/<relative>`.
  *
  * **Details**
  *
  * `into` and `finalDirectory` are DIFFERENT on the install path on purpose:
  * the shims are written into the *staged* tree so they are part of the entry
  * ToolInstaller renames into place (the cache only ever contains complete
  * entries), while their contents must name the *final* cache path the entry
  * is about to land at. On the cache-hit regeneration path the two coincide.
  * When `skipExisting` is set, a shim already present is left untouched — the
  * regeneration path must not rewrite a shared cache entry another writer owns.
  */
	const writeShims = Effect.fnUntraced(function* (
		pin: PackageManagerPin,
		into: string,
		finalDirectory: string,
		bins: Record<string, string>,
		options: { readonly skipExisting: boolean },
	): Effect.fn.Return<void, PackageManagerInstallerError> {
		const shimDir = path.join(into, SHIM_DIR);
		// Preflight the whole map before creating the directory or writing even
		// the first valid shim; a later hostile name must leave no partial shims.
		yield* validateShimDestinations(pin, into, bins);
		const cacheError = (subject: string) => (cause: unknown) =>
			errorFor(pin)({ reason: "cacheFailed", subject, cause });
		yield* fs.makeDirectory(shimDir, { recursive: true }).pipe(Effect.mapError(cacheError(shimDir)));
		for (const [name, relative] of R.toEntries(bins)) {
			const shim = path.join(shimDir, shimFileName(name));
			if (options.skipExisting) {
				if ((yield* typeAt(fs, shim)) === "File") {
					continue;
				}
			}
			yield* fs
				.writeFileString(shim, shimBody(path.join(finalDirectory, relative)))
				.pipe(Effect.mapError(cacheError(shim)));
			if (!windows) {
				yield* fs.chmod(shim, 0o755).pipe(Effect.mapError(cacheError(shim)));
			}
		}
	});

	/**
	 * The record for a directory already in the cache, regenerating absent
	 * shims — or `None` when the entry is a pnpm 12 wrapper whose `pnpm` bin is
	 * still the placeholder, which no shim can make runnable: the caller then
	 * reinstalls over it through the ordinary install path (ToolInstaller's
	 * swap removes the old entry and renames the complete new one into place).
	 */
	const cachedRecord = Effect.fnUntraced(function* (
		pin: PackageManagerPin,
		directory: string,
	): Effect.fn.Return<O.Option<InstalledPackageManager>, PackageManagerInstallerError> {
		if (pin.name === "bun") {
			const binary = path.join(directory, bunBinaryName);
			yield* assertFile(pin, binary, `cached bun binary (${bunBinaryName}) is missing`);
			return O.some(
				CachedPackageManager.make({
					name: pin.name,
					version: pin.version.toString(),
					directory,
					// The binary itself is executable; the entry directory IS the
					// addPath target and no shim is written for bun anywhere.
					binDir: directory,
					bins: { bun: binary },
				}),
			);
		}
		const manifest = yield* readPackageManifest(pin, directory);
		let bins = manifest.bins;
		if (R.keys(manifest.nativePackages).length > 0) {
			// A native-binary wrapper cached by an older writer (which shimmed the
			// placeholder as a Node script) or by a foreign writer that ran no
			// lifecycle scripts still holds the placeholder.
			// A stale `exec node` shim beside it would survive `skipExisting`,
			// so the whole entry is reinstalled over rather than patched in
			// place — the install path rewrites every shim.
			const entry = bins[pin.name];
			if (entry !== undefined && (yield* isPlaceholder(path.join(directory, entry)))) {
				yield* Effect.logInfo(
					`The cached ${pin.name}@${pin.version.toString()} still holds pnpm's placeholder bin; reinstalling it over.`,
				);
				return O.none();
			}
			if (windows) {
				bins = nativeWindowsBins(bins);
			}
		}
		// The tool cache is shared: this entry may have been written by the
		// runner image, a setup-* action, or a previous version of this module,
		// none of which write shims. Regenerate what is missing — best-effort,
		// but a failure to write is a typed cacheFailed, not a silent hole in
		// the PATH contract.
		yield* writeShims(pin, directory, directory, bins, { skipExisting: true });
		return O.some(
			CachedPackageManager.make({
				name: pin.name,
				version: pin.version.toString(),
				directory,
				binDir: path.join(directory, SHIM_DIR),
				bins: rootBins(bins, directory),
			}),
		);
	});

	/**
	 * The strongest digest an SRI value lists — or, when it is not a string or
	 * lists no usable algorithm, the could-not-verify arm of
	 * `integrityMismatch` naming `subject`.
	 */
	const expectedFromSri = (
		pin: PackageManagerPin,
		sri: unknown,
		subject: string,
	): Effect.Effect<ExpectedDigest, PackageManagerInstallerError> =>
		Effect.fromOption(P.isString(sri) ? strongestSri(sri) : O.none(), () => errorFor(pin)({ reason: "integrityMismatch", subject }));

	/**
	 * The expected integrity of a native package as its registry packument
	 * declares it for the exact version — fail-closed: a packument that cannot
	 * be read, parsed, or that lists no usable SRI is the could-not-verify arm
	 * of `integrityMismatch`, naming the packument url.
	 */
	const registryIntegrity = Effect.fnUntraced(function* (
		pin: PackageManagerPin,
		packageName: string,
		version: string,
		registry: string,
	): Effect.fn.Return<ExpectedDigest, PackageManagerInstallerError> {
		const packumentUrl = `${registry}/${packageName}/${version}`;
		const packumentFile = yield* installer.download(packumentUrl).pipe(Effect.mapError(fromInstaller(pin)));
		const unverifiable = (cause: unknown) =>
			errorFor(pin)({ reason: "integrityMismatch", subject: packumentUrl, cause });
		const packument = yield* fs.readFileString(packumentFile).pipe(
			Effect.mapError(unverifiable),
			Effect.flatMap((raw) =>
				Effect.try({
					try: () => Result.getOrThrowWith(S.decodeResult(Json)(raw), (error) => error),
					catch: unverifiable,
				}),
			),
		);
		const dist = P.hasProperty(packument, "dist") ? packument.dist : undefined;
		return yield* expectedFromSri(pin, P.hasProperty(dist, "integrity") ? dist.integrity : undefined, packumentUrl);
	});

	/**
	 * The expected integrity of a native package as the caller's
	 * `nativeIntegrity` map records it — fail-closed: no entry for the host's
	 * package is `integrityMissing` (a lockfile records every platform, so a
	 * gap means the map is inconsistent), and an entry with no usable SRI is
	 * the could-not-verify arm of `integrityMismatch`, both naming the package.
	 */
	const suppliedIntegrity = (
		pin: PackageManagerPin,
		packageName: string,
		nativeIntegrity: Readonly<Record<string, string>>,
	): Effect.Effect<ExpectedDigest, PackageManagerInstallerError> => {
		// An own-property read: the map is caller data, and an inherited
		// member must never stand in for a recorded checksum.
		const supplied = R.has(nativeIntegrity, packageName) ? nativeIntegrity[packageName] : undefined;
		return P.isString(supplied)
			? expectedFromSri(pin, supplied, packageName)
			: Effect.fail(errorFor(pin)({ reason: "integrityMissing", subject: packageName }));
	};

	/**
	 * pnpm 12's native overlay, done here because the installer never runs the
	 * lifecycle script that does it upstream: pick the host's `@pnpm/exe.*`
	 * package from the wrapper's optional dependencies, fetch its tarball from
	 * the SAME registry the wrapper came from, verify it against the caller's
	 * `nativeIntegrity` entry when one was supplied or else the registry's own
	 * `dist.integrity` (fail-closed either way — this is a second artifact the
	 * pin never named, so there is no integrity-less posture to honor), and copy
	 * the executable over the placeholder in the STAGED wrapper, where `dist/`
	 * sits beside it as the binary expects. Answers the bins as they should be
	 * shimmed and recorded — retargeted to `.exe` on Windows, as upstream does.
	 */
	const overlayNativeBinary = Effect.fnUntraced(function* (
		pin: PackageManagerPin,
		packageDir: string,
		{ bins, nativePackages }: PackageManifest,
		{ registry, nativeIntegrity }: RegistrySource,
	): Effect.fn.Return<Record<string, string>, PackageManagerInstallerError> {
		const target = O.getOrUndefined(pnpmExeTarget(runnerOs, arch, musl));
		const packageName = target === undefined ? undefined : `${PNPM_EXE_PREFIX}${target}`;
		const nativeVersion = packageName === undefined ? undefined : nativePackages[packageName];
		if (target === undefined || packageName === undefined || nativeVersion === undefined) {
			return yield* errorFor(pin)({ reason: "unsupportedPlatform", subject: `${runnerOs || "unknown"}/${arch}` });
		}
		// The wrapper's own release pins its native package to the wrapper's
		// version, so anything else is a malformed manifest — and this string
		// is about to be spliced into two registry urls, so it is the pin's
		// version (already validated by the pin grammar) that goes there, never
		// the manifest's bytes.
		if (nativeVersion !== pin.version.toString()) {
			return yield* errorFor(pin)({
					reason: "layoutUnexpected",
					subject: `${packageName} is pinned at ${nativeVersion}, not the wrapper's ${pin.version.toString()}`,
				});
		}
		const placeholder = bins[pin.name];
		if (placeholder === undefined) {
			return yield* errorFor(pin)({ reason: "layoutUnexpected", subject: `package.json names no ${pin.name} bin to overlay` });
		}

		// The expected integrity, settled before the 36 MB tarball is fetched.
		// A caller-supplied map (the lockfile's record) is the authority when
		// present and the packument is never asked; otherwise the registry's
		// own packument vouches for the exact version. Either source that
		// cannot vouch for the bytes ends the install before they are fetched.
		const expected =
			nativeIntegrity === undefined
				? yield* registryIntegrity(pin, packageName, nativeVersion, registry)
				: yield* suppliedIntegrity(pin, packageName, nativeIntegrity);

		const tarballUrl = `${registry}/${packageName}/-/exe.${target}-${nativeVersion}.tgz`;
		const archive = yield* installer.download(tarballUrl).pipe(Effect.mapError(fromInstaller(pin)));
		const actualHex = yield* hashFile(pin, archive, expected.algorithm);
		if (actualHex !== expected.hex) {
			return yield* errorFor(pin)({
					reason: "integrityMismatch",
					subject: tarballUrl,
					expected: `${expected.algorithm}.${expected.hex}`,
					actual: `${expected.algorithm}.${actualHex}`,
				});
		}
		const extracted = yield* installer.extractTar(archive).pipe(Effect.mapError(fromInstaller(pin)));
		const nativeName = windows ? "pnpm.exe" : "pnpm";
		const native = path.join(extracted, "package", nativeName);
		yield* assertFile(pin, native, `package/${nativeName} is missing from the ${packageName} tarball`);

		const cacheError = (subject: string) => (cause: unknown) =>
			errorFor(pin)({ reason: "cacheFailed", subject, cause });
		if (windows) {
			// Mirrors the wrapper's own install script: the binary lands as
			// `<name>.exe` AND over the extensionless placeholder for each bin
			// (a pre-existing shim may still name the latter), and `bin` is
			// repointed at the `.exe` twins.
			for (const name of PNPM_NATIVE_BIN_NAMES) {
				const relative = bins[name];
				if (relative === undefined) {
					continue;
				}
				for (const destination of [path.join(packageDir, relative), path.join(packageDir, `${relative}.exe`)]) {
					yield* fs.copyFile(native, destination).pipe(Effect.mapError(cacheError(destination)));
				}
			}
			return nativeWindowsBins(bins);
		}
		const destination = path.join(packageDir, placeholder);
		yield* fs.copyFile(native, destination).pipe(Effect.mapError(cacheError(destination)));
		// The overlaid binary and the `#!/bin/sh` alias bins are exec'd
		// directly by their shims, so every non-Node bin needs the executable
		// bit — which tar extraction does not reliably carry (the bun rule).
		for (const relative of R.values(bins)) {
			if (!isNodeScript(relative)) {
				const file = path.join(packageDir, relative);
				yield* fs.chmod(file, 0o755).pipe(Effect.mapError(cacheError(file)));
			}
		}
		return bins;
	});

	/** Download bun's per-platform zip from GitHub releases and cache the binary. */
	const installBun = Effect.fnUntraced(function* (pin: PackageManagerPin): Effect.fn.Return<InstalledPackageManager, PackageManagerInstallerError> {
		const version = pin.version.toString();
		const target = O.getOrUndefined(bunTarget(runnerOs, arch));
		if (target === undefined) {
			return yield* errorFor(pin)({ reason: "unsupportedPlatform", subject: `${runnerOs || "unknown"}/${arch}` });
		}
		const url = `https://github.com/oven-sh/bun/releases/download/bun-v${version}/${target}.zip`;
		const archive = yield* installer.download(url).pipe(Effect.mapError(fromInstaller(pin)));
		// No corepack authority exists for bun (corepack does not manage it), so
		// an integrity-carrying bun pin verifies against the downloaded zip —
		// which makes such a pin inherently platform-specific.
		yield* verifyIntegrity(pin, archive);
		const extracted = yield* installer.extractZip(archive).pipe(Effect.mapError(fromInstaller(pin)));
		const binary = path.join(extracted, target, bunBinaryName);
		yield* assertFile(pin, binary, `${target}/${bunBinaryName} is missing from the zip`);
		if (!windows) {
			// The zip does not reliably carry the executable bit through every
			// extractor; the cached binary must be invokable as-is.
			yield* fs
				.chmod(binary, 0o755)
				.pipe(Effect.mapError((cause) => errorFor(pin)({ reason: "cacheFailed", subject: binary, cause })));
		}
		const directory = yield* installer
			.cacheFile(binary, bunBinaryName, pin.name, version)
			.pipe(Effect.mapError(fromInstaller(pin)));
		return CachedPackageManager.make({
			name: pin.name,
			version,
			directory,
			binDir: directory,
			bins: { bun: path.join(directory, bunBinaryName) },
		});
	});

	/** Download a registry tarball, verify, extract, shim, and cache the package dir. */
	const installFromRegistry = Effect.fnUntraced(function* (
		pin: PackageManagerPin,
		source: RegistrySource,
	): Effect.fn.Return<InstalledPackageManager, PackageManagerInstallerError> {
		const { name } = pin;
		const version = pin.version.toString();
		const url = registryTarballUrl(name, version, pin.version.major, source.registry);
		const archive = yield* installer.download(url).pipe(Effect.mapError(fromInstaller(pin)));
		// What a corepack pin's integrity hashes depends on the manager:
		// npm, pnpm and yarn 1.x pins hash the registry tarball's bytes; a
		// yarn>=2 pin hashes the standalone `yarn.js` corepack downloads from
		// repo.yarnpkg.com — byte-identical to `bin/yarn.js` inside the
		// @yarnpkg/cli-dist tarball, which is where it is verified below.
		const berry = name === "yarn" && pin.version.major >= 2;
		if (!berry) {
			yield* verifyIntegrity(pin, archive);
		}
		const extracted = yield* installer.extractTar(archive).pipe(Effect.mapError(fromInstaller(pin)));
		const packageDir = path.join(extracted, "package");
		if ((yield* typeAt(fs, packageDir)) !== "Directory") {
			return yield* errorFor(pin)({ reason: "layoutUnexpected", subject: "tarball has no package/ root" });
		}
		const manifest = yield* readPackageManifest(pin, packageDir);
		// pnpm 12's layout, detected by what the manifest declares rather than
		// by major: the `pnpm` bin is a placeholder for a native binary that
		// ships as an `@pnpm/exe.*` optional dependency and is overlaid here.
		const bins =
			R.keys(manifest.nativePackages).length > 0
				? yield* overlayNativeBinary(pin, packageDir, manifest, source)
				: manifest.bins;
		if (berry) {
			const cli = path.join(packageDir, "bin/yarn.js");
			yield* assertFile(pin, cli, "bin/yarn.js is missing from the cli-dist tarball");
			yield* verifyIntegrity(pin, cli);
		}
		// Shims are written into the STAGED tree, so they are part of what
		// ToolInstaller renames into place — never a post-swap mutation — and
		// their contents name the FINAL cache path, asked of the installer
		// itself so it is the very answer `cacheDir` lands at (no second
		// derivation of root or arch here, and nothing to guard against). The
		// ordering is load-bearing twice over: `cacheDir` CONSUMES `packageDir`,
		// so nothing may be written to or read from it after that call.
		const destination = installer.cachePath(name, version);
		yield* writeShims(pin, packageDir, destination, bins, { skipExisting: false });
		const directory = yield* installer.cacheDir(packageDir, name, version).pipe(Effect.mapError(fromInstaller(pin)));
		return CachedPackageManager.make({
			name,
			version,
			directory,
			binDir: path.join(directory, SHIM_DIR),
			bins: rootBins(bins, directory),
		});
	});

	/**
	 * Fold the `integrity` option into the pin, answering the one pin every
	 * later step reads. The option's FORM is checked here, once — the type
	 * admits every `IntegrityHash` form, but only a corepack `<algo>.<hex>` can
	 * be compared with a pin's tail or split into an algorithm and a digest —
	 * and a pin integrity that disagrees with the option is refused rather than
	 * resolved by preferring either.
	 *
	 * **Details**
	 *
	 * A malformed option is `integrityMismatch` on its could-not-verify arm (no
	 * `expected`, no `actual`): the caller DID supply an integrity, so
	 * `integrityMissing` would misreport it, and a value that cannot be
	 * compared is exactly what that arm means.
	 */
	const settlePin = Effect.fnUntraced(function* (
		pin: PackageManagerPin,
		integrity: IntegrityHashBrand | undefined,
	): Effect.fn.Return<PackageManagerPin, PackageManagerInstallerError> {
		if (integrity === undefined) {
			return pin;
		}
		const option = yield* S.decodeEffect(CorepackIntegrityHash)(integrity).pipe(
			Effect.mapError((cause) =>
				errorFor(pin)({
					reason: "integrityMismatch",
					subject: `the integrity option ${integrity} is not a corepack <algo>.<hex> hash`,
					cause,
				}),
			),
		);
		if (pin.integrity !== undefined && pin.integrity !== option) {
			return yield* errorFor(pin)({
					reason: "integrityMismatch",
					subject: `the pin declares ${pin.integrity}, which disagrees with the integrity option`,
					expected: option,
				});
		}
		return PackageManagerPin.make({ name: pin.name, version: pin.version, integrity: option });
	});

	const install = Effect.fn("PackageManagerInstaller.install")(function* (
		pin: PackageManagerPin,
		options?: PackageManagerInstallOptions,
	) {
		const version = pin.version.toString();
		yield* Effect.annotateCurrentSpan({ name: pin.name, version });

		// Settle ONE effective pin: the `integrity` option folded into the pin
		// (see PackageManagerInstallOptions.integrity for the rules). Everything
		// downstream reads only `effective`.
		const effective = yield* settlePin(pin, options?.integrity);

		// The strictness is a statement about the INPUTS, so it is decided
		// before any path — a cache hit does not launder an integrity-less
		// install, and an option-supplied integrity counts exactly as a pin's.
		if (options?.requireIntegrity === true && effective.integrity === undefined) {
			return yield* errorFor(pin)({ reason: "integrityMissing" });
		}

		const cached = yield* installer.find(effective.name, version);
		if (O.isSome(cached)) {
			const record = yield* cachedRecord(effective, cached.value);
			if (O.isSome(record)) {
				return record.value;
			}
			// A hit that cannot be answered as-is (a pnpm 12 wrapper still holding
			// its placeholder) falls through and is reinstalled over.
		}

		// Every Node toolchain ships npm; when the ambient one is already the
		// pinned version there is nothing to download. A failed probe falls
		// through to the dist path rather than failing. `allowAmbient: false`
		// suppresses the probe entirely — the run is replacing node, so the
		// runner's npm is about to be shadowed and its answer is not the npm
		// that will execute (see PackageManagerInstallOptions.allowAmbient).
		if (effective.name === "npm" && options?.allowAmbient !== false) {
			const probed = yield* ambientNpmVersion;
			if (O.isSome(probed) && probed.value === version) {
				return AmbientPackageManager.make({
					name: effective.name,
					version,
					bins: { npm: "npm", npx: "npx" },
				});
			}
		}

		if (effective.name === "bun") {
			return yield* installBun(effective);
		}
		return yield* installFromRegistry(effective, {
			registry: (options?.registry ?? DEFAULT_REGISTRY).replace(/\/+$/, ""),
			nativeIntegrity: options?.nativeIntegrity,
		});
	});

	return { install } satisfies PackageManagerInstallerShape;
});

const dies = unstubbed("PackageManagerInstaller.makeTest");

/**
 * First-class exact-version package-manager provisioning on a GitHub runner.
 *
 * **Details**
 *
 * Takes a corepack pin (`@effected/npm`'s `PackageManagerPin`) and answers
 * with an installed manager: tool-cache `find` first, then — for npm — an
 * ambient `npm --version` probe (every Node toolchain ships npm), and only
 * then the manager's own dist: npm, pnpm and yarn 1.x from their registry
 * tarballs, yarn 2+ (Berry) from `@yarnpkg/cli-dist`, bun from its
 * per-platform GitHub-release zip. An install with an expected integrity —
 * the pin's `+<integrity>` tail or the `integrity` option — is verified
 * fail-closed against what corepack itself hashes; one without proceeds with
 * a logged warning unless `requireIntegrity` says otherwise.
 *
 * Every tool-cache answer carries a `binDir` a consumer can hand straight to
 * `ActionOutputs.addPath`: the npm-registry managers get a `.bin` directory
 * of executable shims written as part of the cached entry, bun's entry is its
 * own `binDir`. Caching goes through {@link ToolInstaller}, so the
 * stage-then-swap invariant holds here for free — shims included, the tool
 * cache only ever contains complete package managers.
 *
 * The pin is the whole contract: the installer provisions exactly the named
 * version and does not read the artifact's `engines.node` against the
 * runner's node. A pin whose engines the runner does not satisfy (npm 12 on
 * a node below `^22.22.2 || ^24.15.0 || >=26.0.0`) still installs and still
 * runs — npm itself warns (`npm warn cli npm v12.0.2 does not support ...`)
 * on every invocation and carries on (`lib/cli/entry.js`), so the
 * mismatch is visible in the job log but is not a typed failure here.
 * Keeping node and the manager pins coherent is the consumer's call, made
 * where it pins node.
 *
 * **Example** (Install pinned pnpm and publish its bin directory)
 *
 * ```ts
 * import { PackageManagerInstaller } from "@beep/scratchpad/effected/github-actions/PackageManagerInstaller";
 * import { ActionOutputs } from "@beep/scratchpad/effected/github-actions/ActionOutputs";
 * import { PackageManagerPin } from "@beep/scratchpad/effected/npm/PackageManagerPin";
 * import * as Effect from "effect/Effect";
 *
 * const provision = Effect.gen(function* () {
 *   const installer = yield* PackageManagerInstaller;
 *   const outputs = yield* ActionOutputs;
 *   const pin = yield* PackageManagerPin.parse("pnpm@10.13.1");
 *   const installed = yield* installer.install(pin);
 *   if (installed.source === "tool-cache") {
 *     yield* outputs.addPath(installed.binDir);
 *   }
 * });
 * console.log(Effect.isEffect(provision)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class PackageManagerInstaller extends Context.Service<PackageManagerInstaller, PackageManagerInstallerShape>()(
	$I`PackageManagerInstaller`,
) {
	/**
	 * The live installer, caching through {@link ToolInstaller}.
	 *
	 * **Details**
	 *
	 * Fails with {@link PackageManagerInstallerError}; requires the runner's
	 * environment, a filesystem, `Path`, a child-process spawner and a
	 * `ToolInstaller`.
	 *
	 * **Example** (Construct the live installer layer)
	 *
	 * ```ts
	 * import { PackageManagerInstaller } from "@beep/scratchpad/effected/github-actions/PackageManagerInstaller";
	 * import * as Layer from "effect/Layer";
	 *
	 * console.log(Layer.isLayer(PackageManagerInstaller.layer)) // true
	 * ```
	 *
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly layer: Layer.Layer<
		PackageManagerInstaller,
		never,
		ActionEnvironment | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner | ToolInstaller
	> = Layer.effect(this, make);

	/**
	 * A test double. The unstubbed member dies rather than reporting an install that did not happen.
	 *
	 * **Example** (Override installation in a double)
	 *
	 * ```ts
	 * import { AmbientPackageManager, PackageManagerInstaller } from "@beep/scratchpad/effected/github-actions/PackageManagerInstaller";
	 * import * as Effect from "effect/Effect";
	 *
	 * const manager = AmbientPackageManager.make({
	 *   name: "npm", version: "11.0.0", bins: { npm: "npm", npx: "npx" },
	 * });
	 * const installer = PackageManagerInstaller.makeTest({
	 *   install: () => Effect.succeed(manager),
	 * });
	 * console.log(typeof installer.install) // function
	 * ```
	 *
	 * @category constructors
	 * @since 0.0.0
	 */
	static readonly makeTest = (overrides: Partial<PackageManagerInstallerShape> = {}): PackageManagerInstallerShape => ({
		install: () => dies("install"),
		...overrides,
	});

	/**
	 * {@link PackageManagerInstaller.makeTest} behind `Layer.succeed`.
	 *
	 * **Example** (Construct the test installer layer)
	 *
	 * ```ts
	 * import { PackageManagerInstaller } from "@beep/scratchpad/effected/github-actions/PackageManagerInstaller";
	 * import * as Layer from "effect/Layer";
	 *
	 * console.log(Layer.isLayer(PackageManagerInstaller.layerTest())) // true
	 * ```
	 *
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly layerTest = (
		overrides: Partial<PackageManagerInstallerShape> = {},
	): Layer.Layer<PackageManagerInstaller> =>
		Layer.succeed(PackageManagerInstaller, PackageManagerInstaller.makeTest(overrides));
}
