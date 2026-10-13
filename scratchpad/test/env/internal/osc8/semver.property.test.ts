import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { compareSemver, parseKonsoleVersion, parseVteVersion } from "../../../../effected/env/internal/osc8/semver.ts";

const runs = { arbitrary: fcRuns(100) };
const Component = S.Int.check(S.isBetween({ minimum: 0, maximum: 99 }));
const Version = S.Tuple([Component, Component, Component]);

// The inverse wire representation of a dotted packed version is M*10000+m*100+p.
const stringifyPacked = (version: string): string =>
  String(A.reduce(Str.split(".")(version), 0, (packed, part) => packed * 100 + Number(part)));

describe("semver parser property floor", () => {
  for (const [name, parse] of [["VTE", parseVteVersion], ["Konsole", parseKonsoleVersion]] as const) {
    const format = (raw: string | undefined): string | undefined => {
      const parsed = parse(raw);
      return parsed === null ? undefined : stringifyPacked(parsed);
    };

    it.effect.prop(`${name}: canonical packed formatting is idempotent and parsing its serialization is faithful`, [Arbitrary.schema(S.String.pipe(S.UndefinedOr))], ([raw]) =>
      Effect.sync(() => {
        const canonical = format(raw);
        assert.strictEqual(format(canonical), canonical);
        assert.strictEqual(parse(canonical), parse(raw));
      }), runs);

    it.effect.prop(`${name}: packed arithmetic and permissive numeric-prefix parsing preserve all three components`, [Arbitrary.schema(Version)], ([components]) =>
      Effect.sync(() => {
        const [major, minor, patch] = components;
        const packed = major * 10000 + minor * 100 + patch;
        const dotted = `${major}.${minor}.${patch}`;
        const raw = `  +000${packed}suffix`;
        assert.strictEqual(parse(raw), dotted);
        assert.strictEqual(parse(stringifyPacked(dotted)), dotted);
        assert.strictEqual(format(format(raw)), String(packed));
      }), runs);
  }

  it.effect.prop("numeric comparison is antisymmetric and ignores prereleases and absent zero components", [Arbitrary.schema(Version), Arbitrary.schema(Version)], ([left, right]) =>
    Effect.sync(() => {
      const a = A.join(A.map(left, String), ".");
      const b = A.join(A.map(right, String), ".");
      const forward = compareSemver(a, b);
      assert.strictEqual(forward + compareSemver(b, a), 0);
      assert.strictEqual(compareSemver(`${a}-rc.1`, `${b}+build`), forward);
      assert.strictEqual(compareSemver(b)(a), forward);
      assert.strictEqual(compareSemver(String(left[0]), `${left[0]}.0.0`), 0);
    }), runs);
});
