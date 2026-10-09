import * as A from "effect/Array";
import type * as CauseType from "effect/Cause";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as SchemaIssue from "effect/SchemaIssue";
import * as S from "effect/Schema";
import { Cancelled } from "./Cancelled.ts";
import type { Block, Document, InlineOf, TreeInput } from "./Doc.ts";
import { Doc } from "./Doc.ts";
import { Fmt } from "./Fmt.ts";
import { issueEntries, issueTreeChildren } from "./internal/format.ts";
import { splitFrame } from "./internal/splitFrame.ts";
import { NotInteractive } from "./NotInteractive.ts";
import { Status } from "./Status.ts";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as O from "@beep/utils/Option";

/**
 * The protocol an error class implements to say how a failure is shown: a method under this key that returns the
 * document.
 *
 * @remarks
 * `CliFailure.toDoc` calls it for a typed failure that has one, so an application error draws itself (a heading, a
 * table of what went wrong) and the default report uses it with no registration. A `Symbol.for` key, so two copies
 * of this package agree on it.
 *
 * @public
 */
export const CliDoc: unique symbol = Symbol.for("@effected/cli/CliDoc");

/**
 * An error that draws itself: see {@link CliDoc}.
 *
 * @public
 */
export interface CliDocSource {
	readonly [CliDoc]: () => Document;
}

/**
 * Options for {@link CliFailure.toDoc}.
 *
 * @public
 */
export interface CliFailureOptions {
	/**
	 * A document per error `_tag`, for errors that do not implement {@link CliDoc}. A tag with no entry is shown by
	 * the default rules.
	 */
	readonly render?: Readonly<Record<string, (error: unknown) => Document>> | undefined;
	/** Turns an absolute path into its display form, for the stack frames; the identity by default. */
	readonly displayPath?: ((absolute: string) => string) | undefined;
	/**
	 * Which frames of a defect's stack are shown. `app`, the default, shows the program's own: every `node_modules`
	 * frame (Effect's and any other dependency's), `node:internal` and the runtime's generator frames are left out and
	 * counted. When that leaves no frame, as for a program run from its install under `node_modules` (a global
	 * install, `npx`, a pnpm store), only the runtime's and Effect's are left out, so its own frames still show. `all`
	 * shows every frame, unfiltered.
	 */
	readonly stackFrames?: "app" | "all" | undefined;
	/**
	 * Which spans the `in: outer › inner` trail after a failure names. `app`, the default, leaves out the spans the kit
	 * and Effect define themselves: a span whose definition site (an `Effect.fn`'s, or where the span was opened) is a
	 * file under `node_modules/@effected/` or `node_modules/effect/`. A config that fails to decode under
	 * `@effected/config-file` then reports no `ConfigFile.loadFrom` trail, while the program's own spans stay. `all`
	 * shows every span, and `off` drops the trail. Under either, an `Effect.fn` call and its definition are one entry,
	 * `name`, never `name (definition) › name`.
	 *
	 * @remarks
	 * The rule reads file paths, never span names, and it fails open: when it cannot tell, it shows the span. A span
	 * with no captured stack is kept. A kit package linked into a workspace (`link:`, `workspace:`) runs from its own
	 * checkout rather than from `node_modules`, so its spans show as the program's. A bundled program is one file, so
	 * `app` shows what `all` does, unless the bundle is itself installed under `node_modules/@effected/`. A program that
	 * is installed under `node_modules/@effected/` (a kit companion's bin) names itself with `appModule`, or its own
	 * spans are left out with the kit's.
	 */
	readonly spans?: "app" | "all" | "off" | undefined;
	/**
	 * A module of the running program itself, as a `file:` URL or an absolute path: its bin's `import.meta.url`. With
	 * `spans: "app"`, a span defined in the installed package that holds this module is the program's, kept even under
	 * `node_modules/@effected/`, while the packages it depends on (beside it, or nested in its own `node_modules`) are
	 * still left out. The package is the path through the last `node_modules/<name>` (or `node_modules/@scope/name`)
	 * in it, read from the path alone with no file system. A module not under `node_modules` changes nothing: the rule
	 * already keeps its spans. Unset by default.
	 */
	readonly appModule?: string | undefined;
}

