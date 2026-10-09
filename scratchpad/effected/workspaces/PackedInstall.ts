import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "@beep/utils/Option";
import * as Path from "effect/Path";
import type * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import type { ChildProcessSpawner } from "effect/process";
import { ChildProcess } from "effect/process";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import type { CommandOutput } from "../commands/index.ts";
import { Run } from "../commands/index.ts";
import { Yaml } from "../yaml/index.ts";
import type { PackedManifest } from "./internal/packedInstallPlan.ts";
import {
    binConflict,
    binTargetOf,
    closureOf,
    consumerFiles,
    fileOverridesOf,
    installArgs,
    overridePath,
    readPackedManifest,
    scrubEnv,
    versionOf,
} from "./internal/packedInstallPlan.ts";
import { PackageManagerName } from "./PackageManagerName.ts";
import { WorkspaceDiscovery } from "./WorkspaceDiscovery.ts";
import { WorkspacePackage } from "./WorkspacePackage.ts";

const $I = $ScratchpadId.create("effected/workspaces/PackedInstall");

const JsonValue = S.fromJsonString(S.Unknown);

/**
 * Where each closure package is packed from.
 *
 * **Details**
 *
 * `{ directory }` runs `npm pack` in that subdirectory of each package, whose
 * manifest must already be publish-ready. The default,
 * `{ directory: "dist/prod/npm/pkg" }`, is `@savvy-web/bundler`'s prod npm
 * output: the same file list a release publishes.
 *
 * `"source"` runs `pnpm pack` in the package directory: pnpm honours
 * `publishConfig.directory` and rewrites `workspace:` and `catalog:`
 * specifiers. Two costs. Under `@savvy-web/bundler`, `publishConfig.directory`
 * names the DEV build, so source mode proves the dev artifact, not the
 * published one. And pnpm can rewrite a `workspace:` specifier only in a
 * workspace that has been `pnpm install`ed: in a never-installed one the pack
 * fails with `ERR_PNPM_CANNOT_RESOLVE_WORKSPACE_PROTOCOL`, which
 * `PackedInstall.run` reports as a `PackFailed` error naming the missing
 * install.
 *
 * @public
 */
export type PackSource = "source" | { readonly directory: string };

/**
 * What decides the set of packages a packed install packs: the options
 * {@link PackedInstall.closure} and {@link PackedInstall.run} share.
 *
 * **Details**
 *
 * The run's options satisfy this interface, so
 * `PackedInstall.closure(options.carrier, options)` answers for exactly the
 * run those options describe.
 *
 * @public
 */
export interface PackedInstallClosureOptions {
	/**
	 * The other workspace packages to pack and override; `"auto"` is the
	 * carrier's transitive runtime workspace dependencies (`dependencies`,
	 * `optionalDependencies`, `peerDependencies`). `PackedInstall.closure`
	 * defaults it to `"auto"`.
	 */
	readonly closure?: ReadonlyArray<string> | "auto" | undefined;
	/**
  * Packages from outside the workspace that replace registry resolution in
  * every scratch consumer: package name to a local package directory or a
  * `.tgz`, with or without a `file:` prefix.
  *
  * **Details**
  *
  * For a closure member that imports a surface of a dependency existing
  * only in a sibling checkout's unreleased build, which the registry's copy
  * lacks. A directory is `npm pack`ed, so it must be
  * publish-ready (for a package built by `@savvy-web/bundler`, its
  * `dist/prod/npm/pkg`); a `.tgz` is used as it is. Either way the packed
  * manifest must be named as its key, carry no specifier only a workspace
  * could resolve, and it joins `PackedInstallResult.tarballs`. Each
  * consumer steers the package to that tarball through the same override
  * field as the closure (npm's and bun's `overrides`, Yarn's `resolutions`,
  * pnpm's `overrides` in `pnpm-workspace.yaml`), so the carrier's
  * transitive references resolve to it too, whatever range they ask for.
  *
  * A relative path resolves against the workspace root. A key naming the
  * carrier or a closure member, a path that is neither a directory with a
  * `package.json` nor a `.tgz` file, or a manifest named otherwise fails
  * `InvalidOverride`. Entries here win over `workspaceOverrides` ones.
  */
	readonly overrides?: Readonly<Record<string, string>> | undefined;
	/**
	 * Also read the workspace root's `pnpm-workspace.yaml` and take every
	 * `overrides:` entry of the link shape `"@scope/name": "file:<dir>"` as if
	 * passed through `overrides`: the linked sibling builds the workspace itself
	 * installs. Entries that are not `file:`, or
	 * whose key carries a selector (`a>b`, `a@1`), are left out. A root with
	 * no readable `pnpm-workspace.yaml`, or one that is not YAML, fails
	 * `InvalidOverride`.
	 */
	readonly workspaceOverrides?: boolean | undefined;
}

/**
 * Options for {@link PackedInstall.run}.
 *
 * @public
 */
export interface PackedInstallOptions extends PackedInstallClosureOptions {
	/** The carrier: a direct dependency of each scratch consumer, beside only `consumerDependencies`. */
	readonly carrier: string;
	/** The other workspace packages to pack and override; `"auto"` is the carrier's transitive runtime workspace dependencies. */
	readonly closure: ReadonlyArray<string> | "auto";
	/**
	 * The package managers to install with; each is used only if it answers
	 * `--version`. A manager listed twice is installed once; an empty list
	 * fails `NoManagerAvailable`.
	 */
	readonly managers: ReadonlyArray<PackageManagerName>;
	/** `"all"` fails if any listed manager is unavailable; `"any"` (the default) needs one. */
	readonly require?: "all" | "any" | undefined;
	/**
	 * Where to pack from. Defaults to `{ directory: "dist/prod/npm/pkg" }`, the
	 * published artifact; see {@link PackSource} for what `"source"` costs.
	 */
	readonly packFrom?: PackSource | undefined;
	/**
  * Bin names every consumer must expose, executable, in `node_modules/.bin`.
  *
  * **Gotchas**
  *
  * By default only the carrier may declare them. Whatever this lists, a
  * packed package other than the carrier that declares one of the
  * carrier's own bin names fails `BinConflict` before any install, unless
  * `allowSharedBins` is set: under a flat layout (npm, bun,
  * Yarn's `node-modules` linker) either package can take the `.bin` slot,
  * so the bin check and every bin run could pass on the wrong package.
  *
  * The check compares packed packages only (the carrier, the closure and
  * `overrides`), reading each manifest's `bin` field; it does not read
  * `directories.bin`, and a dependency installed from the registry that
  * declares the same bin name goes undetected.
  */
	readonly bins: ReadonlyArray<string>;
	/**
  * Skip the `BinConflict` check: the front ends declare the carrier's bin
  * names too, deliberately.
  *
  * **Gotchas**
  *
  * A supported, permanent choice for a carrier whose front ends are also
  * installed and run on their own, and a stopgap for one migrating to
  * carrier-only bins. Its cost is provenance: under npm, bun and Yarn's
  * `node-modules` linker, either package can take the `.bin` slot (npm and
  * bun were observed to link the package whose name sorts first, which for
  * a `cli` front end and a `plugin` carrier is the front end; Yarn 1 and 4
  * were observed to keep the carrier's, the consumer's direct dependency),
  * and the bin that runs then carries no distribution identity: no
  * `--version` suffix.
  * When every shared bin calls the same `main()`, nothing else changes.
  *
  * Every expected bin in `bins` is still verified present and executable,
  * but that check, and `runBin`, can pass on the front end's bin. Prove the
  * carrier's own shim with `InstalledConsumer.runCarrierBin`, and read who
  * owns the slot with `InstalledConsumer.binProvenance`. Defaults to
  * `false`, so sharing is an explicit choice.
  */
	readonly allowSharedBins?: boolean | undefined;
	/**
	 * The environment for every spawn: pass `process.env` from the test file, the edge that supplies the host
	 * environment. It is taken whole because the parent manager's context is stripped by prefix (`npm_*`,
	 * `pnpm_config_*`, `yarn_*`), which `Config`, reading keys by name, cannot enumerate; read single keys such as
	 * `CI` through `Config`.
	 */
	readonly env: Readonly<Record<string, string | undefined>>;
	/**
  * Extra consumer dependencies, name to range or `file:` tarball spec.
  *
  * **Gotchas**
  *
  * Declare here every package the consumer's own code imports directly
  * other than the carrier. pnpm's isolated layout links only the consumer's
  * declared dependencies at its top level, so a closure package reached only
  * through the carrier's peers or the overrides resolves inside the carrier
  * but fails `ERR_MODULE_NOT_FOUND` when imported from the consumer root,
  * while npm and bun hoist it and pass. That is a property of the consumer,
  * not of the pack.
  *
  * An entry naming a packed package (the carrier, a closure member or an
  * `overrides` package) is written as that package's `file:` tarball,
  * whatever spec you pass, so any range will do: the packed tarball always
  * wins. npm fails an install whose direct spec differs from its override
  * (`EOVERRIDE`), so a range written through unchanged would break every
  * npm consumer.
  */
	readonly consumerDependencies?: Readonly<Record<string, string>> | undefined;
	/** Ceiling on each install. Defaults to four minutes. Expiry fails `InstallFailed` with a message naming the manager and this duration. */
	readonly installTimeout?: Duration.Input | undefined;
	/**
	 * Ceiling on each package's pack. Defaults to two minutes. Expiry fails
	 * `PackFailed` with a message naming the package and this duration. Pass
	 * the same value to {@link PackedInstall.timeoutBudget}.
	 */
	readonly packTimeout?: Duration.Input | undefined;
}

