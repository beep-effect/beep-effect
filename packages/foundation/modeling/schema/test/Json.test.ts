import { decodeJsonString, encodeJsonString } from "@beep/schema/Json";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { Cause, Effect, Exit, pipe } from "effect";

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

      pipe(result, Exit.isFailure, assertTrue);
      if (Exit.isFailure(result)) {
        // beta.103 formatters no longer leak the underlying parser text, so the
        // failure surfaces the static JSON-string decode message instead.
        expect(Cause.pretty(result.cause)).toMatch(/Expected a valid JSON string/u);
      }
    })
  );
});
