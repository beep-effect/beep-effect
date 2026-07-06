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
import { Equal, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { describe, expect, it } from "vitest";

describe("@beep/ui schema parity", () => {
  it("round-trips exported schema models through encoded form", () => {
    fc.assert(
      fc.property(
        S.toArbitrary(BoundaryParams),
        S.toArbitrary(SpinParams),
        S.toArbitrary(NumberInputChangeMetadata),
        S.toArbitrary(NotificationAction),
        S.toArbitrary(ToastData),
        S.toArbitrary(ReactContextInvariantOptions),
        S.toArbitrary(ReactContextInvariantError),
        (boundary, spin, metadata, action, toast, invariantOptions, invariantError) => {
          const roundTrippedBoundary = Result.getOrThrow(
            S.decodeUnknownResult(BoundaryParams)(Result.getOrThrow(S.encodeResult(BoundaryParams)(boundary)))
          );
          const roundTrippedSpin = Result.getOrThrow(
            S.decodeUnknownResult(SpinParams)(Result.getOrThrow(S.encodeResult(SpinParams)(spin)))
          );
          const roundTrippedMetadata = Result.getOrThrow(
            S.decodeUnknownResult(NumberInputChangeMetadata)(
              Result.getOrThrow(S.encodeResult(NumberInputChangeMetadata)(metadata))
            )
          );
          const roundTrippedAction = Result.getOrThrow(
            S.decodeUnknownResult(NotificationAction)(Result.getOrThrow(S.encodeResult(NotificationAction)(action)))
          );
          const roundTrippedToast = Result.getOrThrow(
            S.decodeUnknownResult(ToastData)(Result.getOrThrow(S.encodeResult(ToastData)(toast)))
          );
          const roundTrippedInvariantOptions = Result.getOrThrow(
            S.decodeUnknownResult(ReactContextInvariantOptions)(
              Result.getOrThrow(S.encodeResult(ReactContextInvariantOptions)(invariantOptions))
            )
          );
          const roundTrippedInvariantError = Result.getOrThrow(
            S.decodeUnknownResult(ReactContextInvariantError)(
              Result.getOrThrow(S.encodeResult(ReactContextInvariantError)(invariantError))
            )
          );

          expect(Equal.equals(roundTrippedBoundary, boundary)).toBe(true);
          expect(Equal.equals(roundTrippedSpin, spin)).toBe(true);
          expect(Equal.equals(roundTrippedMetadata, metadata)).toBe(true);
          expect(Equal.equals(roundTrippedAction, action)).toBe(true);
          expect(Equal.equals(roundTrippedToast, toast)).toBe(true);
          expect(Equal.equals(roundTrippedInvariantOptions, invariantOptions)).toBe(true);
          expect(Equal.equals(roundTrippedInvariantError, invariantError)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
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

    expect(Result.getOrThrow(S.encodeResult(NumberInputChangeMetadata)(metadata))).toEqual({
      error: null,
      eventType: "blur",
      valueText: "",
    });
    expect(Result.getOrThrow(S.encodeResult(NotificationAction)(action))).toEqual({
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
    const isCountryCode = S.is(CountryCode);
    expect(isCountryCode("US")).toBe(true);
    expect(isCountryCode("NOPE")).toBe(false);
    expect(PhoneNumberE164.is("+14155552671")).toBe(true);
    expect(PhoneNumberE164.is("")).toBe(false);
    expect(O.getOrUndefined(normalizeHexColorInput("#3bf"))).toBe("#33bbff");
    expect(O.isNone(normalizeHexColorInput("not-a-color"))).toBe(true);
    expect(S.is(NumberInputError)(NumberInputError.Enum["below-min"])).toBe(true);
  });
});
