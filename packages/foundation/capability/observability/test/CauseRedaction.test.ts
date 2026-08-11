/** @effect-diagnostics strictEffectProvide:skip-file */
import {
  LogRedactedCauseOptions,
  logRedactedCause,
  RedactCauseOptions,
  redactCause,
  redactCauseEffect,
  redactCauseForClient,
  redactString,
  sanitizeSensitiveText,
  summarizeCause,
  tapRedactedCause,
} from "@beep/observability";
import { NonNegativeInt } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Equal, Logger, References } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("CauseRedaction", () => {
  it("redacts secret-shaped tokens and home paths", () => {
    expect(sanitizeSensitiveText("API_KEY=sk-EXAMPLEKEY00")).toBe("API_KEY=[REDACTED]");
    expect(sanitizeSensitiveText("Bearer sk-EXAMPLEKEY00")).toBe("Bearer [REDACTED]");
    expect(sanitizeSensitiveText("at /home/ada/app/index.ts:10")).toBe("at /home/[REDACTED]/app/index.ts:10");
    expect(sanitizeSensitiveText("authorization: token-value-here")).toBe("authorization: [REDACTED]");
  });

  it("caps length with redactString", () => {
    const out = redactString("token=sk-EXAMPLEKEY00 and a long tail of more text here", 16);
    expect(out.length).toBeLessThanOrEqual(16 + 3);
    expect(out.endsWith("...")).toBe(true);
  });

  it("redacts an unknown error into a transport-safe summary on the diagnostic channel", () => {
    const cause = Cause.fail(new Error("auth failed for /home/ada with token sk-EXAMPLEKEY00"));
    const safe = redactCause(cause);
    expect(safe.tag).toBe("failure");
    expect(safe.message).toContain("[REDACTED]");
    expect(safe.message).not.toContain("sk-EXAMPLEKEY00");
    expect(safe.message).not.toContain("/home/ada");
    expect(O.isSome(safe.detail)).toBe(true);
    expect(safe.fingerprint.length).toBeGreaterThan(0);
  });

  it("sanitizes the message-derived fingerprint so secrets never leak through correlation ids", () => {
    const safe = redactCause(Cause.fail(new Error("auth failed with token sk-EXAMPLEKEY00")));
    expect(safe.message).not.toContain("sk-EXAMPLEKEY00");
    expect(safe.fingerprint).not.toContain("sk-EXAMPLEKEY00");
    expect(safe.fingerprint).toContain("[REDACTED]");
  });

  it("collapses structurally identical secrets to the same redacted fingerprint", () => {
    const first = redactCause(Cause.fail(new Error("Authorization: Bearer aaaaaaaaaaaaaaaa")));
    const second = redactCause(Cause.fail(new Error("Authorization: Bearer bbbbbbbbbbbbbbbb")));
    expect(first.fingerprint).not.toContain("aaaaaaaaaaaaaaaa");
    expect(second.fingerprint).not.toContain("bbbbbbbbbbbbbbbb");
    expect(first.fingerprint).toBe(second.fingerprint);
  });

  it("drops all internal detail on the client channel", () => {
    const safe = redactCauseForClient(Cause.die("internal invariant /home/ada broke"));
    expect(safe.tag).toBe("defect");
    expect(O.isNone(safe.detail)).toBe(true);
    expect(safe.message).not.toContain("/home/ada");
  });

  it("normalizes a bare unknown value into a failure cause", () => {
    const safe = redactCause("password=hunter2secret");
    expect(safe.tag).toBe("failure");
    expect(safe.message).toContain("[REDACTED]");
  });

  it("supports data-last redaction with schema-backed options", () => {
    const redactForClient = redactCause(RedactCauseOptions.make({ channel: "client" }));
    const safe = redactForClient(Cause.fail(new Error("token=sk-EXAMPLEKEY00")));

    expect(O.isNone(safe.detail)).toBe(true);
    expect(safe.message).not.toContain("sk-EXAMPLEKEY00");
  });

  it.effect(
    "exposes a traced Effect-friendly variant",
    Effect.fnUntraced(function* () {
      const safe = yield* redactCauseEffect(Cause.fail(new Error("boom")));
      expect(safe.tag).toBe("failure");
      expect(safe.message).toBe("boom");
    })
  );

  it.effect(
    "logs only bounded redacted Cause diagnostics",
    Effect.fnUntraced(function* () {
      const annotations: Array<Record<string, unknown>> = [];
      const logger = Logger.make<unknown, void>((options) => {
        annotations.push({ ...options.fiber.getRef(References.CurrentLogAnnotations) });
      });

      yield* logRedactedCause(
        Cause.fail(new Error("token=sk-EXAMPLEKEY00 at /home/ada/project")),
        LogRedactedCauseOptions.make({ message: "boundary failed" })
      ).pipe(Effect.provide(Logger.layer([logger])));
      yield* logRedactedCause(
        Cause.fail(new Error("info boundary")),
        LogRedactedCauseOptions.make({ level: "Info", message: "info boundary failed" })
      ).pipe(Effect.provide(Logger.layer([logger])));

      expect(annotations).toHaveLength(2);
      expect(annotations[0]?.cause_message).not.toContain("sk-EXAMPLEKEY00");
      expect(annotations[0]?.cause_detail).not.toContain("/home/ada");
      expect(annotations[0]?.cause_fingerprint).not.toContain("sk-EXAMPLEKEY00");
      expect(annotations[0]?.cause_classification).toBe("failure");
    })
  );

  it.effect(
    "logs through the curried data-last form with the same redaction",
    Effect.fnUntraced(function* () {
      const annotations: Array<Record<string, unknown>> = [];
      const logger = Logger.make<unknown, void>((options) => {
        annotations.push({ ...options.fiber.getRef(References.CurrentLogAnnotations) });
      });

      yield* logRedactedCause(LogRedactedCauseOptions.make({ message: "boundary failed" }))(
        Cause.fail(new Error("token=sk-EXAMPLEKEY00 at /home/ada/project"))
      ).pipe(Effect.provide(Logger.layer([logger])));

      expect(annotations).toHaveLength(1);
      expect(annotations[0]?.cause_message).not.toContain("sk-EXAMPLEKEY00");
      expect(annotations[0]?.cause_classification).toBe("failure");
    })
  );

  it.effect(
    "observes a boundary failure without changing its Cause",
    Effect.fnUntraced(function* () {
      const original = Cause.fail(new Error("boom"));
      const exit = yield* Effect.exit(
        Effect.failCause(original).pipe(
          tapRedactedCause(LogRedactedCauseOptions.make({ message: "boundary failed" })),
          Effect.provide(Logger.layer([]))
        )
      );

      expect(exit._tag).toBe("Failure");
      expect(exit._tag === "Failure" ? Equal.equals(exit.cause, original) : false).toBe(true);
    })
  );

  it("respects a custom message limit via options", () => {
    const safe = redactCause(
      Cause.fail(new Error("x".repeat(500))),
      RedactCauseOptions.make({ messageLimit: NonNegativeInt.make(32) })
    );
    expect(safe.message.length).toBeLessThanOrEqual(32 + 3);
    expect(safe.truncated).toBe(true);
  });

  it("round-trips schema-derived redaction options", () => {
    fc.assert(
      fc.property(S.toArbitrary(RedactCauseOptions)(fc), (options) => {
        const decoded = O.flatMap(
          S.encodeOption(RedactCauseOptions)(options),
          S.decodeUnknownOption(RedactCauseOptions)
        );
        expect(O.exists(decoded, (value) => Equal.equals(value, options))).toBe(true);
      }),
      fcRuns(50)
    );
  });

  it("honors generated redaction bounds and channel rules", () => {
    fc.assert(
      fc.property(S.toArbitrary(RedactCauseOptions)(fc), fc.string(), (options, rawMessage) => {
        const cause = Cause.fail(new Error(rawMessage));
        const summary = summarizeCause(cause);
        const safe = redactCause(cause, options);
        const messageTruncated = sanitizeSensitiveText(summary.primaryMessage).length > options.messageLimit;
        const detailTruncated =
          options.channel === "diagnostic" && sanitizeSensitiveText(summary.pretty).length > options.detailLimit;

        expect(safe.message.length).toBeLessThanOrEqual(options.messageLimit + 3);
        expect(safe.truncated).toBe(messageTruncated || detailTruncated);

        if (options.channel === "client") {
          expect(O.isNone(safe.detail)).toBe(true);
        } else {
          expect(O.exists(safe.detail, (detail) => detail.length <= options.detailLimit + 3)).toBe(true);
        }
      }),
      fcRuns(50)
    );
  });
});
