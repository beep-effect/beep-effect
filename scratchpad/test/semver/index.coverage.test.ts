import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Public from "../../effected/semver/index.ts";
import { Comparator, InvalidComparatorError } from "../../effected/semver/Comparator.ts";
import { Range, InvalidRangeError, UnsatisfiableConstraintError } from "../../effected/semver/Range.ts";
import { SemVer, SemVerBump, InvalidVersionError } from "../../effected/semver/SemVer.ts";
import { VersionCache, EmptyCacheError, VersionNotFoundError, UnsatisfiedRangeError } from "../../effected/semver/VersionCache.ts";
import { VersionDiff } from "../../effected/semver/VersionDiff.ts";

it.effect("the public entrypoint exposes the owned models, codecs, errors and cache unchanged", () => Effect.sync(() => {
  assert.deepStrictEqual({ ...Public }, {
    Comparator, InvalidComparatorError, Range, InvalidRangeError, UnsatisfiableConstraintError,
    SemVer, SemVerBump, InvalidVersionError, VersionCache, EmptyCacheError, VersionNotFoundError,
    UnsatisfiedRangeError, VersionDiff,
  });
}));
