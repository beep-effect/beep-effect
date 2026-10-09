import { LiteralKit } from "@beep/schema/LiteralKit";
import { $ScratchpadId } from "@beep/identity/packages";
import type * as Effect from "effect/Effect";
import * as Context from "effect/Context";
import * as Eff from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as S from "effect/Schema";
import * as ChildProcess from "effect/process/ChildProcess";

const $I = $ScratchpadId.create("effected/commands/LocalExec");

/**
 * The package managers whose project-local exec argv this package knows.
 *
 * **Details**
 *
 * Structurally identical to `@effected/workspaces`' `PackageManagerName` and
 * assigns freely to and from it — deliberately **not** an import, because this
 * package takes no `@effected` edges. The names are a four-value literal; the
 * *detection* of which one owns a directory is what
 * `@effected/workspaces` contributes, through {@link LocalExec}.
 *
 * **Example** (Validate a launcher)
 *
 * ```ts
 * import { Launcher } from "@beep/scratchpad/effected/commands/LocalExec";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(Launcher)("pnpm")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const Launcher = LiteralKit(["npm", "pnpm", "yarn", "bun"]).pipe($I.annoteSchema("Launcher", { description: "The package managers whose project-local exec argv this package knows." }));

/**
 * The decoded type of {@link (Launcher:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type Launcher = typeof Launcher.Type;

/**
 * The per-launcher argv prefix record: exec, dlx and script-runner.
 *
 * **Details**
 *
 * The return type of {@link LocalExec.prefixes} — exported so a consumer can
 * hold or pass the whole record without re-deriving its shape.
 *
 * **Example** (Decode launcher prefixes)
 *
 * ```ts
 * import { LauncherPrefixes, LocalExec } from "@beep/scratchpad/effected/commands/LocalExec";
 * import * as S from "effect/Schema";
 *
 * const prefixes = S.decodeUnknownSync(LauncherPrefixes)(LocalExec.prefixes("pnpm"));
 * console.log(prefixes.prefix.join(" ")) // pnpm exec
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const LauncherPrefixes = S.Struct({
 /** argv prefix that runs a project-local binary. */
 prefix: S.Array(S.String).annotateKey({ description: "argv for project-local execution." }),
 /** argv prefix that fetches and runs a package binary. */
 dlxPrefix: S.Array(S.String).annotateKey({ description: "argv for package fetch and execution." }),
 /** argv prefix that runs a package.json script. */
 scriptPrefix: S.Array(S.String).annotateKey({ description: "argv for package script execution." }),
}).pipe($I.annoteSchema("LauncherPrefixes", { description: "Per-launcher exec, dlx and script argv prefixes." }));
/**
 * Decoded exec, fetch-and-run and script-runner prefixes for a launcher.
 *
 * @category type-level
 * @since 0.0.0
 */
export type LauncherPrefixes = typeof LauncherPrefixes.Type;

/** The argv prefixes for each launcher. The one place this knowledge lives. */
const PREFIXES: Readonly<Record<Launcher, LauncherPrefixes>> = {
	// `--no` refuses to silently install a missing binary; the `--` stops npx
	// from claiming the tool's own flags. `npm run` needs its own `--` for the
	// same reason: npm silently CLAIMS flag arguments after the script name
	// (probed live at npm 11: `npm run args --flag` delivers nothing to the
	// script; `npm run -- args --flag` delivers `--flag`). The other three
	// managers forward post-script arguments without it.
	npm: { prefix: ["npx", "--no", "--"], dlxPrefix: ["npx"], scriptPrefix: ["npm", "run", "--"] },
	pnpm: { prefix: ["pnpm", "exec"], dlxPrefix: ["pnpm", "dlx"], scriptPrefix: ["pnpm", "run"] },
	yarn: { prefix: ["yarn", "exec"], dlxPrefix: ["yarn", "dlx"], scriptPrefix: ["yarn", "run"] },
	// `--no-install` is bun's equivalent of npm's `--no`.
	bun: { prefix: ["bun", "x", "--no-install"], dlxPrefix: ["bun", "x"], scriptPrefix: ["bun", "run"] },
};