/**
 * Why a packed install could not be proven.
 *
 * @public
 */
export class PackedInstallError extends S.TaggedError<PackedInstallError>($I`PackedInstallError`)("PackedInstallError", {
	/** What failed. */
	reason: S.Literals([
		"UnsupportedPlatform",
		"NoManagerAvailable",
		"ManagerUnavailable",
		"UnknownPackage",
		"PackSourceMissing",
		"PackFailed",
		"UnresolvedProtocol",
		"InvalidOverride",
		"BinConflict",
		"InstallFailed",
		"MissingBin",
		"BinFailed",
		"UnownedBin",
		"Discovery",
		"Io",
	]).annotateKey({ description: "What failed." }),
	/** One line, naming the package or manager involved. */
	message: S.String.annotateKey({ description: "One line, naming the package or manager involved." }),
	/** The package manager involved. */
	manager: S.optionalKey(PackageManagerName).annotateKey({ description: "The package manager involved." }),
	/** The workspace package involved. */
	package: S.optionalKey(S.String).annotateKey({ description: "The workspace package involved." }),
	/** The tail of the failing command's output. */
	output: S.optionalKey(S.String).annotateKey({ description: "The tail of the failing command's output." }),
	/** The originating failure. */
	cause: S.optionalKey(S.Defect()).annotateKey({ description: "The originating failure." }),
}, $I.annote("PackedInstallError", { description: "Why a packed install could not be proven." })) {}

/**
 * Options for {@link InstalledConsumer.command}: how the bin's environment
 * and working directory are built.
 *
 * @public
 */
export interface BinCommandOptions {
	/**
	 * Variables layered over the environment the install ran under, such as an
	 * `XDG_DATA_HOME` inside `PackedInstallResult.scratch`. A key set to
	 * `undefined` removes that variable. They are applied after the parent
	 * manager's context is stripped, so an explicit entry always wins: pass
	 * `CI: "true"` to run a bin as if under CI.
	 */
	readonly env?: Readonly<Record<string, string | undefined>> | undefined;
	/** The working directory. Defaults to the consumer's `directory`. */
	readonly cwd?: string | undefined;
}

/**
 * Options for {@link InstalledConsumer.runBin}.
 *
 * @public
 */
export interface RunBinOptions extends BinCommandOptions {
	/** Ceiling on the run. Defaults to one minute. Expiry fails `BinFailed` with a message naming the bin and this duration. */
	readonly timeout?: Duration.Input | undefined;
	/**
  * What to write to the bin's stdin, which is then closed: a string (UTF-8
  * encoded), bytes, or a byte stream for input that must arrive in pieces,
  * such as a framed LSP session.
  *
  * **Details**
  *
  * Omitted or `""`, the bin's stdin is the null device: it reads end of
  * input immediately, never an open pipe, so a bin that reads stdin exits
  * instead of hanging until the ceiling. Empty bytes and an empty stream
  * are sent as given: the bin sees an ended, empty input. A bin that answers
  * only after the input is complete is driven by this option; one that must
  * be interleaved with its output is driven through
  * {@link InstalledConsumer.command} or {@link InstalledConsumer.carrierCommand},
  * which leave stdin open.
  */
	readonly stdin?: string | Uint8Array | Stream.Stream<Uint8Array, PlatformError.PlatformError> | undefined;
}

const DEFAULT_BIN_TIMEOUT: Duration.Input = "1 minute";

/**
 * Whether a failed `readLink` means "this entry is not a symlink". Node reports
 * that as `EINVAL`, which its platform layer tags `Unknown` with the errno on
 * the cause, and `@effected/memfs` raises the same shape. Anything else,
 * `PermissionDenied` and `BadResource` included, is a real failure.
 */
const isNotALink = (error: PlatformError.PlatformError): boolean =>
	error.reason._tag === "Unknown" &&
	P.isObjectKeyword(error.reason.cause) &&
	!P.isFunction(error.reason.cause) &&
	("code" in error.reason.cause ? error.reason.cause.code : undefined) === "EINVAL";

/**
 * Which installed package a `node_modules/.bin` symlink resolves into.
 *
 * @public
 */
export interface BinProvenance {
	/** The `name` from the nearest `package.json` above the link's target. */
	readonly package: string;
	/** The link's target, realpath'd. */
	readonly target: string;
}

/**
 * One scratch project, outside the workspace, with the carrier installed.
 *
 * @public
 */