/** The deepest an `Error.cause` chain, or a stack, is followed. */
const MAX_DEPTH = 8;
const MAX_SPANS = 32;

const hasCliDoc = (value: unknown): value is CliDocSource =>
	P.isObjectKeyword(value) && !P.isFunction(value) && CliDoc in value && P.isFunction(value[CliDoc]);

// String(value) can throw for an object with no prototype or a hostile toString, and says only "[object Object]" for
// a plain failure value: such a value with a string message is that message.
const describe = (value: unknown): string => {
	try {
		const text = String(value);
		if (text !== "[object Object]") return text;
		const message = P.isObjectKeyword(value) && !P.isFunction(value) && "message" in value ? value.message : undefined;
		return P.isString(message) ? message : text;
	} catch {
		return "[unprintable value]";
	}
};

const firstLine = (text: string): string => text.split(/\r\n|\r|\n/, 1)[0] ?? "";

const tagOf = (value: unknown): string | undefined => {
	if (!P.isObjectKeyword(value) || P.isFunction(value)) return undefined;
	const tag = "_tag" in value ? value._tag : undefined;
	return P.isString(tag) ? tag : undefined;
};

/** The failure status and the text of a message: one block per line, the status on the first. */
const failureBlocks = (message: string): ReadonlyArray<Block> => {
	const [first = "", ...rest] = message.split(/\r\n|\r|\n/);
	return [Doc.paragraph(Doc.status(Status.core, "failure"), " ", first), ...rest.map((line) => Doc.paragraph(line))];
};

/** The issue of a schema failure: the value itself, or the `issue` an error carries. */
const issueOf = (error: unknown): unknown => {
	if (SchemaIssue.isIssue(error)) return error;
	if (P.isObjectKeyword(error) && !P.isFunction(error) && "issue" in error) {
		const issue = error.issue;
		if (SchemaIssue.isIssue(issue)) return issue;
	}
	return undefined;
};

const schemaBlocks = (error: unknown): ReadonlyArray<Block> | undefined => {
	const entries = issueEntries(issueOf(error));
	if (entries.length === 0) return undefined;
	const header =
		P.isObjectKeyword(error) && !P.isFunction(error) && !SchemaIssue.isIssue(error) && "message" in error
			? firstLine(describe(error.message ?? ""))
			: "";
	const label: Array<InlineOf<"Text"> | InlineOf<"StatusMark"> | string> = [
		Doc.status(Status.core, "failure"),
		" ",
		header === "" ? `invalid value (${Fmt.plural(entries.length, "problem")})` : header,
	];
	const root: TreeInput = { label, children: issueTreeChildren(entries) };
	return [Doc.tree(root)];
};

interface Frame {
	readonly raw: string;
	readonly fn?: string;
	readonly file?: string;
	readonly line?: number;
	readonly col?: number;
}

/** The location of a frame as a path: a `file:` URL decoded, or an absolute POSIX or drive path; else `undefined`. */
const asPath = (location: string): string | undefined => {
	if (location.startsWith("file:")) {
		try {
			const path = decodeURIComponent(new URL(location).pathname);
			return /^\/[A-Za-z]:\//.test(path) ? path.slice(1) : path;
		} catch {
			return undefined;
		}
	}
	return location.startsWith("/") || /^[A-Za-z]:[\\/]/.test(location) ? location : undefined;
};

/** A location without its `:line:col`, and the position when there is one. */
const splitPosition = (location: string): { readonly where: string; readonly line?: number; readonly col?: number } => {
	const position = /^(.*):(\d+):(\d+)$/.exec(location);
	return position === null
		? { where: location }
		: { where: position[1] ?? "", line: Number(position[2]), col: Number(position[3]) };
};

const parseFrame = (raw: string): Frame => {
	const { text, fn, location } = splitFrame(raw);
	const { where, line, col } = splitPosition(location);
	const file = asPath(where);
	return {
		raw: text,
		...O.getSomesStruct({ fn: O.fromUndefinedOr(fn) }),
		...O.getSomesStruct({ file: O.fromUndefinedOr(file) }),
		...(file === undefined || line === undefined || col === undefined ? {} : { line, col }),
	};
};