/**
 * How to run a project-local binary here.
 *
 * **Details**
 *
 * This is the whole of what tool discovery needs from a workspace: argv
 * prefixes and a directory to run them in. It deliberately carries no workspace
 * root, no manifest and no package-manager semantics — `label` is for
 * reporting only, and nothing in this package branches on it.
 *
 * **Example** (Construct a project context)
 *
 * ```ts
 * import { ExecContext, LocalExec } from "@beep/scratchpad/effected/commands/LocalExec";
 *
 * const context = ExecContext.make({ label: "pnpm", ...LocalExec.prefixes("pnpm") });
 * console.log(context.label) // pnpm
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ExecContext extends S.Class<ExecContext>($I`ExecContext`)({
	/** Human label of the launcher, e.g. `"pnpm"`. Reporting only. */
	label: S.String.annotateKey({ description: "Human label of the launcher, e.g. `\"pnpm\"`. Reporting only." }),
	/** argv prefix that runs a project-local binary, e.g. `["pnpm", "exec"]`. */
	prefix: S.Array(S.String).annotateKey({ description: "argv prefix that runs a project-local binary, e.g. `[\"pnpm\", \"exec\"]`." }),
	/** argv prefix that fetch-and-runs a package binary, e.g. `["pnpm", "dlx"]`. */
	dlxPrefix: S.Array(S.String).annotateKey({ description: "argv prefix that fetch-and-runs a package binary, e.g. `[\"pnpm\", \"dlx\"]`." }),
	/** argv prefix that runs a `package.json` script, e.g. `["pnpm", "run"]`. */
	scriptPrefix: S.Array(S.String).annotateKey({ description: "argv prefix that runs a `package.json` script, e.g. `[\"pnpm\", \"run\"]`." }),
	/** Directory the prefix must run in. Omitted means "wherever the caller is". */
	directory: S.optionalKey(S.String).annotateKey({ description: "Directory the prefix must run in. Omitted means \"wherever the caller is\"." }),
}, $I.annote("ExecContext", { description: "How to run a project-local binary here." })) {
	/**
	 * Prefixes `command` with `prefix` and applies `directory`, returning a core `Command`.
	 *
	 * **Example** (Prefix a local binary)
	 *
	 * ```ts
	 * import { ExecContext, LocalExec } from "@beep/scratchpad/effected/commands/LocalExec";
	 * import * as ChildProcess from "effect/process/ChildProcess";
	 *
	 * const context = ExecContext.make({ label: "pnpm", ...LocalExec.prefixes("pnpm") });
	 * const command = context.apply(ChildProcess.make("biome", ["--version"]));
	 * console.log(ChildProcess.isCommand(command)) // true
	 * ```
	 *
	 * @since 0.0.0
	 */
	apply(command: ChildProcess.StandardCommand): ChildProcess.Command {
		return this.withPrefix(command, this.prefix);
	}

	/**
	 * As {@link ExecContext.apply}, using `dlxPrefix` — the fetch-and-run launcher.
	 *
	 * **Example** (Prefix a fetched binary)
	 *
	 * ```ts
	 * import { ExecContext, LocalExec } from "@beep/scratchpad/effected/commands/LocalExec";
	 * import * as ChildProcess from "effect/process/ChildProcess";
	 *
	 * const context = ExecContext.make({ label: "pnpm", ...LocalExec.prefixes("pnpm") });
	 * const command = context.applyDlx(ChildProcess.make("biome", ["--version"]));
	 * console.log(ChildProcess.isCommand(command)) // true
	 * ```
	 *
	 * @since 0.0.0
	 */
	applyDlx(command: ChildProcess.StandardCommand): ChildProcess.Command {
		return this.withPrefix(command, this.dlxPrefix);
	}

	/**
	 * As {@link ExecContext.apply}, using `scriptPrefix` — runs a
	 * `package.json` script by name.
	 *
	 * **Details**
	 *
	 * The command's `command` is the script name and its `args` are the script's
	 * arguments. Every launcher uses the explicit `run` form, and npm's prefix
	 * carries a trailing `--` because bare `npm run <script> --flag` silently
	 * claims `--flag` for npm itself instead of the script.
	 *
	 * **Example** (Prefix a package script)
	 *
	 * ```ts
	 * import { ExecContext, LocalExec } from "@beep/scratchpad/effected/commands/LocalExec";
	 * import * as ChildProcess from "effect/process/ChildProcess";
	 *
	 * const context = ExecContext.make({ label: "pnpm", ...LocalExec.prefixes("pnpm") });
	 * const command = context.applyScript(ChildProcess.make("biome", ["--version"]));
	 * console.log(ChildProcess.isCommand(command)) // true
	 * ```
	 *
	 * @since 0.0.0
	 */
	applyScript(command: ChildProcess.StandardCommand): ChildProcess.Command {
		return this.withPrefix(command, this.scriptPrefix);
	}

	/**
	 * Core's `prefix` and `setCwd` both return NEW commands, so the caller's
	 * value is never mutated.
	 *
	 * **Example** (Preserve the original command)
	 *
	 * ```ts
	 * import { ExecContext, LocalExec } from "@beep/scratchpad/effected/commands/LocalExec";
	 * import * as ChildProcess from "effect/process/ChildProcess";
	 *
	 * const context = ExecContext.make({ label: "pnpm", ...LocalExec.prefixes("pnpm") });
	 * const command = ChildProcess.make("biome");
	 * context.apply(command);
	 * console.log(command.command) // biome
	 * ```
	 *
	 * @since 0.0.0
	 */
	private withPrefix(command: ChildProcess.StandardCommand, prefix: ReadonlyArray<string>): ChildProcess.Command {
		const [head, ...rest] = prefix;
		const prefixed = head === undefined ? command : ChildProcess.prefix(command, head, rest);
		return this.directory === undefined ? prefixed : ChildProcess.setCwd(prefixed, this.directory);
	}
}

