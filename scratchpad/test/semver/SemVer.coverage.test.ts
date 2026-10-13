import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as Equal from "effect/Equal";
import { SemVer, InvalidVersionError } from "../../effected/semver/SemVer.ts";

describe("SemVer coverage boundaries", () => {
  it.effect("exposes dual predicates and inspection without losing identifiers", () => Effect.sync(() => {
    const v = SemVer.of(1, 2, 3, ["rc", 2], ["build"]);
    assert.strictEqual(inspect(v), "1.2.3-rc.2+build");
    assert.strictEqual(InvalidVersionError.make({ input: "bad" }).message, 'Invalid version string: "bad"');
    assert.isTrue(SemVer.gte(v, v));
    assert.isTrue(SemVer.lte(v)(v));
    assert.isTrue(SemVer.neq(v, SemVer.of(2, 0, 0)));
    assert.strictEqual(SemVer.OrderWithBuild(v, SemVer.of(2, 0, 0)), -1);
    assert.isFalse(v[Equal.symbol]({ major: 1 }));
    assert.strictEqual(SemVer.of(1, 0, 0, [1]).bump.prerelease("rc").toString(), "1.0.0-rc.0");
  }));
});

const inspect = (value: unknown): unknown => {
  const key = Symbol.for("nodejs.util.inspect.custom");
  if (P.hasProperty(value, key) && P.isFunction(value[key])) return value[key].call(value);
  return assert.fail("Expected a custom inspection method");
};
