/**
 * Node.js color support detection for Chalk.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import os from "node:os";
import process from "node:process";
import tty from "node:tty";
import { $ChalkId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import { flow, Match, pipe } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { ColorSupport, ColorSupportLevel } from "./ChalkSchema.ts";
import type { ColorInfo, ColorSupportLevel as ColorSupportLevelType } from "./ChalkSchema.ts";

const $I = $ChalkId.create("Domain");

class StreamLikeModel extends S.Class<StreamLikeModel>($I`StreamLike`)(
  {
    isTTY: S.optionalKey(S.Boolean),
  },
  $I.annote("StreamLike", {
    description: "Minimal output stream metadata used by Chalk color support detection.",
  })
) {
  static readonly decodeOption = S.decodeUnknownOption(StreamLikeModel);
  static readonly normalize = flow(
    StreamLikeModel.decodeOption,
    O.getOrElse(() => StreamLikeModel.make({}))
  );
}

type StreamLike = typeof StreamLikeModel.Encoded;

class SupportsColorOptionsModel extends S.Class<SupportsColorOptionsModel>($I`SupportsColorOptions`)(
  {
    sniffFlags: S.optionalKey(S.Boolean),
  },
  $I.annote("SupportsColorOptions", {
    description: "Options that tune Chalk color support detection.",
  })
) {
  static readonly decodeOption = S.decodeUnknownOption(SupportsColorOptionsModel);
  static readonly normalize = flow(
    SupportsColorOptionsModel.decodeOption,
    O.getOrElse(() => SupportsColorOptionsModel.make({}))
  );
}

type SupportsColorOptions = typeof SupportsColorOptionsModel.Encoded;

class RuntimeProcessLikeModel extends S.Class<RuntimeProcessLikeModel>($I`RuntimeProcessLike`)(
  {
    argv: S.Array(S.String).pipe(SchemaUtils.withEmptyArrayDefaults<string>()),
    env: S.Record(S.String, S.UndefinedOr(S.String)).pipe(SchemaUtils.withKeyDefaults({})),
    osRelease: S.optionalKey(S.String),
    platform: S.optionalKey(S.String),
  },
  $I.annote("RuntimeProcessLike", {
    description: "Minimal process metadata used by Chalk color support detection.",
  })
) {
  static readonly decodeOption = S.decodeUnknownOption(RuntimeProcessLikeModel);
  static readonly normalize = flow(
    RuntimeProcessLikeModel.decodeOption,
    O.getOrElse(() => RuntimeProcessLikeModel.make({}))
  );
}

type RuntimeProcessLike = typeof RuntimeProcessLikeModel.Encoded;

class SupportsColorDecisionInputModel extends S.Class<SupportsColorDecisionInputModel>($I`SupportsColorDecisionInput`)(
  {
    argv: S.Array(S.String),
    env: S.Record(S.String, S.UndefinedOr(S.String)),
    isTTY: S.optionalKey(S.Boolean),
    osRelease: S.optionalKey(S.String),
    platform: S.optionalKey(S.String),
    sniffFlags: S.optionalKey(S.Boolean),
  },
  $I.annote("SupportsColorDecisionInput", {
    description: "Normalized decision input for Chalk color support heuristics.",
  })
) {}

type SupportsColorDecisionInput = typeof SupportsColorDecisionInputModel.Encoded;

class ColorHeuristicInputModel extends S.Class<ColorHeuristicInputModel>($I`ColorHeuristicInput`)(
  {
    argv: S.Array(S.String),
    env: S.Record(S.String, S.UndefinedOr(S.String)),
    forceColor: S.Option(ColorSupportLevel),
    isTTY: S.optionalKey(S.Boolean),
    minimumLevel: ColorSupportLevel,
    osRelease: S.optionalKey(S.String),
    platform: S.optionalKey(S.String),
    sniffFlags: S.optionalKey(S.Boolean),
  },
  $I.annote("ColorHeuristicInput", {
    description: "Prepared inputs shared by Chalk color support heuristics.",
  })
) {}

type ColorHeuristicInput = typeof ColorHeuristicInputModel.Encoded;

type ColorLevelHeuristic = (input: ColorHeuristicInput) => O.Option<ColorSupportLevel>;

class WindowsReleaseModel extends S.Class<WindowsReleaseModel>($I`WindowsRelease`)(
  {
    build: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    major: S.Int.check(S.isGreaterThanOrEqualTo(0)),
  },
  $I.annote("WindowsRelease", {
    description: "Parsed Windows release metadata used to infer terminal color support.",
  })
) {
  static readonly fromOsRelease: (osRelease: O.Option<string>) => WindowsRelease = flow(
    O.getOrElse(() => "0.0.0"),
    Str.split("."),
    ([major = "0", , build = "0"]) =>
      WindowsReleaseModel.make({
        build: parseIntegerSegment(build),
        major: parseIntegerSegment(major),
      })
  );
}

type WindowsRelease = typeof WindowsReleaseModel.Encoded;

class TermProgramInfoModel extends S.Class<TermProgramInfoModel>($I`TermProgramInfo`)(
  {
    majorVersion: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    program: S.String,
  },
  $I.annote("TermProgramInfo", {
    description: "Terminal program metadata used to infer color support.",
  })
) {
  static readonly fromEnvironment = (
    program: string,
    env: Readonly<Record<string, string | undefined>>
  ): TermProgramInfo =>
    TermProgramInfoModel.make({
      majorVersion: parseIntegerSegment(firstVersionSegment(env.TERM_PROGRAM_VERSION)),
      program,
    });
}

type TermProgramInfo = typeof TermProgramInfoModel.Encoded;

const disabledColorFlags = ["no-color", "no-colors", "color=false", "color=never"] as const;

const basicColorFlags = ["color", "colors", "color=true", "color=always"] as const;

const trueColorFlags = ["color=16m", "color=full", "color=truecolor"] as const;

const ansi256ColorFlags = ["color=256"] as const;

const highColorCiEnvironmentKeys = ["GITHUB_ACTIONS", "GITEA_ACTIONS", "CIRCLECI"] as const;

const basicColorCiEnvironmentKeys = ["TRAVIS", "APPVEYOR", "GITLAB_CI", "BUILDKITE", "DRONE"] as const;

const trueColorTerminals: ReadonlyArray<string> = ["xterm-kitty", "xterm-ghostty", "wezterm"];

const normalizeStreamLike = StreamLikeModel.normalize;

const normalizeSupportsColorOptions = SupportsColorOptionsModel.normalize;

const normalizeRuntimeProcessLike = RuntimeProcessLikeModel.normalize;

const level0: ColorSupportLevelType = 0;

const level1: ColorSupportLevelType = 1;

const level2: ColorSupportLevelType = 2;

const level3: ColorSupportLevelType = 3;

const flagPrefix = Match.type<string>().pipe(
  Match.when(Str.startsWith("-"), () => ""),
  Match.when(
    (flag) => Str.length(flag) === 1,
    () => "-"
  ),
  Match.orElse(() => "--")
);

const normalizeParsedForceColorLevel: (level: number) => ColorSupportLevel = Match.type<number>().pipe(
  Match.when(
    (level) => level <= 0,
    () => level0
  ),
  Match.when(1, () => level1),
  Match.when(2, () => level2),
  Match.orElse(() => level3)
);

const forceColorIntegerPattern = /^-?\d+$/;

const parseIntegerSegment = (segment: string): number => {
  const parsed = Number.parseInt(segment, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const literalForceColorLevel: (value: string) => O.Option<ColorSupportLevel> = Match.type<string>().pipe(
  Match.when("true", () => O.some(level1)),
  Match.when("false", () => O.some(level0)),
  Match.when(Str.isEmpty, () => O.some(level1)),
  Match.orElse(O.none<ColorSupportLevel>)
);

const colorLevelWhen = (level: ColorSupportLevel) => flow(O.liftPredicate(P.isTruthy), O.as(level));

const matchesPattern = (pattern: RegExp) => flow(Str.match(pattern), O.isSome);

const isDisabledColorLevel = (level: ColorSupportLevel): level is 0 => level === 0;

const hasNoColorEnvironment = (env: Readonly<Record<string, string | undefined>>): boolean =>
  P.isNotUndefined(env.NO_COLOR);

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

const hasAnyFlag =
  (flags: ReadonlyArray<string>) =>
  (argv: ReadonlyArray<string>): boolean =>
    A.some(flags, (flag) => hasFlag(flag, argv));

const hasAnyEnvironmentValue =
  (keys: ReadonlyArray<string>) =>
  (env: Readonly<Record<string, string | undefined>>): boolean =>
    A.some(keys, (key) => P.isNotUndefined(env[key]));

const isAzurePipelinesEnvironment = (env: Readonly<Record<string, string | undefined>>): boolean =>
  P.isNotUndefined(env.TF_BUILD) && P.isNotUndefined(env.AGENT_NAME);

const isHighColorCiEnvironment = hasAnyEnvironmentValue(highColorCiEnvironmentKeys);

const isBasicColorCiEnvironment = (env: Readonly<Record<string, string | undefined>>): boolean =>
  hasAnyEnvironmentValue(basicColorCiEnvironmentKeys)(env) || env.CI_NAME === "codeship";

const isModernTeamCityVersion = matchesPattern(/^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/);

const isAnsi256Terminal = matchesPattern(/-256(color)?$/i);

const isBasicColorTerminal = matchesPattern(/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i);

const hasTrueColorTerminalName: (term: O.Option<string>) => boolean = O.exists((name) =>
  A.contains(trueColorTerminals, name)
);

const readCurrentRuntimeProcessLike = (): RuntimeProcessLike => ({
  argv: process.argv,
  env: process.env,
  osRelease: os.release(),
  platform: process.platform,
});

const currentRuntimeProcessLike: RuntimeProcessLike = readCurrentRuntimeProcessLike();

const hasFlag = (flag: string, argv: ReadonlyArray<string>): boolean => {
  const position = pipe(argv, A.findFirstIndex(equalsArgument(`${flagPrefix(flag)}${flag}`)));
  const terminatorPosition = pipe(argv, A.findFirstIndex(equalsArgument("--")));

  return pipe(position, O.exists(isBeforeArgumentTerminator(terminatorPosition)));
};

const detectFlagForceColor = (argv: ReadonlyArray<string>): O.Option<ColorSupportLevel> =>
  pipe(
    [
      colorLevelWhen(level0)(hasAnyFlag(disabledColorFlags)(argv)),
      colorLevelWhen(level1)(hasAnyFlag(basicColorFlags)(argv)),
    ],
    O.firstSomeOf
  );

const parseNumericForceColorLevel: (value: string) => O.Option<ColorSupportLevel> = flow(
  Str.trim,
  O.liftPredicate(matchesPattern(forceColorIntegerPattern)),
  O.map((level) => normalizeParsedForceColorLevel(Number.parseInt(level, 10)))
);

const envForceColor = (env: Readonly<Record<string, string | undefined>>): O.Option<ColorSupportLevel> =>
  pipe(
    env.FORCE_COLOR,
    O.fromNullishOr,
    O.flatMap((value) =>
      pipe(
        literalForceColorLevel(value),
        O.orElse(() => parseNumericForceColorLevel(value))
      )
    )
  );

const translateLevel = (level: ColorSupportLevel): ColorInfo =>
  Match.type<ColorSupportLevel>().pipe(
    Match.when(level0, () => false as const),
    Match.orElse((enabledLevel) =>
      ColorSupport.make({
        has16m: enabledLevel >= 3,
        has256: enabledLevel >= 2,
        hasBasic: true,
        level: enabledLevel,
      })
    )
  )(level);

const resolveForceColor = (input: SupportsColorDecisionInput): O.Option<ColorSupportLevel> =>
  Match.type<boolean>().pipe(
    Match.when(true, () => envForceColor(input.env)),
    Match.orElse(() =>
      pipe(
        envForceColor(input.env),
        O.orElse(() => detectFlagForceColor(input.argv))
      )
    )
  )(input.sniffFlags === false);

const detectForcedOffColorLevel: ColorLevelHeuristic = ({ forceColor }) =>
  pipe(forceColor, O.filter(isDisabledColorLevel));

const detectNoColorEnvironmentLevel: ColorLevelHeuristic = ({ env, forceColor }) =>
  colorLevelWhen(level0)(hasNoColorEnvironment(env) && O.isNone(forceColor));

const detectSniffFlagColorLevel: ColorLevelHeuristic = ({ argv, sniffFlags }) =>
  pipe(
    sniffFlags !== false,
    O.liftPredicate(P.isTruthy),
    O.flatMap(() =>
      pipe(
        [
          colorLevelWhen(level3)(hasAnyFlag(trueColorFlags)(argv)),
          colorLevelWhen(level2)(hasAnyFlag(ansi256ColorFlags)(argv)),
        ],
        O.firstSomeOf
      )
    )
  );

const detectAzurePipelinesColorLevel: ColorLevelHeuristic = ({ env }) =>
  colorLevelWhen(level1)(isAzurePipelinesEnvironment(env));

const detectNonTtyColorLevel: ColorLevelHeuristic = ({ forceColor, isTTY }) =>
  colorLevelWhen(level0)(isTTY !== true && O.isNone(forceColor));

const detectDumbTerminalColorLevel: ColorLevelHeuristic = ({ env, minimumLevel }) =>
  colorLevelWhen(minimumLevel)(env.TERM === "dumb");

const parseWindowsRelease = (osRelease: string | undefined): WindowsRelease =>
  WindowsReleaseModel.fromOsRelease(O.fromUndefinedOr(osRelease));

const selectWindowsBuildColorLevel: (build: number) => ColorSupportLevel = Match.type<number>().pipe(
  Match.when(
    (build) => build >= 14931,
    () => level3
  ),
  Match.orElse(() => level2)
);

const selectWindowsReleaseColorLevel: (release: WindowsRelease) => ColorSupportLevel =
  Match.type<WindowsRelease>().pipe(
    Match.when(
      ({ build, major }) => major >= 10 && build >= 10586,
      ({ build }) => selectWindowsBuildColorLevel(build)
    ),
    Match.orElse(() => level1)
  );

const detectWindowsColorLevel: ColorLevelHeuristic = ({ osRelease, platform }) =>
  pipe(
    platform === "win32",
    O.liftPredicate(P.isTruthy),
    O.map(() => selectWindowsReleaseColorLevel(parseWindowsRelease(osRelease)))
  );

const selectCiColorLevel = (minimumLevel: ColorSupportLevel) =>
  Match.type<Readonly<Record<string, string | undefined>>>().pipe(
    Match.when(isHighColorCiEnvironment, () => level3),
    Match.when(isBasicColorCiEnvironment, () => level1),
    Match.orElse(() => minimumLevel)
  );

const detectCiColorLevel: ColorLevelHeuristic = ({ env, minimumLevel }) =>
  pipe(
    env.CI,
    O.fromNullishOr,
    O.map(() => selectCiColorLevel(minimumLevel)(env))
  );

const selectTeamCityColorLevel: (version: string) => ColorSupportLevel = Match.type<string>().pipe(
  Match.when(isModernTeamCityVersion, () => level1),
  Match.orElse(() => level0)
);

const detectTeamCityColorLevel: ColorLevelHeuristic = ({ env }) =>
  pipe(env.TEAMCITY_VERSION, O.fromNullishOr, O.map(selectTeamCityColorLevel));

const isTrueColorTerminal = (env: Readonly<Record<string, string | undefined>>): boolean =>
  env.COLORTERM === "truecolor" || hasTrueColorTerminalName(O.fromNullishOr(env.TERM));

const detectTrueColorTerminalLevel: ColorLevelHeuristic = ({ env }) => colorLevelWhen(level3)(isTrueColorTerminal(env));

const firstVersionSegment = (version: string | undefined): string =>
  pipe(
    version ?? "",
    Str.split("."),
    A.head,
    O.getOrElse(() => "0")
  );

const selectITermColorLevel: (version: number) => ColorSupportLevel = Match.type<number>().pipe(
  Match.when(
    (version) => version >= 3,
    () => level3
  ),
  Match.orElse(() => level2)
);

const selectTermProgramColorLevel: (info: TermProgramInfo) => ColorSupportLevel = Match.type<TermProgramInfo>().pipe(
  Match.when(
    ({ program }) => program === "iTerm.app",
    ({ majorVersion }) => selectITermColorLevel(majorVersion)
  ),
  Match.when(
    ({ program }) => program === "Apple_Terminal",
    () => level2
  ),
  Match.orElse(() => level0)
);

const detectTermProgramColorLevel: ColorLevelHeuristic = ({ env }) =>
  pipe(
    env.TERM_PROGRAM,
    O.fromNullishOr,
    O.map((program) => selectTermProgramColorLevel(TermProgramInfoModel.fromEnvironment(program, env)))
  );

const detectTerminalPatternColorLevel: ColorLevelHeuristic = ({ env }) =>
  pipe(
    [
      pipe(env.TERM, O.fromNullishOr, O.filter(isAnsi256Terminal), O.as(level2)),
      pipe(env.TERM, O.fromNullishOr, O.filter(isBasicColorTerminal), O.as(level1)),
      pipe(env.COLORTERM, O.fromNullishOr, O.as(level1)),
    ],
    O.firstSomeOf
  );

const makeSupportsColorDecisionInput = (
  argv: SupportsColorDecisionInput["argv"],
  env: SupportsColorDecisionInput["env"],
  isTTY: SupportsColorDecisionInput["isTTY"],
  osRelease: SupportsColorDecisionInput["osRelease"],
  platform: SupportsColorDecisionInput["platform"],
  sniffFlags: SupportsColorDecisionInput["sniffFlags"]
): SupportsColorDecisionInput => ({
  argv,
  env,
  ...O.getSomesStruct({
    isTTY: O.fromUndefinedOr(isTTY),
    osRelease: O.fromUndefinedOr(osRelease),
    platform: O.fromUndefinedOr(platform),
    sniffFlags: O.fromUndefinedOr(sniffFlags),
  }),
});

const supportsColorLevel = ({
  argv,
  env,
  isTTY,
  osRelease,
  platform,
  sniffFlags,
}: SupportsColorDecisionInput): ColorSupportLevel => {
  const decisionInput = makeSupportsColorDecisionInput(argv, env, isTTY, osRelease, platform, sniffFlags);
  const forceColor = resolveForceColor(decisionInput);
  const heuristicInput: ColorHeuristicInput = {
    ...decisionInput,
    forceColor,
    minimumLevel: pipe(
      forceColor,
      O.getOrElse(() => level0)
    ),
  };

  return pipe(
    [
      detectForcedOffColorLevel(heuristicInput),
      detectNoColorEnvironmentLevel(heuristicInput),
      detectSniffFlagColorLevel(heuristicInput),
      detectAzurePipelinesColorLevel(heuristicInput),
      detectNonTtyColorLevel(heuristicInput),
      detectDumbTerminalColorLevel(heuristicInput),
      detectWindowsColorLevel(heuristicInput),
      detectCiColorLevel(heuristicInput),
      detectTeamCityColorLevel(heuristicInput),
      detectTrueColorTerminalLevel(heuristicInput),
      detectTermProgramColorLevel(heuristicInput),
      detectTerminalPatternColorLevel(heuristicInput),
    ],
    O.firstSomeOf,
    O.getOrElse(() => heuristicInput.minimumLevel)
  );
};

/**
 * Detect color support for a stream and process-like runtime.
 *
 * **Example** (Force color via env)
 *
 * ```ts
 * import { createSupportsColor } from "./SupportsColor.ts"
 *
 * const support = createSupportsColor({ isTTY: true }, {}, { argv: [], env: { FORCE_COLOR: "1" } })
 * console.log(support)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const createSupportsColor = (
  stream: StreamLike = {},
  options: SupportsColorOptions = {},
  runtimeProcessLike: RuntimeProcessLike = currentRuntimeProcessLike
): ColorInfo => {
  const normalizedStream = normalizeStreamLike(stream);
  const normalizedOptions = normalizeSupportsColorOptions(options);
  const normalizedRuntimeProcessLike = normalizeRuntimeProcessLike(runtimeProcessLike);

  return translateLevel(
    supportsColorLevel(
      makeSupportsColorDecisionInput(
        normalizedRuntimeProcessLike.argv,
        normalizedRuntimeProcessLike.env,
        normalizedStream.isTTY,
        normalizedRuntimeProcessLike.osRelease,
        normalizedRuntimeProcessLike.platform,
        normalizedOptions.sniffFlags
      )
    )
  );
};

/**
 * Color support detected for the current Node.js stdout and stderr streams.
 *
 * **Example** (Log detected stdout support)
 *
 * ```ts
 * import { detectedSupportsColor } from "./SupportsColor.ts"
 *
 * console.log(detectedSupportsColor.stdout)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const detectedSupportsColor = {
  stderr: createSupportsColor({ isTTY: tty.isatty(2) }),
  stdout: createSupportsColor({ isTTY: tty.isatty(1) }),
};
