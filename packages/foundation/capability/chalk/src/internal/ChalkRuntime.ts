/**
 * Internal Chalk builder runtime.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ChalkId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { pipe, Tuple } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { ansiStyles, getModelAnsi, getStyleEntry } from "./AnsiStyles.ts";
import { AnsiRenderLevel, ColorModelName, ColorSupportLevel, StyleName } from "./ChalkSchema.ts";
import { ColorSupportLevelInput } from "./PublicSurface.ts";
import { stringEncaseCRLFWithFirstIndex, stringReplaceAll } from "./Utilities.ts";
import type { ColorInfo, ColorSupportLevel as ColorSupportLevelType } from "./ChalkSchema.ts";
import type { ChalkConstructorOptions } from "./PublicSurface.ts";

const $I = $ChalkId.create("Domain");
class ChalkNoColorState extends S.Class<ChalkNoColorState>($I`ChalkNoColorState`)(
  {
    level: S.tag(0),
  },
  $I.annote("ChalkNoColorState", {
    description: "Chalk builder state for disabled color output.",
  })
) {}

class ChalkAnsiColorState extends S.Class<ChalkAnsiColorState>($I`ChalkAnsiColorState`)(
  {
    level: S.tag(1),
  },
  $I.annote("ChalkAnsiColorState", {
    description: "Chalk builder state for basic ANSI color output.",
  })
) {}

class ChalkAnsi256ColorState extends S.Class<ChalkAnsi256ColorState>($I`ChalkAnsi256ColorState`)(
  {
    level: S.tag(2),
  },
  $I.annote("ChalkAnsi256ColorState", {
    description: "Chalk builder state for ANSI 256-color output.",
  })
) {}

class ChalkTrueColorState extends S.Class<ChalkTrueColorState>($I`ChalkTrueColorState`)(
  {
    level: S.tag(3),
  },
  $I.annote("ChalkTrueColorState", {
    description: "Chalk builder state for truecolor output.",
  })
) {}

export const ChalkState = ColorSupportLevel.mapMembers(
  Tuple.evolve([
    () => ChalkNoColorState,
    () => ChalkAnsiColorState,
    () => ChalkAnsi256ColorState,
    () => ChalkTrueColorState,
  ])
).pipe(
  $I.annoteSchema("ChalkState", {
    description: "Discriminated Chalk builder color state keyed by color support level.",
  }),
  S.toTaggedUnion("level")
);
type ChalkState = typeof ChalkState.Type;
type MutableChalkState = {
  -readonly [Key in keyof ChalkState]: ChalkState[Key];
};

class Styler extends S.Class<Styler>($I`Styler`)(
  {
    open: S.NonEmptyString,
    close: S.NonEmptyString,
    openAll: S.NonEmptyString,
    closeAll: S.NonEmptyString,
    parent: S.UndefinedOr(S.suspend((): S.Codec<Styler.Codec> => Styler)),
  },
  $I.annote("Styler", {
    description: "Represents a style modifier for terminal output formatting.",
  })
) {}

declare namespace Styler {
  export type Codec = {
    readonly open: string;
    readonly close: string;
    readonly openAll: string;
    readonly closeAll: string;
    readonly parent: Styler | undefined;
  };
}

class BuilderMeta extends S.Class<BuilderMeta>($I`BuilderMeta`)(
  {
    isEmpty: S.Boolean,
    state: ChalkState,
    styler: S.UndefinedOr(Styler),
  },
  $I.annote("BuilderMeta", {
    description: "Represents metadata for a chalk builder instance.",
  })
) {}

type ChalkFunction = (...arguments_: ReadonlyArray<unknown>) => string;
type ChalkPrototype = object;

const builderMetaMap = new WeakMap<ChalkFunction, BuilderMeta>();

const levelMapping: Readonly<Record<ColorSupportLevelType, AnsiRenderLevel>> = {
  0: AnsiRenderLevel.Enum.ansi,
  1: AnsiRenderLevel.Enum.ansi,
  2: AnsiRenderLevel.Enum.ansi256,
  3: AnsiRenderLevel.Enum.ansi16m,
};

class MissingBuilderMetadataError extends TaggedErrorClass<MissingBuilderMetadataError>(
  $I`MissingBuilderMetadataError`
)(
  "MissingBuilderMetadataError",
  {
    message: S.String,
  },
  $I.annote("MissingBuilderMetadataError", {
    description: "Raised when Chalk builder metadata is unexpectedly unavailable.",
  })
) {}

const normalizeColorSupportLevel = (level: unknown): ColorSupportLevelType =>
  ColorSupportLevel.fromUnknown(ColorSupportLevelInput.fromUnknown(level));

const setChalkStateLevel = (state: ChalkState, level: unknown): void => {
  (state as MutableChalkState).level = normalizeColorSupportLevel(level);
};

const getBuilderMeta = (builder: ChalkFunction): BuilderMeta => {
  const meta = builderMetaMap.get(builder);

  if (P.isUndefined(meta)) {
    throw MissingBuilderMetadataError.make({
      message: "Missing Chalk builder metadata.",
    });
  }

  return meta;
};

const isTemplateStringsArray = (value: unknown): value is TemplateStringsArray =>
  A.isArray(value) && P.hasProperty(value, "raw") && A.isArray(value.raw);

const renderTemplateArguments = (strings: TemplateStringsArray, substitutions: ReadonlyArray<unknown>): string =>
  A.reduce(
    strings,
    "",
    (rendered, text, index) => rendered + text + (index < substitutions.length ? `${substitutions[index]}` : "")
  );

const renderJoinArgument = (argument: unknown): string => (P.isNullish(argument) ? "" : `${argument}`);

const renderArguments = (arguments_: ReadonlyArray<unknown>): string => {
  const [first] = arguments_;

  if (isTemplateStringsArray(first)) {
    return renderTemplateArguments(first, A.drop(arguments_, 1));
  }

  return arguments_.length === 1 ? `${first}` : pipe(arguments_, A.map(renderJoinArgument), A.join(" "));
};

const capitalizeModelName = (modelName: string): string =>
  `${Str.toUpperCase(Str.slice(0, 1)(modelName))}${Str.slice(1)(modelName)}`;

const createStyler = (open: string, close: string, parent: Styler | undefined): Styler =>
  P.isUndefined(parent)
    ? Styler.make({
        close,
        closeAll: close,
        open,
        openAll: open,
        parent,
      })
    : Styler.make({
        close,
        closeAll: close + parent.closeAll,
        open,
        openAll: parent.openAll + open,
        parent,
      });

const applyStyle = (builder: ChalkFunction, text: string): string => {
  const { isEmpty, state, styler } = getBuilderMeta(builder);

  if (state.level <= 0 || text.length === 0) {
    return isEmpty ? "" : text;
  }

  if (styler === undefined) {
    return text;
  }

  let rendered = text;
  let currentStyler: Styler | undefined = styler;

  if (Str.includes("\u001B")(rendered)) {
    do {
      rendered = stringReplaceAll(rendered, currentStyler.close, { replacer: currentStyler.open });
      currentStyler = currentStyler.parent;
    } while (P.isNotUndefined(currentStyler));
  }

  rendered = pipe(
    rendered,
    Str.indexOf("\n"),
    O.match({
      onNone: () => rendered,
      onSome: (index) =>
        stringEncaseCRLFWithFirstIndex(rendered, styler.closeAll, {
          postfix: styler.openAll,
          index,
        }),
    })
  );

  return styler.openAll + rendered + styler.closeAll;
};

const createPrototype = (): ChalkPrototype => {
  const prototype = Object.defineProperties(() => "", {
    level: {
      enumerable: true,
      get(this: ChalkFunction) {
        return getBuilderMeta(this).state.level;
      },
      set(this: ChalkFunction, level: unknown) {
        setChalkStateLevel(getBuilderMeta(this).state, level);
      },
    },
    visible: {
      get(this: ChalkFunction) {
        const { state, styler } = getBuilderMeta(this);
        const builder = createBuilder(state, styler, true, prototype);

        Object.defineProperty(this, "visible", {
          value: builder,
        });

        return builder;
      },
    },
  });

  for (const styleName of StyleName.Options) {
    Object.defineProperty(prototype, styleName, {
      get(this: ChalkFunction) {
        const { isEmpty, state, styler } = getBuilderMeta(this);
        const style = getStyleEntry(styleName);
        const builder = createBuilder(state, createStyler(style.open, style.close, styler), isEmpty, prototype);

        Object.defineProperty(this, styleName, {
          value: builder,
        });

        return builder;
      },
    });
  }

  for (const modelName of ColorModelName.Options) {
    Object.defineProperty(prototype, modelName, {
      get(this: ChalkFunction) {
        const level = getBuilderMeta(this).state.level;

        return function modelBuilder(this: ChalkFunction, ...arguments_: ReadonlyArray<number | string>) {
          const { isEmpty, state, styler } = getBuilderMeta(this);
          const open = getModelAnsi(modelName, levelMapping[level], "color", ...arguments_);
          return createBuilder(state, createStyler(open, ansiStyles.color.close, styler), isEmpty, prototype);
        };
      },
    });

    const backgroundModelName = `bg${capitalizeModelName(modelName)}`;

    Object.defineProperty(prototype, backgroundModelName, {
      get(this: ChalkFunction) {
        const level = getBuilderMeta(this).state.level;

        return function modelBuilder(this: ChalkFunction, ...arguments_: ReadonlyArray<number | string>) {
          const { isEmpty, state, styler } = getBuilderMeta(this);
          const open = getModelAnsi(modelName, levelMapping[level], "bgColor", ...arguments_);
          return createBuilder(state, createStyler(open, ansiStyles.bgColor.close, styler), isEmpty, prototype);
        };
      },
    });
  }

  return prototype;
};

const prototype = createPrototype();

const createBuilder = (
  state: ChalkState,
  styler: Styler | undefined,
  isEmpty: boolean,
  currentPrototype: ChalkPrototype
): ChalkFunction => {
  const builder = (...arguments_: ReadonlyArray<unknown>): string => applyStyle(builder, renderArguments(arguments_));

  builderMetaMap.set(builder, {
    isEmpty,
    state,
    styler,
  });

  Object.setPrototypeOf(builder, currentPrototype);

  return builder;
};

/**
 * Create a Chalk instance factory from detected default color support.
 *
 * @example
 * ```ts
 * import { makeCreateChalk } from "@beep/chalk/Chalk"
 *
 * const createChalk = makeCreateChalk(false)
 * const chalk = createChalk({ level: 0 })
 * console.log(chalk("plain"))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeCreateChalk = (defaultColorInfo: ColorInfo) => {
  const defaultLevel = defaultColorInfo === false ? 0 : defaultColorInfo.level;

  return (options?: ChalkConstructorOptions): ChalkFunction =>
    createBuilder(
      {
        level: P.isUndefined(options?.level) ? defaultLevel : normalizeColorSupportLevel(options.level),
      },
      undefined,
      false,
      prototype
    );
};
