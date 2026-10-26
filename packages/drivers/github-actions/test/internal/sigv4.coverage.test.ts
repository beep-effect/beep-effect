import { uriEncode } from "@beep/github-actions/internal/sigv4";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

it.effect("URI encoding rejects unpaired surrogates and encodes AWS reserved characters", () =>
  Effect.sync(() => {
    assert.throws(() => uriEncode("\ud800"), URIError);
    assert.strictEqual(uriEncode("!'()*"), "%21%27%28%29%2A");
  })
);
