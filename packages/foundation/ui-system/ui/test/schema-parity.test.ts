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
  SpinParams,
} from "@beep/ui/hooks/useNumberInput";
import { ReactContextInvariantError, ReactContextInvariantOptions } from "@beep/ui/lib/react-invariant";
import { Effect, Equal, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import { describe, expect, it } from "vitest";

const decodeBoundaryParamsResult = S.decodeResult(BoundaryParams);
const decodeNotificationActionResult = S.decodeResult(NotificationAction);
const decodeNumberInputChangeMetadataResult = S.decodeResult(NumberInputChangeMetadata);
const decodeReactContextInvariantErrorResult = S.decodeResult(ReactContextInvariantError);
const decodeReactContextInvariantOptionsResult = S.decodeResult(ReactContextInvariantOptions);
const decodeSpinParamsResult = S.decodeResult(SpinParams);
const decodeToastDataResult = S.decodeResult(ToastData);
const encodeBoundaryParamsResult = S.encodeResult(BoundaryParams);
const encodeNotificationActionResult = S.encodeResult(NotificationAction);
const encodeNumberInputChangeMetadataResult = S.encodeResult(NumberInputChangeMetadata);
const encodeReactContextInvariantErrorResult = S.encodeResult(ReactContextInvariantError);
const encodeReactContextInvariantOptionsResult = S.encodeResult(ReactContextInvariantOptions);
const encodeSpinParamsResult = S.encodeResult(SpinParams);
const encodeToastDataResult = S.encodeResult(ToastData);
const isCountryCode2 = S.is(CountryCode);
const isNumberInputError = S.is(NumberInputError);

describe("@beep/ui schema parity", () => {
  it("round-trips exported schema models through encoded form", () => {
    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([
            Arbitrary.schema(BoundaryParams),
            Arbitrary.schema(SpinParams),
            Arbitrary.schema(NumberInputChangeMetadata),
            Arbitrary.schema(NotificationAction),
            Arbitrary.schema(ToastData),
            Arbitrary.schema(ReactContextInvariantOptions),
            Arbitrary.schema(ReactContextInvariantError),
          ]),
          ([boundary, spin, metadata, action, toast, invariantOptions, invariantError]) => {
            const roundTrippedBoundary = Result.getOrThrow(
              decodeBoundaryParamsResult(Result.getOrThrow(encodeBoundaryParamsResult(boundary)))
            );
            const roundTrippedSpin = Result.getOrThrow(
              decodeSpinParamsResult(Result.getOrThrow(encodeSpinParamsResult(spin)))
            );
            const roundTrippedMetadata = Result.getOrThrow(
              decodeNumberInputChangeMetadataResult(Result.getOrThrow(encodeNumberInputChangeMetadataResult(metadata)))
            );
            const roundTrippedAction = Result.getOrThrow(
              decodeNotificationActionResult(Result.getOrThrow(encodeNotificationActionResult(action)))
            );
            const roundTrippedToast = Result.getOrThrow(
              decodeToastDataResult(Result.getOrThrow(encodeToastDataResult(toast)))
            );
            const roundTrippedInvariantOptions = Result.getOrThrow(
              decodeReactContextInvariantOptionsResult(
                Result.getOrThrow(encodeReactContextInvariantOptionsResult(invariantOptions))
              )
            );
            const roundTrippedInvariantError = Result.getOrThrow(
              decodeReactContextInvariantErrorResult(
                Result.getOrThrow(encodeReactContextInvariantErrorResult(invariantError))
              )
            );
            const encodedInvariantError = Result.getOrThrow(encodeReactContextInvariantErrorResult(invariantError));
            const encodedRoundTrippedInvariantError = Result.getOrThrow(
              encodeReactContextInvariantErrorResult(roundTrippedInvariantError)
            );

            expect(Equal.equals(roundTrippedBoundary, boundary)).toBe(true);
            expect(Equal.equals(roundTrippedSpin, spin)).toBe(true);
            expect(Equal.equals(roundTrippedMetadata, metadata)).toBe(true);
            expect(Equal.equals(roundTrippedAction, action)).toBe(true);
            expect(Equal.equals(roundTrippedToast, ToastData.make({ ...toast }))).toBe(true);
            expect(Equal.equals(roundTrippedInvariantOptions, invariantOptions)).toBe(true);
            expect(encodedRoundTrippedInvariantError).toEqual(encodedInvariantError);

            return true;
          },
          fcRuns(50)
        )
      )._tag
    ).toBe("Passed");
  });

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
    expect(isCountryCode2("US")).toBe(true);
    expect(isCountryCode2("NOPE")).toBe(false);
    expect(PhoneNumberE164.is("+14155552671")).toBe(true);
    expect(PhoneNumberE164.is("")).toBe(false);
    expect(O.getOrUndefined(normalizeHexColorInput("#3bf"))).toBe("#33bbff");
    expect(O.isNone(normalizeHexColorInput("not-a-color"))).toBe(true);
    expect(isNumberInputError(NumberInputError.Enum["below-min"])).toBe(true);
  });
});
