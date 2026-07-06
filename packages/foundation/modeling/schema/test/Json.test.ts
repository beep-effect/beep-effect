import { decodeJsonString, encodeJsonString } from "@beep/schema/Json";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";

describe("Json", () => {
  it.effect(
    "decodes JSON strings into unknown values",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeJsonString('{"ok":true}');

      expect(decoded).toEqual({ ok: true });
    })
  );

  it.effect(
    "encodes unknown JSON values into compact strings",
    Effect.fnUntraced(function* () {
      const encoded = yield* encodeJsonString({ ok: true });

      expect(encoded).toBe('{"ok":true}');
    })
  );

  it.effect(
    "fails invalid JSON strings through the SchemaError channel",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(decodeJsonString("{"));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        expect(Cause.pretty(result.cause)).toMatch(/JSON Parse error|SyntaxError/u);
      }
    })
  );
});
