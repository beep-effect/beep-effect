import { $ScratchpadId } from "@beep/identity/packages";
import * as Cause from "effect/Cause";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as MutableRef from "effect/MutableRef";
import * as O from "@beep/utils/Option";
import type { AudienceShape } from "../../env/index.ts";
import { Audience, TerminalEnv } from "../../env/index.ts";
import { CommandNeutralizer } from "../../github-commands/index.ts";
import { CliFailure } from "../CliFailure.ts";
import { CliLinks } from "../CliLinks.ts";
import { CliTheme } from "../CliTheme.ts";
import type { Block, Document, Inline } from "../Doc.ts";
import { sanitize } from "../Fmt.ts";
import { Glyphs } from "../Glyphs.ts";
import type { RenderContext } from "../Render.ts";
import { Render } from "../Render.ts";
import { autoFormat } from "./autoFormat.ts";

const $I = $ScratchpadId.create("effected/cli/internal/failureTarget");

/**
 * Where a failure report is written to: the context the renderer lays out for, and which renderer.
 *
 * @internal
 */
export interface FailureTarget {
	readonly ctx: RenderContext;
	readonly format: "plain" | "ansi" | "githubLog";
	/** `true` for the fallback: nothing is known of the audience or the runner, so it is assumed, not read. */
	readonly assumed?: boolean;
	/** Which stack frames a defect's report shows; `app` when absent. */
	readonly stackFrames?: "app" | "all";
	/** Which spans the report's `in:` trail names; `app` when absent. */
	readonly spans?: "app" | "all" | "off";
	/** A module of the running program, whose package `spans: "app"` keeps. */
	readonly appModule?: string;
}

/**
 * The run's report settings `CliRuntime.main` takes from `env`, recorded with the target.
 *
 * @internal
 */
export interface FailureSettings {
	readonly displayPath?: ((absolute: string) => string) | undefined;
	readonly stackFrames?: "app" | "all" | undefined;
	readonly spans?: "app" | "all" | "off" | undefined;
	readonly appModule?: string | undefined;
}

/**
 * A cell `CliRuntime.main` provides outside failure reporting and fills from inside it.
 *
 * @remarks
 * `reportFailures` catches OUTSIDE the layers `main` provides, so the theme, terminal, audience and links a report is
 * rendered with are not in its context when a failure arrives. The environment layer writes the target here as it is
 * built, and an audience flag rewrites it once the flag is read. A `Reference` defaulting to `undefined`, so a
 * program run without `main` finds no cell and falls back, and no state is shared between runs.
 *
 * @internal
 */
export const FailureTargetCell = Context.Reference<MutableRef.MutableRef<FailureTarget | undefined> | undefined>(
	$I`FailureTargetCell`,
	{ defaultValue: () => undefined },
);

/** What a report is rendered with when nothing is known about the terminal: plain text, no limit, no escapes. */
export const fallbackTarget: FailureTarget = {
	ctx: {
		width: Number.POSITIVE_INFINITY,
		audience: "agent",
		color: "none",
		paint: (_token, text) => text,
		glyphs: Glyphs.ascii,
		link: (_target, label) => label,
		displayPath: (absolute) => absolute,
		// Nothing is known about the runner here, so the report refuses to emit a workflow command: a zero-width space
		// in front of a line that starts with `::` or `##` costs nothing anywhere else.
		neutralizeWorkflowCommands: true,
	},
	format: "plain",
	assumed: true,
};

/**
 * The target for the services in the current context, or `undefined` when it lacks any of the four.
 *
 * @remarks
 * Each is read with `serviceOption`, so this never adds a requirement. `audience` overrides the one in context: an
 * audience flag is provided deeper than the environment layer, where the report cannot see it.
 */