/** The file a frame ran in, as a path, or `undefined` for a frame with none: `node:`, `<anonymous>`, `native`, `eval`. */
const frameFile = (raw: string): string | undefined => asPath(splitPosition(splitFrame(raw).location).where);

/** A frame under `node_modules`: a dependency's, or an installed program's own. Decided by its file alone. */
const isDependency = (raw: string): boolean => /[\\/]node_modules[\\/]/.test(frameFile(raw) ?? "");

/**
 * A frame that is the runtime's or Effect's, never the program's, wherever the program is installed: one with no file
 * (every `node:` frame, `<anonymous>`, native), or one in Effect's own files. Decided by the file alone, never by the
 * function name: V8 names a program's own thunk by Effect's method alias (`boom [as ~effect/Effect/args]`).
 */
const isRuntime = (raw: string): boolean => {
	const file = frameFile(raw);
	return (
		file === undefined ||
		/[\\/]node_modules[\\/]effect[\\/]/.test(file) ||
		/[\\/]packages[\\/]effect[\\/]src[\\/]/.test(file)
	);
};

/** The frames of a stack that belong to the program, and how many were left out. */
const cleanStack = (
	stack: unknown,
	mode: "app" | "all",
): { readonly frames: ReadonlyArray<Frame>; readonly hidden: number } => {
	if (!P.isString(stack)) return { frames: [], hidden: 0 };
	const lines = stack.split(/\r\n|\r|\n/).filter((line) => /^\s*at\s/.test(line));
	const app = lines.filter((line) => !isRuntime(line) && !isDependency(line));
	// An installed program (a global install, `npx`, a pnpm store) has every frame of its own under `node_modules`:
	// when dropping dependencies leaves nothing, keep everything but the runtime's and Effect's.
	const kept = mode === "all" ? lines : app.length > 0 ? app : lines.filter((line) => !isRuntime(line));
	return { frames: kept.map(parseFrame), hidden: lines.length - kept.length };
};

const frameBlock = (frame: Frame, displayPath: (absolute: string) => string): Block => {
	if (frame.file === undefined) return Doc.paragraph(Doc.text("at ", "muted"), frame.raw);
	const where = `${displayPath(frame.file)}${frame.line === undefined ? "" : `:${frame.line}:${frame.col}`}`;
	const target = {
		file: frame.file,
		...O.getSomesStruct({ line: O.fromUndefinedOr(frame.line) }),
		...O.getSomesStruct({ col: O.fromUndefinedOr(frame.col) }),
	};
	return Doc.paragraph(
		Doc.text("at ", "muted"),
		...(frame.fn === undefined ? [] : [`${frame.fn} `]),
		Doc.link(target, where),
	);
};

const stackBlock = (defect: Error, displayPath: (absolute: string) => string, mode: "app" | "all"): Block => {
	const { frames, hidden } = cleanStack(defect.stack, mode);
	if (frames.length > 0) {
		const shown = frames.map((frame) => frameBlock(frame, displayPath));
		const note = hidden === 0 ? [] : [Doc.paragraph(Doc.text(`(+${hidden} internal frames hidden)`, "muted"))];
		return Doc.collapsible("stack", [...shown, ...note], { open: true });
	}
	const note = hidden === 0 ? "no stack" : `no user frames (${hidden} internal frames hidden)`;
	return Doc.collapsible("stack", [Doc.paragraph(Doc.text(note, "muted"))], { open: true });
};

/** The `Error.cause` chain below a defect as a tree of one-line messages, or none. */
const causeTree = (defect: Error): Block | undefined => {
	const chain: Array<string> = [];
	const seen = new Set<unknown>([defect]);
	for (let current: unknown = defect.cause; current !== undefined && chain.length < MAX_DEPTH; ) {
		if (seen.has(current)) break;
		seen.add(current);
		chain.push(firstLine(describe(current)));
		current = current instanceof Error ? current.cause : undefined;
	}
	if (chain.length === 0) return undefined;
	const nest = (index: number): TreeInput =>
		index === chain.length - 1
			? { label: A.getUnsafe(chain, index) }
			: { label: A.getUnsafe(chain, index), children: [nest(index + 1)] };
	return Doc.tree({ label: firstLine(describe(defect)), children: [nest(0)] });
};