/**
 * The project-local execution context could not be determined.
 *
 * **Details**
 *
 * A *mechanism* failure — an unreadable manifest, a detection error. "There is
 * no project-local way to run tools here" is `Option.none()`, never this error:
 * the same `None`-is-success convention `@effected/npm`'s resolver contracts
 * use, so an implementation never has to decide whether absence is exceptional.
 *
 * **Example** (Report a context detection failure)
 *
 * ```ts
 * import { LocalExecError } from "@beep/scratchpad/effected/commands/LocalExec";
 *
 * console.log(LocalExecError.make({ directory: "/project" }).message) // Could not determine the project-local execution context for /project
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class LocalExecError extends S.TaggedError<LocalExecError>($I`LocalExecError`)("LocalExecError", {
	/** The directory whose context could not be determined, when one is known. */
	directory: S.optionalKey(S.String).annotateKey({ description: "The directory whose context could not be determined, when one is known." }),
	/** The underlying failure. */
	cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying failure." }),
}, $I.annote("LocalExecError", { description: "The project-local execution context could not be determined." })) {
	/**
	 * Describes the detection failure and includes its directory when known.
	 *
	 * **Example** (Describe a failure without a directory)
	 *
	 * ```ts
	 * import { LocalExecError } from "@beep/scratchpad/effected/commands/LocalExec";
	 *
	 * console.log(LocalExecError.make({}).message) // Could not determine the project-local execution context
	 * ```
	 *
	 * @since 0.0.0
	 */
	override get message(): string {
		return this.directory === undefined
			? "Could not determine the project-local execution context"
			: `Could not determine the project-local execution context for ${this.directory}`;
	}
}