export class InstalledConsumer extends S.Class<InstalledConsumer>($I`InstalledConsumer`)({
	/** The package manager that installed it. */
	manager: PackageManagerName.annotateKey({ description: "The package manager that installed it." }),
	/** The version it reported and was pinned to. */
	managerVersion: S.String.annotateKey({ description: "The version it reported and was pinned to." }),
	/** The consumer project directory (realpath'd). */
	directory: S.String.annotateKey({ description: "The consumer project directory (realpath'd)." }),
	/**
	 * The scrubbed environment the install ran under, which {@link InstalledConsumer.runBin}
	 * starts from. Redacted, so printing a consumer never prints a token.
	 * `PackedInstall.run` always sets it; a hand-made consumer without it runs
	 * its bins under only `RunBinOptions.env`.
	 */
	env: S.Record(S.String, S.String).pipe(S.Redacted, S.optionalKey).annotateKey({ description: "The scrubbed environment the install ran under, which InstalledConsumer.runBin starts from. Redacted, so printing a consumer never prints a token. `PackedInstall.run` always sets it; a hand-made consumer without it runs its bins under only `RunBinOptions.env`." }),
	/**
	 * The carrier the consumer depends on, which {@link InstalledConsumer.carrierCommand}
	 * resolves bins through. `PackedInstall.run` always sets it.
	 */
	carrier: S.optionalKey(S.String).annotateKey({ description: "The carrier the consumer depends on, which InstalledConsumer.carrierCommand resolves bins through. `PackedInstall.run` always sets it." }),
}, $I.annote("InstalledConsumer", { description: "One scratch project, outside the workspace, with the carrier installed." })) {
	/** The installed bin `name`, in `node_modules/.bin`. POSIX: `PackedInstall` runs only there. */
	binPath(name: string): string {
		return `${this.directory}/node_modules/.bin/${name}`;
	}

	/**
  * Which installed package the `node_modules/.bin` entry `name` resolves into.
  *
  * **Details**
  *
  * Under a flat layout (npm, bun, and Yarn with the `node-modules` linker
  * this run configures), a hoisted bin of the same name from another package
  * can shadow the carrier's, and running it cannot tell you which one ran.
  * Those managers write each `.bin` entry as a symlink, so this reads the
  * link, realpaths its target, and walks up to the nearest `package.json`
  * with a string `name`, staying inside the consumer directory (itself
  * realpath'd first, so a `/var` alias of `/private/var` or a trailing
  * slash does not move the bound). A manifest that is valid JSON but not an
  * object, or has no string `name` (a `dist/package.json` carrying only
  * `type`), is passed over. Assert `package` is your carrier.
  *
  * `undefined` means one thing: the entry exists and is not a symlink.
  * pnpm writes `.bin` entries as shell shims, whose target this does not
  * parse; its isolated layout links only the consumer's direct dependencies
  * at the top level, so a shadowing bin needs a direct dependency there.
  *
  * An entry that does not exist, or a link whose target does not, fails
  * `MissingBin`. A link into no named package inside the consumer fails
  * `UnownedBin`, naming the target. Any other read failure, a
  * `package.json` that is not JSON included, fails `Io`.
  *
  * @param name - The bin, as named in `node_modules/.bin`.
  */
	binProvenance(
		name: string,
	): Effect.Effect<BinProvenance | undefined, PackedInstallError, FileSystem.FileSystem | Path.Path> {
		const bin = this.binPath(name);
		const directory = this.directory;
		const manager = this.manager;
		const entry = `node_modules/.bin/${name}`;
		return binProvenance(bin, directory, manager, entry);
	}

	/**
  * The command {@link InstalledConsumer.runBin} spawns for the bin `name`,
  * for a caller that drives the child itself, such as `McpProbe.initialize`
  * from `@effected/mcp/testing`.
  *
  * **Details**
  *
  * {@link InstalledConsumer.binPath}, from the consumer's directory, under
  * the install's scrubbed environment with `options.env` layered over it
  * after the scrub, and nothing inherited beyond that. `runBin` builds its
  * command here and then ignores stdin; this one leaves stdin as the
  * spawner's default pipe, so a probe can write to it. Spawn it inside the
  * scope that ran `PackedInstall.run`: the scratch directory is removed
  * when that scope closes.
  *
  * **Example** (Initialize an MCP probe from an installed bin)
  *
  * ```ts
  * import { McpProbe } from "@effected/mcp/testing";
  * import type { InstalledConsumer } from "./testing.ts";
  *
  * declare const consumer: InstalledConsumer;
  * declare const xdg: string;
  *
  * const probe = McpProbe.initialize(consumer.command("my-tool-mcp", [], { env: { XDG_DATA_HOME: xdg } }));
  * ```
  *
  * @param name - The bin, as named in `node_modules/.bin`.
  * @param args - Its arguments.
  * @param options - Extra environment and working directory.
  */
	command(
		name: string,
		args: ReadonlyArray<string> = [],
		options: BinCommandOptions = {},
	): ChildProcess.StandardCommand {
		return ChildProcess.make(this.binPath(name), args, {
			cwd: options.cwd ?? this.directory,
			env: layeredEnv(this, options),
			extendEnv: false,
		});
	}

	/**
  * Run the installed bin `name` to completion and collect what it wrote.
  *
  * **Details**
  *
  * Spawns {@link InstalledConsumer.command} with `options.stdin` as its
  * input (the null device when omitted, so a bin never waits on an open
  * pipe): the bin
  * from the consumer's directory, under the install's scrubbed environment
  * with `options.env` layered over it after the scrub, and nothing
  * inherited beyond that. A
  * non-zero exit is a result, read from `exitCode`, never a failure. A bin
  * that cannot spawn, outlives `options.timeout` or floods its output fails
  * `BinFailed` naming the manager and the bin. Run it inside the scope that
  * ran `PackedInstall.run`: the scratch directory is removed when that
  * scope closes.
  *
  * @param name - The bin, as named in `node_modules/.bin`.
  * @param args - Its arguments.
  * @param options - Extra environment, working directory, ceiling and stdin.
  */
	runBin(
		name: string,
		args: ReadonlyArray<string> = [],
		options: RunBinOptions = {},
	): Effect.Effect<CommandOutput, PackedInstallError, ChildProcessSpawner.ChildProcessSpawner> {
		return collectBin(this.command(name, args, options), this.manager, name, options);
	}

	/**
  * The command that runs the CARRIER's own bin `name`, whichever package
  * won the `node_modules/.bin` slot.
  *
  * **Gotchas**
  *
  * With `allowSharedBins`, a flat layout (npm, bun, Yarn's `node-modules`
  * linker) can link a front end's same-named bin into `.bin`, so
  * {@link InstalledConsumer.runBin} proves only that SOME package's bin runs.
  * This reads the carrier's installed `node_modules/<carrier>/package.json`,
  * takes `name` from its `bin` map (a `bin` string answers to the unscoped
  * package name), and returns `node <that file> ...args`: the carrier's shim
  * itself, run by the `node` on the environment's `PATH`.
  *
  * Running it through `node` has three limits. It assumes a Node script, so
  * a non-Node shim misruns. It drops any flags in the shim's shebang (a
  * `#!/usr/bin/env -S node --enable-source-maps` runs without them). And it
  * bypasses the file's executable bit, so under shared bins it does not
  * prove the carrier's shim is executable, only that it runs: the manager
  * that linked a front end's bin into the slot may never have made the
  * carrier's target executable. Environment and working directory are built as
  * {@link InstalledConsumer.command} builds them, stdin left open for a probe
  * such as `McpProbe.initialize`.
  *
  * A consumer with no `carrier`, a carrier that is not installed or does not
  * declare `name`, or a declared file that does not exist fails
  * `MissingBin`; a manifest that cannot be read or is not JSON fails `Io`.
  *
  * @param name - The bin, as the carrier's `bin` map names it.
  * @param args - Its arguments.
  * @param options - Extra environment and working directory.
  */
	carrierCommand(
		name: string,
		args: ReadonlyArray<string> = [],
		options: BinCommandOptions = {},
	): Effect.Effect<ChildProcess.StandardCommand, PackedInstallError, FileSystem.FileSystem | Path.Path> {
		const consumer = this;
		const manager = this.manager;
		return carrierCommand(consumer, manager, name, args, options);
	}

	/**
  * Run the carrier's own bin `name` to completion, whichever package won
  * the `node_modules/.bin` slot.
  *
  * **Details**
  *
  * Spawns {@link InstalledConsumer.carrierCommand} with `options.stdin` as
  * its input (the null device when omitted), and
  * reports as {@link InstalledConsumer.runBin} does: a non-zero exit is a
  * result, and a bin that cannot spawn or outlives `options.timeout` (one
  * minute by default) fails `BinFailed`. Use it beside `runBin` under
  * `allowSharedBins`: `runBin` proves what a user typing the bin name gets,
  * this proves the carrier's shim itself works, within `carrierCommand`'s
  * limits (a Node script, shebang flags dropped, executable bit not
  * checked).
  *
  * @param name - The bin, as the carrier's `bin` map names it.
  * @param args - Its arguments.
  * @param options - Extra environment, working directory, ceiling and stdin.
  */
	runCarrierBin(
		name: string,
		args: ReadonlyArray<string> = [],
		options: RunBinOptions = {},
	): Effect.Effect<
		CommandOutput,
		PackedInstallError,
		FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
	> {
		const manager = this.manager;
		return this.carrierCommand(name, args, options).pipe(
			Effect.flatMap((command) => collectBin(command, manager, name, options)),
		);
	}
}

/** The install's scrubbed environment with the caller's entries layered on after the scrub: a deliberate CI=true must survive it. */
const layeredEnv = (consumer: InstalledConsumer, options: BinCommandOptions): Record<string, string> => {
	const env = scrubEnv(consumer.env === undefined ? {} : Redacted.value(consumer.env));
	for (const [key, value] of R.toEntries(options.env ?? {})) {
		if (value === undefined) delete env[key];
		else env[key] = value;
	}
	return env;
};

/** A bin's stdin as `ChildProcess` takes it: absent or `""` is the null device (immediate end of input), anything else is written and closed. */
const stdinOf = (stdin: RunBinOptions["stdin"]): ChildProcess.CommandInput => {
	if (stdin === undefined || stdin === "") return "ignore";
	if (P.isString(stdin)) return Stream.make(new TextEncoder().encode(stdin));
	if (stdin instanceof Uint8Array) return Stream.make(stdin);
	return stdin;
};

/** Run a bin's command to completion with `options.stdin` as its input (the null device when omitted), mapping a failed spawn or an expired ceiling to `BinFailed`. */
const collectBin = (
	command: ChildProcess.StandardCommand,
	manager: PackageManagerName,
	name: string,
	options: RunBinOptions,
): Effect.Effect<CommandOutput, PackedInstallError, ChildProcessSpawner.ChildProcessSpawner> => {
	const timeout = options.timeout ?? DEFAULT_BIN_TIMEOUT;
	return Run.collect(
		ChildProcess.make(command.command, command.args, { ...command.options, stdin: stdinOf(options.stdin) }),
		{ timeout },
	).pipe(
		Effect.mapError((cause) =>
			failure(
				"BinFailed",
				cause._tag === "CommandFailedError" && cause.kind === "timeout"
					? `${manager}: ${name} timed out after ${describeDuration(timeout)}`
					: `${manager}: ${name} could not run`,
				{ manager, cause },
			),
		),
	);
};

