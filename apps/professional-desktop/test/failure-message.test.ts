import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";
import { failureMessageOr } from "@/lib/failureMessage";

class PrototypeMessageFailure {
  get message(): string {
    return "message from the prototype";
  }
}

describe("failureMessageOr", () => {
  const orFallback = failureMessageOr("fallback");

  it("returns the redacted message for an Error with a non-empty message", () => {
    expect(orFallback(new Error("boom"))).toBe("boom");
  });

  it("falls back for an Error with an empty message", () => {
    expect(orFallback(new Error(""))).toBe("fallback");
  });

  it("reads a non-empty message from a plain object", () => {
    expect(orFallback({ message: "shaped" })).toBe("shaped");
  });

  it("reads a message exposed as a prototype getter", () => {
    const failure = new PrototypeMessageFailure();

    expect(Object.hasOwn(failure, "message")).toBe(false);
    expect(orFallback(failure)).toBe("message from the prototype");
  });

  it("reads an inherited message from a non-Error object", () => {
    expect(orFallback(Object.create({ message: "inherited" }))).toBe("inherited");
  });

  it("reads the issue text from a real SchemaError", () => {
    const failure = Effect.runSync(S.decodeUnknownEffect(S.Finite)("x").pipe(Effect.flip));
    const message = orFallback(failure);

    expect(message).not.toBe("fallback");
    expect(message).toContain("number");
  });

  it("redacts secrets and home paths in the surfaced message", () => {
    const message = orFallback(new Error("auth failed for /home/ada with token sk-EXAMPLEKEY00"));

    expect(message).toBe("auth failed for /home/[REDACTED] with token [REDACTED]");
    expect(message).not.toContain("sk-EXAMPLEKEY00");
  });

  it("falls back for message-less causes", () => {
    expect(orFallback({})).toBe("fallback");
    expect(orFallback("boom")).toBe("fallback");
    expect(orFallback(undefined)).toBe("fallback");
  });
});
