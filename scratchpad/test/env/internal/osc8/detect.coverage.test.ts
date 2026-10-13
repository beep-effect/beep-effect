import { assert, describe, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { detect } from "../../../../effected/env/internal/osc8/detect.ts";
import * as Wrappers from "../../../../effected/env/internal/osc8/wrappers.ts";
import { deliberatelyInvalid } from "../../deliberatelyInvalid.ts";

describe("OSC8 missing terminal version", () => {
  it.effect("uses the generic wrapper explanation if the collaborator omits its name", () => Effect.sync(() => {
    const spy = vi.spyOn(Wrappers, "detectWrapper").mockReturnValue({
      name: deliberatelyInvalid<Wrappers.WrapperInfo["name"]>(undefined),
      passesThrough: false,
    });
    try {
      const result = detect({ env: {}, isStdoutTTY: true, isStderrTTY: true });
      assert.strictEqual(result.supported, false);
      assert.strictEqual(result.supportedForStderr, false);
      assert.strictEqual(result.reason, "wrapper-strips");
      assert.strictEqual(result.explanation, "inside wrapper; passthrough not verifiable without subprocess");
    } finally {
      spy.mockRestore();
    }
  }));

  it.effect("a version-gated terminal without a version explains why links are disabled", () => Effect.sync(() => {
    const result = detect({ env: { TERM_PROGRAM: "iTerm.app" }, isStdoutTTY: true, isStderrTTY: true });
    assert.strictEqual(result.supported, false);
    assert.strictEqual(result.supportedForStderr, false);
    assert.strictEqual(result.reason, "terminal-known-too-old");
    assert.strictEqual(result.terminalVersion, null);
    assert.strictEqual(result.explanation, "detected iTerm.app ; below minimum version");
  }));
});