/**
 * What a packed install produced.
 *
 * @public
 */
export class PackedInstallResult extends S.Class<PackedInstallResult>($I`PackedInstallResult`)({
	/** One consumer per available manager, in the order requested. */
	consumers: S.Array(InstalledConsumer).annotateKey({ description: "One consumer per available manager, in the order requested." }),
	/** The requested managers that did not answer `--version`. */
	unavailable: S.Array(PackageManagerName).annotateKey({ description: "The requested managers that did not answer `--version`." }),
	/** Every packed package: name to absolute tarball path. */
	tarballs: S.Record(S.String, S.String).annotateKey({ description: "Every packed package: name to absolute tarball path." }),
	/**
	 * The scratch root (realpath'd) holding the tarballs and every consumer.
	 * It is removed when the scope that ran `PackedInstall.run` closes, so a
	 * directory made under it, such as an `XDG_DATA_HOME` for the bins, is
	 * cleaned up with it.
	 */
	scratch: S.String.annotateKey({ description: "The scratch root (realpath'd) holding the tarballs and every consumer. It is removed when the scope that ran `PackedInstall.run` closes, so a directory made under it, such as an `XDG_DATA_HOME` for the bins, is cleaned up with it." }),
}, $I.annote("PackedInstallResult", { description: "What a packed install produced." })) {}

/**
 * What {@link PackedInstall.timeoutBudget} adds up.
 *
 * @public
 */
export interface PackedInstallBudget {
	/** The managers the run requests; one listed twice counts once. */
	readonly managers: ReadonlyArray<PackageManagerName>;
	/** The run's `installTimeout`. Defaults to four minutes, as the run does. */
	readonly installTimeout?: Duration.Input | undefined;
	/** The run's `packTimeout`. Defaults to two minutes, as the run does. */
	readonly packTimeout?: Duration.Input | undefined;
	/**
	 * What the run packs: a count, or the names {@link PackedInstall.closure}
	 * returns for the run's options, which are exactly the keys of
	 * `PackedInstallResult.tarballs`.
	 */
	readonly packages: number | ReadonlyArray<string>;
	/**
	 * What the test does with each consumer afterwards, such as its bin runs'
	 * ceilings. Defaults to one minute: one {@link InstalledConsumer.runBin}
	 * at its default ceiling. Add a minute per further `runBin`, and pass
	 * `"0 seconds"` for a test that only installs.
	 */
	readonly perConsumer?: Duration.Input | undefined;
}

/**
 * Options for {@link PackedInstall.preflight}: the run's closure and pack
 * source, so the check answers for exactly the run those options describe.
 *
 * @public
 */
export interface PackedInstallPreflightOptions extends PackedInstallClosureOptions {
	/** The carrier, as the run's `carrier`. */
	readonly carrier: string;
	/** Where the run packs from; defaults as the run's does, to `{ directory: "dist/prod/npm/pkg" }`. */
	readonly packFrom?: PackSource | undefined;
}

/**
 * Whether the pack source a run needs is on disk.
 *
 * @public
 */
export interface PackedInstallPreflight {
	/** `true` when every package the run packs has its pack source in place. */
	readonly ready: boolean;
	/** The absolute `package.json` paths that do not exist, in pack order; empty exactly when `ready`. */
	readonly missing: ReadonlyArray<string>;
}

/**
 * What a test suite should do about a {@link PackedInstallPreflight}.
 *
 * @public
 */
export interface PackedInstallGate {
	/**
	 * `"run"` when the pack source is there; `"skip"` when it is missing and
	 * the run is not under CI; `"fail"` when it is missing under CI.
	 */
	readonly action: "run" | "skip" | "fail";
	/** Why, naming the missing paths and the build to run. Empty when `action` is `"run"`. */
	readonly message: string;
}

// npm-packing the prod output is byte-identical to the published tarball;
// pnpm-packing the source packs the dev build.
const DEFAULT_PACK_FROM: PackSource = { directory: "dist/prod/npm/pkg" };
const WORKSPACE_PROTOCOL_NOT_INSTALLED = "ERR_PNPM_CANNOT_RESOLVE_WORKSPACE_PROTOCOL";
const TAIL = 2000;
const tail = (text: string): string => (text.length <= TAIL ? text : text.slice(-TAIL));
const DEFAULT_INSTALL_TIMEOUT: Duration.Input = "4 minutes";
const PROBE_TIMEOUT: Duration.Input = "30 seconds";
const DEFAULT_PACK_TIMEOUT: Duration.Input = "2 minutes";
const MANIFEST_TIMEOUT: Duration.Input = "30 seconds";
/** The untimed steps a budget allows for: discovery, the consumer files and the bin checks. */
const UNTIMED_SLACK: Duration.Input = "30 seconds";
/**
 * Cleanup a budget allows for: removing the scratch root, every consumer's
 * `node_modules` included, when the scope closes, and killing and reaping a
 * child after its ceiling interrupts it.
 */
const CLEANUP_ALLOWANCE: Duration.Input = "1 minute";
/** A ceiling as a person reads it: `"4m"` for `"4 minutes"`, the raw input if it does not decode. */
const describeDuration = (input: Duration.Input): string =>
	O.match(Duration.fromInput(input), { onNone: () => String(input), onSome: Duration.format });

const failure = (
	reason: PackedInstallError["reason"],
	message: string,
	extra: { manager?: PackageManagerName; package?: string; output?: string; cause?: unknown } = {},
): PackedInstallError => PackedInstallError.make({ reason, message, ...extra });

/** A package from outside the workspace that replaces registry resolution: where it is and how to get a tarball of it. */
const ReplacementKind = LiteralKit(["directory", "tarball"]).annotate(
	$I.annote("ReplacementKind", { description: "Whether a replacement is packed from a directory or uses an existing tarball." }),
);

const Replacement = S.Struct({
	name: S.String.annotate({ description: "The package name the replacement must pack." }),
	source: S.String.annotate({ description: "The absolute, realpath-resolved replacement source." }),
	kind: ReplacementKind,
}).annotate($I.annote("Replacement", { description: "An external package source replacing registry resolution." }));

type Replacement = typeof Replacement.Type;

/** Everything a run packs, in the order it packs it: the carrier, the rest of the closure, then the replacements by name. */
const ClosurePlan = S.Struct({
	closure: S.Array(WorkspacePackage).annotate({ description: "The carrier followed by the remaining workspace closure, in pack order." }),
	replacements: S.Array(Replacement).annotate({ description: "External replacements in package-name order, packed after the workspace closure." }),
}).annotate($I.annote("ClosurePlan", { description: "The ordered workspace closure and external replacements a run packs." }));

type ClosurePlan = typeof ClosurePlan.Type;

const namesOf = (plan: ClosurePlan): ReadonlyArray<string> => [
	...plan.closure.map((pkg) => pkg.name),
	...plan.replacements.map((replacement) => replacement.name),
];

/**
 * The one implementation of "what does this run pack", behind both
 * `PackedInstall.closure` and `PackedInstall.run`, so the two cannot drift.
 */
