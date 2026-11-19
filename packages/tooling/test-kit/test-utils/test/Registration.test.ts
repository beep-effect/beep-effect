import { atRegistration, atRegistrationAsync } from "@beep/test-utils/Registration";
import { describe, expect, it } from "@effect/vitest";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

const flag = atRegistration(Config.Boolean("BEEP_TEST_UTILS_REGISTRATION_UNSET").pipe(Config.withDefault(false)));
const probed = await atRegistrationAsync(Effect.sleep("1 millis").pipe(Effect.as("probed")));

describe("registration-time values", () => {
  it("reads a defaulted Config flag while the module registers", () => {
    expect(flag).toBe(false);
  });

  it("waits for an asynchronous probe while the module registers", () => {
    expect(probed).toBe("probed");
  });

  it("throws during registration when the effect fails", () => {
    expect(() => atRegistration(Effect.fail("refused"))).toThrow();
  });
});
