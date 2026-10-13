import { assert, describe, it, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { Offence, SourceBoundary } from "../../effected/workspaces/SourceBoundary.ts";

describe("SourceBoundary coverage controls", () => {
  it.effect("the namespace constructor preserves the static scanner surface", () => Effect.sync(() => {
    const namespace: unknown = Reflect.construct(SourceBoundary, []);
    assert.strictEqual(Object.getPrototypeOf(namespace), SourceBoundary.prototype);
    assert.strictEqual(SourceBoundary.referencesProcess("process.cwd()"), true);
  }));
  it.effect("console member parsing tolerates whitespace, astral names and a missing member", () => Effect.sync(() => {
    assert.deepStrictEqual(SourceBoundary.check("f.ts", "console \n . \t log(x); console.; console.𝒙(x);", ["console-stdout"]).map((offence) => offence.detail), ["console.log", "console", "console.𝒙"]);
  }));
  it.effect("fixture verification diagnoses missed positives", () => Effect.sync(() => {
    const spy = vi.spyOn(SourceBoundary, "check").mockReturnValue([]);
    try {
      assert.deepStrictEqual(SourceBoundary.verifyFixtures(), SourceBoundary.fixtures.filter((fixture) => fixture.flagged).map((fixture) => `missed: ${fixture.name}`));
    } finally { spy.mockRestore(); }
    assert.deepStrictEqual(SourceBoundary.verifyFixtures(), []);
  }));
  it.effect("fixture verification diagnoses false positives", () => Effect.sync(() => {
    const offence = Offence.make({ file: "fixture.ts", line: 1, column: 1, rule: "process", detail: "process" });
    const spy = vi.spyOn(SourceBoundary, "check").mockReturnValue([offence]);
    try {
      assert.deepStrictEqual(SourceBoundary.verifyFixtures(), SourceBoundary.fixtures.filter((fixture) => fixture.flagged === false).map((fixture) => `false positive: ${fixture.name}`));
    } finally { spy.mockRestore(); }
    assert.deepStrictEqual(SourceBoundary.verifyFixtures(), []);
  }));
  it.layer(Layer.mergeAll(MemoryFileSystem.layerWith({ "/repo/a.ts": "process.cwd(); console.log(1);" }), Path.layer), { timeout: "10 seconds" })((it) => {
    it.effect("undefined rule waivers do not waive offences", () => Effect.gen(function* () {
      const report = yield* SourceBoundary.scan({ root: "/repo", rules: ["process", "console"], allowRules: { process: undefined, console: ["a.ts"] } });
      assert.deepStrictEqual(report.offences.map((offence) => offence.rule), ["process"]);
      assert.deepStrictEqual(report.waived.map((offence) => offence.rule), ["console"]);
    }));
  });
});
