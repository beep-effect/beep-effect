import type { AudienceKind } from "../env/index.ts";
import { CurrentRuntimeEnv } from "../env/index.ts";
import { Walker } from "../walker/index.ts";
import type { Layer as LayerType } from "effect";
import { Config, Context, Effect, FileSystem, Layer, Option, Path } from "effect";
import type { LinkTarget } from "./Doc.ts";
import { sanitize } from "./Fmt.ts";
import { isAllowedLinkUrl } from "./internal/linkScheme.ts";
import { DRIVE, UNC, encodeForOsc8, fileUrlPath } from "./internal/linkTarget.ts";

/**
 * Whether file links open in an editor.
 *
 * @remarks
 * `vscode` writes `vscode://file/<path>:<line>:<col>`, `file` writes `file://<path>`, `off` writes no file link, and
 * `auto` picks `vscode` when it finds a signal of VS Code and `file` otherwise.
 *
 * @public
 */
export type EditorLinks = "auto" | "vscode" | "file" | "off";

/**
 * The shape of the {@link CliLinks} service: the mode decided, and the URL a link target becomes.
 *
 * @public
 */
export interface CliLinksShape {
	/** The mode `auto` resolved to, or the one that was asked for. */
	readonly mode: "vscode" | "file" | "off";
	/**
	 * The URL a target opens, or `None` when it has none.
	 *
	 * @remarks
	 * A `{ url }` target is its URL, whatever the mode. A `{ file }` target is `vscode://file/<path>:<line>:<col>` or
	 * `file://<path>`, with the path URL-encoded; `off` gives it none, and so does a relative path when the layer
	 * has no working directory to resolve it against. A column needs a line.
	 */
	readonly target: (target: LinkTarget) => Option.Option<string>;
}

/**
 * Options for {@link CliLinks.layer}.
 *
 * @public
 */
export interface CliLinksOptions {
	/** The setting, `auto` by default. An environment variable the consumer names beats it. */
	readonly editorLinks?: EditorLinks | undefined;
	/** The environment variable that overrides the setting, read through `Config`. Not read unless named. */
	readonly envVar?: string | undefined;
	/** The working directory; `PWD` through `Config`, then `Path.resolve(".")`, when omitted. */
	readonly cwd?: string | undefined;
}

/**
 * The options of {@link CliLinks.linker}.
 *
 * @public
 */
export interface CliLinksLinkerOptions {
	/** The service that turns a target into a URL. */
	readonly links: CliLinksShape;
	/** Whether the stream's terminal renders OSC 8 hyperlinks. */
	readonly hyperlinks: boolean;
	/** Who the output is for. */
	readonly audience: AudienceKind;
}

/** The most directories the ascent climbs above the working directory, so it looks at most at 65. */
const MAX_ASCENT = 64;

const MODES: ReadonlyArray<EditorLinks> = ["auto", "vscode", "file", "off"];

const parseSetting = (raw: string): EditorLinks | undefined => MODES.find((mode) => mode === raw.trim().toLowerCase());

/** A URL with its control characters and line breaks removed: none is legal in one, and each could end an OSC 8 early. */
const cleanUrl = (url: string): string => sanitize(url).replace(/[\r\n]/g, "");

const makeTarget =
	(mode: "vscode" | "file" | "off", absolute: (file: string) => string | undefined) =>
	(target: LinkTarget): Option.Option<string> => {
		if ("url" in target) {
			const url = cleanUrl(target.url);
			return url === "" || !isAllowedLinkUrl(url) ? Option.none() : Option.some(url);
		}
		if (mode === "off") return Option.none();
		const resolved = absolute(target.file);
		if (resolved === undefined) return Option.none();
		const path = fileUrlPath(resolved);
		if (path === undefined) return Option.none();
		if (mode === "file") return Option.some(`file://${path}`);
		const position =
			target.line === undefined ? "" : target.col === undefined ? `:${target.line}` : `:${target.line}:${target.col}`;
		return Option.some(`vscode://file${path}${position}`);
	};