/**
 * The {@link LocalExec} service shape.
 *
 * **Details**
 *
 * Exported so a consumer can type a bespoke implementation against the contract
 * without naming the service class.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export interface LocalExecShape {
	/**
	 * The project-local execution context, or `Option.none()` when there is no
	 * project-local way to run tools here.
	 *
	 * **Details**
	 *
	 * A value that *is* an `Effect`, because yielding is the natural verb —
	 * core writes `ChildProcessHandle.exitCode` the same way.
	 *
	 * @since 0.0.0
	 */
	readonly context: Effect.Effect<O.Option<ExecContext>, LocalExecError>;
}

/**
 * Contract: how to run a project-local binary in this project.
 *
 * **Details**
 *
 * **This is an inverted contract.** Tool discovery needs package-manager
 * detection and workspace-root resolution, both of which live in the
 * integrated-tier `@effected/workspaces`. Depending on it directly would make
 * this package integrated too, pulling its transitive dependencies up a tier
 * with it. So this package declares the narrow contract and
 * `@effected/workspaces` ships the layer that implements it, the same shape as
 * `@effected/npm`'s `CatalogResolver`, which workspaces also implements.
 *
 * A consumer with no monorepo never needs that implementation:
 * {@link LocalExec.layerNone} (global-only) and {@link LocalExec.layerFor}
 * (a known package manager) are one-liners.
 *
 * **Example** (Read a provided execution context)
 *
 * ```ts
 * import { LocalExec } from "@beep/scratchpad/effected/commands/LocalExec";
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 *
 * const program = Effect.flatMap(LocalExec, (service) => service.context).pipe(Effect.provide(LocalExec.layerNone));
 * console.log(O.isNone(Effect.runSync(program))) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class LocalExec extends Context.Service<LocalExec, LocalExecShape>()($I`LocalExec`) {
	/**
	 * The exec, dlx and script-runner argv prefixes for a launcher — the single home of that knowledge.
	 *
	 * **Example** (Inspect local binary prefixes)
	 *
	 * ```ts
	 * import { LocalExec } from "@beep/scratchpad/effected/commands/LocalExec";
	 *
	 * console.log(LocalExec.prefixes("npm").prefix.join(" ")) // npx --no --
	 * ```
	 *
	 * @since 0.0.0
	 */
	static readonly prefixes = (launcher: Launcher): LauncherPrefixes => PREFIXES[launcher];

	/**
	 * The argv prefix that runs a `package.json` script for `launcher`.
	 *
	 * **Details**
	 *
	 * A projection of {@link LocalExec.prefixes} for the caller that only runs
	 * scripts. Every launcher uses the explicit `run` form —
	 * `["npm", "run", "--"]`, `["pnpm", "run"]`, `["yarn", "run"]` and
	 * `["bun", "run"]` — and npm's carries a trailing `--` because bare
	 * `npm run <script> --flag` silently claims `--flag` for npm itself; the
	 * other three forward post-script arguments without it.
	 *
	 * **Example** (Inspect npm script forwarding)
	 *
	 * ```ts
	 * import { LocalExec } from "@beep/scratchpad/effected/commands/LocalExec";
	 *
	 * console.log(LocalExec.scriptPrefix("npm").join(" ")) // npm run --
	 * ```
	 *
	 * @since 0.0.0
	 */
	static readonly scriptPrefix = (launcher: Launcher): ReadonlyArray<string> => PREFIXES[launcher].scriptPrefix;

	/**
	 * No project-local execution context: every tool resolves globally.
	 *
	 * **Details**
	 *
	 * The right wiring for a GitHub Action or any single-package checkout, and
	 * the reason such a consumer never installs `@effected/workspaces`.
	 *
	 * **Example** (Construct global-only wiring)
	 *
	 * ```ts
	 * import { LocalExec } from "@beep/scratchpad/effected/commands/LocalExec";
	 * import * as Layer from "effect/Layer";
	 *
	 * const layer = LocalExec.layerNone;
	 * console.log(Layer.isLayer(layer)) // true
	 * ```
	 *
	 * @since 0.0.0
	 */
	static readonly layerNone: Layer.Layer<LocalExec> = Layer.succeed(this, {
		context: Eff.succeedNone,
	});

	/**
	 * A context for a known package manager, from the static prefix table.
	 *
	 * **Example** (Construct known-launcher wiring)
	 *
	 * ```ts
	 * import { LocalExec } from "@beep/scratchpad/effected/commands/LocalExec";
	 * import * as Layer from "effect/Layer";
	 *
	 * const layer = LocalExec.layerFor("pnpm", { directory: "/project" });
	 * console.log(Layer.isLayer(layer)) // true
	 * ```
	 *
	 * @since 0.0.0
	 */
	static readonly layerFor = (
		launcher: Launcher,
		options?: { readonly directory?: string | undefined },
	): Layer.Layer<LocalExec> => {
		const { prefix, dlxPrefix, scriptPrefix } = PREFIXES[launcher];
		return LocalExec.layerContext(
			ExecContext.make({
				label: launcher,
				prefix,
				dlxPrefix,
				scriptPrefix,
				...O.getSomesStruct({ directory: O.fromUndefinedOr(options?.directory) }),
			}),
		);
	};

	/**
	 * A caller-supplied context, answered verbatim.
	 *
	 * **Example** (Provide a supplied context)
	 *
	 * ```ts
	 * import { ExecContext, LocalExec } from "@beep/scratchpad/effected/commands/LocalExec";
	 * import * as Layer from "effect/Layer";
	 *
	 * const context = ExecContext.make({ label: "pnpm", ...LocalExec.prefixes("pnpm") });
	 * const layer = LocalExec.layerContext(context);
	 * console.log(Layer.isLayer(layer)) // true
	 * ```
	 *
	 * @since 0.0.0
	 */
	static readonly layerContext = (context: ExecContext): Layer.Layer<LocalExec> =>
		Layer.succeed(LocalExec, { context: Eff.succeedSome(context) });

	/**
	 * An in-memory test double.
	 *
	 * **Details**
	 *
	 * Unlike most `makeTest` doubles in the kit, the unstubbed default here is
	 * **honest rather than loud**: `Option.none()` is a real, correct answer
	 * ("no project-local context"), so a test that does not care about local
	 * resolution gets the global-only behavior instead of a defect.
	 *
	 * **Example** (Inspect the default test context)
	 *
	 * ```ts
	 * import { LocalExec } from "@beep/scratchpad/effected/commands/LocalExec";
	 * import * as Effect from "effect/Effect";
	 * import * as O from "effect/Option";
	 *
	 * console.log(O.isNone(Effect.runSync(LocalExec.makeTest().context))) // true
	 * ```
	 *
	 * @since 0.0.0
	 */
	static readonly makeTest = (overrides: Partial<LocalExecShape> = {}): LocalExecShape => ({
		context: Eff.succeedNone,
		...overrides,
	});

	/**
	 * {@link LocalExec.makeTest} behind `Layer.succeed`.
	 *
	 * **Gotchas**
	 *
	 * A parameterized layer factory mints a fresh reference per call and layers
	 * memoize by reference — bind the result to a `const` rather than calling it
	 * at each composition site.
	 *
	 * **Example** (Bind a reusable test layer)
	 *
	 * ```ts
	 * import { LocalExec } from "@beep/scratchpad/effected/commands/LocalExec";
	 * import * as Layer from "effect/Layer";
	 *
	 * const layer = LocalExec.layerTest();
	 * console.log(Layer.isLayer(layer)) // true
	 * ```
	 *
	 * @since 0.0.0
	 */
	static readonly layerTest = (overrides: Partial<LocalExecShape> = {}): Layer.Layer<LocalExec> =>
		Layer.succeed(LocalExec, LocalExec.makeTest(overrides));
}