const build = (audience?: AudienceShape, settings: FailureSettings = {}): Effect.Effect<FailureTarget | undefined> =>
	Effect.gen(function* () {
		const theme = yield* Effect.serviceOption(CliTheme);
		const terminal = yield* Effect.serviceOption(TerminalEnv);
		const current = yield* Effect.serviceOption(Audience);
		const links = yield* Effect.serviceOption(CliLinks);
		if (O.isNone(theme) || O.isNone(terminal) || O.isNone(links)) return undefined;
		const shape = audience ?? (O.isSome(current) ? current.value : undefined);
		if (shape === undefined) return undefined;
		const { displayPath, stackFrames, spans, appModule } = settings;
		const ctx = yield* Render.context("stderr", displayPath === undefined ? undefined : { displayPath }).pipe(
			Effect.provideService(CliTheme, theme.value),
			Effect.provideService(TerminalEnv, terminal.value),
			Effect.provideService(CliLinks, links.value),
			Effect.provideService(Audience, shape),
		);
		const format = yield* autoFormat(ctx.audience);
		return {
			ctx,
			format,
			...O.getSomesStruct({ stackFrames: O.fromUndefinedOr(stackFrames) }),
			...O.getSomesStruct({ spans: O.fromUndefinedOr(spans) }),
			...O.getSomesStruct({ appModule: O.fromUndefinedOr(appModule) }),
		};
	});

/**
 * Record the target for the services in context in the cell, if there is one. A no-op without a cell or services.
 *
 * @internal
 */
export const refreshFailureTarget: {
	(audience?: AudienceShape, settings?: FailureSettings): Effect.Effect<void>;
	(settings?: FailureSettings): (audience?: AudienceShape) => Effect.Effect<void>;
} = dual((args) => args.length === 0 || args.length >= 2 || args[0] === undefined || "kind" in args[0], (audience?: AudienceShape, settings?: FailureSettings): Effect.Effect<void> =>
	Effect.gen(function* () {
		const cell = yield* FailureTargetCell;
		if (cell === undefined) return;
		// A rewrite for an audience flag keeps the settings the environment layer recorded.
		const recorded = MutableRef.get(cell);
		const target = yield* build(
			audience,
			settings ?? {
				displayPath: recorded?.ctx.displayPath,
				stackFrames: recorded?.stackFrames,
				spans: recorded?.spans,
				appModule: recorded?.appModule,
			},
		);
		if (target !== undefined) MutableRef.set(cell, target);
	}));

/**
 * The target a report is rendered with: the cell, else the services in context, else the plain fallback.
 *
 * @internal
 */
export const currentTarget: Effect.Effect<FailureTarget> = Effect.gen(function* () {
	const cell = yield* FailureTargetCell;
	const recorded = cell === undefined ? undefined : MutableRef.get(cell);
	if (recorded !== undefined) return recorded;
	return (yield* build()) ?? fallbackTarget;
});

/** Content with its leading status mark (and the space after it) removed. */
const dropStatus = (content: ReadonlyArray<Inline>): ReadonlyArray<Inline> => {
	if (content[0]?._tag !== "StatusMark") return content;
	const next = content[1];
	return next?._tag === "Text" && next.value === " " ? content.slice(2) : content.slice(1);
};

/**
 * A failure document without its status marks. A failure's status leads its first paragraph, or a schema failure's
 * tree label; nothing else in the document carries one.
 */
const withoutStatus = (doc: Document): Document =>
	doc.map((block): Block => {
		if (block._tag === "Paragraph") return { ...block, content: dropStatus(block.content) };
		if (block._tag === "Tree") return { ...block, root: { ...block.root, label: dropStatus(block.root.label) } };
		return block;
	});

/**
 * The lines of a failure report for a target, with or without the leading status.
 *
 * @internal
 */
export const linesOf: {
	(target: FailureTarget, status?: boolean, spans?: "app" | "all" | "off" | undefined): (cause: Cause.Cause<unknown>) => ReadonlyArray<string>;
	(cause: Cause.Cause<unknown>, target: FailureTarget, status?: boolean, spans?: "app" | "all" | "off" | undefined): ReadonlyArray<string>;
} = dual((args) => Cause.isCause(args[0]), (
	cause: Cause.Cause<unknown>,
	target: FailureTarget,
	status: boolean = true,
	spans: "app" | "all" | "off" | undefined = target.spans,
): ReadonlyArray<string> => {
	const full = CliFailure.toDoc(cause, {
		displayPath: target.ctx.displayPath,
		...O.getSomesStruct({ stackFrames: O.fromUndefinedOr(target.stackFrames) }),
		...O.getSomesStruct({ spans: O.fromUndefinedOr(spans) }),
		...O.getSomesStruct({ appModule: O.fromUndefinedOr(target.appModule) }),
	});
	const doc = status ? full : withoutStatus(full);
	const text = Render[target.format](doc, target.ctx);
	return text === "" ? [] : text.split("\n");
});