const isDirectory = (fs: FileSystem.FileSystem, path: string): Effect.Effect<boolean> =>
	fs.stat(path).pipe(
		Effect.map((info) => info.type === "Directory"),
		Effect.orElseSucceed(() => false),
	);

const exists = (fs: FileSystem.FileSystem, path: string): Effect.Effect<boolean> =>
	fs.exists(path).pipe(Effect.orElseSucceed(() => false));

/**
 * The nearest directory, from `cwd` up, that holds `.git` or `pnpm-workspace.yaml`.
 *
 * It looks at `cwd` and then climbs at most {@link MAX_ASCENT} directories, through `Walker.ascend`, which also stops
 * where `dirname` reaches a fixpoint (the filesystem root). `Walker.findRoot` absorbs a failed probe as "not a root",
 * so one unreadable directory never hides a root above it. `None` when there is none.
 */
const findRoot = (fs: FileSystem.FileSystem, path: Path.Path, cwd: string): Effect.Effect<Option.Option<string>> =>
	Walker.ascend(cwd, { maxDepth: MAX_ASCENT + 1 }).pipe(
		Effect.provideService(Path.Path, path),
		Effect.flatMap((directories) =>
			Walker.findRoot(directories, (directory) =>
				Effect.gen(function* () {
					return (
						(yield* exists(fs, path.join(directory, ".git"))) ||
						(yield* exists(fs, path.join(directory, "pnpm-workspace.yaml")))
					);
				}),
			),
		),
	);

const readOption = (name: string): Effect.Effect<Option.Option<string>> =>
	Config.option(Config.String(name)).pipe(Effect.orElseSucceed(() => Option.none<string>()));

interface Ambient {
	readonly fs: Option.Option<FileSystem.FileSystem>;
	readonly path: Option.Option<Path.Path>;
}

const build = (options: CliLinksOptions, ambient: Ambient): Effect.Effect<CliLinksShape, never, CurrentRuntimeEnv> =>
	Effect.gen(function* () {
		const runtime = yield* CurrentRuntimeEnv;
		const raw =
			options.envVar === undefined ? "" : Option.getOrElse(yield* readOption(options.envVar), () => "").trim();
		const fromEnv = parseSetting(raw);
		// A value that is not a mode warns once, as the audience override does, and the option is used.
		if (options.envVar !== undefined && raw !== "" && fromEnv === undefined) {
			yield* Effect.logWarning(`${options.envVar}=${raw} is not one of ${MODES.join("|")}; ignoring it`);
		}
		const setting = fromEnv ?? options.editorLinks ?? "auto";

		// The working directory: the option, else PWD, else where the path service resolves ".".
		const pwd = options.cwd === undefined ? yield* readOption("PWD") : Option.none<string>();
		const cwd =
			options.cwd ??
			Option.getOrUndefined(pwd) ??
			(Option.isSome(ambient.path) ? ambient.path.value.resolve(".") : undefined);
		const path = Option.getOrUndefined(ambient.path);
		const absolute = (file: string): string | undefined => {
			// A UNC path is not on this machine: it must not be resolved against the working directory as a filename.
			if (UNC.test(file)) return undefined;
			if (DRIVE.test(file)) return file;
			if (path === undefined) return file.startsWith("/") ? file : undefined;
			if (path.isAbsolute(file)) return file;
			return cwd === undefined ? undefined : path.resolve(cwd, file);
		};

		const mode: "vscode" | "file" | "off" =
			setting !== "auto"
				? setting
				: Option.exists(runtime.terminal, (terminal) => terminal.name === "vscode")
					? "vscode"
					: yield* Effect.gen(function* () {
							if (Option.isNone(ambient.fs) || path === undefined || cwd === undefined) return "file" as const;
							const root = yield* findRoot(ambient.fs.value, path, cwd);
							const base = Option.getOrElse(root, () => cwd);
							return (yield* isDirectory(ambient.fs.value, path.join(base, ".vscode")))
								? ("vscode" as const)
								: ("file" as const);
						});
		return { mode, target: makeTarget(mode, absolute) };
	});

