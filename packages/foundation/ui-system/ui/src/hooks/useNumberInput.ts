import { $UiId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import { useAtom, useAtomInitialValues, useAtomSet, useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import { Effect, flow, Match, pipe, SchemaIssue, SchemaTransformation, Tuple } from "effect";
import { constVoid, dual, identity } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
import { useId, useRef } from "react";
import { useSpinner } from "./useSpinner";
import type React from "react";

const $I = $UiId.create("hooks/useNumberInput");

const NumberInputEventKeyBase = LiteralKit([
  "ArrowDown",
  "ArrowUp",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
  "Space",
  "Tab",
  "Backspace",
  "Control",
  "Meta",
  "Home",
  "End",
  "PageDown",
  "PageUp",
  "Delete",
  "Escape",
  " ",
  "Shift",
]);
const NumberInputEventKey = NumberInputEventKeyBase.pipe(
  $I.annoteSchema("NumberInputEventKey", {
    description: "Normalized keyboard event keys recognized by the number input hook.",
  }),
  SchemaUtils.withLiteralKitStatics(NumberInputEventKeyBase)
);

const numberInputTextPatternSource = "(-|\\+)?(0|[1-9]\\d*)?(\\.)?(\\d+)?";
const numberInputTextPattern = new RegExp(`^${numberInputTextPatternSource}$`);

type NumberInputEventKey = typeof NumberInputEventKey.Type;

type EventKeyMap = Partial<Record<NumberInputEventKey, () => void>>;

type KeyboardLikeEvent = {
  readonly key: string;
  readonly keyCode: number;
};

type ModifierKeyState = {
  readonly metaKey?: boolean | undefined;
  readonly ctrlKey?: boolean | undefined;
  readonly shiftKey?: boolean | undefined;
};

type StepModifierState = readonly [coarse: boolean | undefined, fine: boolean];

type InputHandlers = {
  readonly onBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  readonly onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  readonly onWheel: (event: React.WheelEvent<HTMLInputElement>) => void;
};

type ButtonHandlers = {
  readonly onTouchStart: (event: React.TouchEvent<HTMLButtonElement>) => void;
  readonly onTouchEnd: (event: React.TouchEvent<HTMLButtonElement>) => void;
  readonly onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onMouseUp: (event: React.MouseEvent<HTMLButtonElement>) => void;
  readonly onMouseLeave: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

type SpinStartHandler = (event: React.MouseEvent<HTMLButtonElement> | React.TouchEvent<HTMLButtonElement>) => void;

type SpinStartProps = Partial<Pick<ButtonHandlers, "onMouseDown" | "onTouchStart">>;

const NumberInputText = S.String.check(
  S.isPattern(numberInputTextPattern, {
    identifier: $I`NumberInputTextPattern`,
    title: "Number Input Text",
    description: "A partial numeric string accepted while the user edits a number input.",
    message: "Number input text must be a valid editable numeric string.",
  })
).pipe(
  $I.annoteSchema("NumberInputText", {
    description: "Editable text accepted by the number input during typing.",
  }),
  SchemaUtils.withCodecStatics
);

const isCoarseStepModifier = P.Tuple([P.isTruthy, P.isUnknown]);
const isFineStepModifier = P.Tuple([P.isUnknown, P.isTruthy]);

const decodeNumberInputFiniteText = (value: string): Effect.Effect<number, SchemaIssue.Issue> =>
  pipe(
    Str.trim(value),
    O.liftPredicate(Str.isNonEmpty),
    O.map(Number),
    O.match({
      onNone: () =>
        Effect.fail(
          new SchemaIssue.InvalidValue(O.some(value), {
            message: "Number input text must contain a parseable finite number.",
          })
        ),
      onSome: Effect.succeed,
    })
  );

const encodeNumberInputFiniteText = (value: number): Effect.Effect<string> => Effect.succeed(value.toString());

const NumberInputFiniteFromText = S.String.pipe(
  S.decodeTo(
    S.Finite,
    SchemaTransformation.transformOrFail({
      decode: decodeNumberInputFiniteText,
      encode: encodeNumberInputFiniteText,
    })
  ),
  $I.annoteSchema("NumberInputFiniteFromText", {
    description: "Boundary parser from editable number input text to a finite number.",
  })
);

const PositiveFiniteStep = S.Finite.check(
  S.isGreaterThan(0, {
    identifier: $I`PositiveFiniteStepCheck`,
    title: "Positive Finite Step",
    description: "Step values must be finite numbers greater than zero.",
    message: "Number input step must be greater than zero.",
  })
).pipe(
  $I.annoteSchema("PositiveFiniteStep", {
    description: "Positive step size for number input spinner changes.",
  })
);

const NonNegativePrecision = S.Finite.check(S.isInt(), S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("NonNegativePrecision", {
    description: "A non-negative integer precision used for fixed-point formatting.",
  })
);

const normalizeEventKey = (event: KeyboardLikeEvent): O.Option<NumberInputEventKey> =>
  pipe(
    event.keyCode >= 37 && event.keyCode <= 40 && !pipe(event.key, Str.startsWith("Arrow"))
      ? `Arrow${event.key}`
      : event.key,
    O.liftPredicate(S.is(NumberInputEventKey))
  );

const isVoidHandler = (value: unknown): value is () => void => P.isFunction(value);
const toNumberOrUndefined = flow(S.decodeUnknownOption(NumberInputFiniteFromText), O.getOrUndefined);

const getMaxTouchPoints = (): number => {
  const runtimeNavigator = globalThis.navigator;

  if (P.isUndefined(runtimeNavigator)) {
    return 0;
  }

  const msMaxTouchPoints = Reflect.get(runtimeNavigator, "msMaxTouchPoints");

  return Math.max(runtimeNavigator.maxTouchPoints, P.isNumber(msMaxTouchPoints) ? msMaxTouchPoints : 0);
};

const isTouchDevice = (): boolean =>
  P.isNotUndefined(globalThis.window) && ("ontouchstart" in globalThis.window || getMaxTouchPoints() > 0);

const makeStepModifierState = (event: Partial<ModifierKeyState>): StepModifierState =>
  Tuple.make(event.shiftKey, pipe(Tuple.make(event.metaKey, event.ctrlKey), A.some(P.isTruthy)));

const getStepRatio = (event: Partial<ModifierKeyState>): number =>
  pipe(
    makeStepModifierState(event),
    (modifierState) =>
      Tuple.make(
        pipe(modifierState, O.liftPredicate(isCoarseStepModifier), O.as(10)),
        pipe(modifierState, O.liftPredicate(isFineStepModifier), O.as(0.1))
      ),
    O.firstSomeOf,
    O.getOrElse(() => 1)
  );

const isAtLeastMinimumStepFactor = (minimumStepFactor: number): P.Predicate<number> =>
  P.not((stepFactor) => stepFactor < minimumStepFactor);

const precisionFromOptions = (options: { readonly precision: number }): number =>
  P.isNumber(options) ? options : options.precision;

const callAllHandlers =
  <T>(...handlers: ReadonlyArray<undefined | ((event: T) => void)>) =>
  (event: T) =>
    A.forEach(handlers, (handler) => {
      if (P.isFunction(handler)) {
        handler(event);
      }
    });

const getSpinStartProps: {
  (handlers: Partial<ButtonHandlers> | undefined): (spin: SpinStartHandler) => SpinStartProps;
  (spin: SpinStartHandler, handlers: Partial<ButtonHandlers> | undefined): SpinStartProps;
} = dual(
  2,
  (spin: SpinStartHandler, handlers: Partial<ButtonHandlers> | undefined): SpinStartProps =>
    pipe(
      isTouchDevice(),
      O.liftPredicate(P.isTruthy),
      O.map(
        (): SpinStartProps => ({
          onTouchStart: callAllHandlers(spin, handlers?.onTouchStart),
        })
      ),
      O.getOrElse(
        (): SpinStartProps => ({
          onMouseDown: callAllHandlers(spin, handlers?.onMouseDown),
        })
      )
    )
);

const numberBoundaryInterfaceValueAtom = Atom.family((_scope: string) => Atom.make(""));

const numberInputTempInterfaceValueAtom = Atom.family((_scope: string) => Atom.make(""));

/**
 * Lowest safe integer supported by the hook defaults.
 *
 * @example
 * ```ts
 * import { minSafeInteger } from "@beep/ui/hooks/useNumberInput"
 *
 * console.log(minSafeInteger)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const minSafeInteger = Number.MIN_SAFE_INTEGER ?? -9007199254740991;

/**
 * Highest safe integer supported by the hook defaults.
 *
 * @example
 * ```ts
 * import { maxSafeInteger } from "@beep/ui/hooks/useNumberInput"
 *
 * console.log(maxSafeInteger)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const maxSafeInteger = Number.MAX_SAFE_INTEGER ?? 9007199254740991;

/**
 * Schema describing optional numeric bounds and controlled values for number input hooks.
 *
 * @example
 * ```ts
 * import { BoundaryParams } from "@beep/ui/hooks/useNumberInput"
 *
 * const params = BoundaryParams.make({ min: 0, max: 10, defaultValue: 5 })
 * console.log(params.defaultValue)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoundaryParams extends S.Class<BoundaryParams>($I`BoundaryParams`)(
  {
    defaultValue: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("BoundaryParams.defaultValue", {
        description: "Initial uncontrolled value for the number input.",
      })
    ),
    value: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("BoundaryParams.value", {
        description: "Controlled numeric value for the number input.",
      })
    ),
    min: S.Finite.pipe(
      SchemaUtils.withKeyDefaults(minSafeInteger),
      $I.annoteKey("BoundaryParams.min", {
        description: "Minimum value allowed by the number input.",
      })
    ),
    max: S.Finite.pipe(
      SchemaUtils.withKeyDefaults(maxSafeInteger),
      $I.annoteKey("BoundaryParams.max", {
        description: "Maximum value allowed by the number input.",
      })
    ),
  },
  $I.annote("BoundaryParams", {
    description: "Optional numeric boundary settings accepted by number input hooks.",
  })
) {}

/**
 * Schema describing step and precision overrides for spinner changes.
 *
 * @example
 * ```ts
 * import { SpinParams } from "@beep/ui/hooks/useNumberInput"
 *
 * const params = SpinParams.make({ step: 0.5, precision: 1 })
 * console.log(params.step)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SpinParams extends S.Class<SpinParams>($I`SpinParams`)(
  {
    precision: NonNegativePrecision.pipe(
      SchemaUtils.withKeyDefaults(0),
      $I.annoteKey("SpinParams.precision", {
        description: "Decimal precision used while formatting spinner results.",
      })
    ),
    step: PositiveFiniteStep.pipe(
      SchemaUtils.withKeyDefaults(1),
      $I.annoteKey("SpinParams.step", {
        description: "Positive increment or decrement amount for spinner changes.",
      })
    ),
  },
  $I.annote("SpinParams", {
    description: "Precision and step overrides accepted by number input increment and decrement actions.",
  })
) {}

type BoundaryParamsInput = Exclude<(typeof BoundaryParams)["~type.make.in"], void>;
type SpinParamsInput = Exclude<(typeof SpinParams)["~type.make.in"], void>;

/**
 * Convert editable number-input text into a number when the text is parseable.
 *
 * Empty strings and invalid numeric strings normalize to `Option.none()`.
 *
 * @example
 * ```typescript
 * import * as O from "effect/Option"
 * import { toNumber } from "@beep/ui/hooks/useNumberInput"
 *
 * const parsed = O.getOrUndefined(toNumber("12.5"))
 * const missing = toNumber("")
 *
 * console.log(parsed) // 12.5
 * console.log(O.isNone(missing)) // true
 * ```
 *
 * @category utilities
 * @param value - Editable text from the input or parser.
 * @returns The parsed numeric value when available.
 * @since 0.0.0
 */
export const toNumber = S.decodeUnknownOption(NumberInputFiniteFromText);

/**
 * Format an optional numeric value using a fixed decimal precision.
 *
 * Invalid numeric values normalize to an empty string so the hook can safely render
 * controlled inputs.
 *
 * @example
 * ```typescript
 * import { numberToString } from "@beep/ui/hooks/useNumberInput"
 *
 * const formatted = numberToString(12.345, 2)
 * const empty = numberToString(undefined, 2)
 *
 * console.log(formatted) // "12.35"
 * console.log(empty) // ""
 * ```
 *
 * @category utilities
 * @param value - Numeric value to render for the input.
 * @param precision - Number of fractional digits to keep.
 * @returns The formatted text representation for the current input value.
 * @since 0.0.0
 */
export const numberToString: {
  (precision: number): (value: number | undefined) => string;
  (value: number | undefined, precision?: number): string;
} = dual(2, (value: number | undefined, precision = 0): string =>
  pipe(
    O.fromUndefinedOr(value),
    O.map((numberValue) => numberValue.toFixed(precision)),
    O.filter((result) => result !== "NaN"),
    O.getOrElse(() => "")
  )
);

/**
 * Compute the effective step multiplier for an increment or decrement gesture.
 *
 * Holding `meta` or `ctrl` applies a fine-grained `0.1x` multiplier, while `shift`
 * applies a coarse `10x` multiplier. The returned value is clamped so precision
 * rounding never produces a no-op step.
 *
 * @example
 * ```typescript
 * import { getStepFactor } from "@beep/ui/hooks/useNumberInput"
 *
 * const coarse = getStepFactor({ shiftKey: true }, 2, { precision: 0 })
 * const fine = getStepFactor({ ctrlKey: true }, 2, { precision: 2 })
 *
 * console.log(coarse) // 20
 * console.log(fine) // 0.2
 * ```
 *
 * @example
 * ```typescript
 * import { pipe } from "effect"
 * import { getStepFactor } from "@beep/ui/hooks/useNumberInput"
 *
 * const factor = pipe({ metaKey: true }, getStepFactor(5, { precision: 2 }))
 *
 * console.log(factor) // 0.5
 * ```
 *
 * @category utilities
 * @param event - Modifier-key state captured from the current gesture.
 * @param step - Base step configured for the number input.
 * @param options - Decimal precision enforced by the number input.
 * @returns The effective step value for the current gesture.
 * @since 0.0.0
 */
export const getStepFactor: {
  (step: number, options: { readonly precision: number }): (event: Partial<ModifierKeyState>) => number;
  (event: Partial<ModifierKeyState>, step: number, options: { readonly precision: number }): number;
} = dual(3, (event: Partial<ModifierKeyState>, step: number, options: { readonly precision: number }): number => {
  const stepFactor = getStepRatio(event) * step;
  const precision = precisionFromOptions(options);

  return pipe(
    stepFactor,
    O.liftPredicate(isAtLeastMinimumStepFactor(1 / 10 ** precision)),
    O.getOrElse(() => step)
  );
});

/**
 * Event types reported through the `onChange` metadata callback.
 *
 * @example
 * ```ts
 * import { NumberInputEventType } from "@beep/ui/hooks/useNumberInput"
 *
 * console.log(NumberInputEventType.Options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NumberInputEventType = LiteralKit(["change", "blur"]).pipe(
  $I.annoteSchema("NumberInputEventType", {
    description: "The interaction that produced a number input change notification.",
  })
);

/**
 * Runtime type for {@link NumberInputEventType}.
 *
 * @category models
 * @since 0.0.0
 */
export type NumberInputEventType = typeof NumberInputEventType.Type;

/**
 * Error states reported through the `onChange` metadata callback.
 *
 * @example
 * ```ts
 * import { NumberInputError } from "@beep/ui/hooks/useNumberInput"
 *
 * console.log(NumberInputError.Options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NumberInputError = LiteralKit(["exceed-max", "below-min"]).pipe(
  $I.annoteSchema("NumberInputError", {
    description: "Range-validation outcomes surfaced by the number input hook.",
  })
);

/**
 * Runtime type for {@link NumberInputError}.
 *
 * @category models
 * @since 0.0.0
 */
export type NumberInputError = typeof NumberInputError.Type;

/**
 * Metadata passed to `UseNumberInputOptions.onChange`.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { NumberInputChangeMetadata, NumberInputEventType } from "@beep/ui/hooks/useNumberInput"
 *
 * const metadata = NumberInputChangeMetadata.make({
 *   error: O.none(),
 *   eventType: NumberInputEventType.Enum.change,
 *   valueText: "5"
 * })
 *
 * console.log(metadata.valueText)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NumberInputChangeMetadata extends S.Class<NumberInputChangeMetadata>($I`NumberInputChangeMetadata`)(
  {
    error: S.OptionFromNullOr(NumberInputError).pipe(
      SchemaUtils.withNoneDefault,
      $I.annoteKey("NumberInputChangeMetadata.error", {
        description: "Range-validation error when the current value is outside the configured bounds.",
      })
    ),
    eventType: S.optionalKey(NumberInputEventType).pipe(
      $I.annoteKey("NumberInputChangeMetadata.eventType", {
        description: "Interaction that produced the change callback.",
      })
    ),
    valueText: S.optionalKey(NumberInputText).pipe(
      $I.annoteKey("NumberInputChangeMetadata.valueText", {
        description: "Editable text after formatting or parser normalization.",
      })
    ),
  },
  $I.annote("NumberInputChangeMetadata", {
    description: "Context describing the latest number input change callback.",
  })
) {}

const getError = (value: number | undefined, min: number, max: number): O.Option<NumberInputError> => {
  if (!P.isNumber(value)) {
    return O.none();
  }

  return pipe(
    value,
    Match.type<number>().pipe(
      Match.when(
        (current) => current < min,
        () => O.some(NumberInputError.Enum["below-min"])
      ),
      Match.when(
        (current) => current > max,
        () => O.some(NumberInputError.Enum["exceed-max"])
      ),
      Match.orElse(O.none<NumberInputError>)
    )
  );
};

/**
 * Options accepted by {@link useNumberBoundary} and {@link useNumberInput}.
 *
 * @example
 * ```ts
 * import type { UseNumberInputOptions } from "@beep/ui/hooks/useNumberInput"
 *
 * const options: UseNumberInputOptions = { min: 0, max: 10, step: 1 }
 * console.log(options.max)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UseNumberInputOptions = BoundaryParamsInput &
  SpinParamsInput & {
    /**
     * If true, the input's value will change based on mouse wheel.
     */
    readonly allowMouseWheel?: boolean | undefined;
    /**
     * When user types number directly into the input.
     * This controls the value update when you blur out of the input.
     * - If true and the value is greater than max, the value will be reset to max.
     * - Else, the value remains the same.
     */
    readonly clampValueOnBlur?: boolean | undefined;
    /**
     * This controls the value update behavior in general.
     * - If true and you use the stepper or up/down arrow keys, the value will not exceed the max or go lower than min.
     * - If false, the value will be allowed to go out of range.
     */
    readonly keepWithinRange?: boolean | undefined;
    /**
     * If true, the input will be focused as you increment or decrement the value with the stepper.
     */
    readonly focusInputOnChange?: boolean | undefined;
    readonly formatter?: ((value: string) => string) | undefined;
    readonly parser?: ((value: string) => string) | undefined;
    /**
     * Callback function invoked whenever the input value changes.
     */
    readonly onChange?: ((value: number | undefined, metadata: NumberInputChangeMetadata) => void) | undefined;
  };

const makeBoundaryParams = (options: BoundaryParamsInput): BoundaryParams =>
  BoundaryParams.make(
    O.getSomesStruct({
      defaultValue: O.fromUndefinedOr(options.defaultValue),
      value: O.fromUndefinedOr(options.value),
      min: O.fromUndefinedOr(options.min),
      max: O.fromUndefinedOr(options.max),
    })
  );

const isPositiveFiniteStep = S.is(PositiveFiniteStep);

const makeSpinParams = (options: SpinParamsInput): SpinParams =>
  SpinParams.make(
    O.getSomesStruct({
      precision: O.fromUndefinedOr(options.precision),
      step: pipe(O.fromUndefinedOr(options.step), O.filter(isPositiveFiniteStep)),
    })
  );

// `step: 0` (or any non-positive/non-finite step) historically meant "spinning
// is a no-op". The branded SpinParams cannot carry that state, so the hooks
// collapse the effective step to 0 whenever the caller provided such a step.
const effectiveStep = (provided: number | undefined, params: SpinParams): number =>
  provided !== undefined && !isPositiveFiniteStep(provided) ? 0 : params.step;

/**
 * Low-level hook that manages string and numeric boundary state for a number input.
 *
 * Use this when you need number parsing, formatting, and range-aware increment/decrement
 * behavior but want to build your own DOM event handlers on top.
 *
 * @example
 * ```typescript
 * import React from "react"
 * import { useNumberBoundary } from "@beep/ui/hooks/useNumberInput"
 *
 * function Example() {
 *   const number = useNumberBoundary({ defaultValue: 1, min: 0, max: 10 })
 *   return React.createElement("output", null, number.interfaceValue)
 * }
 *
 * console.log(Example.name)
 * ```
 *
 * @category components
 * @param options - Number-input boundary and formatting options.
 * @returns Managed numeric and interface state helpers.
 * @since 0.0.0
 * @category components
 */
export const useNumberBoundary = (options: UseNumberInputOptions = {}, scope?: string | undefined) => {
  const generatedScope = useId();
  const boundaryScope = scope ?? generatedScope;
  const boundaryParams = makeBoundaryParams(options);
  const spinParams = makeSpinParams(options);
  const { defaultValue, value, keepWithinRange = true, formatter = identity, parser = identity } = options;
  const { min, max } = boundaryParams;
  const { precision } = spinParams;
  const step = effectiveStep(options.step, spinParams);

  const interfaceValueAtom = numberBoundaryInterfaceValueAtom(boundaryScope);
  const [storedInterfaceValue, setInterfaceValueState] = useAtom(interfaceValueAtom);

  useAtomInitialValues([[interfaceValueAtom, formatter(numberToString(defaultValue, precision))]]);

  const storedNumberValue = pipe(storedInterfaceValue, parser, toNumberOrUndefined);
  const interfaceValue =
    defaultValue === undefined && value !== storedNumberValue
      ? formatter(numberToString(value, precision))
      : storedInterfaceValue;
  const numberValue = pipe(interfaceValue, parser, toNumberOrUndefined);

  const change = (multiplier = 1, params: SpinParamsInput = {}) =>
    setInterfaceValueState((current) => {
      const requestedStep = params.step ?? step;
      const currentSpinParams = makeSpinParams({
        precision: params.precision ?? precision,
        step: requestedStep,
      });
      const result =
        pipe(
          current,
          parser,
          toNumber,
          O.getOrElse(() => 0)
        ) +
        multiplier * effectiveStep(requestedStep, currentSpinParams);
      const digits = currentSpinParams.precision;

      if (keepWithinRange) {
        if (result > max) {
          return formatter(max.toFixed(digits));
        }

        if (result < min) {
          return formatter(min.toFixed(digits));
        }
      }

      return formatter(result.toFixed(digits));
    });

  const increment = (params: SpinParamsInput = {}) => change(1, params);
  const decrement = (params: SpinParamsInput = {}) => change(-1, params);

  return {
    interfaceValueAtom,
    numberValue,
    interfaceValue,
    setInterfaceValue: flow(formatter, setInterfaceValueState),
    increment,
    decrement,
  };
};

/**
 * Fully managed number-input hook with keyboard and spinner controls.
 *
 * @example
 * ```ts
 * import React from "react"
 * import { useNumberInput } from "@beep/ui/hooks/useNumberInput"
 *
 * function Example() {
 *   const number = useNumberInput({ defaultValue: 1, min: 0, max: 10 })
 *   return React.createElement("input", { ref: number.inputRef, ...number.getInputProps() })
 * }
 *
 * console.log(Example.name)
 * ```
 *
 * @since 0.0.0
 * @category components
 */
export const useNumberInput = (options: UseNumberInputOptions = {}) => {
  const scope = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const boundaryParams = makeBoundaryParams(options);
  const spinParams = makeSpinParams(options);
  const {
    focusInputOnChange = true,
    keepWithinRange = true,
    clampValueOnBlur = true,
    allowMouseWheel = false,
    parser = identity,
    formatter = identity,
    onChange,
  } = options;
  const { min, max } = boundaryParams;
  const { precision } = spinParams;
  const step = effectiveStep(options.step, spinParams);

  const { interfaceValueAtom, interfaceValue, setInterfaceValue, numberValue, increment, decrement } =
    useNumberBoundary(options, scope);
  const tempInterfaceValue = useAtomValue(numberInputTempInterfaceValueAtom(scope));
  const setTempInterfaceValue = useAtomSet(numberInputTempInterfaceValueAtom(scope));
  const spinner = useSpinner(increment, decrement);

  useAtomInitialValues([[numberInputTempInterfaceValueAtom(scope), interfaceValue]]);

  useAtomSubscribe(interfaceValueAtom, (nextInterfaceValue) => {
    const nextNumberValue = pipe(nextInterfaceValue, parser, toNumberOrUndefined);
    onChange?.(nextNumberValue, {
      valueText: nextInterfaceValue,
      error: getError(nextNumberValue, min, max),
      eventType: NumberInputEventType.Enum.change,
    });
  });

  const spinUp = (event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    spinner.up({ step: getStepFactor(event, step, { precision }) });

    if (focusInputOnChange) {
      inputRef.current?.focus();
    }
  };

  const spinDown = (event: React.MouseEvent | React.TouchEvent) => {
    event.preventDefault();
    spinner.down({ step: getStepFactor(event, step, { precision }) });

    if (focusInputOnChange) {
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const stepFactor = getStepFactor(event, step, { precision });
    const keyMap: EventKeyMap = {
      ArrowUp: () => increment({ step: stepFactor }),
      ArrowDown: () => decrement({ step: stepFactor }),
    };

    pipe(
      normalizeEventKey(event),
      O.flatMap((eventKey) => pipe(keyMap[eventKey], O.fromNullishOr, O.filter(isVoidHandler))),
      O.match({
        onNone: constVoid,
        onSome: (action) => {
          event.preventDefault();
          action();
        },
      })
    );
  };

  const handleWheel = (event: React.WheelEvent<HTMLInputElement>) => {
    const isInputFocused = document.activeElement === inputRef.current;

    if (!allowMouseWheel || !isInputFocused) {
      return;
    }

    event.preventDefault();

    const stepFactor = getStepFactor(event, step, { precision });
    const direction = Math.sign(event.deltaY);

    if (direction === -1) {
      increment({ step: stepFactor });
    } else if (direction === 1) {
      decrement({ step: stepFactor });
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setTempInterfaceValue(interfaceValue);

    const result = parser(event.target.value);

    if (NumberInputText.is(result)) {
      setInterfaceValue(result);
    }
  };

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const parsedValue = parser(event.target.value);

    if (parsedValue !== "") {
      const nextNum = Number(parsedValue);
      let result = "";

      if (Number.isNaN(nextNum)) {
        result = tempInterfaceValue;
      } else {
        result = nextNum.toFixed(precision);

        if (clampValueOnBlur) {
          if (nextNum > max) {
            result = max.toFixed(precision);
          }

          if (nextNum < min) {
            result = min.toFixed(precision);
          }
        }
      }

      const resolvedValue = toNumberOrUndefined(result);

      setInterfaceValue(result);
      onChange?.(resolvedValue, {
        valueText: formatter(result),
        error: getError(resolvedValue, min, max),
        eventType: NumberInputEventType.Enum.blur,
      });
    } else {
      onChange?.(undefined, {
        valueText: "",
        error: O.none(),
        eventType: NumberInputEventType.Enum.blur,
      });
    }
  };

  const incrementDisabled = keepWithinRange && P.isNumber(numberValue) && numberValue >= max;
  const decrementDisabled = keepWithinRange && P.isNumber(numberValue) && numberValue <= min;

  return {
    inputRef,
    getInputProps: (handlers?: Partial<InputHandlers>) => ({
      pattern: numberInputTextPatternSource,
      role: "spinbutton",
      "aria-valuemin": min,
      "aria-valuemax": max,
      autoComplete: "off",
      autoCorrect: "off",
      "aria-valuetext": interfaceValue,
      "aria-valuenow": numberValue,
      value: interfaceValue,
      onChange: handleChange,
      onBlur: callAllHandlers(handleBlur, handlers?.onBlur),
      onKeyDown: callAllHandlers(handleKeyDown, handlers?.onKeyDown),
      onWheel: callAllHandlers(handleWheel, handlers?.onWheel),
    }),
    getIncrementProps: (handlers?: Partial<ButtonHandlers>) => ({
      tabIndex: -1,
      ...getSpinStartProps(spinUp, handlers),
      onMouseUp: callAllHandlers(spinner.stop, handlers?.onMouseUp),
      onMouseLeave: callAllHandlers(spinner.stop, handlers?.onMouseLeave),
      onTouchEnd: callAllHandlers(spinner.stop, handlers?.onTouchEnd),
      disabled: incrementDisabled,
      "aria-disabled": incrementDisabled ? true : undefined,
    }),
    getDecrementProps: (handlers?: Partial<ButtonHandlers>) => ({
      tabIndex: -1,
      ...getSpinStartProps(spinDown, handlers),
      onMouseUp: callAllHandlers(spinner.stop, handlers?.onMouseUp),
      onMouseLeave: callAllHandlers(spinner.stop, handlers?.onMouseLeave),
      onTouchEnd: callAllHandlers(spinner.stop, handlers?.onTouchEnd),
      disabled: decrementDisabled,
      "aria-disabled": decrementDisabled ? true : undefined,
    }),
  };
};
