import {
  confirmHoldVerdict,
  HoldClaimVersion,
  HoldId,
  HoldProposition,
  judgeProbeRun,
  ProbeOutcome,
} from "@beep/repo-cli/commands/Holds";
import { describe, expect, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const reproduced = ProbeOutcome.cases.Reproduced.make({});
const passed = ProbeOutcome.cases.Passed.make({});
const inconclusive = ProbeOutcome.cases.Inconclusive.make({ detail: "install failed" });

const jsdomProposition = {
  _tag: "Hold",
  holdId: "jsdom-vitest-eventtarget",
  kind: "syncpack-held",
  subject: {
    packages: ["jsdom"],
    anchors: [{ file: "syncpack.config.ts", key: "Held back — do not auto-update/jsdom" }],
  },
  assertion: "jsdom 30.1.x breaks every vitest jsdom-environment file under the --bun runtime.",
  falsifier: {
    _tag: "Scripted",
    runtime: "vitest-bun",
    command: ["bunx", "vitest", "run", "--bun", "probe.test.ts"],
    controlVersion: "30.1.0",
    candidate: "latest",
    failureSignature: "not a valid instance of EventTarget",
  },
  watch: [{ _tag: "NpmVersion", packageName: "jsdom", distTag: "latest" }],
  exitAction: { _tag: "Unpin" },
};

describe("judgeProbeRun", () => {
  it("is probe-broken when the control passes, whatever the candidate did", () => {
    expect(judgeProbeRun(passed, passed)).toBe("probe-broken");
    expect(judgeProbeRun(passed, reproduced)).toBe("probe-broken");
  });

  it("never reads an inconclusive run as a pass", () => {
    expect(judgeProbeRun(inconclusive, passed)).toBe("inconclusive");
    expect(judgeProbeRun(reproduced, inconclusive)).toBe("inconclusive");
  });

  it("separates still-holds from a passing candidate when the control reproduces", () => {
    expect(judgeProbeRun(reproduced, reproduced)).toBe("still-holds");
    expect(judgeProbeRun(reproduced, passed)).toBe("candidate-passed");
  });
});

describe("confirmHoldVerdict", () => {
  it("needs two consecutive passing runs to flip", () => {
    expect(confirmHoldVerdict(["candidate-passed", "candidate-passed"])).toBe("Flipped");
    expect(confirmHoldVerdict(["candidate-passed"])).toBe("Unconfirmed");
    expect(confirmHoldVerdict(["candidate-passed", "still-holds"])).toBe("Unconfirmed");
    expect(confirmHoldVerdict(["candidate-passed", "inconclusive", "candidate-passed"])).toBe("Unconfirmed");
  });

  it("escalates a broken probe and reports the latest state otherwise", () => {
    expect(confirmHoldVerdict(["probe-broken", "candidate-passed"])).toBe("ProbeBroken");
    expect(confirmHoldVerdict(["still-holds", "candidate-passed"])).toBe("StillHolds");
    expect(confirmHoldVerdict([])).toBe("Inconclusive");
  });
});

describe("hold schemas", () => {
  it.effect("decodes the jsdom hold proposition", () =>
    Effect.gen(function* () {
      const decoded = yield* S.decodeUnknownEffect(HoldProposition)(jsdomProposition);
      expect(decoded.holdId).toBe("jsdom-vitest-eventtarget");
      expect(decoded.falsifier._tag).toBe("Scripted");
    })
  );

  it("rejects a hold id that is not kebab-case", () => {
    assertFailure(
      Result.mapError(S.decodeResult(HoldId)("Jsdom_Hold"), () => "invalid"),
      "invalid"
    );
    assertSuccess(
      Result.map(S.decodeResult(HoldId)("jsdom-hold"), () => "ok"),
      "ok"
    );
  });

  it("rejects a claim version whose logical key disagrees with the hold id", () => {
    const version = {
      id: "jsdom-vitest-eventtarget@1",
      logicalKey: "hold:something-else",
      proposition: jsdomProposition,
      supportedBy: ["run-1"],
      challengedBy: [],
      validTime: { _tag: "Interval", validFrom: 0, validTo: 1_000 },
      knowledge: { recordedAt: 0, expiredAt: null },
      supersedes: null,
      review: { _tag: "Proposed" },
      signals: {
        sourceTrust: { _tag: "Absent", reason: "not-assessed" },
        sourceAssertedConfidence: { _tag: "Absent", reason: "not-assessed" },
        extractorConfidence: { _tag: "Absent", reason: "not-applicable" },
        validator: { _tag: "Absent", reason: "not-assessed" },
        reviewer: { _tag: "Absent", reason: "not-assessed" },
      },
    };
    expect(Result.isFailure(S.decodeUnknownResult(HoldClaimVersion)(version))).toBe(true);
    expect(
      Result.isSuccess(
        S.decodeUnknownResult(HoldClaimVersion)({ ...version, logicalKey: "hold:jsdom-vitest-eventtarget" })
      )
    ).toBe(true);
  });
});
