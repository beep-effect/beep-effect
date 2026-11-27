/**
 * Internal Chalk builder runtime.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ChalkId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import { pipe } from "effect/Function";
import * as MutableRef from "effect/MutableRef";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { ansiStyles, getModelAnsi, getStyleEntry } from "./AnsiStyles.ts";
import { AnsiRenderLevel, ColorModelName, ColorSupportLevel, StyleName } from "./ChalkSchema.ts";
import { ColorSupportLevelInput } from "./PublicSurface.ts";
import { stringEncaseCRLFWithFirstIndex, stringReplaceAll } from "./Utilities.ts";
import type { ColorInfo, ColorSupportLevel as ColorSupportLevelType } from "./ChalkSchema.ts";
import type { ChalkConstructorOptions } from "./PublicSurface.ts";

const $I = $ChalkId.create("Domain");
class Styler extends S.Opaque<Styler, { readonly brand: unique symbol }>()(
  S.Struct({
    open: S.NonEmptyString,
    close: S.NonEmptyString,
    openAll: S.NonEmptyString,
    closeAll: S.NonEmptyString,
    parent: S.UndefinedOr(S.suspend((): S.Codec<Styler.Codec> => Styler)),
  }).pipe(
    $I.annoteSchema("Styler", {
      description: "Represents a style modifier for terminal output formatting.",
    })
  )
) {}

declare namespace Styler {
  export type Codec = {
    readonly open: string;
    readonly close: string;
    readonly openAll: string;
    readonly closeAll: string;
    readonly parent: Codec | undefined;
  };
}

class BuilderMeta extends S.Opaque<BuilderMeta, { readonly brand: unique symbol }>()(
  S.Struct({
    isEmpty: S.Boolean,
    styler: S.UndefinedOr(Styler),
  }).pipe(
    $I.annoteSchema("BuilderMeta", {
      description: "Represents metadata for a chalk builder instance.",
    })
  )
) {}

type ChalkFunction = (...arguments_: ReadonlyArray<unknown>) => string;
type ChalkPrototype = object;

const builderMetaMap = new WeakMap<ChalkFunction, BuilderMeta>();

const sharedLevelCellByBuilder = new WeakMap<ChalkFunction, MutableRef.MutableRef<ColorSupportLevelType>>();

const levelMapping: Readonly<Record<ColorSupportLevelType, AnsiRenderLevel>> = {
  0: AnsiRenderLevel.Enum.ansi,
  1: AnsiRenderLevel.Enum.ansi,
  2: AnsiRenderLevel.Enum.ansi256,
  3: AnsiRenderLevel.Enum.ansi16m,
};

class MissingBuilderMetadataError extends S.TaggedError<MissingBuilderMetadataError, { readonly brand: unique symbol }>(
  $I`MissingBuilderMetadataError`
)(
  "MissingBuilderMetadataError",
  {
    message: S.String,
  },
  $I.annoteError<MissingBuilderMetadataError>("MissingBuilderMetadataError", {
    description: "Raised when Chalk builder metadata is unexpectedly unavailable.",
  })
) {}

const normalizeColorSupportLevel = (level: unknown): ColorSupportLevelType =>
  S.decodeUnknownResult(ColorSupportLevelInput)(level).pipe(
    Result.getOrThrow,
    S.decodeUnknownResult(ColorSupportLevel),
    Result.getOrThrow
  );

const lookupBuilder = <A>(entries: WeakMap<ChalkFunction, A>, builder: ChalkFunction): A => {
  const entry = entries.get(builder);

  if (P.isUndefined(entry)) {
    throw MissingBuilderMetadataError.make({
      message: "Missing Chalk builder metadata.",
    });
  }

  return entry;
};

const getBuilderLevel = (builder: ChalkFunction): MutableRef.MutableRef<ColorSupportLevelType> =>
  lookupBuilder(sharedLevelCellByBuilder, builder);

const getBuilderMeta = (builder: ChalkFunction): BuilderMeta => lookupBuilder(builderMetaMap, builder);

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
  const { isEmpty, styler } = getBuilderMeta(builder);

  if (MutableRef.get(getBuilderLevel(builder)) <= 0 || text.length === 0) {
    return isEmpty ? "" : text;
  }

  if (styler === undefined) {
    return text;
  }

  let rendered = text;
  let currentStyler: Styler.Codec | undefined = styler;

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
        return MutableRef.get(getBuilderLevel(this));
      },
      set(this: ChalkFunction, level: unknown) {
        MutableRef.set(getBuilderLevel(this), normalizeColorSupportLevel(level));
      },
    },
    visible: {
      get(this: ChalkFunction) {
        const { styler } = getBuilderMeta(this);
        const builder = createBuilder(getBuilderLevel(this), styler, true, prototype);

        Object.defineProperty(this, "visible", {
          value: builder,
        });

        return builder;
      },
    },
  });

  for (const styleName of StyleName.literals) {
    Object.defineProperty(prototype, styleName, {
      get(this: ChalkFunction) {
        const { isEmpty, styler } = getBuilderMeta(this);
        const style = getStyleEntry(styleName);
        const builder = createBuilder(
          getBuilderLevel(this),
          createStyler(style.open, style.close, styler),
          isEmpty,
          prototype
        );

        Object.defineProperty(this, styleName, {
          value: builder,
        });

        return builder;
      },
    });
  }

  for (const modelName of ColorModelName.literals) {
    Object.defineProperty(prototype, modelName, {
      get(this: ChalkFunction) {
        const level = MutableRef.get(getBuilderLevel(this));

        return function modelBuilder(this: ChalkFunction, ...arguments_: ReadonlyArray<number | string>) {
          const { isEmpty, styler } = getBuilderMeta(this);
          const open = getModelAnsi(modelName, levelMapping[level], "color", ...arguments_);
          return createBuilder(
            getBuilderLevel(this),
            createStyler(open, ansiStyles.color.close, styler),
            isEmpty,
            prototype
          );
        };
      },
    });

    const backgroundModelName = `bg${capitalizeModelName(modelName)}`;

    Object.defineProperty(prototype, backgroundModelName, {
      get(this: ChalkFunction) {
        const level = MutableRef.get(getBuilderLevel(this));

        return function modelBuilder(this: ChalkFunction, ...arguments_: ReadonlyArray<number | string>) {
          const { isEmpty, styler } = getBuilderMeta(this);
          const open = getModelAnsi(modelName, levelMapping[level], "bgColor", ...arguments_);
          return createBuilder(
            getBuilderLevel(this),
            createStyler(open, ansiStyles.bgColor.close, styler),
            isEmpty,
            prototype
          );
        };
      },
    });
  }

  return prototype;
};

const prototype = createPrototype();

const createBuilder = (
  level: MutableRef.MutableRef<ColorSupportLevelType>,
  styler: Styler | undefined,
  isEmpty: boolean,
  currentPrototype: ChalkPrototype
): ChalkFunction => {
  const builder = (...arguments_: ReadonlyArray<unknown>): string => applyStyle(builder, renderArguments(arguments_));

  builderMetaMap.set(
    builder,
    BuilderMeta.make({
      isEmpty,
      styler,
    })
  );
  sharedLevelCellByBuilder.set(builder, level);

  Object.setPrototypeOf(builder, currentPrototype);

  return builder;
};

/**
 * Create a Chalk instance factory from detected default color support.
 *
 * **Example** (Create chalk with level zero)
 *
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

  return (options?: ChalkConstructorOptions): ChalkFunction => {
    const level = P.isUndefined(options?.level) ? defaultLevel : normalizeColorSupportLevel(options.level);
    return createBuilder(MutableRef.make(level), undefined, false, prototype);
  };
};
