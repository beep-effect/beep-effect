import {
  YeetMergeReady,
  YeetMergeReadyCriteria,
  YeetMergeReadyCriterion,
  YeetVerdict,
  YeetVerdictJson,
  YeetVerdictLane,
} from "@beep/repo-cli/test/Yeet";
import { UUID } from "@beep/schema/String";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const ATTEMPT_ID_TEXT = "550e8400-e29b-41d4-a716-446655440000";
const ATTEMPT_ID = S.decodeSync(UUID)(ATTEMPT_ID_TEXT);

const verdict = YeetVerdict.make({
  schemaVersion: "yeet-verdict/v2",
  attemptId: O.some(ATTEMPT_ID),
  base: "origin/main",
  branch: "feat/merge-loop",
  committed: true,
  createdAt: "2026-08-04T00:00:05.000Z",
  startedAt: O.some("2026-08-04T00:00:00.000Z"),
  endedAt: O.some("2026-08-04T00:00:05.000Z"),
  elapsedMs: O.some(5000),
  head: "HEAD",
  lanes: [
    YeetVerdictLane.make({
      id: "full:pre-push",
      label: "full:pre-push",
      phase: "full",
      status: "passed",
      exitCode: 0,
      durationMs: 4200,
      peakRssKb: 262144,
    }),
  ],
  message: "yeet publish proof passed.",
  mode: "publish",
  outcome: "success",
  packetPaths: [],
  pushed: true,
  runId: "feat_merge-loop",
});

// The verdict document written before mergeReady existed: schemaVersion is still
// v2 and every append-optional key is simply absent.
const priorVersionVerdictJson = [
  '{"schemaVersion":"yeet-verdict/v2","base":"origin/main","branch":"feat/merge-loop","committed":true,',
  '"createdAt":"2026-08-04T00:00:05.000Z","failurePolicy":"fail-fast","head":"HEAD","lanes":[],',
  '"message":"yeet publish proof passed.","mode":"publish","outcome":"success","packetPaths":[],',
  '"pushed":true,"runId":"feat_merge-loop"}',
].join("");

describe("YeetVerdictJson", () => {
  // Regression: the writer used to render the DECODED verdict through a generic
  // JSON encoder, which serialized Option fields as their runtime shape
  // (`{"_id":"Option","_tag":"Some","value":...}`). That artifact no longer
  // decoded, and `yeet status` reported "verdict artifact could not be decoded"
  // with nothing pointing back at the writer.
  it.effect("round-trips a verdict carrying Some(attemptId)", () =>
    Effect.gen(function* () {
      const text = yield* YeetVerdictJson.encode(verdict);
      const decoded = yield* YeetVerdictJson.decode(text);
      expect(decoded.attemptId).toEqual(O.some(ATTEMPT_ID));
      expect(decoded).toEqual(verdict);
    })
  );

  it.effect("encodes Option fields as plain JSON values, never Option runtime objects", () =>
    Effect.gen(function* () {
      const text = yield* YeetVerdictJson.encode(verdict);
      expect(text).toContain(`"attemptId":"${ATTEMPT_ID_TEXT}"`);
      expect(text).toContain('"elapsedMs":5000');
      expect(text).toContain('"peakRssKb":262144');
      expect(text).not.toContain('"_id":"Option"');
      expect(text).not.toContain('"_tag":"Some"');
    })
  );

  it.effect("omits absent append-optional keys from the artifact", () =>
    Effect.gen(function* () {
      const text = yield* YeetVerdictJson.encode(verdict);
      expect(text).not.toContain("mergeReady");
    })
  );

  it.effect("round-trips a merge-ready verdict naming its blocking criterion", () =>
    Effect.gen(function* () {
      const blocked = YeetVerdict.make({
        ...verdict,
        mergeReady: O.some(
          YeetMergeReady.make({
            ready: false,
            failing: O.some("threads-resolved"),
            criteria: YeetMergeReadyCriteria.make({
              prOpen: true,
              notDraft: true,
              closeoutRun: true,
              requiredChecksGreen: true,
              threadsResolved: false,
              mergeable: true,
              mergeStateAcceptable: true,
              reviewDecisionAcceptable: true,
              greptileScore: O.some("5/5"),
            }),
          })
        ),
      });
      const text = yield* YeetVerdictJson.encode(blocked);
      expect(text).toContain('"failing":"threads-resolved"');
      expect(text).toContain('"greptileScore":"5/5"');
      const decoded = yield* YeetVerdictJson.decode(text);
      expect(decoded).toEqual(blocked);
    })
  );

  it.effect("decodes a verdict written before mergeReady existed", () =>
    Effect.gen(function* () {
      const decoded = yield* YeetVerdictJson.decode(priorVersionVerdictJson);
      expect(decoded.mergeReady).toEqual(O.none());
      expect(decoded.attemptId).toEqual(O.none());
      expect(decoded.schemaVersion).toBe("yeet-verdict/v2");
    })
  );

  it("keeps the Greptile score out of the hard criterion domain", () => {
    expect(YeetMergeReadyCriterion.Options).toEqual([
      "pr-open",
      "not-draft",
      "closeout-run",
      "required-checks-green",
      "threads-resolved",
      "mergeable",
      "merge-state-acceptable",
      "review-decision-acceptable",
    ]);
  });
});