/**
 * A consumer `render`'s lines, made safe: neutralized under GitHub Actions, and stripped of escapes for an agent.
 *
 * @remarks
 * What a consumer's `render` returns is text the kit did not build and cannot vouch for: it interpolates error
 * messages, file names, whatever the failure carried. So it gets the output policy the kit's own report has. Under
 * GitHub Actions (the target says so, and with no environment services at all it is assumed) every line is neutralized,
 * a returned line break splitting it first. For an agent or a CI audience the escapes are removed too (GitHub Actions
 * detects as `ci`, and the kit's own output for it has none). For a person they are kept: the kit cannot tell the consumer's own colour from an injected sequence, so the consumer's `render` is
 * responsible for sanitising what it interpolates. An audience that was only assumed is not an agent.
 *
 * @internal
 */
export const guardConsumerLines = (lines: ReadonlyArray<string>): Effect.Effect<ReadonlyArray<string>> =>
	Effect.map(currentTarget, (target) => {
		// An agent or a CI gets no escape of any kind (the kit's own output for them is already escape-free); only a person
		// keeps what the consumer wrote.
		const noEscapes = target.assumed !== true && (target.ctx.audience === "agent" || target.ctx.audience === "ci");
		const stripped = noEscapes ? lines.map(sanitize) : lines;
		return target.ctx.neutralizeWorkflowCommands === true
			? stripped.flatMap((line) => CommandNeutralizer.lines(line))
			: stripped;
	});

/**
 * The plain lines of a failure, for a caller with no services: what `CliRuntime.defaultRender` returns.
 *
 * @internal
 */
export const plainFailureLines: {
	(status?: boolean, spans?: "app" | "all" | "off"): (cause: Cause.Cause<unknown>) => ReadonlyArray<string>;
	(cause: Cause.Cause<unknown>, status?: boolean, spans?: "app" | "all" | "off"): ReadonlyArray<string>;
} = dual((args) => Cause.isCause(args[0]), (
	cause: Cause.Cause<unknown>,
	status = true,
	spans?: "app" | "all" | "off",
): ReadonlyArray<string> => linesOf(cause, fallbackTarget, status, spans));

const SPAN_SETTINGS: ReadonlyArray<"app" | "all" | "off"> = ["app", "all", "off"];

/**
 * The span trail setting, as `CliLog`'s level is read: the explicit `spans` when given (the variable is then not read
 * at all), else the variable named `envVar` through `Config`, case-insensitive, unset or empty meaning the default.
 * A value that is not a setting is ignored, with the warning to log.
 *
 * @internal
 */
export const readSpans: {
	(envVar: string | undefined): (explicit: "app" | "all" | "off" | undefined) => Effect.Effect<{ readonly spans: "app" | "all" | "off" | undefined; readonly invalid: string | undefined }>;
	(explicit: "app" | "all" | "off" | undefined, envVar: string | undefined): Effect.Effect<{ readonly spans: "app" | "all" | "off" | undefined; readonly invalid: string | undefined }>;
} = dual(2, (
	explicit: "app" | "all" | "off" | undefined,
	envVar: string | undefined,
): Effect.Effect<{ readonly spans: "app" | "all" | "off" | undefined; readonly invalid: string | undefined }> =>
	Effect.gen(function* () {
		if (explicit !== undefined) return { spans: explicit, invalid: undefined };
		if (envVar === undefined) return { spans: undefined, invalid: undefined };
		const raw = yield* Config.option(Config.String(envVar)).pipe(Effect.orElseSucceed(O.none<string>));
		if (O.isNone(raw) || raw.value === "") return { spans: undefined, invalid: undefined };
		const value = raw.value.toLowerCase();
		const spans = SPAN_SETTINGS.find((setting) => setting === value);
		if (spans !== undefined) return { spans, invalid: undefined };
		return {
			spans: undefined,
			invalid: `${envVar}=${raw.value} is not a span setting (${SPAN_SETTINGS.join("|")}); ignoring it`,
		};
	}));
