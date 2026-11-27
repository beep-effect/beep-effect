/**
 * Provisions exact package-manager versions through the runner's tool cache.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $GithubActionsId } from "@beep/identity/packages";
import { CorepackIntegrityHash, IntegrityHash } from "@beep/npm-spec/IntegrityHash";
import { PackageManagerPin, PackageManagerPinName } from "@beep/npm-spec/PackageManagerPin";
import { DEFAULT_REGISTRY } from "@beep/npm-spec/RegistryKind";
import { HostProcessArchitecture, HostProcessPlatform } from "@beep/utils/HostProcess";
import * as O from "@beep/utils/Option";
import { unstubbed } from "@beep/utils/TestDouble";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ActionEnvironment } from "./ActionEnvironment.ts";
import { digestFileHex } from "./internal/digest.ts";
import { escapesRoot, realDestination, typeAt } from "./internal/fsProbe.ts";
import { detailText, framed } from "./internal/messageText.ts";
import { detectMusl, isNodeScript, PNPM_EXE_PREFIX, pnpmExeTarget, strongestSri } from "./internal/pnpmExe.ts";
import { isWindowsRunner } from "./internal/runner.ts";
import { ToolInstaller } from "./ToolInstaller.ts";
import type { IntegrityHashBrand } from "@beep/npm-spec/IntegrityHash";
import type { ToolInstallerError } from "./ToolInstaller.ts";

const $I = $GithubActionsId.create("PackageManagerInstaller");

const Json = S.fromJsonString(S.Unknown);

const BinName = S.String.check(
  S.isPattern(
    /^(?!\.{1,2}$)[^/\\:\x00]+$/,
    $I.annote("BinNamePattern", {
      message: "Package manager bin name",
      description: "A nonempty filename component without path separators, drive prefixes or NUL bytes.",
    })
  )
).pipe($I.annoteSchema("BinName", { description: "A package manager command name confined to one shim filename." }));
const isBinName = S.is(BinName);

const WindowsDeviceName = S.String.check(
  S.isPattern(
    /^(?:CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/i,
    $I.annote("WindowsDeviceNamePattern", {
      message: "Windows reserved device name",
      description: "A reserved Win32 device stem, including names with extensions.",
    })
  )
).pipe($I.annoteSchema("WindowsDeviceName", { description: "A command name that Windows resolves as a device." }));
const isWindowsDeviceName = S.is(WindowsDeviceName);

const WindowsShimTarget = S.String.check(
  S.isPattern(
    /^[^"%!\x00-\x1f\x7f]+$/,
    $I.annote("WindowsShimTargetPattern", {
      message: "Literal Windows shim target",
      description:
        "A complete target without quotes, cmd expansion markers or control bytes; path separators are allowed.",
    })
  )
).pipe($I.annoteSchema("WindowsShimTarget", { description: "A complete path safe inside a quoted cmd argument." }));
const isWindowsShimTarget = S.is(WindowsShimTarget);

/**
 * **Example** (Inspect an integrity requirement failure)
 *
 * ```ts
 * import { PackageManagerInstallerError } from "@beep/github-actions/PackageManagerInstaller";
 *
 * const error = PackageManagerInstallerError.make({
 *   reason: "integrityMissing", manager: "pnpm", version: "10.13.1",
 * });
 * console.log(error.reason) // integrityMissing
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class PackageManagerInstallerError extends S.TaggedError<
  PackageManagerInstallerError,
  { readonly brand: unique symbol }
>($I`PackageManagerInstallerError`)(
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
    ]).pipe(
      $I.annoteKey("PackageManagerInstallerError.reason", {
        description:
          "`downloadFailed`, `extractFailed` and `cacheFailed` mirror the ToolInstallerError that caused them, preserved on `cause` (`cacheFailed` also covers a shim that could not be written into the entry). `integrityMismatch` — the downloaded artifact does not hash to what the pin or the `integrity` option (or, for pnpm 12's native binary, the registry or the caller's `nativeIntegrity`) declares; nothing was cached. Also raised before anything runs when the `integrity` option is malformed or disagrees with the pin (see PackageManagerInstallOptions.integrity). `integrityMissing` — neither the pin nor the `integrity` option carries integrity and the caller asked for `requireIntegrity`, or — with `subject` naming the package — the caller supplied `nativeIntegrity` without an entry for the host's `@pnpm/exe.*` package. `unsupportedPlatform` — no build exists for this runner's OS/architecture pair: bun publishes none, or pnpm 12 ships no `@pnpm/exe.*` native binary for it. `layoutUnexpected` — the artifact extracted, but its contents are not shaped like the package manager it claims to be.",
      })
    ),
    /** The package manager being installed. */
    manager: PackageManagerPinName.pipe(
      $I.annoteKey("PackageManagerInstallerError.manager", { description: "The package manager being installed." })
    ),
    /** The exact version being installed, in string form. */
    version: S.String.pipe(
      $I.annoteKey("PackageManagerInstallerError.version", {
        description: "The exact version being installed, in string form.",
      })
    ),
    /** What was being worked on — a url, a path, or an OS/arch pair. */
    subject: S.optionalKey(S.String).pipe(
      $I.annoteKey("PackageManagerInstallerError.subject", {
        description: "What was being worked on — a url, a path, or an OS/arch pair.",
      })
    ),
    /** The integrity the pin declares (`<algo>.<hex>`), on a mismatch. */
    expected: S.optionalKey(S.String).pipe(
      $I.annoteKey("PackageManagerInstallerError.expected", {
        description: "The integrity the pin declares (`<algo>.<hex>`), on a mismatch.",
      })
    ),
    /** The integrity the artifact actually hashed to, on a mismatch. */
    actual: S.optionalKey(S.String).pipe(
      $I.annoteKey("PackageManagerInstallerError.actual", {
        description: "The integrity the artifact actually hashed to, on a mismatch.",
      })
    ),
    /** The underlying failure, preserved structurally. */
    cause: S.optionalKey(S.Defect()).pipe(
      $I.annoteKey("PackageManagerInstallerError.cause", {
        description: "The underlying failure, preserved structurally.",
      })
    ),
  },
  $I.annoteError<PackageManagerInstallerError>("PackageManagerInstallerError", {
    description: "Raised when a package manager cannot be provisioned on the runner.",
  })
) {
  /**
   * Explains the provisioning failure using the manager pin and available diagnostic fields.
   *
   * **Example** (Read a download failure explanation)
   *
   * ```ts
   * import { PackageManagerInstallerError } from "@beep/github-actions/PackageManagerInstaller";
   *
   * const error = PackageManagerInstallerError.make({
   *   reason: "downloadFailed", manager: "pnpm", version: "10.13.1",
   * });
   * console.log(error.message) // Could not download pnpm@10.13.1
   * ```
   *
   * @category getters
   * @since 0.0.0
   */
  override get message(): string {
    const pin = `${this.manager}@${this.version}`;
    return Match.value(this.reason).pipe(
      Match.when("downloadFailed", () => `Could not download ${pin}${framed({ prefix: " from " })(this.subject)}`),
      Match.when(
        "extractFailed",
        () => `Could not extract ${pin}${framed({ prefix: " (", closing: ")" })(this.subject)}`
      ),
      Match.when("integrityMismatch", () =>
        this.expected === undefined || this.actual === undefined
          ? `Could not verify the integrity of ${pin}${framed({ prefix: " (", closing: ")" })(this.subject)}`
          : `Integrity mismatch for ${pin}: expected ${this.expected}, got ${this.actual}`
      ),
      Match.when("integrityMissing", () =>
        this.subject === undefined
          ? `Neither the pin for ${pin} nor the integrity option carries an integrity hash, and requireIntegrity is set`
          : `No integrity was supplied for ${this.subject}, which ${pin} needs on this runner`
      ),
      Match.when("unsupportedPlatform", () => `No ${pin} build is published for ${this.subject}`),
      Match.when(
        "layoutUnexpected",
        () => `The ${pin} artifact does not have the expected layout${detailText(this.subject)}`
      ),
      Match.when("cacheFailed", () => `Could not cache ${pin} into the tool cache${detailText(this.subject)}`),
      Match.exhaustive
    );
  }
}

