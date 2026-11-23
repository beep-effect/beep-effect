import { CommandNeutralizer } from "@beep/github-commands";
import { $CliKitId } from "@beep/identity/packages";
import { Audience, TerminalEnv } from "@beep/runtime-env";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as MutableRef from "effect/MutableRef";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CliFailure } from "../CliFailure.ts";
import { CliLinks } from "../CliLinks.ts";
import { CliTheme } from "../CliTheme.ts";
import { sanitize } from "../Fmt.ts";
import { Glyphs } from "../Glyphs.ts";
import { Render, RenderContext } from "../Render.ts";
import { autoFormat } from "./autoFormat.ts";
import { DisplayPath } from "./declared.ts";
import type { AudienceShape } from "@beep/runtime-env";
import type { Block, Document, Inline } from "../Doc.ts";
import type { LinkTargetInput } from "../LinkTarget.ts";
import type { Style, TokenName } from "../Token.ts";

const $I = $CliKitId.create("internal/failureTarget");

/**
 * Where a failure report is written to: the context the renderer lays out for, and which renderer.
 *
 * **Example** (Inspect the schema)
 *
 * ```ts
 * import { FailureTarget } from "@beep/cli-kit/internal/failureTarget"
 *
 * console.log(typeof FailureTarget.make) // function
 * ```
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export class FailureTarget extends S.Opaque<FailureTarget, { readonly brand: unique symbol }>()(
  S.Struct({
    /** A module of the running program, whose package `spans: "app"` keeps. */
    appModule: S.optionalKey(S.String).pipe(
      $I.annoteKey("FailureTarget.appModule", { description: "The appModule field of FailureTarget." })
    ),
    /** `true` for the fallback: nothing is known of the audience or the runner, so it is assumed, not read. */
    assumed: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("FailureTarget.assumed", { description: "The assumed field of FailureTarget." })
    ),
    /** The ctx field. */
    ctx: RenderContext.pipe($I.annoteKey("FailureTarget.ctx", { description: "The ctx field of FailureTarget." })),
    /** The format field. */
    format: S.Union([S.Literal("plain"), S.Literal("ansi"), S.Literal("githubLog")]).pipe(
      $I.annoteKey("FailureTarget.format", { description: "The format field of FailureTarget." })
    ),
    /** Which spans the report's `in:` trail names; `app` when absent. */
    spans: S.optionalKey(S.suspend(() => SpanSetting)).pipe(
      $I.annoteKey("FailureTarget.spans", { description: "The spans field of FailureTarget." })
    ),
    /** Which stack frames a defect's report shows; `app` when absent. */
    stackFrames: S.optionalKey(S.Union([S.Literal("app"), S.Literal("all")])).pipe(
      $I.annoteKey("FailureTarget.stackFrames", { description: "The stackFrames field of FailureTarget." })
    ),
  }).pipe($I.annoteSchema("FailureTarget", { description: "Plain FailureTarget data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import type { FailureTarget } from "@beep/cli-kit/internal/failureTarget"
 *
 * const accepts = (_value: FailureTarget.Encoded) => true
 * console.log(typeof accepts) // function
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FailureTarget {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof FailureTarget.Encoded;
}

/**
 * The run's report settings `CliRuntime.main` takes from `env`, recorded with the target.
 *
 * **Example** (Validate plain options)
 *
 * ```ts
 * import { FailureSettings } from "@beep/cli-kit/internal/failureTarget"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(FailureSettings)({ spans: "off" })) // true
 * ```
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export class FailureSettings extends S.Opaque<FailureSettings, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The appModule field. */
    appModule: S.optionalKey(S.String).pipe(
      $I.annoteKey("FailureSettings.appModule", { description: "The appModule field of FailureSettings." })
    ),
    /** The displayPath field. */
    displayPath: S.optionalKey(DisplayPath).pipe(
      $I.annoteKey("FailureSettings.displayPath", { description: "The displayPath field of FailureSettings." })
    ),
    /** The spans field. */
    spans: S.optionalKey(S.suspend(() => SpanSetting)).pipe(
      $I.annoteKey("FailureSettings.spans", { description: "The spans field of FailureSettings." })
    ),
    /** The stackFrames field. */
    stackFrames: S.optionalKey(S.Union([S.Literal("app"), S.Literal("all")])).pipe(
      $I.annoteKey("FailureSettings.stackFrames", { description: "The stackFrames field of FailureSettings." })
    ),
  }).pipe($I.annoteSchema("FailureSettings", { description: "Plain FailureSettings data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { FailureSettings } from "@beep/cli-kit/internal/failureTarget"
 * import * as S from "effect/Schema"
 *
 * const plain: FailureSettings.Encoded = { spans: "off" }
 * console.log(S.is(FailureSettings)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FailureSettings {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof FailureSettings.Encoded;
}

/**
 * A cell `CliRuntime.main` provides outside failure reporting and fills from inside it.
 *
 * **Details**
 *
 * `reportFailures` catches OUTSIDE the layers `main` provides, so the theme, terminal, audience and links a report is
 * rendered with are not in its context when a failure arrives. The environment layer writes the target here as it is
 * built, and an audience flag rewrites it once the flag is read. A `Reference` defaulting to `undefined`, so a
 * program run without `main` finds no cell and falls back, and no state is shared between runs.
 *
 * **Example** (Read a missing failure target cell)
 *
 * ```ts
 * import { FailureTargetCell } from "@beep/cli-kit/internal/failureTarget"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.runSync(FailureTargetCell)) // undefined
 * ```
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const FailureTargetCell = Context.Reference<
  MutableRef.MutableRef<FailureTarget.Encoded | undefined> | undefined
>($I`FailureTargetCell`, { defaultValue: () => undefined });

/**
 * What a report is rendered with when nothing is known about the terminal: plain text, no limit, no escapes.
 *
 * **Example** (Inspect the plain fallback policy)
 *
 * ```ts
 * import { fallbackTarget } from "@beep/cli-kit/internal/failureTarget"
 *
 * console.log(fallbackTarget.format) // plain
 * console.log(fallbackTarget.ctx.neutralizeWorkflowCommands) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const fallbackTarget: FailureTarget.Encoded = {
  ctx: {
    width: Number.POSITIVE_INFINITY,
    audience: "agent",
    color: "none",
    paint: dual(2, (_token: TokenName | Style.Encoded, text: string): string => text),
    glyphs: Glyphs.ascii,
    link: dual(2, (_target: LinkTargetInput, label: string): string => label),
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
 * **Details**
 *
 * Each is read with `serviceOption`, so this never adds a requirement. `audience` overrides the one in context: an
 * audience flag is provided deeper than the environment layer, where the report cannot see it.
 */
const build = Effect.fn("FailureTarget.build")(function* (
  audience?: AudienceShape,
  settings: FailureSettings.Encoded = {}
): Effect.fn.Return<FailureTarget.Encoded | undefined> {
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
    Effect.provideService(Audience, shape)
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
 * **Example** (Refresh without a reporting cell)
 *
 * ```ts
 * import { refreshFailureTarget } from "@beep/cli-kit/internal/failureTarget"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.runSync(refreshFailureTarget())) // undefined
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const refreshFailureTarget: {
  (audience?: AudienceShape): Effect.Effect<void>;
  (audience: AudienceShape | undefined, settings: FailureSettings.Encoded): Effect.Effect<void>;
  (settings: FailureSettings.Encoded): (audience?: AudienceShape) => Effect.Effect<void>;
} = dual(
  (args) => args.length === 0 || args.length >= 2 || args[0] === undefined || "kind" in args[0],
  Effect.fnUntraced(function* (audience?: AudienceShape, settings?: FailureSettings.Encoded) {
    const cell = yield* FailureTargetCell;
    if (cell === undefined) return;
    // A rewrite for an audience flag keeps the settings the environment layer recorded.
    const recorded = MutableRef.get(cell);
    const target = yield* build(
      audience,
      settings ??
        O.getSomesStruct({
          displayPath: O.fromUndefinedOr(recorded?.ctx.displayPath),
          stackFrames: O.fromUndefinedOr(recorded?.stackFrames),
          spans: O.fromUndefinedOr(recorded?.spans),
          appModule: O.fromUndefinedOr(recorded?.appModule),
        })
    );
    if (target !== undefined) MutableRef.set(cell, target);
  })
);

/**
 * The target a report is rendered with: the cell, else the services in context, else the plain fallback.
 *
 * **Example** (Read the fallback without services)
 *
 * ```ts
 * import { currentTarget } from "@beep/cli-kit/internal/failureTarget"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.runSync(currentTarget).format) // plain
 * ```
 *
 * @internal
 * @category getters
 * @since 0.0.0
 */
export const currentTarget: Effect.Effect<FailureTarget.Encoded> = Effect.gen(function* () {
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
  A.map(doc, (block): Block => {
    if (block._tag === "Paragraph") return { ...block, content: dropStatus(block.content) };
    if (block._tag === "Tree") return { ...block, root: { ...block.root, label: dropStatus(block.root.label) } };
    return block;
  });

/**
 * The lines of a failure report for a target, with or without the leading status.
 *
 * **Example** (Render an empty cause)
 *
 * ```ts
 * import { linesOf } from "@beep/cli-kit/internal/failureTarget"
 * import * as Cause from "effect/Cause"
 * import { fallbackTarget } from "@beep/cli-kit/internal/failureTarget"
 *
 * console.log(JSON.stringify(linesOf(Cause.empty, fallbackTarget))) // []
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const linesOf: {
  (
    target: FailureTarget.Encoded,
    status?: boolean,
    spans?: SpanSetting | undefined
  ): (cause: Cause.Cause<unknown>) => ReadonlyArray<string>;
  (
    cause: Cause.Cause<unknown>,
    target: FailureTarget.Encoded,
    status?: boolean,
    spans?: SpanSetting | undefined
  ): ReadonlyArray<string>;
} = dual(
  (args) => Cause.isCause(args[0]),
  (
    cause: Cause.Cause<unknown>,
    target: FailureTarget.Encoded,
    status?: boolean,
    spans: SpanSetting | undefined = target.spans
  ): ReadonlyArray<string> => {
    const full = CliFailure.toDoc(cause, {
      displayPath: target.ctx.displayPath,
      ...O.getSomesStruct({ stackFrames: O.fromUndefinedOr(target.stackFrames) }),
      ...O.getSomesStruct({ spans: O.fromUndefinedOr(spans) }),
      ...O.getSomesStruct({ appModule: O.fromUndefinedOr(target.appModule) }),
    });
    const doc = status === false ? withoutStatus(full) : full;
    const text = Render[target.format](doc, target.ctx);
    return text === "" ? [] : Str.split(text, "\n");
  }
);

/**
 * A consumer `render`'s lines, made safe: neutralized under GitHub Actions, and stripped of escapes for an agent.
 *
 * **Details**
 *
 * What a consumer's `render` returns is text the kit did not build and cannot vouch for: it interpolates error
 * messages, file names, whatever the failure carried. So it gets the output policy the kit's own report has. Under
 * GitHub Actions (the target says so, and with no environment services at all it is assumed) every line is neutralized,
 * a returned line break splitting it first. For an agent or a CI audience the escapes are removed too (GitHub Actions
 * detects as `ci`, and the kit's own output for it has none). For a person they are kept: the kit cannot tell the consumer's own colour from an injected sequence, so the consumer's `render` is
 * responsible for sanitising what it interpolates. An audience that was only assumed is not an agent.
 *
 * **Example** (Split consumer output into safe lines)
 *
 * ```ts
 * import { guardConsumerLines } from "@beep/cli-kit/internal/failureTarget"
 * import * as Effect from "effect/Effect"
 *
 * console.log(JSON.stringify(Effect.runSync(guardConsumerLines(["first\nsecond"])))) // ["first","second"]
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const guardConsumerLines = (lines: ReadonlyArray<string>): Effect.Effect<ReadonlyArray<string>> =>
  Effect.map(currentTarget, (target) => {
    // An agent or a CI gets no escape of any kind (the kit's own output for them is already escape-free); only a person
    // keeps what the consumer wrote.
    const noEscapes = target.assumed !== true && (target.ctx.audience === "agent" || target.ctx.audience === "ci");
    const stripped = noEscapes ? A.map(lines, sanitize) : lines;
    return target.ctx.neutralizeWorkflowCommands === true
      ? A.flatMap(stripped, (line) => CommandNeutralizer.lines(line))
      : stripped;
  });

/**
 * The plain lines of a failure, for a caller with no services: what `CliRuntime.defaultRender` returns.
 *
 * **Example** (Render an empty cause without services)
 *
 * ```ts
 * import { plainFailureLines } from "@beep/cli-kit/internal/failureTarget"
 * import * as Cause from "effect/Cause"
 *
 * console.log(JSON.stringify(plainFailureLines(Cause.empty))) // []
 * ```
 *
 * @internal
 * @category formatting
 * @since 0.0.0
 */
export const plainFailureLines: {
  (status?: boolean, spans?: SpanSetting): (cause: Cause.Cause<unknown>) => ReadonlyArray<string>;
  (cause: Cause.Cause<unknown>, status?: boolean, spans?: SpanSetting): ReadonlyArray<string>;
} = dual(
  (args) => Cause.isCause(args[0]),
  (cause: Cause.Cause<unknown>, status = true, spans?: SpanSetting): ReadonlyArray<string> =>
    linesOf(cause, fallbackTarget, status, spans)
);

const SpanSetting = LiteralKit(["app", "all", "off"]).pipe(
  $I.annoteSchema("SpanSetting", { description: "The span trail visibility setting." })
);
type SpanSetting = typeof SpanSetting.Type;
const isSpanSetting = S.is(SpanSetting);

/**
 * The span trail setting, as `CliLog`'s level is read: the explicit `spans` when given (the variable is then not read
 * at all), else the variable named `envVar` through `Config`, case-insensitive, unset or empty meaning the default.
 * A value that is not a setting is ignored, with the warning to log.
 *
 * **Example** (Prefer the explicit span setting)
 *
 * ```ts
 * import { readSpans } from "@beep/cli-kit/internal/failureTarget"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.runSync(readSpans("off", undefined)).spans) // off
 * ```
 *
 * @internal
 * @category configuration
 * @since 0.0.0
 */
export const readSpans: {
  (
    envVar: string | undefined
  ): (explicit: SpanSetting | undefined) => Effect.Effect<{
    readonly spans: SpanSetting | undefined;
    readonly invalid: string | undefined;
  }>;
  (
    explicit: SpanSetting | undefined,
    envVar: string | undefined
  ): Effect.Effect<{
    readonly spans: SpanSetting | undefined;
    readonly invalid: string | undefined;
  }>;
} = dual(
  2,
  Effect.fnUntraced(function* (explicit: SpanSetting | undefined, envVar: string | undefined) {
    if (explicit !== undefined) return { spans: explicit, invalid: undefined };
    if (envVar === undefined) return { spans: undefined, invalid: undefined };
    const raw = yield* Config.option(Config.String(envVar)).pipe(Effect.orElseSucceed(O.none<string>));
    if (O.isNone(raw) || raw.value === "") return { spans: undefined, invalid: undefined };
    const value = Str.toLowerCase(raw.value);
    if (isSpanSetting(value)) return { spans: value, invalid: undefined };
    return {
      spans: undefined,
      invalid: `${envVar}=${raw.value} is not a span setting (${A.join(SpanSetting.literals, "|")}); ignoring it`,
    };
  })
);
