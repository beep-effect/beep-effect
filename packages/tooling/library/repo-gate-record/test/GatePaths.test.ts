import {
  GateName,
  RecordTarget,
  RepoRelativeDir,
  RunId,
  recordLocation,
  rootGateDir,
} from "@beep/repo-gate-record/GatePaths";
import { expiredRuns, makeRunId, newestFirst, ROOT_RUNS_KEPT } from "@beep/repo-gate-record/RunId";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Random from "effect/Random";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";

const packageTarget = RecordTarget.cases.PackageTarget.make({
  packageDir: "packages/foundation/primitive/glob",
  gate: "test",
});

describe("record paths", () => {
  it("a package gate writes report.json and report.log under its own .beep/gates", () => {
    const location = recordLocation(packageTarget);
    assert.strictEqual(location.record, "packages/foundation/primitive/glob/.beep/gates/test/report.json");
    assert.strictEqual(location.log, "packages/foundation/primitive/glob/.beep/gates/test/report.log");
  });

  it("a root run writes <run-id>.json and <run-id>.log under the root .beep/gates", () => {
    const location = recordLocation(RecordTarget.cases.RootTarget.make({ gate: "check", runId: "r1" }));
    assert.strictEqual(location.record, ".beep/gates/check/r1.json");
    assert.strictEqual(location.log, ".beep/gates/check/r1.log");
    assert.strictEqual(rootGateDir("check"), ".beep/gates/check");
  });

  it("refuses path segments that would leave the repository or the gate directory", () => {
    const relative = S.is(RepoRelativeDir);
    assert.isTrue(relative("packages/a/b"));
    assert.isFalse(relative("/abs/packages"));
    assert.isFalse(relative("packages/../outside"));
    assert.isFalse(relative("packages//a"));
    assert.isFalse(relative("./packages"));
    assert.isFalse(S.is(GateName)("Test"));
    assert.isFalse(S.is(RunId)(".hidden"));
    assert.isFalse(S.is(RunId)("a/b"));
  });
});

describe("run ids", () => {
  it.effect("mint the UTC instant to the millisecond and a four-digit hex suffix", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.UTC(2026, 10, 19, 10, 0, 0, 123));
      const runId = yield* makeRunId.pipe(Random.withSeed("gate"));
      assert.match(runId, /^20261119T100000123Z-[0-9a-f]{4}$/u);
      assert.isTrue(S.is(RunId)(runId));
    })
  );

  it.effect("sort by time, newest first", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.UTC(2026, 10, 19));
      const earlier = yield* makeRunId;
      yield* TestClock.setTime(Date.UTC(2026, 10, 20));
      const later = yield* makeRunId;
      assert.deepStrictEqual(newestFirst([earlier, later]), [later, earlier]);
    })
  );

  it("retention keeps the newest twenty and expires the rest", () => {
    const ids = A.makeBy(ROOT_RUNS_KEPT + 3, (index) => `run-${index + 10}`);
    assert.deepStrictEqual(expiredRuns(ids), ["run-12", "run-11", "run-10"]);
    assert.deepStrictEqual(expiredRuns(A.take(ids, ROOT_RUNS_KEPT)), []);
  });
});