const planClosure = Effect.fn("planClosure")(function* (carrier: string, options: PackedInstallClosureOptions) {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const discovery = yield* WorkspaceDiscovery;
		const discoveryFailed = (cause: unknown) => failure("Discovery", "workspace discovery failed", { cause });
		const packages = yield* discovery.listPackages.pipe(Effect.mapError(discoveryFailed));
		const closure = closureOf(packages, carrier, options.closure ?? "auto");
		if (Result.isFailure(closure)) {
			return yield* failure("UnknownPackage", `${closure.failure} is not a package of this workspace`, {
				package: closure.failure,
			});
		}

		const requested = R.toEntries(options.overrides ?? {}).map(
			([name, spec]) => [name, overridePath(spec)] as const,
		);
		// The root is read only when something needs it: a double that answers only listPackages still plans.
		const needsRoot = options.workspaceOverrides === true || requested.some(([, spec]) => !path.isAbsolute(spec));
		const root = needsRoot ? (yield* discovery.info.pipe(Effect.mapError(discoveryFailed))).root : "/";
		const wanted = MutableHashMap.empty<string, string>();
		if (options.workspaceOverrides === true) {
			const file = path.join(root, "pnpm-workspace.yaml");
			const text = yield* fs
				.readFileString(file)
				.pipe(
					Effect.mapError((cause) =>
						failure("InvalidOverride", `workspaceOverrides reads ${file}, which could not be read`, { cause }),
					),
				);
			const document = yield* Yaml.parse(text).pipe(
				Effect.mapError((cause) => failure("InvalidOverride", `${file} is not valid YAML`, { cause })),
			);
			for (const [name, spec] of R.toEntries(fileOverridesOf(document))) MutableHashMap.set(wanted, name, spec);
		}
		for (const [name, spec] of requested) MutableHashMap.set(wanted, name, spec);

		const packed = MutableHashSet.fromIterable(closure.success.map((pkg) => pkg.name));
		const replacements: Array<Replacement> = [];
		for (const name of pipe(wanted, MutableHashMap.keys, A.fromIterable, A.sort(Str.Order))) {
			const invalid = (message: string, cause?: unknown) =>
				failure("InvalidOverride", `override ${name}: ${message}`, {
					package: name,
					...O.getSomesStruct({ cause: O.fromUndefinedOr(cause) }),
				});
			if (MutableHashSet.has(packed, name)) {
				return yield* invalid(
					`${name === carrier ? "the carrier" : "a closure member"} is always packed from the workspace; overrides replace only packages outside it`,
				);
			}
			const spec = O.getOrElse(MutableHashMap.get(wanted, name), () => "");
			const absolute = path.isAbsolute(spec) ? spec : path.resolve(root, spec);
			const source = yield* fs
				.realPath(absolute)
				.pipe(
					Effect.catch((error) =>
						error.reason._tag === "NotFound"
							? Effect.fail(invalid(`${absolute} does not exist`))
							: Effect.fail(failure("Io", `could not resolve ${absolute}`, { package: name, cause: error })),
					),
				);
			const info = yield* fs
				.stat(source)
				.pipe(Effect.mapError((cause) => failure("Io", `could not inspect ${source}`, { package: name, cause })));
			if (info.type === "Directory") {
				const manifest = path.join(source, "package.json");
				const built = yield* fs
					.exists(manifest)
					.pipe(Effect.mapError((cause) => failure("Io", `could not inspect ${manifest}`, { package: name, cause })));
				if (!built) return yield* invalid(`${source} has no package.json to pack`);
				replacements.push({ name, source, kind: "directory" });
			} else if (info.type === "File" && source.endsWith(".tgz")) {
				replacements.push({ name, source, kind: "tarball" });
			} else {
				return yield* invalid(`${source} is neither a package directory nor a .tgz`);
			}
		}
		return { closure: closure.success, replacements } satisfies ClosurePlan;
	});

/**
 * Prove a carrier's bins reach a consumer that is not part of the workspace,
 * once per available package manager.
 *
 * **Details**
 *
 * Packs the carrier and its closure into a scoped, realpath'd scratch
 * directory (so `file:` specs and the install cwd agree on macOS). Then, for
 * each manager that answers `--version` from that directory (so a corepack
 * pin in the repo cannot refuse it), it writes a consumer whose only direct
 * dependency is the carrier tarball, steers the closure to its tarballs
 * through the manager's own override field, pins the probed version (as
 * `packageManager`, or for pnpm as `devEngines.packageManager` with
 * `onFail: "ignore"`, since pnpm resolves a `packageManager` pin from the registry even
 * when it names the running version), installs with lifecycle scripts skipped,
 * and checks every
 * expected bin is present and executable. A packed manifest that still
 * carries `workspace:`, `catalog:`, `link:` or a relative `file:` specifier
 * fails `UnresolvedProtocol` before any install.
 *
 * It asserts nothing about what the bins DO: run them from the test through
 * `InstalledConsumer.runBin`, or for an MCP bin through `McpProbe` from
 * `@effected/mcp/testing` at `InstalledConsumer.binPath`, inside the same
 * scope, because the scratch directory (`PackedInstallResult.scratch`) is
 * removed when the scope closes. Size the test's outer timeout with
 * {@link PackedInstall.timeoutBudget}. POSIX only.
 *
 * **Example** (Install packed packages and run each consumer bin)
 *
 * ```ts
 * import { NodeServices } from "@effect/platform-node";
 * import { Workspaces } from "./index.ts";
 * import { PackedInstall } from "./testing.ts";
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
 *
 * const Live = Workspaces.layer({ cwd: "/repo" }).pipe(Layer.provideMerge(NodeServices.layer));
 *
 * // Use the consumers INSIDE the scope: closing it removes the scratch
 * // directory, so a binPath returned out of Effect.scoped points at nothing.
 * const program = Effect.gen(function* () {
 *   const result = yield* PackedInstall.run({
 *     carrier: "my-tool",
 *     closure: "auto",
 *     managers: ["npm", "pnpm"],
 *     bins: ["my-tool"],
 *     env: process.env,
 *   });
 *   // Keep the tool's data inside the scratch root, removed with it.
 *   const env = { XDG_DATA_HOME: `${result.scratch}/xdg` };
 *   for (const consumer of result.consumers) {
 *     const { stdout, exitCode } = yield* consumer.runBin("my-tool", ["--version"], { env });
 *     console.log(consumer.manager, exitCode, stdout.trim());
 *   }
 * }).pipe(Effect.scoped, Effect.provide(Live));
 * ```
 *
 * @public
 */
export class PackedInstall {
	private constructor() {}

	/** `env` without undefined values or the parent manager's context: the environment the installs run under. Reuse it to run the installed bins. */
	static readonly scrubEnv: (env: Readonly<Record<string, string | undefined>>) => Record<string, string> = scrubEnv;

	/**
  * The ceiling a test's outer timeout should cover so that every one of the
  * run's own ceilings fires first, as a named `PackedInstallError`, rather
  * than the outer guard's `TimeoutError` that names nothing.
  *
  * **Details**
  *
  * The worst case of the run's own ceilings, taken in sequence as the run
  * takes them: each manager's `--version` probe (30 seconds), install
  * (`installTimeout`) and `perConsumer` (one minute by default, one `runBin`
  * at its default ceiling), plus each package's pack
  * (`packTimeout`, two minutes by default) and manifest read (30 seconds),
  * plus 30 seconds for the untimed steps and one minute for cleanup:
  * removing the scratch root when the scope closes, and killing a child
  * whose ceiling interrupted it. It reads the same defaults the run does.
  * Pass `packages` as the names {@link PackedInstall.closure} returns to
  * size it before the run. A vitest test timeout must sit above it, since
  * vitest's own guard should not pre-empt the Effect's.
  *
  * **Example** (Calculate a packed-install timeout budget)
  *
  * ```ts
  * import { PackedInstall } from "./testing.ts";
  * import * as Duration from "effect/Duration";
  *
  * const budget = PackedInstall.timeoutBudget({
  *   managers: ["npm", "pnpm", "yarn", "bun"],
  *   installTimeout: "3 minutes",
  *   packTimeout: "30 seconds",
  *   packages: ["my-tool", "my-tool-cli", "my-tool-core"],
  *   perConsumer: "2 minutes",
  * });
  * console.log(Duration.format(budget));
  * // => 26m 30s
  * ```
  */
	static readonly timeoutBudget = (budget: PackedInstallBudget): Duration.Duration => {
		const perManager = [
			PROBE_TIMEOUT,
			budget.installTimeout ?? DEFAULT_INSTALL_TIMEOUT,
			budget.perConsumer ?? DEFAULT_BIN_TIMEOUT,
		]
			.map(Duration.fromInputUnsafe)
			.reduce((total, step) => Duration.sum(total, step), Duration.zero);
		const perPackage = Duration.sum(
			Duration.fromInputUnsafe(budget.packTimeout ?? DEFAULT_PACK_TIMEOUT),
			Duration.fromInputUnsafe(MANIFEST_TIMEOUT),
		);
		const packages = P.isNumber(budget.packages) ? budget.packages : budget.packages.length;
		return Duration.sum(
			Duration.sum(
				Duration.times(perManager, MutableHashSet.size(MutableHashSet.fromIterable(budget.managers))),
				Duration.times(perPackage, Math.max(1, packages)),
			),
			Duration.sum(Duration.fromInputUnsafe(UNTIMED_SLACK), Duration.fromInputUnsafe(CLEANUP_ALLOWANCE)),
		);
	};