/**
 * Editor-aware links for file targets: where a link to a file opens.
 *
 * @remarks
 * The mode is decided once, when the layer is built. `auto` is `vscode` when `CurrentRuntimeEnv.terminal` is
 * `vscode` (`TERM_PROGRAM=vscode`) or a `.vscode/` directory sits at the project root, and `file` otherwise. The
 * root is the nearest directory, from the working directory up, that holds `.git` or `pnpm-workspace.yaml`; the
 * climb is bounded, at most 64 directories above the working directory, and stops where `Path.dirname` reaches the
 * filesystem root. With no root, the working directory itself is checked.
 *
 * Whether a link is written at all is a separate question, answered by {@link CliLinks.linker}.
 *
 * @public
 */
export class CliLinks extends Context.Service<CliLinks, CliLinksShape>()("@effected/cli/CliLinks") {
	/**
	 * The links for the working directory, reading the filesystem for a `.vscode/` directory.
	 *
	 * @remarks
	 * A layer-returning function mints a fresh layer per call: call it once and bind the result to a constant.
	 *
	 * @param options - the setting, the environment variable that overrides it, and the working directory
	 */
	static readonly layer = (
		options: CliLinksOptions = {},
	): LayerType.Layer<CliLinks, never, FileSystem.FileSystem | Path.Path | CurrentRuntimeEnv> =>
		Layer.effect(
			CliLinks,
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				const path = yield* Path.Path;
				return yield* build(options, { fs: Option.some(fs), path: Option.some(path) });
			}),
		);

	/**
	 * Links fixed to a mode, with no filesystem: a relative path has no link, since there is no working directory.
	 *
	 * @param mode - `vscode`, `file` or `off`
	 */
	static readonly layerTest = (mode: "vscode" | "file" | "off"): LayerType.Layer<CliLinks> =>
		Layer.succeed(CliLinks, {
			mode,
			target: makeTarget(mode, (file) => (file.startsWith("/") || DRIVE.test(file) ? file : undefined)),
		});

	/**
	 * The function that writes a link: a target and a label in, the label out, wrapped in OSC 8 when it should be.
	 *
	 * @remarks
	 * It writes the hyperlink `ESC ] 8 ; ; URL ESC \ label ESC ] 8 ; ; ESC \` only when the stream's terminal can
	 * render it (`hyperlinks`) and the audience is not an agent, which never gets an escape of any kind; in every other
	 * case, and whenever the target has no URL, it returns the label unchanged. The URL has its control characters
	 * removed again here, so a hostile target cannot end the sequence early or start another, and a URL whose scheme is
	 * not one a link may have (`javascript:`, `data:`, and the like; the same list markdown uses) is the label alone. It is pure and cheap,
	 * which {@link RenderContext}'s `link` requires.
	 *
	 * @param options - the links, whether hyperlinks are available, and the audience
	 */
	static readonly linker =
		(options: CliLinksLinkerOptions) =>
		(target: LinkTarget, label: string): string => {
			if (!options.hyperlinks || options.audience === "agent") return label;
			const url = options.links.target(target);
			if (Option.isNone(url)) return label;
			const written = encodeForOsc8(cleanUrl(url.value));
			if (!isAllowedLinkUrl(written)) return label;
			return `\u001B]8;;${written}\u001B\\${label}\u001B]8;;\u001B\\`;
		};
}

/**
 * The links for {@link CliEnv.layer}: the same as {@link CliLinks.layer}, except that `FileSystem` and `Path` are
 * taken from the environment if it has them, not required.
 *
 * Without them there is no `.vscode/` to look for and no working directory to resolve a relative path against, so
 * `auto` is `vscode` only on the terminal signal. This keeps the requirements of `CliEnv.layer` and of every
 * `CliRuntime.main` overload unchanged.
 *
 * @internal
 */
export const ambientLinksLayer = (options: CliLinksOptions = {}): LayerType.Layer<CliLinks, never, CurrentRuntimeEnv> =>
	Layer.effect(
		CliLinks,
		Effect.gen(function* () {
			const fs = yield* Effect.serviceOption(FileSystem.FileSystem);
			const path = yield* Effect.serviceOption(Path.Path);
			return yield* build(options, { fs, path });
		}),
	);
