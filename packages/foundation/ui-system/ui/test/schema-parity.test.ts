import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { normalizeHexColorInput } from "@beep/ui/components/color-picker";
import { CountryCode } from "@beep/ui/components/country-select";
import { NotificationAction } from "@beep/ui/components/notification-card";
import { PhoneNumberE164 } from "@beep/ui/components/phone-input";
import { ToastData } from "@beep/ui/components/toast";
import {
  BoundaryParams,
  NumberInputChangeMetadata,
  NumberInputError,
  NumberInputEventType,
  NumberInputTestKit,
  numberToString,
  SpinParams,
} from "@beep/ui/hooks/useNumberInput";
import { ReactContextInvariantError, ReactContextInvariantOptions } from "@beep/ui/lib/react-invariant";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertNone, assertTrue } from "@effect/vitest/utils";
import { Effect, Equal, pipe, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeBoundaryParams = S.decodeEffect(BoundaryParams);
const encodeBoundaryParams = S.encodeEffect(BoundaryParams);
const decodeNotificationAction = S.decodeEffect(NotificationAction);
const encodeNotificationAction = S.encodeEffect(NotificationAction);
const decodeNumberInputChangeMetadata = S.decodeEffect(NumberInputChangeMetadata);
const encodeNumberInputChangeMetadata = S.encodeEffect(NumberInputChangeMetadata);
const decodeReactContextInvariantError = S.decodeEffect(ReactContextInvariantError);
const encodeReactContextInvariantError = S.encodeEffect(ReactContextInvariantError);
const decodeReactContextInvariantOptions = S.decodeEffect(ReactContextInvariantOptions);
const encodeReactContextInvariantOptions = S.encodeEffect(ReactContextInvariantOptions);
const decodeSpinParams = S.decodeEffect(SpinParams);
const encodeSpinParams = S.encodeEffect(SpinParams);
const decodeToastData = S.decodeEffect(ToastData);
const encodeToastData = S.encodeEffect(ToastData);
const encodeNotificationActionResult = S.encodeResult(NotificationAction);
const encodeNumberInputChangeMetadataResult = S.encodeResult(NumberInputChangeMetadata);
const isCountryCode2 = S.is(CountryCode);
const isNumberInputError = S.is(NumberInputError);

describe("@beep/ui schema parity", () => {
  it.effect.prop(
    "round-trips exported schema models through encoded form",
    [
      Arbitrary.schema(BoundaryParams),
      Arbitrary.schema(SpinParams),
      Arbitrary.schema(NumberInputChangeMetadata),
      Arbitrary.schema(NotificationAction),
      Arbitrary.schema(ToastData),
      Arbitrary.schema(ReactContextInvariantOptions),
      Arbitrary.schema(ReactContextInvariantError),
    ],
    ([boundary, spin, metadata, action, toast, invariantOptions, invariantError]) =>
      Effect.gen(function* () {
        const encodedBoundaryParams = yield* encodeBoundaryParams(boundary);
        const roundTrippedBoundary = yield* decodeBoundaryParams(encodedBoundaryParams);
        const encodedSpinParams = yield* encodeSpinParams(spin);
        const roundTrippedSpin = yield* decodeSpinParams(encodedSpinParams);
        const encodedNumberInputChangeMetadata = yield* encodeNumberInputChangeMetadata(metadata);
        const roundTrippedMetadata = yield* decodeNumberInputChangeMetadata(encodedNumberInputChangeMetadata);
        const encodedNotificationAction = yield* encodeNotificationAction(action);
        const roundTrippedAction = yield* decodeNotificationAction(encodedNotificationAction);
        const encodedToastData = yield* encodeToastData(toast);
        const roundTrippedToast = yield* decodeToastData(encodedToastData);
        const encodedReactContextInvariantOptions = yield* encodeReactContextInvariantOptions(invariantOptions);
        const roundTrippedInvariantOptions = yield* decodeReactContextInvariantOptions(
          encodedReactContextInvariantOptions
        );
        const encodedReactContextInvariantError = yield* encodeReactContextInvariantError(invariantError);
        const roundTrippedInvariantError = yield* decodeReactContextInvariantError(encodedReactContextInvariantError);
        pipe(Equal.equals(roundTrippedBoundary, boundary), assertTrue);
        pipe(Equal.equals(roundTrippedSpin, spin), assertTrue);
        pipe(Equal.equals(roundTrippedMetadata, metadata), assertTrue);
        pipe(Equal.equals(roundTrippedAction, action), assertTrue);
        pipe(Equal.equals(roundTrippedToast, ToastData.make({ ...toast })), assertTrue);
        pipe(Equal.equals(roundTrippedInvariantOptions, invariantOptions), assertTrue);
        const encodedRoundTrippedInvariantError = yield* encodeReactContextInvariantError(roundTrippedInvariantError);
        expect(encodedRoundTrippedInvariantError).toEqual(encodedReactContextInvariantError);
      }),
    { arbitrary: fcRuns(50) }
  );

  it.effect.prop(
    "formats every schema-accepted precision in both number input consumers",
    [Arbitrary.schema(SpinParams), Arbitrary.schema(S.Finite)],
    ([params, value]) =>
      Effect.sync(() => {
        const formatted = numberToString(value, params.precision);
        expect(formatted).toBe(value.toFixed(params.precision));
        expect(
          NumberInputTestKit.resolveBlurInterfaceValue(String(value), "fallback", params.precision, false, 0, 10)
        ).toBe(formatted);
        expect(NumberInputTestKit.resolveBlurInterfaceValue("11", "fallback", params.precision, true, 0, 10)).toBe(
          (10).toFixed(params.precision)
        );
        expect(NumberInputTestKit.resolveBlurInterfaceValue("-1", "fallback", params.precision, true, 0, 10)).toBe(
          (0).toFixed(params.precision)
        );
        expect(NumberInputTestKit.resolveBlurInterfaceValue("5", "fallback", params.precision, true, 0, 10)).toBe(
          (5).toFixed(params.precision)
        );
      }),
    { arbitrary: fcRuns(50) }
  );

  it.effect("rejects unsupported precision before either fixed-point consumer", () =>
    Effect.gen(function* () {
      const params = yield* decodeSpinParams({ precision: 100, step: 1 });
      expect(numberToString(1, params.precision)).toHaveLength(102);
      expect(NumberInputTestKit.resolveBlurInterfaceValue("1", "fallback", params.precision, true, 0, 10)).toBe(
        numberToString(1, params.precision)
      );
      const error = yield* Effect.flip(decodeSpinParams({ precision: 101, step: 1 }));
      pipe(error, S.isSchemaError, assertTrue);
    })
  );

  it("preserves nullable and optional encoded compatibility at UI boundaries", () => {
    const metadata = NumberInputChangeMetadata.make({
      error: O.none(),
      eventType: NumberInputEventType.Enum.blur,
      valueText: "",
    });
    const action = NotificationAction.make({
      type: "redirect",
      id: "open",
      label: "Open",
      executed: O.none(),
      style: O.none(),
    });

    expect(Result.getOrThrow(encodeNumberInputChangeMetadataResult(metadata))).toEqual({
      error: null,
      eventType: "blur",
      valueText: "",
    });
    expect(Result.getOrThrow(encodeNotificationActionResult(action))).toEqual({
      type: "redirect",
      id: "open",
      label: "Open",
    });
  });

  it("applies schema defaults and precision checks at construction boundaries", () => {
    expect(BoundaryParams.make({})).toEqual({
      min: Number.MIN_SAFE_INTEGER,
      max: Number.MAX_SAFE_INTEGER,
    });
    expect(SpinParams.make({})).toEqual({
      precision: 0,
      step: 1,
    });
    expect(() => SpinParams.make({ step: 0 })).toThrow();
  });

  it("keeps schema-derived guards aligned with helper surfaces", () => {
    pipe(isCountryCode2("US"), assertTrue);
    pipe(isCountryCode2("NOPE"), assertFalse);
    pipe(PhoneNumberE164.is("+14155552671"), assertTrue);
    pipe(PhoneNumberE164.is(""), assertFalse);
    expect(O.getOrUndefined(normalizeHexColorInput("#3bf"))).toBe("#33bbff");
    assertNone(normalizeHexColorInput("not-a-color"));
    pipe(isNumberInputError(NumberInputError.Enum["below-min"]), assertTrue);
  });
});