	/**
  * The packages a run packs, in the order it packs them, without packing
  * anything: the carrier, the rest of the closure, then the `overrides`
  * packages by name.
  *
  * **Details**
  *
  * The same implementation {@link PackedInstall.run} plans with, so for the
  * same workspace and options the result equals the keys of
  * `PackedInstallResult.tarballs`, in order. `options.closure` defaults to
  * `"auto"`, and the run's own options object is accepted as it is. It
  * fails as the run would before packing: `UnknownPackage`, `Discovery`,
  * `InvalidOverride` or `Io`. Use it to size
  * {@link PackedInstall.timeoutBudget} before the test is declared.
  *
  * **Example** (Plan the package closure to size a timeout budget)
  *
  * ```ts
  * import { NodeServices } from "@effect/platform-node";
  * import { Workspaces } from "./index.ts";
  * import { PackedInstall } from "./testing.ts";
  * import * as Effect from "effect/Effect";
  * import * as Layer from "effect/Layer";
  *
  * const Live = Workspaces.layer({ cwd: "/repo" }).pipe(Layer.provideMerge(NodeServices.layer));
  * const packages = await Effect.runPromise(PackedInstall.closure("my-tool").pipe(Effect.provide(Live)));
  * const budget = PackedInstall.timeoutBudget({ managers: ["npm", "pnpm"], packages });
  * ```
  *
  * @param carrier - The carrier, as the run's `carrier`.
  * @param options - The closure and override options, as the run takes them.
  */
	static readonly closure = (
		carrier: string,
		options: PackedInstallClosureOptions = {},
	): Effect.Effect<ReadonlyArray<string>, PackedInstallError, WorkspaceDiscovery | FileSystem.FileSystem | Path.Path> =>
		planClosure(carrier, options).pipe(Effect.map(namesOf), Effect.withSpan("PackedInstall.closure"));

	/**
  * {@link PackedInstall.timeoutBudget} for exactly the run `options`
  * describes, planned from the options themselves.
  *
  * **Details**
  *
  * Plans the closure with {@link PackedInstall.closure} (the run's own
  * planner, `overrides` and `workspaceOverrides` included) and takes
  * `managers`, `installTimeout` and `packTimeout` from the same object, so
  * nothing is written twice. `perConsumer` is the one input a run's options
  * do not carry. It is an Effect because planning reads the workspace; in a
  * vitest file, await it at module evaluation, since a test's timeout is
  * fixed when the test is declared. Fails as `closure` does.
  *
  * **Example** (Derive a test timeout from packed-install options)
  *
  * ```ts
  * import { NodeServices } from "@effect/platform-node";
  * import { Workspaces } from "./index.ts";
  * import type { PackedInstallOptions } from "./testing.ts";
  * import { PackedInstall } from "./testing.ts";
  * import * as Duration from "effect/Duration";
  * import * as Effect from "effect/Effect";
  * import * as Layer from "effect/Layer";
  *
  * const Live = Workspaces.layer({ cwd: "/repo" }).pipe(Layer.provideMerge(NodeServices.layer));
  * const RUN: PackedInstallOptions = {
  *   carrier: "my-tool",
  *   closure: "auto",
  *   managers: ["npm", "pnpm"],
  *   bins: ["my-tool"],
  *   env: process.env,
  *   packTimeout: "30 seconds",
  * };
  * const budget = await Effect.runPromise(
  *   PackedInstall.timeoutBudgetFor(RUN, { perConsumer: "1 minute" }).pipe(Effect.provide(Live)),
  * );
  * const TEST_TIMEOUT_MS = Duration.toMillis(budget) + 60_000;
  * ```
  *
  * @param options - The run's options, the same object passed to `run`.
  * @param extra - What the test does with each consumer afterwards.
  */
	static readonly timeoutBudgetFor = (
		options: PackedInstallOptions,
		extra: { readonly perConsumer?: Duration.Input | undefined } = {},
	): Effect.Effect<Duration.Duration, PackedInstallError, WorkspaceDiscovery | FileSystem.FileSystem | Path.Path> =>
		PackedInstall.closure(options.carrier, options).pipe(
			Effect.map((packages) =>
				PackedInstall.timeoutBudget({
					managers: options.managers,
					packages,
					...O.getSomesStruct({ installTimeout: O.fromUndefinedOr(options.installTimeout) }),
					...O.getSomesStruct({ packTimeout: O.fromUndefinedOr(options.packTimeout) }),
					...O.getSomesStruct({ perConsumer: O.fromUndefinedOr(extra.perConsumer) }),
				}),
			),
		);

	/**
  * Whether the pack source {@link PackedInstall.run} would read is on disk,
  * before any package manager is spawned.
  *
  * **Details**
  *
  * Plans the closure as the run does (`PackedInstall.closure`'s planner) and
  * checks the `package.json` of each closure package under `packFrom`
  * (default `{ directory: "dist/prod/npm/pkg" }`), the same file whose
  * absence makes the run fail `PackSourceMissing`. Under `packFrom: "source"`
  * the packer builds nothing of its own, so nothing is checked and the
  * result is ready. A package a bundler's dev build produced is no
  * substitute: the prod output exists only after the prod build, which a
  * test job's usual `build:dev` pre-step does not run. Pair it with
  * {@link PackedInstall.gate} to skip locally and fail under CI.
  *
  * Fails as `closure` does, plus `Io` when a path cannot be inspected.
  *
  * **Example** (Check whether production pack sources exist)
  *
  * ```ts
  * import { NodeServices } from "@effect/platform-node";
  * import { Workspaces } from "./index.ts";
  * import { PackedInstall } from "./testing.ts";
  * import * as Effect from "effect/Effect";
  * import * as Layer from "effect/Layer";
  *
  * const Live = Workspaces.layer({ cwd: "/repo" }).pipe(Layer.provideMerge(NodeServices.layer));
  * const preflight = await Effect.runPromise(
  *   PackedInstall.preflight({ carrier: "my-tool", closure: "auto" }).pipe(Effect.provide(Live)),
  * );
  * console.log(preflight.ready, preflight.missing);
  * ```
  *
  * @param options - The run's carrier, closure, overrides and pack source.
  */
	static readonly preflight: (
		options: PackedInstallPreflightOptions,
	) => Effect.Effect<
		PackedInstallPreflight,
		PackedInstallError,
		WorkspaceDiscovery | FileSystem.FileSystem | Path.Path
	> = Effect.fn("PackedInstall.preflight")(function* (options: PackedInstallPreflightOptions) {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const plan = yield* planClosure(options.carrier, options);
		const source = options.packFrom ?? DEFAULT_PACK_FROM;
		if (source === "source") return { ready: true, missing: [] } satisfies PackedInstallPreflight;
		const missing: Array<string> = [];
		for (const pkg of plan.closure) {
			const manifest = path.join(pkg.path, source.directory, "package.json");
			const present = yield* fs
				.exists(manifest)
				.pipe(Effect.mapError((cause) => failure("Io", `could not inspect ${manifest}`, { cause })));
			if (!present) missing.push(manifest);
		}
		return { ready: missing.length === 0, missing } satisfies PackedInstallPreflight;
	});