const dieBlocks = (
	defect: unknown,
	spans: ReadonlyArray<Block>,
	displayPath: (absolute: string) => string,
	mode: "app" | "all",
): ReadonlyArray<Block> => {
	// A prompt that was cancelled, or refused for want of a terminal, is a defect to the runtime and a fixed line to a person.
	if (S.is(Cancelled)(defect) || S.is(NotInteractive)(defect)) return [Doc.paragraph(defect.message)];
	const header = failureBlocks(describe(defect));
	if (!(defect instanceof Error)) return [...header, ...spans];
	const chain = causeTree(defect);
	return [...header, ...spans, stackBlock(defect, displayPath, mode), ...(chain === undefined ? [] : [chain])];
};

const failBlocks = (
	error: unknown,
	spans: ReadonlyArray<Block>,
	options: CliFailureOptions | undefined,
): ReadonlyArray<Block> => {
	if (hasCliDoc(error)) {
		try {
			return [...error[CliDoc](), ...spans];
		} catch {
			// A document that cannot be built falls through to the generic line: a report must not fail to report.
		}
	}
	const tag = tagOf(error);
	const custom =
		tag === undefined || options?.render === undefined || !R.has(options.render, tag)
			? undefined
			: options.render[tag];
	if (custom !== undefined) {
		try {
			return [...custom(error), ...spans];
		} catch {
			// Likewise.
		}
	}
	if (S.is(Cancelled)(error) || S.is(NotInteractive)(error)) return [Doc.paragraph(error.message)];
	const schema = schemaBlocks(error);
	if (schema !== undefined) return [...schema, ...spans];
	return [...failureBlocks(describe(error)), ...spans];
};

/** A file of the kit's own packages or of Effect, as installed: a span defined there is not the program's. */
const isKitFile = (file: string): boolean => /[\\/]node_modules[\\/](?:@effected[\\/]|effect[\\/])/.test(file);

/**
 * The installed package directory that holds `module`: the path through the last `node_modules/<name>` or
 * `node_modules/@scope/name` in it, or `undefined` when the module is not under `node_modules` (or not a path at all).
 * Read from the path alone, with no file system.
 */
const packageDirOf = (module: string | undefined): string | undefined => {
	if (module === undefined) return undefined;
	const path = asPath(module);
	if (path === undefined) return undefined;
	// Greedy, so it is the last node_modules in the path: the package the module itself belongs to.
	return /^(.*\/node_modules\/(?:@[^/]+\/)?[^/]+)\//.exec(comparable(path))?.[1];
};

/**
 * A path in the one spelling both sides of a comparison use: `/` separators, and a Windows drive letter lower-cased. A
 * CommonJS frame on Windows reads `C:\…` where an `import.meta.url` reads `file:///C:/…`, and the drive's case is not
 * fixed (`c:` and `C:` are one drive). Lexical only: no file system, no realpath.
 */
const comparable = (path: string): string =>
	path.replace(/\\/g, "/").replace(/^([A-Za-z]):/, (_, drive: string) => `${drive.toLowerCase()}:`);

/** Whether `file` is in the program's own package `appDir`, and not in a dependency nested in its `node_modules`. */
const isAppFile = (file: string, appDir: string | undefined): boolean => {
	if (appDir === undefined) return false;
	const path = comparable(file);
	if (!path.startsWith(appDir)) return false;
	const rest = path.slice(appDir.length);
	return rest.startsWith("/") && !rest.includes("/node_modules/");
};

/** The file a span frame's captured stack points at, or `undefined` when it captured none. */
const spanFile = (frame: { readonly stack: () => string | undefined }): string | undefined => {
	try {
		const stack = frame.stack();
		if (stack === undefined) return undefined;
		const line = stack.split(/\r\n|\r|\n/).find((candidate) => /^\s*at\s/.test(candidate)) ?? stack;
		return frameFile(line.trim().startsWith("at ") ? line : `at ${line.trim()}`);
	} catch {
		return undefined;
	}
};