/**
 * How {@link PackageManagerInstallerShape.install} should behave.
 *
 * **Example** (Validate PackageManagerInstallOptions input)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import * as Console from "effect/Console";
 * import * as Effect from "effect/Effect";
 * import { PackageManagerInstallOptions } from "@beep/github-actions/PackageManagerInstaller";
 *
 * const input = { requireIntegrity: true };
 * Effect.runSync(Console.log(S.is(PackageManagerInstallOptions)(input))) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export class PackageManagerInstallOptions extends S.Opaque<
  PackageManagerInstallOptions,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    /**
     * Fail with `integrityMissing` when neither the pin nor the `integrity`
     * option carries an integrity hash, instead of proceeding with a logged
     * warning. Off by default, because in-the-wild `devEngines` pins routinely
     * carry no integrity.
     *
     * @since 0.0.0
     */
    requireIntegrity: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("PackageManagerInstallOptions.requireIntegrity", {
        description: "Require an integrity authority before provisioning.",
      })
    ),
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
    integrity: S.optionalKey(IntegrityHash).pipe(
      $I.annoteKey("PackageManagerInstallOptions.integrity", {
        description: "The existing branded integrity hash supplied alongside the pin.",
      })
    ),
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
    registry: S.optionalKey(S.String).pipe(
      $I.annoteKey("PackageManagerInstallOptions.registry", {
        description: "The optional registry override; the install operation supplies its default.",
      })
    ),
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
    nativeIntegrity: S.optionalKey(S.Record(S.String, S.String)).pipe(
      $I.annoteKey("PackageManagerInstallOptions.nativeIntegrity", {
        description: "Native package names mapped to caller-supplied SRI strings.",
      })
    ),
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
    allowAmbient: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("PackageManagerInstallOptions.allowAmbient", {
        description: "Whether the install operation may use the runner ambient npm.",
      })
    ),
  }).pipe(
    $I.annoteSchema("PackageManagerInstallOptions", {
      description: "Structural provisioning options; absent fields stay absent and an explicit undefined is rejected.",
    })
  )
) {}