	/**
  * Turns a {@link PackedInstallPreflight} into the suite's decision: run,
  * skip locally, or fail under CI.
  *
  * **Details**
  *
  * `CI` is read through `Config`, so the ambient `ConfigProvider` decides —
  * the process environment at a test file's top level, and whatever a test
  * provides in a test; nothing here reads `process`. `CI` counts as set when
  * it is present and not `""`, `"0"` or `"false"` (case-insensitive), and an
  * unreadable `CI` counts as unset. Ready is always `"run"`;
  * missing is `"skip"` off CI and `"fail"` on it, so a CI job that never ran
  * the prod build cannot pass by silently skipping the proof. The message
  * names every missing path. The test job must run the prod build
  * (`build:prod` for a `@savvy-web/bundler` package) before the packed-install
  * tests: a dev build leaves `dist/prod` absent.
  *
  * **Example** (Gate packed-install tests on preflight readiness)
  *
  * ```ts
  * import { assert, describe, it } from "@effect/vitest";
  * import { PackedInstall } from "./testing.ts";
  * import * as Effect from "effect/Effect";
  *
  * declare const preflight: { readonly ready: boolean; readonly missing: ReadonlyArray<string> };
  * const gate = Effect.runSync(PackedInstall.gate(preflight));
  *
  * describe.runIf(gate.action === "run")("packed install", () => {
  *   it("installs", () => {});
  * });
  * describe.runIf(gate.action === "fail")("packed install prod build", () => {
  *   it("exists", () => assert.fail(gate.message));
  * });
  * ```
  *
  * @param preflight - What {@link PackedInstall.preflight} answered.
  */
	static readonly gate = Effect.fn("gate")(function* (preflight: PackedInstallPreflight): Effect.fn.Return<PackedInstallGate> {
			if (preflight.ready) return { action: "run", message: "" } satisfies PackedInstallGate;
			const ci = yield* Config.option(Config.String("CI")).pipe(Effect.orElseSucceed(O.none<string>));
			const underCi = O.isSome(ci) && !["", "0", "false"].includes(ci.value.toLowerCase());
			const message = `the pack source is missing: ${preflight.missing.join(", ")}; run the prod build (build:prod) before the packed-install tests`;
			return (
				underCi
					? { action: "fail", message: `${message}; it must not be skipped under CI` }
					: { action: "skip", message }
			) satisfies PackedInstallGate;
		});

	/** Pack, then install under every available manager. */
	static readonly run = Effect.fn("PackedInstall.run")(function* (options: PackedInstallOptions) {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		if (path.sep !== "/") {
			return yield* failure(
				"UnsupportedPlatform",
				"PackedInstall drives POSIX .bin shims and tar; run it on macOS or Linux",
			);
		}
		// One consumer directory per manager: a manager listed twice is installed once.
		const managers = [...MutableHashSet.fromIterable(options.managers)];
		if (managers.length === 0) {
			return yield* failure(
				"NoManagerAvailable",
				"managers is empty: name at least one package manager to install with",
			);
		}
		const env = scrubEnv(options.env);
		const io = (message: string) => (cause: unknown) => failure("Io", message, { cause });
		const command = (executable: string, args: ReadonlyArray<string>, cwd: string) =>
			ChildProcess.make(executable, args, { cwd, env, extendEnv: false, stdin: "ignore" });

		const scratch = yield* fs.makeTempDirectoryScoped({ prefix: "effected-packed-install-" }).pipe(
			Effect.flatMap((directory) => fs.realPath(directory)),
			Effect.mapError(io("could not create the scratch directory")),
		);

		const probes = yield* Effect.forEach(managers, (manager) =>
			Run.collect(command(manager, ["--version"], scratch), { timeout: PROBE_TIMEOUT }).pipe(
				Effect.map((output) => (output.succeeded ? versionOf(output.stdout) : undefined)),
				Effect.orElseSucceed(() => undefined),
				Effect.map((version) => ({ manager, version })),
			),
		);
		const available = probes.flatMap(({ manager, version }) => (version === undefined ? [] : [{ manager, version }]));
		const unavailable = probes.flatMap(({ manager, version }) => (version === undefined ? [manager] : []));
		if (available.length === 0) {
			return yield* failure("NoManagerAvailable", `none of ${managers.join(", ")} answered --version from ${scratch}`);
		}
		const missing = unavailable[0];
		if (options.require === "all" && missing !== undefined) {
			return yield* failure("ManagerUnavailable", `${missing} is required but did not answer --version`, {
				manager: missing,
			});
		}

		const plan = yield* planClosure(options.carrier, options);

		const source = options.packFrom ?? DEFAULT_PACK_FROM;
		const packTimeout = options.packTimeout ?? DEFAULT_PACK_TIMEOUT;
		/** `npm pack` or `pnpm pack` in `cwd` into an empty `destination`; the one tarball it wrote. */
		const pack = Effect.fn("pack")(function* (name: string, cwd: string, packer: "npm" | "pnpm", destination: string) {
				yield* fs
					.makeDirectory(destination, { recursive: true })
					.pipe(Effect.mapError(io(`could not create ${destination}`)));
				const args =
					packer === "pnpm"
						? ["pack", "--pack-destination", destination, "--config.ignore-scripts=true"]
						: ["pack", "--ignore-scripts", "--pack-destination", destination];
				const output = yield* Run.collect(command(packer, args, cwd), { timeout: packTimeout }).pipe(
					Effect.mapError((cause) =>
						failure(
							"PackFailed",
							cause._tag === "CommandFailedError" && cause.kind === "timeout"
								? `${packer} pack timed out after ${describeDuration(packTimeout)} for ${name}`
								: `${packer} pack could not run for ${name}`,
							{ package: name, cause },
						),
					),
				);
				if (!output.succeeded) {
					const notInstalled =
						packer === "pnpm" && `${output.stdout}${output.stderr}`.includes(WORKSPACE_PROTOCOL_NOT_INSTALLED);
					return yield* failure(
						"PackFailed",
						notInstalled
							? `pnpm pack could not rewrite the workspace: specifiers of ${name} because the workspace is not installed; run pnpm install in the workspace first`
							: `${packer} pack exited ${output.exitCode} for ${name}`,
						// Both streams: a pnpm WARN banner on stderr must not hide the real error on stdout.
						{ package: name, output: tail(`${output.stdout}\n${output.stderr}`) },
					);
				}
				const found = (yield* fs
					.readDirectory(destination)
					.pipe(Effect.mapError(io(`could not list ${destination}`)))).filter((file) => file.endsWith(".tgz"));
				const [only] = found;
				if (only === undefined || found.length !== 1) {
					return yield* failure(
						"PackFailed",
						`expected exactly one tarball for ${name} in ${destination}, found ${found.length}`,
						{ package: name },
					);
				}
				return path.join(destination, only);
			});
		/** The packed manifest, read with `tar` from `cwd`, refused if only a workspace could resolve it. */
		const inspect = Effect.fn("inspect")(function* (name: string, tarball: string, cwd: string, workspace: boolean = false) {
				const text = yield* Run.text(command("tar", ["-xzOf", tarball, "package/package.json"], cwd), {
					timeout: MANIFEST_TIMEOUT,
				}).pipe(
					Effect.mapError((cause) =>
						failure("PackFailed", `could not read package/package.json out of ${tarball}`, { package: name, cause }),
					),
				);
				const manifest = readPackedManifest(text);
				if (Result.isFailure(manifest)) {
					return yield* failure("PackFailed", `the packed package.json of ${name} is not a JSON object`, {
						package: name,
						cause: manifest.failure,
					});
				}
				if (workspace && manifest.success.name !== name) {
					return yield* failure(
						"PackFailed",
						`${tarball} packs ${manifest.success.name ?? "a package with no name"}, not ${name}`,
						{ package: name },
					);
				}
				if (manifest.success.unresolved.length > 0) {
					return yield* failure(
						"UnresolvedProtocol",
						`${name}'s packed manifest still carries ${manifest.success.unresolved.join(", ")}, which no consumer outside the workspace can resolve; pack from "source" so pnpm rewrites workspace: and catalog:, or fix the build`,
						{ package: name },
					);
				}
				return manifest.success;
			});

		const packed: Array<{ readonly name: string; readonly tarball: string; readonly manifest: PackedManifest }> = [];
		for (const [index, pkg] of plan.closure.entries()) {
			const destination = path.join(scratch, "tarballs", String(index));
			const cwd = source === "source" ? pkg.path : path.join(pkg.path, source.directory);
			if (source !== "source") {
				const built = yield* fs
					.exists(path.join(cwd, "package.json"))
					.pipe(Effect.mapError(io(`could not inspect ${cwd}`)));
				if (!built) {
					return yield* failure(
						"PackSourceMissing",
						`${cwd} has no package.json; build ${pkg.name} before packing it`,
						{
							package: pkg.name,
						},
					);
				}
			}
			const tarball = yield* pack(pkg.name, cwd, source === "source" ? "pnpm" : "npm", destination);
			packed.push({ name: pkg.name, tarball, manifest: yield* inspect(pkg.name, tarball, destination, true) });
		}
		for (const [offset, replacement] of plan.replacements.entries()) {
			const destination = path.join(scratch, "tarballs", String(plan.closure.length + offset));
			// A directory is packed with npm like any publish-ready build; a tarball is used as it is.
			const tarball =
				replacement.kind === "tarball"
					? replacement.source
					: yield* pack(replacement.name, replacement.source, "npm", destination);
			const manifest = yield* inspect(replacement.name, tarball, scratch);
			if (manifest.name !== replacement.name) {
				return yield* failure(
					"InvalidOverride",
					`override ${replacement.name}: ${replacement.source} packs ${manifest.name ?? "a package with no name"}, not ${replacement.name}`,
					{ package: replacement.name },
				);
			}
			packed.push({ name: replacement.name, tarball, manifest });
		}
		const [carrier, ...rest] = packed;
		if (carrier === undefined)
			return yield* failure("UnknownPackage", `${options.carrier} was not packed`, { package: options.carrier });
		const conflict =
			options.allowSharedBins === true
				? undefined
				: binConflict(
						{ name: carrier.name, bins: carrier.manifest.bins },
						rest.map(({ name, manifest }) => ({ name, bins: manifest.bins })),
					);
		if (conflict !== undefined) {
			return yield* failure(
				"BinConflict",
				`${conflict.package} declares the bin ${conflict.bin}, which the carrier ${carrier.name} declares; under a flat layout (npm, bun, Yarn's node-modules linker) either can take node_modules/.bin/${conflict.bin} and the carrier's provenance is lost there; drop the bin from ${conflict.package}, or pass allowSharedBins: true to share it deliberately`,
				{ package: conflict.package },
			);
		}
		const overrides = R.fromEntries(rest.map(({ name, tarball }) => [name, tarball]));

		const consumers = yield* Effect.forEach(available, Effect.fnUntraced(function* ({ manager, version }) {
				const directory = path.join(scratch, `consumer-${manager}`);
				yield* fs
					.makeDirectory(directory, { recursive: true })
					.pipe(Effect.mapError(io(`could not create ${directory}`)));
				for (const { file, content } of consumerFiles({
					manager,
					version,
					carrier,
					overrides,
					dependencies: options.consumerDependencies ?? {},
				})) {
					yield* fs
						.writeFileString(path.join(directory, file), content)
						.pipe(Effect.mapError(io(`could not write ${file}`)));
				}
				const installTimeout = options.installTimeout ?? DEFAULT_INSTALL_TIMEOUT;
				const output = yield* Run.collect(command(manager, installArgs(manager, version), directory), {
					timeout: installTimeout,
				}).pipe(
					Effect.mapError((cause) =>
						failure(
							"InstallFailed",
							// A ceiling that fired is not a spawn that failed: say which, so a slow registry is not read as a missing binary.
							cause._tag === "CommandFailedError" && cause.kind === "timeout"
								? `${manager} install timed out after ${describeDuration(installTimeout)}`
								: `${manager} install could not run`,
							{ manager, cause },
						),
					),
				);
				if (!output.succeeded) {
					return yield* failure("InstallFailed", `${manager} install exited ${output.exitCode}`, {
						manager,
						output: tail(`${output.stdout}\n${output.stderr}`),
					});
				}
				const consumer = InstalledConsumer.make({
					manager,
					managerVersion: version,
					directory,
					env: Redacted.make(env),
					carrier: carrier.name,
				});
				for (const bin of options.bins) {
					const info = yield* Effect.option(fs.stat(consumer.binPath(bin)));
					if (O.isNone(info) || (info.value.mode & 0o111) === 0) {
						// What .bin DOES hold separates a wrong bin name from a link that never happened.
						const listing = yield* fs.readDirectory(path.join(directory, "node_modules", ".bin")).pipe(
							Effect.map((names) =>
								names.length === 0
									? "node_modules/.bin is empty"
									: `node_modules/.bin holds: ${A.sort(names, Str.Order).join(", ")}`,
							),
							Effect.orElseSucceed(() => "node_modules/.bin does not exist or cannot be listed"),
						);
						return yield* failure(
							"MissingBin",
							`${manager} installed ${options.carrier} but node_modules/.bin/${bin} is missing or not executable; ${listing}`,
							{ manager, package: options.carrier, output: listing },
						);
					}
				}
				return consumer;
			}),
		);

		return PackedInstallResult.make({
			consumers,
			unavailable,
			tarballs: R.fromEntries(packed.map(({ name, tarball }) => [name, tarball])),
			scratch,
		});
	});
}

