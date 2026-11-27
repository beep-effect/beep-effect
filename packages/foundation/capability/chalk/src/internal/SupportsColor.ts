/**
 * Node.js color support detection for Chalk, delegated to the shared colour-level decision of `@beep/runtime-env`.
 *
 * **Details**
 *
 * `ColorLevel.fromEnv` decides the level: `FORCE_COLOR` first (`0` disables, `1`, `2` and `3` force a level), then a
 * non-empty `NO_COLOR`, then a stream that is not a TTY, then the `TERM` and `COLORTERM` capability table. CI alone
 * never enables colour. Chalk adds only its argv flags: when neither `FORCE_COLOR` nor a non-empty `NO_COLOR` or
 * `NODE_DISABLE_COLORS` is set, a `--no-color`, `--color=16m`, `--color=256` or `--color` flag before `--` stands in for
 * `FORCE_COLOR` `0`, `3`, `2` or `1`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as NodeProcess from "node:process";
import * as NodeTty from "node:tty";
import { $ChalkId } from "@beep/identity/packages";
import * as ColorLevel from "@beep/runtime-env/ColorLevel";
import { A, O, Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { ColorSupport } from "./ChalkSchema.ts";
import type { ColorInfo, ColorSupportLevel } from "./ChalkSchema.ts";

const $I = $ChalkId.create("Domain");

class StreamLikeModel extends S.Opaque<StreamLikeModel, { readonly brand: unique symbol }>()(
  S.Struct({
    isTTY: S.optionalKey(S.Boolean),
  }).pipe(
    $I.annoteSchema("StreamLike", {
      description: "Minimal output stream metadata used by Chalk color support detection.",
    })
  )
) {
  static readonly decodeOption = S.decodeUnknownOption(StreamLikeModel);
  static readonly normalize = flow(
    StreamLikeModel.decodeOption,
    O.getOrElse(() => StreamLikeModel.make({}))
  );
}

type StreamLike = typeof StreamLikeModel.Encoded;

class SupportsColorOptionsModel extends S.Opaque<SupportsColorOptionsModel, { readonly brand: unique symbol }>()(
  S.Struct({
    sniffFlags: S.optionalKey(S.Boolean),
  }).pipe(
    $I.annoteSchema("SupportsColorOptions", {
      description: "Options that tune Chalk color support detection.",
    })
  )
) {
  static readonly decodeOption = S.decodeUnknownOption(SupportsColorOptionsModel);
  static readonly normalize = flow(
    SupportsColorOptionsModel.decodeOption,
    O.getOrElse(() => SupportsColorOptionsModel.make({}))
  );
}

type SupportsColorOptions = typeof SupportsColorOptionsModel.Encoded;

const runtimeProcessLikeModelArgvDefault = A.empty<string>();
const runtimeProcessLikeModelEnvDefault = {};
class RuntimeProcessLikeModel extends S.Opaque<RuntimeProcessLikeModel, { readonly brand: unique symbol }>()(
  S.Struct({
    argv: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(runtimeProcessLikeModelArgvDefault)),
      S.withDecodingDefaultType(Effect.succeed(runtimeProcessLikeModelArgvDefault))
    ),
    env: S.Record(S.String, S.UndefinedOr(S.String)).pipe(
      S.withConstructorDefault(Effect.succeed(runtimeProcessLikeModelEnvDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(runtimeProcessLikeModelEnvDefault))
    ),
  }).pipe(
    $I.annoteSchema("RuntimeProcessLike", {
      description: "Minimal process metadata used by Chalk color support detection.",
    })
  )
) {
  static readonly decodeOption = S.decodeUnknownOption(RuntimeProcessLikeModel);
  static readonly normalize = flow(
    RuntimeProcessLikeModel.decodeOption,
    O.getOrElse(() => RuntimeProcessLikeModel.make({}))
  );
}

type RuntimeProcessLike = typeof RuntimeProcessLikeModel.Encoded;

type CreateSupportsColorInput = {
  readonly options?: SupportsColorOptions;
  readonly runtimeProcessLike?: RuntimeProcessLike;
  readonly stream?: StreamLike;
};

type Env = RuntimeProcessLikeModel["env"];

const disabledColorFlags = ["no-color", "no-colors", "color=false", "color=never"] as const;

const basicColorFlags = ["color", "colors", "color=true", "color=always"] as const;

const trueColorFlags = ["color=16m", "color=full", "color=truecolor"] as const;

const ansi256ColorFlags = ["color=256"] as const;

const forceColorByFlagPriority: ReadonlyArray<readonly [ReadonlyArray<string>, string]> = [
  [disabledColorFlags, "0"],
  [trueColorFlags, "3"],
  [ansi256ColorFlags, "2"],
  [basicColorFlags, "1"],
];

const supportLevels: { readonly [Level in ColorLevel.ColorLevel]: ColorSupportLevel } = {
  none: 0,
  basic: 1,
  "256": 2,
  truecolor: 3,
};

const normalizeStreamLike = StreamLikeModel.normalize;

const normalizeSupportsColorOptions = SupportsColorOptionsModel.normalize;

const normalizeRuntimeProcessLike = RuntimeProcessLikeModel.normalize;

const flagPrefix = Match.type<string>().pipe(
  Match.when(Str.startsWith("-"), () => ""),
  Match.when(
    (flag) => Str.length(flag) === 1,
    () => "-"
  ),
  Match.orElse(() => "--")
);

const equalsArgument =
  (expected: string) =>
  (actual: string): boolean =>
    actual === expected;

const isBeforeArgumentTerminator =
  (terminatorPosition: O.Option<number>) =>
  (position: number): boolean =>
    pipe(
      terminatorPosition,
      O.match({
        onNone: () => true,
        onSome: (terminator) => position < terminator,
      })
    );

const hasFlag = (flag: string, argv: ReadonlyArray<string>): boolean => {
  const position = pipe(argv, A.findFirstIndex(equalsArgument(`${flagPrefix(flag)}${flag}`)));
  const terminatorPosition = pipe(argv, A.findFirstIndex(equalsArgument("--")));

  return pipe(position, O.exists(isBeforeArgumentTerminator(terminatorPosition)));
};

const hasAnyFlag =
  (argv: ReadonlyArray<string>) =>
  (flags: ReadonlyArray<string>): boolean =>
    A.some(flags, (flag) => hasFlag(flag, argv));

const flagForceColor = (argv: ReadonlyArray<string>): O.Option<string> =>
  A.findFirst(forceColorByFlagPriority, ([flags, value]) =>
    pipe(flags, O.liftPredicate(hasAnyFlag(argv)), O.as(value))
  );

const isSetValue: (value: string | undefined) => boolean = flow(O.fromUndefinedOr, O.exists(Str.isNonEmpty));

const defersToFlags = (env: Env): boolean =>
  P.isUndefined(env.FORCE_COLOR) && !isSetValue(env.NO_COLOR) && !isSetValue(env.NODE_DISABLE_COLORS);

const withFlagOverlay = (env: Env, argv: ReadonlyArray<string>, sniffFlags: boolean | undefined): Env =>
  pipe(
    env,
    O.liftPredicate((current) => sniffFlags !== false && defersToFlags(current)),
    O.flatMap(() => flagForceColor(argv)),
    O.match({
      onNone: () => env,
      onSome: (FORCE_COLOR) => ({ ...env, FORCE_COLOR }),
    })
  );

const translateLevel = (level: ColorSupportLevel): ColorInfo =>
  Match.type<ColorSupportLevel>().pipe(
    Match.when(0, () => false as const),
    Match.orElse((enabledLevel) =>
      ColorSupport.make({
        has16m: enabledLevel >= 3,
        has256: enabledLevel >= 2,
        hasBasic: true,
        level: enabledLevel,
      })
    )
  )(level);

const currentRuntimeProcessLike: RuntimeProcessLike = {
  argv: NodeProcess.argv,
  env: NodeProcess.env,
};

/**
 * Detect color support for a stream and process-like runtime.
 *
 * **Example** (Force color via env)
 *
 * ```ts
 * import { createSupportsColor } from "@beep/chalk/internal/SupportsColor"
 *
 * const support = createSupportsColor({
 *   stream: { isTTY: true },
 *   runtimeProcessLike: { argv: [], env: { FORCE_COLOR: "1" } }
 * })
 * console.log(support)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const createSupportsColor = ({
  options = {},
  runtimeProcessLike = currentRuntimeProcessLike,
  stream = {},
}: CreateSupportsColorInput = {}): ColorInfo => {
  const { isTTY } = normalizeStreamLike(stream);
  const { sniffFlags } = normalizeSupportsColorOptions(options);
  const { argv, env } = normalizeRuntimeProcessLike(runtimeProcessLike);
  const level = ColorLevel.fromEnv(withFlagOverlay(env, argv, sniffFlags), isTTY === true);

  return translateLevel(supportLevels[level]);
};

/**
 * Color support detected for the current Node.js stdout and stderr streams.
 *
 * **Example** (Log detected stdout support)
 *
 * ```ts
 * import { detectedSupportsColor } from "@beep/chalk/internal/SupportsColor"
 *
 * console.log(detectedSupportsColor.stdout)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const detectedSupportsColor = {
  stderr: createSupportsColor({ stream: { isTTY: NodeTty.isatty(2) } }),
  stdout: createSupportsColor({ stream: { isTTY: NodeTty.isatty(1) } }),
};