/**
 * `in: outer › inner`, from the span stack the runtime annotates a reason with, or none. With `app`, a span the kit or
 * Effect defined is left out. An `Effect.fn` call carries its definition as its parent (`name (definition)`): the two
 * are one entry, `name`, judged by the definition's site, so a kit function the program calls goes with its
 * definition.
 */
const spanBlocks = (
	reason: CauseType.Reason<unknown>,
	mode: "app" | "all" | "off",
	appDir: string | undefined,
): ReadonlyArray<Block> => {
	if (mode === "off") return [];
	const names: Array<string> = [];
	let frame = Context.getOrUndefined(Cause.reasonAnnotations(reason), Cause.StackTrace);
	for (let seen = 0; frame !== undefined && seen < MAX_SPANS; seen++) {
		const parent = frame.parent;
		const definition = parent !== undefined && parent.name === `${frame.name} (definition)` ? parent : undefined;
		const file = (definition === undefined ? undefined : spanFile(definition)) ?? spanFile(frame);
		if (mode === "all" || file === undefined || isAppFile(file, appDir) || !isKitFile(file)) names.push(frame.name);
		// A call and its definition are one entry, `X`, never `X (definition) › X`: the definition is skipped.
		frame = definition === undefined ? parent : definition.parent;
	}
	if (names.length === 0) return [];
	return [Doc.paragraph(Doc.text("in: ", "muted"), Doc.path(...names.reverse()))];
};

/**
 * A failure as a document: what the default report prints, and a building block for a custom one.
 *
 * @remarks
 * One run of blocks per `Cause` reason. A typed failure is, in order of preference: the document of an error that
 * implements {@link CliDoc}; the document `options.render` holds for its `_tag`; for `Cancelled` and
 * `NotInteractive`, their one fixed line; a `Tree` of the rejected values, for a schema error or issue; else a failure
 * status line with its message. A defect is its message followed by a collapsible `stack` of the program's own frames,
 * each a file link (so a terminal can open it in an editor) shown through `displayPath`, with the runtime's frames (every
 * `node:` frame and every frame with no file) and every `node_modules` frame (Effect's and any other dependency's)
 * left out unless `stackFrames` is `all`. A frame is classified by its file alone, never by its function name, so a
 * program's own thunk that V8 names by Effect's method alias is still shown. When that would
 * leave no frame at all, as for a program run from its own install under `node_modules`, only the runtime's and
 * Effect's are left out. Then an
 * `Error.cause` chain as a tree. When cleaning leaves no frame the stack says
 * `no user frames (N internal frames hidden)`, never an empty block; when frames survive and some were left out, the
 * count follows them as `(+N internal frames hidden)`. A reason that ran under spans is followed by
 * `in: outer › inner`: by default only the program's own spans, the kit's and Effect's left out (`spans`). Interrupts are not rendered beside a real failure, and a cause with only interrupts is the
 * one line `interrupted`.
 *
 * All text goes through the document, so a control character in a message or a stack frame never reaches the terminal.
 * Render it with `Render.context` and `Render.plain`, `ansi`, `markdown` or `githubLog`, or `Doc.print` it.
 *
 * @public
 */
export class CliFailure {
	private constructor() {}

	/**
	 * Build the document of a cause.
	 *
	 * @param cause - the failure
	 * @param options - per-tag documents and a path display function
	 */
	static readonly toDoc = (cause: CauseType.Cause<unknown>, options?: CliFailureOptions): Document => {
		const reasons = cause.reasons;
		if (reasons.length > 0 && reasons.every(Cause.isInterruptReason)) return [Doc.paragraph("interrupted")];
		const displayPath = options?.displayPath ?? ((absolute: string) => absolute);
		return reasons.flatMap((reason): ReadonlyArray<Block> => {
			const spans = options?.spans ?? "app";
			const appDir = packageDirOf(options?.appModule);
			if (Cause.isFailReason(reason)) return failBlocks(reason.error, spanBlocks(reason, spans, appDir), options);
			if (Cause.isDieReason(reason))
				return dieBlocks(reason.defect, spanBlocks(reason, spans, appDir), displayPath, options?.stackFrames ?? "app");
			return [];
		});
	};
}