const binProvenance = Effect.fn("binProvenance")(function* (bin: string, directory: string, manager: PackageManagerName, entry: string): Effect.fn.Return<BinProvenance | undefined, PackedInstallError, FileSystem.FileSystem | Path.Path> {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const io = (message: string) => (cause: unknown) => failure("Io", message, { manager, cause });
	const missing = (why: string) => failure("MissingBin", `${manager}: ${entry} ${why}`, { manager });
	const linked = yield* fs.readLink(bin).pipe(
		Effect.as(true),
		Effect.catch((error) =>
			isNotALink(error)
				? Effect.succeed(false)
				: error.reason._tag === "NotFound"
					? Effect.fail(missing("does not exist"))
					: error.pipe(io(`could not read the link ${bin}`), Effect.fail),
		),
	);
	if (!linked) {
		const present = yield* fs.exists(bin).pipe(Effect.mapError(io(`could not inspect ${bin}`)));
		if (!present) return yield* missing("does not exist");
		// A shim, not a link (pnpm writes these): its target is inside a script this does not parse.
		return undefined;
	}
	const target = yield* fs
		.realPath(bin)
		.pipe(
			Effect.catch((error) =>
				error.reason._tag === "NotFound"
					? Effect.fail(missing("is a link to nothing"))
					: error.pipe(io(`could not resolve ${bin}`), Effect.fail),
			),
		);
	const root = yield* fs.realPath(directory).pipe(Effect.mapError(io(`could not resolve ${directory}`)));
	for (let dir = path.dirname(target); dir.startsWith(`${root}/`); dir = path.dirname(dir)) {
		const manifest = path.join(dir, "package.json");
		if (!(yield* fs.exists(manifest).pipe(Effect.mapError(io(`could not inspect ${manifest}`))))) continue;
		const text = yield* fs.readFileString(manifest).pipe(Effect.mapError(io(`could not read ${manifest}`)));
		const parsed: unknown = yield* S.decodeEffect(JsonValue)(text).pipe(Effect.mapError(io(`${manifest} is not JSON`)));
		const named =
			P.isObjectKeyword(parsed) && !P.isFunction(parsed) && "name" in parsed ? parsed.name : undefined;
		if (P.isString(named)) return { package: named, target };
	}
	return yield* failure(
		"UnownedBin",
		`${manager}: ${entry} links to ${target}, which lies in no named package inside ${root}`,
		{ manager },
	);
});

const carrierCommand = Effect.fn("carrierCommand")(function* (consumer: InstalledConsumer, manager: PackageManagerName, name: string, args: ReadonlyArray<string>, options: BinCommandOptions): Effect.fn.Return<ChildProcess.StandardCommand, PackedInstallError, FileSystem.FileSystem | Path.Path> {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const missing = (why: string) =>
		failure("MissingBin", `${manager}: the carrier's bin ${name} ${why}`, {
			manager,
			...O.getSomesStruct({ package: O.fromUndefinedOr(consumer.carrier) }),
		});
	if (consumer.carrier === undefined) return yield* missing("cannot be found: this consumer records no carrier");
	const root = path.join(consumer.directory, "node_modules", ...consumer.carrier.split("/"));
	const manifestPath = path.join(root, "package.json");
	const text = yield* fs
		.readFileString(manifestPath)
		.pipe(
			Effect.catch((error) =>
				error.reason._tag === "NotFound"
					? Effect.fail(missing(`cannot be found: ${consumer.carrier} is not installed at ${root}`))
					: Effect.fail(failure("Io", `could not read ${manifestPath}`, { manager, cause: error })),
			),
		);
	const manifest = readPackedManifest(text);
	if (Result.isFailure(manifest)) {
		return yield* failure("Io", `${manifestPath} is not a JSON object`, { manager, cause: manifest.failure });
	}
	const target = binTargetOf(text, name);
	if (target === undefined) return yield* missing(`is not declared by ${consumer.carrier}`);
	const file = path.join(root, target);
	const present = yield* fs
		.exists(file)
		.pipe(Effect.mapError((cause) => failure("Io", `could not inspect ${file}`, { manager, cause })));
	if (!present) return yield* missing(`points at ${file}, which does not exist`);
	return ChildProcess.make("node", [file, ...args], {
		cwd: options.cwd ?? consumer.directory,
		env: layeredEnv(consumer, options),
		extendEnv: false,
	});
});
