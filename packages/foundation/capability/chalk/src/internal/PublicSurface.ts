/**
 * Public-facing Chalk constructor and instance surface contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ChalkId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import type { ColorSupportLevel } from "./ChalkSchema.ts";

const $I = $ChalkId.create("Domain");

const colorSupportLevelInputMessage = "The `level` option should be an integer from 0 to 3";

const ColorSupportLevelInputChecks = S.makeFilterGroup(
  [
    S.isGreaterThanOrEqualTo(0).annotate({
      description: "A Chalk color support level greater than or equal to 0.",
      message: colorSupportLevelInputMessage,
    }),
    S.isLessThanOrEqualTo(3).annotate({
      description: "A Chalk color support level less than or equal to 3.",
      message: colorSupportLevelInputMessage,
    }),
  ],
  {
    identifier: $I`ColorSupportLevelInputCheck`,
    title: "Chalk Color Support Level",
    description: "Checks that a numeric Chalk color support level is between 0 and 3 inclusive.",
  }
);

/**
 * Numeric Chalk color support level input accepted by constructor and setter boundaries.
 *
 * **Details**
 *
 * The schema keeps the public constructor input broad as `number` while
 * validating that runtime values are integer levels `0` through `3`.
 *
 * **Example** (Decode color support level)
 *
 * ```ts
 * import { ColorSupportLevelInput } from "@beep/chalk/Chalk"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownSync(ColorSupportLevelInput)
 * console.log(decode(3))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ColorSupportLevelInput = S.Int.check(ColorSupportLevelInputChecks).pipe(
  $I.annoteSchema("ColorSupportLevelInput", {
    description: "A numeric Chalk color support level accepted by constructor and setter boundaries.",
  }),
  SchemaUtils.withCodecStatics
);

class ChalkConstructorOptionsModel extends S.Class<ChalkConstructorOptionsModel>($I`ChalkConstructorOptions`)(
  {
    level: S.optionalKey(ColorSupportLevelInput),
  },
  $I.annote("ChalkConstructorOptions", {
    description: "Constructor options accepted when creating an isolated Chalk instance.",
  })
) {}

/**
 * Method and property surface shared by Chalk instances.
 *
 * **Example** (Type chalk instance surface)
 *
 * ```ts
 * import type { ChalkInstanceSurface } from "@beep/chalk/Chalk"
 *
 * const render = (chalk: ChalkInstanceSurface) => chalk.red.bold("error")
 * console.log(render)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare abstract class ChalkInstanceSurface {
  ansi256(index: number): this;
  bgAnsi256(index: number): this;
  readonly bgBlack: this;
  readonly bgBlackBright: this;
  readonly bgBlue: this;
  readonly bgBlueBright: this;
  readonly bgCyan: this;
  readonly bgCyanBright: this;
  readonly bgGray: this;
  readonly bgGreen: this;
  readonly bgGreenBright: this;
  readonly bgGrey: this;
  bgHex(color: string): this;
  readonly bgMagenta: this;
  readonly bgMagentaBright: this;
  readonly bgRed: this;
  readonly bgRedBright: this;
  bgRgb(red: number, green: number, blue: number): this;
  readonly bgWhite: this;
  readonly bgWhiteBright: this;
  readonly bgYellow: this;
  readonly bgYellowBright: this;
  readonly black: this;
  readonly blackBright: this;
  readonly blue: this;
  readonly blueBright: this;
  readonly bold: this;
  readonly cyan: this;
  readonly cyanBright: this;
  readonly dim: this;
  readonly gray: this;
  readonly green: this;
  readonly greenBright: this;
  readonly grey: this;
  hex(color: string): this;
  readonly hidden: this;
  readonly inverse: this;
  readonly italic: this;
  level: ColorSupportLevel;
  readonly magenta: this;
  readonly magentaBright: this;
  readonly overline: this;
  readonly red: this;
  readonly redBright: this;
  readonly reset: this;
  rgb(red: number, green: number, blue: number): this;
  readonly strikethrough: this;
  readonly underline: this;
  readonly visible: this;
  readonly white: this;
  readonly whiteBright: this;
  readonly yellow: this;
  readonly yellowBright: this;
}

/**
 * Schema for options accepted by Chalk constructors.
 *
 * **Example** (Decode constructor options)
 *
 * ```ts
 * import { ChalkConstructorOptions } from "@beep/chalk/Chalk"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownSync(ChalkConstructorOptions)
 * console.log(decode({ level: 3 }).level)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ChalkConstructorOptions = ChalkConstructorOptionsModel;

/**
 * Plain constructor options accepted by Chalk constructors.
 *
 * **Details**
 *
 * Derived from {@link ChalkConstructorOptions}' encoded schema side so callers
 * can continue to pass object literals like `{ level: 3 }`.
 *
 * **Example** (Assign constructor options object)
 *
 * ```ts
 * import type { ChalkConstructorOptions } from "@beep/chalk/Chalk"
 *
 * const options: ChalkConstructorOptions = { level: 3 }
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ChalkConstructorOptions = typeof ChalkConstructorOptions.Encoded;

/**
 * Base constructor shape wrapped by the Chalk constructor proxy.
 *
 * **Example** (Assign constructor base class)
 *
 * ```ts
 * import type { ChalkConstructorBase } from "@beep/chalk/Chalk"
 *
 * const Base: ChalkConstructorBase = class {}
 * console.log(Base)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ChalkConstructorBase = new () => object;

type ChalkConstructorFor<Base extends ChalkConstructorBase> = new (
  options?: ChalkConstructorOptions
) => InstanceType<Base>;

/**
 * Function that creates a Chalk instance from constructor options.
 *
 * **Example** (Type chalk creator function)
 *
 * ```ts
 * import type { ChalkCreator } from "@beep/chalk/Chalk"
 *
 * const create: ChalkCreator = () => ({})
 * console.log(create)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ChalkCreator = (options?: ChalkConstructorOptions) => object;

/**
 * Wrap a constructor base so `new` delegates to a Chalk creator.
 *
 * **Example** (Wrap constructor with creator)
 *
 * ```ts
 * import { makeChalkConstructor } from "@beep/chalk/Chalk"
 *
 * const Base = class {}
 * const Chalk = makeChalkConstructor(Base, () => ({}))
 * console.log(new Chalk())
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeChalkConstructor: {
  <Base extends ChalkConstructorBase>(ConstructorBase: Base, create: ChalkCreator): ChalkConstructorFor<Base>;
  (create: ChalkCreator): <Base extends ChalkConstructorBase>(ConstructorBase: Base) => ChalkConstructorFor<Base>;
} = dual(
  2,
  <Base extends ChalkConstructorBase>(ConstructorBase: Base, create: ChalkCreator): ChalkConstructorFor<Base> =>
    new Proxy(ConstructorBase, {
      construct(_target, [options]: ReadonlyArray<ChalkConstructorOptions | undefined>) {
        return create(options);
      },
    }) as unknown as ChalkConstructorFor<Base>
);
