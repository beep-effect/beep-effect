import { assert, describe, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { compareSemver, parseKonsoleVersion, parseVteVersion } from "../../../../effected/env/internal/osc8/semver.ts";

describe("semver edge behaviour", () => {
  it.effect("defaults a missing major capture from the regex collaborator to zero", () =>
    Effect.sync(() => {
      const exec = RegExp.prototype.exec;
      const spy = vi.spyOn(RegExp.prototype, "exec").mockImplementation(function (this: RegExp, text) {
        if (this.source === "^(\\d+)(?:\\.(\\d+))?(?:\\.(\\d+))?") {
          const match: [string] = [text];
          return Object.assign(match, { index: 0, input: text });
        }
        return exec.call(this, text);
      });
      try {
        assert.strictEqual(compareSemver("7", "8"), 0);
      } finally {
        spy.mockRestore();
      }
    }));

  it.effect("defaults missing numeric components on either side of the indexed comparison", () =>
    Effect.sync(() => {
      const number = Number;
      vi.stubGlobal("Number", (value: unknown) => value === "0" ? undefined : number(value));
      try {
        assert.strictEqual(compareSemver("0.0.0", "0.0.0"), 0);
        assert.strictEqual(compareSemver("0.0.0", "1.0.0"), -1);
        assert.strictEqual(compareSemver("1.0.0", "0.0.0"), 1);
      } finally {
        vi.unstubAllGlobals();
      }
    }));

  it.effect("compares fixed components, zero defaults and permissive suffixes in both call forms", () =>
    Effect.sync(() => {
      assert.strictEqual(compareSemver("2", "2.0.0"), 0);
      assert.strictEqual(compareSemver("2.3", "2.3.0"), 0);
      assert.strictEqual(compareSemver("2.3.4-beta", "2.3.4+build"), 0);
      assert.strictEqual(compareSemver("2.3.5", "2.3.4"), 1);
      assert.strictEqual(compareSemver("2.3.4")("2.4.0"), 1);
      assert.strictEqual(compareSemver("unknown", "2"), 0);
      assert.strictEqual(compareSemver("2", "unknown"), 0);
    })
  );

  it.effect("rejects missing, negative and nonfinite packed values but accepts numeric prefixes", () =>
    Effect.sync(() => {
      for (const parse of [parseVteVersion, parseKonsoleVersion]) {
        for (const raw of [undefined, "", "unknown", "-1", "9".repeat(400)]) {
          assert.strictEqual(parse(raw), null);
        }
        assert.strictEqual(parse("0005202tail"), "0.52.2");
        assert.strictEqual(parse("  +220401suffix"), "22.4.1");
        assert.strictEqual(parse("0"), "0.0.0");
      }
    })
  );
});