/**
 * The plain-object input accepted by {@link PackageManagerInstallOptions}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace PackageManagerInstallOptions {
  /**
   * The plain object a {@link PackageManagerInstallOptions} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof PackageManagerInstallOptions.Encoded;

  /**
   * The field values {@link PackageManagerInstaller} takes: the `integrity`
   * option already an admitted `IntegrityHash` (decoded, or built by its
   * schema), so nothing re-validates it.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Admitted = S.Struct.Type<typeof PackageManagerInstallOptions.fields>;
}

/**
 * **Details**
 *
 * `bins` values are bare command names (`npm`, `npx`) resolved through the
 * ambient `PATH` — the toolchain already put them there.
 *
 * **Example** (Construct an ambient npm record)
 *
 * ```ts
 * import { AmbientPackageManager } from "@beep/github-actions/PackageManagerInstaller";
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
export class AmbientPackageManager extends S.Opaque<AmbientPackageManager, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The discriminant: the runner's own toolchain answered. */
    source: S.tag("ambient").pipe(
      $I.annoteKey("AmbientPackageManager.source", {
        description: "The discriminant: the runner's own toolchain answered.",
      })
    ),
    /** The package-manager name (`npm`, `pnpm`, `yarn` or `bun`). */
    name: PackageManagerPinName.pipe(
      $I.annoteKey("AmbientPackageManager.name", {
        description: "The package-manager name (`npm`, `pnpm`, `yarn` or `bun`).",
      })
    ),
    /** The exact installed version, in string form. */
    version: S.String.pipe(
      $I.annoteKey("AmbientPackageManager.version", { description: "The exact installed version, in string form." })
    ),
    /** Bin name → the ambient command name that invokes it. */
    bins: S.Record(S.String, S.String).pipe(
      $I.annoteKey("AmbientPackageManager.bins", {
        description: "Bin name → the ambient command name that invokes it.",
      })
    ),
  }).pipe(
    $I.annoteSchema("AmbientPackageManager", {
      description:
        "A package manager the runner's own toolchain already had: nothing was downloaded and nothing was cached, so there is no directory to publish.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AmbientPackageManager {
  /**
   * The plain object a {@link AmbientPackageManager} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof AmbientPackageManager.Encoded;
}

/**
 * **Details**
 *
 * `binDir` is the directory a consumer hands to `ActionOutputs.addPath` to
 * make the manager invocable by name in subsequent workflow steps. For the
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
 * import { CachedPackageManager } from "@beep/github-actions/PackageManagerInstaller";
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
export class CachedPackageManager extends S.Opaque<CachedPackageManager, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The discriminant: the manager lives in the tool cache. */
    source: S.tag("tool-cache").pipe(
      $I.annoteKey("CachedPackageManager.source", {
        description: "The discriminant: the manager lives in the tool cache.",
      })
    ),
    /** The package-manager name (`npm`, `pnpm`, `yarn` or `bun`). */
    name: PackageManagerPinName.pipe(
      $I.annoteKey("CachedPackageManager.name", {
        description: "The package-manager name (`npm`, `pnpm`, `yarn` or `bun`).",
      })
    ),
    /** The exact installed version, in string form. */
    version: S.String.pipe(
      $I.annoteKey("CachedPackageManager.version", { description: "The exact installed version, in string form." })
    ),
    /** The cached entry: `<tool-cache>/<name>/<version>/<arch>`. */
    directory: S.String.pipe(
      $I.annoteKey("CachedPackageManager.directory", {
        description: "The cached entry: `<tool-cache>/<name>/<version>/<arch>`.",
      })
    ),
    /** The directory to `addPath` — executable shims, or bun's own directory. */
    binDir: S.String.pipe(
      $I.annoteKey("CachedPackageManager.binDir", {
        description: "The directory to `addPath` — executable shims, or bun's own directory.",
      })
    ),
    /** Bin name → the absolute path of the underlying entry point. */
    bins: S.Record(S.String, S.String).pipe(
      $I.annoteKey("CachedPackageManager.bins", {
        description: "Bin name → the absolute path of the underlying entry point.",
      })
    ),
  }).pipe(
    $I.annoteSchema("CachedPackageManager", {
      description:
        "A package manager living in the runner's tool cache — found there, or installed into it by this call.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CachedPackageManager {
  /**
   * The plain object a {@link CachedPackageManager} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CachedPackageManager.Encoded;
}

/**
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
 * import { AmbientPackageManager, InstalledPackageManager } from "@beep/github-actions/PackageManagerInstaller";
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
export const InstalledPackageManager = S.Union([AmbientPackageManager, CachedPackageManager]).pipe(
  $I.annoteSchema("InstalledPackageManager", {
    description:
      "An installed package manager, discriminated by `source`: `ambient` carries no directory, `tool-cache` carries the cached `directory` and the `addPath`-able `binDir`. The union is a `Schema`, so the record round-trips through `ActionState` for a later phase to read back.",
  })
);

/**
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
   *
   * **Gotchas**
   *
   * POSIX .bin shims exec their target and preserve quoted arguments with "$@". Run .js/.mjs/.cjs entry points under node; exec native binaries and shell alias scripts directly, since feeding Mach-O or shell text to node fails with Invalid or unexpected token. Windows shims apply the same distinction with CRLF-terminated command text.
   *
   * Bun asset naming was verified against bun-v1.3.14: bun-{linux,darwin,windows}-{x64,aarch64}.zip, mapping runner macOS to darwin and Node arm64 to aarch64; unsupported pairs return None. Yarn before version 2 uses the yarn registry package; Berry uses `@yarnpkg/cli-dist`, with an unscoped `cli-dist-<version>.tgz` tarball basename.
   *
   * Resolve RUNNER_OS and RUNNER_ARCH once at construction; host architecture is only the off-runner fallback when RUNNER_ARCH is absent. ToolInstaller owns cache-path arch derivation. Read libc beside those facts only to select Linux pnpm glibc versus musl binaries.
   *
   * Hash artifact bytes incrementally through native crypto. The pin grammar limits algorithms to sha1/sha256/sha384/sha512, all supported there. An integrity-less pin may proceed with a warning because devEngines pins commonly omit it, but requireIntegrity is decided on inputs before cache, ambient probing or download: a cache hit cannot launder a missing checksum, and an option-supplied checksum counts.
   *
   * Settle one effective pin before every path. Validate the integrity option as corepack `<algo>.<hex>` once even though its input type accepts broader IntegrityHash forms. Refuse disagreement with pin integrity instead of preferring either. A malformed supplied option is could-not-verify integrityMismatch without expected/actual, rather than incorrectly reporting integrityMissing.
   *
   * Read bin and @pnpm/exe.* optional-dependency maps from the downloaded manifest instead of hardcoding changing layouts: pnpm used bin/pnpm.cjs through v10, bin/pnpm.mjs from v11, and native placeholders from v12. Treat both maps as attacker bytes and admit string pairs only.
   *
   * Package roots must be real directories. Bin links may resolve only inside them: a ../../payload.js manifest target must not escape into a file the archive never owned for existence checks, chmod, shim execution or published bin paths. Preflight every target, shim directory and destination before writing any shim, including literal .cmd representability on Windows, so a later hostile bin leaves no partial shim set.
   *
   * Detect pnpm native layout from @pnpm/exe.* optional dependencies, not its major. A shebang-less #-led non-#! placeholder marks an old/foreign entry whose lifecycle overlay never ran; a shebang, executable magic, unreadable or empty file stays under ordinary layout validation. No shim can repair a placeholder, so reinstall the whole entry and rewrite every stale exec-node shim rather than keeping it through skipExisting.
   *
   * The shared cache may have been populated by the runner image, setup actions or older writers with no shims. Regenerate missing shims without replacing ones owned by another writer; failure to write remains typed cacheFailed rather than a silent PATH hole.
   *
   * Overlay pnpm native binaries in the staged wrapper because lifecycle scripts are never run. Fetch the host @pnpm/exe.* artifact from the wrapper's same registry and keep dist/ beside the executable. Settle its expected checksum before fetching the roughly 36 MB archive: a supplied nativeIntegrity map is authoritative and skips packument lookup, otherwise the exact-version registry dist.integrity is authoritative. Either unavailable authority fails closed; this second artifact has no integrity-less posture.
   *
   * On Windows place each wrapper bin both as `<name>.exe` and over its extensionless placeholder, since an old shim may still name the latter, and repoint recorded bins to .exe. Off Windows chmod every non-Node executable and shell alias after overlay; extraction does not reliably preserve executability. Bun likewise needs its executable bit set before caching.
   *
   * Bun has no corepack integrity authority: its checksum covers the downloaded platform zip and is inherently platform-specific. npm, pnpm and Yarn 1 corepack pins cover registry tarball bytes; Yarn >=2 pins cover standalone repo.yarnpkg.com yarn.js, byte-identical to bin/yarn.js inside cli-dist, so verify that extracted file instead.
   *
   * Prefer the runner npm only when it already matches the pin; a failed probe falls through to distribution install rather than failing. allowAmbient=false suppresses the probe entirely when replacing node, because the current npm is about to be shadowed and is not the one that will execute.
   *
   * @since 0.0.0
   */
  readonly install: {
    (
      pin: PackageManagerPin,
      options?: PackageManagerInstallOptions.Admitted
    ): Effect.Effect<InstalledPackageManager, PackageManagerInstallerError>;
    (
      options?: PackageManagerInstallOptions.Admitted
    ): (pin: PackageManagerPin) => Effect.Effect<InstalledPackageManager, PackageManagerInstallerError>;
  };
}

interface RegistrySource {
  readonly nativeIntegrity: Readonly<Record<string, string>> | undefined;

  readonly registry: string;
}

interface PackageManifest {
  readonly bins: Record<string, string>;
  readonly nativePackages: Record<string, string>;
}

interface NativeOverlayPlan {
  readonly nativeVersion: string;
  readonly packageName: string;
  readonly placeholder: string;
  readonly target: string;
}

interface ExpectedDigest {
  readonly algorithm: string;
  readonly hex: string;
}

const SHIM_DIR = ".bin";

const posixShim = (target: string): string => {
  const literal = `'${Str.replaceAll("'", "'\\''")(target)}'`;
  return isNodeScript(target) ? `#!/bin/sh\nexec node -- ${literal} "$@"\n` : `#!/bin/sh\nexec ${literal} "$@"\n`;
};

const cmdShim = (target: string): string =>
  isNodeScript(target) ? `@echo off\r\nnode -- "${target}" %*\r\n` : `@echo off\r\n"${target}" %*\r\n`;

const PNPM_NATIVE_BIN_NAMES: ReadonlyArray<string> = ["pnpm", "pn", "pnpx", "pnx"];

const BUN_OS: Readonly<Record<string, string>> = { linux: "linux", macos: "darwin", windows: "windows" };
const BUN_CPU: Readonly<Record<string, string>> = { x64: "x64", arm64: "aarch64" };
const bunTarget: {
  (runnerOs: string, arch: string): O.Option<string>;
  (arch: string): (runnerOs: string) => O.Option<string>;
} = dual(2, (runnerOs: string, arch: string): O.Option<string> => {
  const os = BUN_OS[Str.toLowerCase(runnerOs)];
  const cpu = BUN_CPU[arch];
  return os === undefined || cpu === undefined ? O.none() : O.some(`bun-${os}-${cpu}`);
});

const registryTarballUrl: {
  (name: string, version: string, major: number, registry: string): string;
  (version: string, major: number, registry: string): (name: string) => string;
} = dual(4, (name: string, version: string, major: number, registry: string): string =>
  name === "yarn" && major >= 2
    ? `${registry}/@yarnpkg/cli-dist/-/cli-dist-${version}.tgz`
    : `${registry}/${name}/-/${name}-${version}.tgz`
);

const normalizeBins: {
  (bin: unknown, fallbackName: string): O.Option<Record<string, string>>;
  (fallbackName: string): (bin: unknown) => O.Option<Record<string, string>>;
} = dual(2, (bin: unknown, fallbackName: string): O.Option<Record<string, string>> => {
  if (P.isString(bin)) {
    return O.some({ [fallbackName]: Str.replace(/^\.\//, "")(bin) });
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
    R.assignProperty(entries, name, Str.replace(/^\.\//, "")(value));
  }
  return R.keys(entries).length === 0 ? O.none() : O.some(entries);
});

const archFromRunner = (runnerArch: string): string => {
  const lowered = Str.toLowerCase(runnerArch);
  return lowered === "x64" || lowered === "arm64" ? lowered : runnerArch;
};

// decision: atomic-cache-entry-publication
const make = Effect.gen(function* () {
  const env = yield* ActionEnvironment;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const installer = yield* ToolInstaller;

  const runnerOs = yield* Effect.map(env.getOptional("RUNNER_OS"), (found) => O.getOrElse(found, () => ""));
  const hostArch = yield* HostProcessArchitecture;
  const arch = yield* Effect.map(env.getOptional("RUNNER_ARCH"), (found) =>
    O.match(found, { onNone: (): string => hostArch, onSome: archFromRunner })
  );
  const windows = yield* isWindowsRunner(env);

  const HostProcessPlatform1 = yield* HostProcessPlatform;
  const musl = detectMusl(HostProcessPlatform1);
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
      PackageManagerInstallerError.make({ manager: pin.name, version: pin.version.toString(), ...fields });

  const fromInstaller =
    (pin: PackageManagerPin) =>
    (cause: ToolInstallerError): PackageManagerInstallerError =>
      errorFor(pin)({
        reason: cause.reason,
        ...O.getSomesStruct({ subject: O.fromUndefinedOr(cause.subject) }),
        cause,
      });

  const hashFile: {
    (pin: PackageManagerPin, file: string, algorithm: string): Effect.Effect<string, PackageManagerInstallerError>;
    (file: string, algorithm: string): (pin: PackageManagerPin) => Effect.Effect<string, PackageManagerInstallerError>;
  } = dual(
    3,
    (pin: PackageManagerPin, file: string, algorithm: string): Effect.Effect<string, PackageManagerInstallerError> =>
      digestFileHex(fs, file, algorithm).pipe(
        Effect.mapError((cause) => errorFor(pin)({ reason: "integrityMismatch", subject: file, cause }))
      )
  );

  const verifyIntegrity: {
    (pin: PackageManagerPin, file: string): Effect.Effect<void, PackageManagerInstallerError>;
    (file: string): (pin: PackageManagerPin) => Effect.Effect<void, PackageManagerInstallerError>;
  } = dual(
    2,
    Effect.fnUntraced(function* (
      pin: PackageManagerPin,
      file: string
    ): Effect.fn.Return<void, PackageManagerInstallerError> {
      const integrity = pin.integrity;
      if (integrity === undefined) {
        yield* Effect.logWarning(
          `The pin ${pin.toString()} carries no integrity hash and none was supplied; the downloaded artifact was not verified.`
        );
        return;
      }
      const algorithm = A.headNonEmpty(Str.split(".")(integrity));
      const expectedHex = Str.slice(Str.length(algorithm) + 1)(integrity);
      const actualHex = yield* hashFile(pin, file, algorithm);
      if (actualHex !== expectedHex) {
        return yield* errorFor(pin)({
          reason: "integrityMismatch",
          subject: file,
          expected: integrity,
          actual: `${algorithm}.${actualHex}`,
        });
      }
    })
  );

  const ambientNpmVersion: Effect.Effect<O.Option<string>> = Effect.map(
    Effect.result(spawner.string(ChildProcess.make("npm", ["--version"]))),
    (result) => (result._tag === "Success" ? O.some(Str.trim(result.success)) : O.none())
  );

  const assertFile: {
    (pin: PackageManagerPin, file: string, subject: string): Effect.Effect<void, PackageManagerInstallerError>;
    (file: string, subject: string): (pin: PackageManagerPin) => Effect.Effect<void, PackageManagerInstallerError>;
  } = dual(
    3,
    Effect.fnUntraced(function* (
      pin: PackageManagerPin,
      file: string,
      subject: string
    ): Effect.fn.Return<void, PackageManagerInstallerError> {
      if ((yield* typeAt(fs, file)) !== "File") {
        return yield* errorFor(pin)({ reason: "layoutUnexpected", subject });
      }
    })
  );

  const resolvedDestination = realDestination({ fs, path });

  const containedPackagePath: {
    (pin: PackageManagerPin, packageDir: string, file: string): Effect.Effect<void, PackageManagerInstallerError>;
    (packageDir: string, file: string): (pin: PackageManagerPin) => Effect.Effect<void, PackageManagerInstallerError>;
  } = dual(
    3,
    Effect.fnUntraced(function* (
      pin: PackageManagerPin,
      packageDir: string,
      file: string
    ): Effect.fn.Return<void, PackageManagerInstallerError> {
      const root = path.resolve(packageDir);
      const link = yield* Effect.option(fs.readLink(root));
      if (O.isSome(link)) {
        return yield* errorFor(pin)({ reason: "layoutUnexpected", subject: "package root is a symbolic link" });
      }
      const realRoot = yield* fs
        .realPath(root)
        .pipe(Effect.mapError((cause) => errorFor(pin)({ reason: "layoutUnexpected", subject: packageDir, cause })));
      const target = yield* resolvedDestination(path.resolve(file)).pipe(
        Effect.mapError((cause) => errorFor(pin)({ reason: "layoutUnexpected", subject: file, cause }))
      );
      const relative = path.relative(realRoot, target);
      if (escapesRoot(path, relative)) {
        return yield* errorFor(pin)({
          reason: "layoutUnexpected",
          subject: `${file} escapes the real package directory`,
        });
      }
    })
  );

  const validateShimDestinations: {
    (
      pin: PackageManagerPin,
      into: string,
      bins: Record<string, string>
    ): Effect.Effect<void, PackageManagerInstallerError>;
    (
      into: string,
      bins: Record<string, string>
    ): (pin: PackageManagerPin) => Effect.Effect<void, PackageManagerInstallerError>;
  } = dual(
    3,
    Effect.fnUntraced(function* (
      pin: PackageManagerPin,
      into: string,
      bins: Record<string, string>
    ): Effect.fn.Return<void, PackageManagerInstallerError> {
      const shimDir = path.resolve(into, SHIM_DIR);
      for (const name of R.keys(bins)) {
        const shim = path.resolve(shimDir, shimFileName(name));
        const containment = path.relative(shimDir, shim);
        if (
          !isBinName(name) ||
          (windows && isWindowsDeviceName(name)) ||
          containment === "" ||
          containment === ".." ||
          Str.startsWith(`..${path.sep}`)(containment) ||
          path.isAbsolute(containment)
        ) {
          return yield* errorFor(pin)({
            reason: "layoutUnexpected",
            subject: `bin ${name} does not name a shim inside ${SHIM_DIR}`,
          });
        }
      }
    })
  );

  const readPackageManifest: {
    (pin: PackageManagerPin, packageDir: string): Effect.Effect<PackageManifest, PackageManagerInstallerError>;
    (packageDir: string): (pin: PackageManagerPin) => Effect.Effect<PackageManifest, PackageManagerInstallerError>;
  } = dual(
    2,
    Effect.fnUntraced(function* (
      pin: PackageManagerPin,
      packageDir: string
    ): Effect.fn.Return<PackageManifest, PackageManagerInstallerError> {
      const manifestPath = path.join(packageDir, "package.json");
      yield* containedPackagePath(pin, packageDir, manifestPath);
      const raw = yield* fs
        .readFileString(manifestPath)
        .pipe(
          Effect.mapError((cause) => errorFor(pin)({ reason: "layoutUnexpected", subject: "no package.json", cause }))
        );
      const manifest = yield* S.decodeEffect(Json)(raw).pipe(
        Effect.mapError((cause) =>
          errorFor(pin)({ reason: "layoutUnexpected", subject: "unparseable package.json", cause })
        )
      );
      const bins = O.getOrUndefined(normalizeBins(P.hasProperty(manifest, "bin") ? manifest.bin : undefined, pin.name));
      if (bins === undefined) {
        return yield* errorFor(pin)({ reason: "layoutUnexpected", subject: "package.json names no bin" });
      }
      yield* validateShimDestinations(pin, packageDir, bins);
      for (const [name, relative] of R.toEntries(bins)) {
        const target = path.join(packageDir, relative);

        const containment = path.relative(packageDir, target);
        if (containment === ".." || Str.startsWith(`..${path.sep}`)(containment) || path.isAbsolute(containment)) {
          return yield* errorFor(pin)({
            reason: "layoutUnexpected",
            subject: `bin ${name} (${relative}) escapes the package directory`,
          });
        }
        yield* containedPackagePath(pin, packageDir, target);
        yield* assertFile(pin, target, `bin ${name} (${relative}) is missing`);
      }
      return {
        bins,
        nativePackages: nativePackagesOf(
          P.hasProperty(manifest, "optionalDependencies") ? manifest.optionalDependencies : undefined
        ),
      };
    })
  );

  const nativePackagesOf = (optionalDependencies: unknown): Record<string, string> => {
    if (!P.isObjectOrArray(optionalDependencies)) {
      return {};
    }
    const entries: Record<string, string> = {};
    const properties: ReadonlyArray<[string, unknown]> = R.toEntries<never, unknown>(optionalDependencies);
    for (const [name, version] of properties) {
      if (Str.startsWith(PNPM_EXE_PREFIX)(name) && P.isString(version)) {
        entries[name] = version;
      }
    }
    return entries;
  };

  const nativeWindowsBins = (bins: Record<string, string>): Record<string, string> =>
    R.fromEntries(
      A.map(R.toEntries(bins), ([name, relative]): [string, string] => [
        name,
        PNPM_NATIVE_BIN_NAMES.includes(name) ? `${relative}.exe` : relative,
      ])
    );

  const isPlaceholder = (file: string): Effect.Effect<boolean> =>
    Effect.scoped(Effect.flatMap(fs.open(file), (handle) => handle.readAlloc(2))).pipe(
      Effect.map((head) =>
        O.match(head, {
          onNone: () => false,
          onSome: (bytes) => bytes.length >= 1 && bytes[0] === 0x23 && bytes[1] !== 0x21,
        })
      ),
      Effect.orElseSucceed(() => false)
    );

  const rootBins: {
    (bins: Record<string, string>, directory: string): Record<string, string>;
    (directory: string): (bins: Record<string, string>) => Record<string, string>;
  } = dual(
    2,
    (bins: Record<string, string>, directory: string): Record<string, string> =>
      R.fromEntries(
        A.map(R.toEntries(bins), ([name, relative]): [string, string] => [name, path.join(directory, relative)])
      )
  );

  const preflightShims = Effect.fnUntraced(function* (
    pin: PackageManagerPin,
    into: string,
    finalDirectory: string,
    bins: Record<string, string>
  ): Effect.fn.Return<void, PackageManagerInstallerError> {
    for (const [name, relative] of R.toEntries(bins)) {
      const target = path.join(into, relative);
      yield* containedPackagePath(pin, into, target);
      yield* assertFile(pin, target, `bin ${name} (${relative}) is missing`);
    }
    yield* containedPackagePath(pin, into, path.join(into, SHIM_DIR));
    yield* validateShimDestinations(pin, into, bins);
    const unrepresentable = A.findFirst(
      R.toEntries(bins),
      ([, relative]) => windows && !isWindowsShimTarget(path.join(finalDirectory, relative))
    );
    if (O.isSome(unrepresentable)) {
      const [name, relative] = unrepresentable.value;
      return yield* errorFor(pin)({
        reason: "layoutUnexpected",
        subject: `bin ${name} (${path.join(finalDirectory, relative)}) cannot be represented literally in a Windows shim`,
      });
    }
  });

  const writeShim = Effect.fnUntraced(function* (
    pin: PackageManagerPin,
    into: string,
    shim: string,
    target: string,
    options: { readonly skipExisting: boolean }
  ): Effect.fn.Return<void, PackageManagerInstallerError> {
    yield* containedPackagePath(pin, into, shim);
    if (options.skipExisting && (yield* typeAt(fs, shim)) === "File") {
      return;
    }
    const cacheFailed = (cause: unknown) => errorFor(pin)({ reason: "cacheFailed", subject: shim, cause });
    yield* fs.writeFileString(shim, shimBody(target)).pipe(Effect.mapError(cacheFailed));
    if (!windows) {
      yield* fs.chmod(shim, 0o755).pipe(Effect.mapError(cacheFailed));
    }
  });

  const writeShims: {
    (
      pin: PackageManagerPin,
      into: string,
      finalDirectory: string,
      bins: Record<string, string>,
      options: { readonly skipExisting: boolean }
    ): Effect.Effect<void, PackageManagerInstallerError>;
    (
      into: string,
      finalDirectory: string,
      bins: Record<string, string>,
      options: { readonly skipExisting: boolean }
    ): (pin: PackageManagerPin) => Effect.Effect<void, PackageManagerInstallerError>;
  } = dual(
    5,
    Effect.fnUntraced(function* (
      pin: PackageManagerPin,
      into: string,
      finalDirectory: string,
      bins: Record<string, string>,
      options: { readonly skipExisting: boolean }
    ): Effect.fn.Return<void, PackageManagerInstallerError> {
      const shimDir = path.join(into, SHIM_DIR);
      yield* preflightShims(pin, into, finalDirectory, bins);
      yield* fs
        .makeDirectory(shimDir, { recursive: true })
        .pipe(Effect.mapError((cause) => errorFor(pin)({ reason: "cacheFailed", subject: shimDir, cause })));
      yield* Effect.forEach(
        R.toEntries(bins),
        ([name, relative]) =>
          writeShim(pin, into, path.join(shimDir, shimFileName(name)), path.join(finalDirectory, relative), options),
        { concurrency: 1, discard: true }
      );
    })
  );

  const cachedRecord: {
    (
      pin: PackageManagerPin,
      directory: string
    ): Effect.Effect<O.Option<InstalledPackageManager>, PackageManagerInstallerError>;
    (
      directory: string
    ): (pin: PackageManagerPin) => Effect.Effect<O.Option<InstalledPackageManager>, PackageManagerInstallerError>;
  } = dual(
    2,
    Effect.fnUntraced(function* (
      pin: PackageManagerPin,
      directory: string
    ): Effect.fn.Return<O.Option<InstalledPackageManager>, PackageManagerInstallerError> {
      if (pin.name === "bun") {
        const binary = path.join(directory, bunBinaryName);
        yield* assertFile(pin, binary, `cached bun binary (${bunBinaryName}) is missing`);
        return CachedPackageManager.makeOption({
          name: pin.name,
          version: pin.version.toString(),
          directory,
          binDir: directory,
          bins: { bun: binary },
        });
      }
      const manifest = yield* readPackageManifest(pin, directory);
      let bins = manifest.bins;
      if (R.keys(manifest.nativePackages).length > 0) {
        const entry = bins[pin.name];
        if (entry !== undefined && (yield* isPlaceholder(path.join(directory, entry)))) {
          yield* Effect.logInfo(
            `The cached ${pin.name}@${pin.version.toString()} still holds pnpm's placeholder bin; reinstalling it over.`
          );
          return O.none();
        }
        if (windows) {
          bins = nativeWindowsBins(bins);
        }
      }

      yield* writeShims(pin, directory, directory, bins, { skipExisting: true });
      return CachedPackageManager.makeOption({
        name: pin.name,
        version: pin.version.toString(),
        directory,
        binDir: path.join(directory, SHIM_DIR),
        bins: rootBins(bins, directory),
      });
    })
  );

  const expectedFromSri: {
    (
      pin: PackageManagerPin,
      sri: unknown,
      subject: string
    ): Effect.Effect<ExpectedDigest, PackageManagerInstallerError>;
    (
      sri: unknown,
      subject: string
    ): (pin: PackageManagerPin) => Effect.Effect<ExpectedDigest, PackageManagerInstallerError>;
  } = dual(
    3,
    (
      pin: PackageManagerPin,
      sri: unknown,
      subject: string
    ): Effect.Effect<ExpectedDigest, PackageManagerInstallerError> =>
      Effect.fromOption(P.isString(sri) ? strongestSri(sri) : O.none(), () =>
        errorFor(pin)({ reason: "integrityMismatch", subject })
      )
  );

  const registryIntegrity: {
    (
      pin: PackageManagerPin,
      packageName: string,
      version: string,
      registry: string
    ): Effect.Effect<ExpectedDigest, PackageManagerInstallerError>;
    (
      packageName: string,
      version: string,
      registry: string
    ): (pin: PackageManagerPin) => Effect.Effect<ExpectedDigest, PackageManagerInstallerError>;
  } = dual(
    4,
    Effect.fnUntraced(function* (
      pin: PackageManagerPin,
      packageName: string,
      version: string,
      registry: string
    ): Effect.fn.Return<ExpectedDigest, PackageManagerInstallerError> {
      const packumentUrl = `${registry}/${packageName}/${version}`;
      const packumentFile = yield* installer.download(packumentUrl).pipe(Effect.mapError(fromInstaller(pin)));
      const unverifiable = (cause: unknown) =>
        errorFor(pin)({ reason: "integrityMismatch", subject: packumentUrl, cause });
      const packument = yield* fs
        .readFileString(packumentFile)
        .pipe(Effect.flatMap(S.decodeEffect(Json)), Effect.mapError(unverifiable));
      const dist = P.hasProperty(packument, "dist") ? packument.dist : undefined;
      return yield* expectedFromSri(pin, P.hasProperty(dist, "integrity") ? dist.integrity : undefined, packumentUrl);
    })
  );

  const suppliedIntegrity: {
    (
      pin: PackageManagerPin,
      packageName: string,
      nativeIntegrity: Readonly<Record<string, string>>
    ): Effect.Effect<ExpectedDigest, PackageManagerInstallerError>;
    (
      packageName: string,
      nativeIntegrity: Readonly<Record<string, string>>
    ): (pin: PackageManagerPin) => Effect.Effect<ExpectedDigest, PackageManagerInstallerError>;
  } = dual(
    3,
    (
      pin: PackageManagerPin,
      packageName: string,
      nativeIntegrity: Readonly<Record<string, string>>
    ): Effect.Effect<ExpectedDigest, PackageManagerInstallerError> => {
      const supplied = R.has(nativeIntegrity, packageName) ? nativeIntegrity[packageName] : undefined;
      return P.isString(supplied)
        ? expectedFromSri(pin, supplied, packageName)
        : Effect.fail(errorFor(pin)({ reason: "integrityMissing", subject: packageName }));
    }
  );

  const nativeOverlayPlan = Effect.fnUntraced(function* (
    pin: PackageManagerPin,
    { bins, nativePackages }: PackageManifest
  ): Effect.fn.Return<NativeOverlayPlan, PackageManagerInstallerError> {
    const target = O.getOrUndefined(pnpmExeTarget(runnerOs, arch, musl));
    const packageName = target === undefined ? undefined : `${PNPM_EXE_PREFIX}${target}`;
    const nativeVersion = packageName === undefined ? undefined : nativePackages[packageName];
    if (target === undefined || packageName === undefined || nativeVersion === undefined) {
      return yield* errorFor(pin)({ reason: "unsupportedPlatform", subject: `${runnerOs || "unknown"}/${arch}` });
    }
    if (nativeVersion !== pin.version.toString()) {
      return yield* errorFor(pin)({
        reason: "layoutUnexpected",
        subject: `${packageName} is pinned at ${nativeVersion}, not the wrapper's ${pin.version.toString()}`,
      });
    }
    const placeholder = bins[pin.name];
    if (placeholder === undefined) {
      return yield* errorFor(pin)({
        reason: "layoutUnexpected",
        subject: `package.json names no ${pin.name} bin to overlay`,
      });
    }
    return { target, packageName, nativeVersion, placeholder };
  });

  const fetchNativeBinary = Effect.fnUntraced(function* (
    pin: PackageManagerPin,
    { target, packageName, nativeVersion }: NativeOverlayPlan,
    { registry, nativeIntegrity }: RegistrySource
  ): Effect.fn.Return<string, PackageManagerInstallerError> {
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
    yield* containedPackagePath(pin, path.join(extracted, "package"), native);
    yield* assertFile(pin, native, `package/${nativeName} is missing from the ${packageName} tarball`);
    return native;
  });

  const copyNative = (pin: PackageManagerPin, packageDir: string, native: string, destination: string) =>
    containedPackagePath(pin, packageDir, destination).pipe(
      Effect.andThen(
        fs
          .copyFile(native, destination)
          .pipe(Effect.mapError((cause) => errorFor(pin)({ reason: "cacheFailed", subject: destination, cause })))
      )
    );

  const placeNativeWindows = Effect.fnUntraced(function* (
    pin: PackageManagerPin,
    packageDir: string,
    bins: Record<string, string>,
    native: string
  ): Effect.fn.Return<Record<string, string>, PackageManagerInstallerError> {
    const relatives = A.getSomes(A.map(PNPM_NATIVE_BIN_NAMES, (name) => O.fromUndefinedOr(bins[name])));
    const destinations = A.flatMap(relatives, (relative) => [
      path.join(packageDir, relative),
      path.join(packageDir, `${relative}.exe`),
    ]);
    yield* Effect.forEach(destinations, (destination) => copyNative(pin, packageDir, native, destination), {
      concurrency: 1,
      discard: true,
    });
    return nativeWindowsBins(bins);
  });

  const placeNativePosix = Effect.fnUntraced(function* (
    pin: PackageManagerPin,
    packageDir: string,
    bins: Record<string, string>,
    placeholder: string,
    native: string
  ): Effect.fn.Return<Record<string, string>, PackageManagerInstallerError> {
    yield* copyNative(pin, packageDir, native, path.join(packageDir, placeholder));
    const executables = A.map(
      A.filter(R.values(bins), (relative) => !isNodeScript(relative)),
      (relative) => path.join(packageDir, relative)
    );
    yield* Effect.forEach(
      executables,
      (file) =>
        containedPackagePath(pin, packageDir, file).pipe(
          Effect.andThen(
            fs
              .chmod(file, 0o755)
              .pipe(Effect.mapError((cause) => errorFor(pin)({ reason: "cacheFailed", subject: file, cause })))
          )
        ),
      { concurrency: 1, discard: true }
    );
    return bins;
  });

  const overlayNativeBinary: {
    (
      pin: PackageManagerPin,
      packageDir: string,
      manifest: PackageManifest,
      source: RegistrySource
    ): Effect.Effect<Record<string, string>, PackageManagerInstallerError>;
    (
      packageDir: string,
      manifest: PackageManifest,
      source: RegistrySource
    ): (pin: PackageManagerPin) => Effect.Effect<Record<string, string>, PackageManagerInstallerError>;
  } = dual(
    4,
    Effect.fnUntraced(function* (
      pin: PackageManagerPin,
      packageDir: string,
      manifest: PackageManifest,
      source: RegistrySource
    ): Effect.fn.Return<Record<string, string>, PackageManagerInstallerError> {
      const plan = yield* nativeOverlayPlan(pin, manifest);
      const native = yield* fetchNativeBinary(pin, plan, source);
      return windows
        ? yield* placeNativeWindows(pin, packageDir, manifest.bins, native)
        : yield* placeNativePosix(pin, packageDir, manifest.bins, plan.placeholder, native);
    })
  );

  const installBun = Effect.fnUntraced(function* (
    pin: PackageManagerPin
  ): Effect.fn.Return<InstalledPackageManager, PackageManagerInstallerError> {
    const version = pin.version.toString();
    const target = O.getOrUndefined(bunTarget(runnerOs, arch));
    if (target === undefined) {
      return yield* errorFor(pin)({ reason: "unsupportedPlatform", subject: `${runnerOs || "unknown"}/${arch}` });
    }
    const url = `https://github.com/oven-sh/bun/releases/download/bun-v${version}/${target}.zip`;
    const archive = yield* installer.download(url).pipe(Effect.mapError(fromInstaller(pin)));

    yield* verifyIntegrity(pin, archive);
    const extracted = yield* installer.extractZip(archive).pipe(Effect.mapError(fromInstaller(pin)));
    const binary = path.join(extracted, target, bunBinaryName);
    yield* assertFile(pin, binary, `${target}/${bunBinaryName} is missing from the zip`);
    if (!windows) {
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

  const installFromRegistry: {
    (
      pin: PackageManagerPin,
      source: RegistrySource
    ): Effect.Effect<InstalledPackageManager, PackageManagerInstallerError>;
    (
      source: RegistrySource
    ): (pin: PackageManagerPin) => Effect.Effect<InstalledPackageManager, PackageManagerInstallerError>;
  } = dual(
    2,
    Effect.fnUntraced(function* (
      pin: PackageManagerPin,
      source: RegistrySource
    ): Effect.fn.Return<InstalledPackageManager, PackageManagerInstallerError> {
      const { name } = pin;
      const version = pin.version.toString();
      const url = registryTarballUrl(name, version, pin.version.major, source.registry);
      const archive = yield* installer.download(url).pipe(Effect.mapError(fromInstaller(pin)));

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

      const bins =
        R.keys(manifest.nativePackages).length > 0
          ? yield* overlayNativeBinary(pin, packageDir, manifest, source)
          : manifest.bins;
      if (berry) {
        const cli = path.join(packageDir, "bin/yarn.js");
        yield* assertFile(pin, cli, "bin/yarn.js is missing from the cli-dist tarball");
        yield* verifyIntegrity(pin, cli);
      }
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
    })
  );

  const cachedInstall = Effect.fnUntraced(function* (
    effective: PackageManagerPin,
    version: string
  ): Effect.fn.Return<O.Option<InstalledPackageManager>, PackageManagerInstallerError> {
    const cached = yield* installer.find(effective.name, version);
    return O.isSome(cached) ? yield* cachedRecord(effective, cached.value) : O.none();
  });

  const ambientInstall = Effect.fnUntraced(function* (
    effective: PackageManagerPin,
    version: string,
    allowAmbient: boolean
  ): Effect.fn.Return<O.Option<InstalledPackageManager>> {
    if (effective.name !== "npm" || !allowAmbient) {
      return O.none();
    }
    const probed = yield* ambientNpmVersion;
    return O.contains(probed, version)
      ? AmbientPackageManager.makeOption({ name: effective.name, version, bins: { npm: "npm", npx: "npx" } })
      : O.none();
  });

  const settlePin: {
    (
      pin: PackageManagerPin,
      integrity: IntegrityHashBrand | undefined
    ): Effect.Effect<PackageManagerPin, PackageManagerInstallerError>;
    (
      integrity: IntegrityHashBrand | undefined
    ): (pin: PackageManagerPin) => Effect.Effect<PackageManagerPin, PackageManagerInstallerError>;
  } = dual(
    2,
    Effect.fnUntraced(function* (
      pin: PackageManagerPin,
      integrity: IntegrityHashBrand | undefined
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
          })
        )
      );
      if (pin.integrity !== undefined && pin.integrity !== option) {
        return yield* errorFor(pin)({
          reason: "integrityMismatch",
          subject: `the pin declares ${pin.integrity}, which disagrees with the integrity option`,
          expected: option,
        });
      }
      return PackageManagerPin.make({ name: pin.name, version: pin.version, integrity: option });
    })
  );

  const fromDist = (effective: PackageManagerPin, options: PackageManagerInstallOptions.Admitted | undefined) =>
    effective.name === "bun"
      ? installBun(effective)
      : installFromRegistry(effective, {
          registry: Str.replace(/\/+$/, "")(options?.registry ?? DEFAULT_REGISTRY),
          nativeIntegrity: options?.nativeIntegrity,
        });

  const install: PackageManagerInstallerShape["install"] = dual(
    (args) => S.is(PackageManagerPin)(args[0]),
    Effect.fn("PackageManagerInstaller.install")(function* (
      pin: PackageManagerPin,
      options?: PackageManagerInstallOptions.Admitted
    ) {
      const version = pin.version.toString();
      yield* Effect.annotateCurrentSpan({ name: pin.name, version });

      const effective = yield* settlePin(pin, options?.integrity);

      if (options?.requireIntegrity === true && effective.integrity === undefined) {
        return yield* errorFor(pin)({ reason: "integrityMissing" });
      }

      const cached = yield* cachedInstall(effective, version);
      if (O.isSome(cached)) {
        return cached.value;
      }
      const ambient = yield* ambientInstall(effective, version, options?.allowAmbient !== false);
      if (O.isSome(ambient)) {
        return ambient.value;
      }
      return yield* fromDist(effective, options);
    })
  );

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
 * import { PackageManagerInstaller } from "@beep/github-actions/PackageManagerInstaller";
 * import { ActionOutputs } from "@beep/github-actions/ActionOutputs";
 * import { PackageManagerPin } from "@beep/npm-spec/PackageManagerPin";
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
  $I`PackageManagerInstaller`
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
   * import { PackageManagerInstaller } from "@beep/github-actions/PackageManagerInstaller";
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
   * import { AmbientPackageManager, PackageManagerInstaller } from "@beep/github-actions/PackageManagerInstaller";
   * import { PackageManagerPin } from "@beep/npm-spec/PackageManagerPin";
   * import * as Effect from "effect/Effect";
   * import { dual } from "effect/Function";
   * import * as S from "effect/Schema";
   *
   * const manager = AmbientPackageManager.make({
   *   name: "npm", version: "11.0.0", bins: { npm: "npm", npx: "npx" },
   * });
   * const installer = PackageManagerInstaller.makeTest({
   *   install: dual((args) => S.is(PackageManagerPin)(args[0]), (_pin: PackageManagerPin, _options?: unknown) => Effect.succeed(manager)),
   * });
   * console.log(typeof installer.install) // function
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly makeTest = (overrides: Partial<PackageManagerInstallerShape> = {}): PackageManagerInstallerShape => ({
    install: dual(
      (args) => S.is(PackageManagerPin)(args[0]),
      (
        _pin: PackageManagerPin,
        _options?: PackageManagerInstallOptions.Admitted
      ): Effect.Effect<InstalledPackageManager, PackageManagerInstallerError> => dies("install")
    ),
    ...overrides,
  });

  /**
   * {@link PackageManagerInstaller.makeTest} behind `Layer.succeed`.
   *
   * **Example** (Construct the test installer layer)
   *
   * ```ts
   * import { PackageManagerInstaller } from "@beep/github-actions/PackageManagerInstaller";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(PackageManagerInstaller.layerTest())) // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerTest = (
    overrides: Partial<PackageManagerInstallerShape> = {}
  ): Layer.Layer<PackageManagerInstaller> =>
    Layer.succeed(PackageManagerInstaller, PackageManagerInstaller.makeTest(overrides));
}
