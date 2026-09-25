import { Semver, SemverFromString } from "@beep/schema/Semver";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import { Cause, Effect, Exit, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeSemver = S.decodeUnknownEffect(SemverFromString);
const decodeSemverObject = S.decodeUnknownEffect(Semver);

const expectDecodeFailure = <A, E>(effect: Effect.Effect<A, E>, input: string): Effect.Effect<void> =>
  Effect.gen(function* () {
    const exit = yield* Effect.exit(effect);

    assertTrue(Exit.isFailure(exit), `Expected schema failure for ${input}`);
    if (Exit.isFailure(exit)) {
      assertTrue(O.isSome(Cause.findErrorOption(exit.cause)), `Expected typed failure for ${input}`);
    }
  });

describe("Semver", () => {
  it("normalizes supported loose boundary strings before strict parsing", () => {
    expect(Semver.normalizeStr(" v1.2 ")).toBe("1.2.0");
    expect(Semver.normalizeStr("v1.2.3- rc . 1 + build . 5")).toBe("1.2.3-rc.1+build.5");
  });

  it.effect(
    "decodes strings into structured semantic versions",
    Effect.fnUntraced(function* () {
      const version = yield* decodeSemver("v1.2.3-alpha.1+build.5");

      expect(version).toEqual(
        Semver.make({
          major: 1,
          minor: 2,
          patch: 3,
          prerelease: ["alpha", "1"],
          build: ["build", "5"],
        })
      );
      expect(Semver.format(version)).toBe("1.2.3-alpha.1+build.5");
    })
  );

  it.effect(
    "decodes shorthand major-minor strings by adding a zero patch segment",
    Effect.fnUntraced(function* () {
      const version = yield* decodeSemver("2.4");

      expect(Semver.format(version)).toBe("2.4.0");
    })
  );

  it.effect(
    "rejects malformed semantic version strings",
    Effect.fnUntraced(function* () {
      yield* expectDecodeFailure(decodeSemver("1.02.0"), 'decodeSemver("1.02.0")');
      yield* expectDecodeFailure(decodeSemver("1..2"), 'decodeSemver("1..2")');
      yield* expectDecodeFailure(decodeSemver("1.2.3-01"), 'decodeSemver("1.2.3-01")');
      yield* expectDecodeFailure(decodeSemver("1.2.3+"), 'decodeSemver("1.2.3+")');
      yield* expectDecodeFailure(decodeSemver("1.2.3-alpha..1"), 'decodeSemver("1.2.3-alpha..1")');
    })
  );

  it.effect(
    "rejects invalid structured values through the Semver schema",
    Effect.fnUntraced(function* () {
      yield* expectDecodeFailure(
        decodeSemverObject({
          major: -1,
          minor: 0,
          patch: 0,
          prerelease: [],
          build: [],
        }),
        "decodeSemverObject({ major: -1, minor: 0, patch: 0, prerelease: [], build: [], })"
      );
      yield* expectDecodeFailure(
        decodeSemverObject({
          major: 1,
          minor: 0,
          patch: 0,
          prerelease: ["01"],
          build: [],
        }),
        'decodeSemverObject({ major: 1, minor: 0, patch: 0, prerelease: ["01"], build: [], })'
      );
      yield* expectDecodeFailure(
        decodeSemverObject({
          major: 1,
          minor: 0,
          patch: 0,
          prerelease: [],
          build: [""],
        }),
        'decodeSemverObject({ major: 1, minor: 0, patch: 0, prerelease: [], build: [""], })'
      );
    })
  );

  it("parses prerelease identifiers with SemVer numeric rules", () => {
    assertSome(Semver.preReleaseSegmentsFromStr("alpha.1"), ["alpha", "1"]);
    pipe(Semver.preReleaseSegmentsFromStr("alpha.01"), O.isNone, assertTrue);
  });

  it("orders prerelease identifiers according to SemVer precedence", () => {
    expect(Semver.comparePreReleaseIdentifier("2", "11")).toBe(-1);
    expect(pipe("2", Semver.comparePreReleaseIdentifier("11"))).toBe(-1);
    expect(Semver.comparePreReleaseIdentifier("alpha", "beta")).toBe(-1);
    expect(Semver.comparePreReleaseIdentifier("1", "alpha")).toBe(-1);
    expect(Semver.comparePreReleaseIdentifier("alpha", "1")).toBe(1);
  });

  it("orders versions according to the SemVer precedence examples", () => {
    const ordered = [
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-alpha.beta",
      "1.0.0-beta",
      "1.0.0-beta.2",
      "1.0.0-beta.11",
      "1.0.0-rc.1",
      "1.0.0",
    ];

    pipe(
      A.zip(ordered, A.drop(ordered, 1)),
      A.forEach(([left, right]) => {
        expect(Semver.compare(left, right)).toBe(-1);
        expect(pipe(left, Semver.compare(right))).toBe(-1);
        expect(Semver.compare(right, left)).toBe(1);
      })
    );
  });

  it("ignores build metadata during precedence comparison", () => {
    expect(Semver.compare("1.0.0+build.1", "1.0.0+build.2")).toBe(0);
    expect(Semver.compare("1.0.0-alpha+1", "1.0.0-alpha+2")).toBe(0);
  });

  it("checks supported comparator ranges", () => {
    expect(Semver.satisfiesRange("v20.1.0", "^18.0.0 || ^20.0.0")).toBe(true);
    expect(pipe("v20.1.0", Semver.satisfiesRange("^18.0.0 || ^20.0.0"))).toBe(true);
    expect(Semver.satisfiesRange("2.0.0", "^1.2.3")).toBe(false);
    expect(Semver.satisfiesRange("1.2.3", ">= 1.2.0 < 2.0.0")).toBe(true);
    expect(Semver.satisfiesRange("0.2.5", "^0.2.3")).toBe(true);
    expect(Semver.satisfiesRange("0.3.0", "^0.2.3")).toBe(false);
    expect(Semver.satisfiesRange("1.0.0-alpha", ">=1.0.0-alpha <1.0.0")).toBe(true);
  });

  it("returns false for unsupported or invalid ranges", () => {
    expect(Semver.satisfiesRange("1.2.3", "~1.2.0")).toBe(false);
    expect(Semver.satisfiesRange("not-a-version", ">=1.0.0")).toBe(false);
    expect(Semver.satisfiesRange("1.2.3", "")).toBe(false);
  });
});
