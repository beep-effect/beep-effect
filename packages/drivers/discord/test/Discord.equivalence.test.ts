import { DiscordError } from "@beep/discord";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameDiscordError = S.toEquivalence(DiscordError);

describe("Discord declared-field equivalence", () => {
  it("treats field-equal DiscordError instances as equivalent and field-different ones as distinct", () => {
    const a = DiscordError.make({ reason: "transport" });
    const b = DiscordError.make({ reason: "transport" });
    const c = DiscordError.make({ reason: "request" });

    expect(sameDiscordError(a, b)).toBe(true);
    expect(sameDiscordError(a, c)).toBe(false);
  });
});
