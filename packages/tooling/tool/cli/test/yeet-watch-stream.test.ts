import {
  classifyYeetCheckOutcome,
  countYeetWatchFailures,
  diffYeetWatchSnapshots,
  renderYeetWatchEventLine,
  YEET_WATCH_SCHEMA_VERSION,
  YeetCheckSignal,
  YeetWatchCheck,
  YeetWatchDiffInput,
  YeetWatchEnded,
  YeetWatchEvent,
  YeetWatchSnapshot,
  YeetWatchStarted,
  YeetWatchThread,
  yeetWatchEndReason,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { YeetCheckTransition, YeetHeadChanged } from "@beep/repo-cli/test/Yeet";

const AT = "2026-08-17T00:00:00Z";

const snapshot = (overrides: Partial<Parameters<typeof YeetWatchSnapshot.make>[0]> = {}): YeetWatchSnapshot =>
  YeetWatchSnapshot.make({
    checks: [],
    headSha: "aaa111",
    mergeable: "MERGEABLE",
    prNumber: 751,
    state: "OPEN",
    threads: [],
    ...overrides,
  });

const check = (name: string, outcome: "pending" | "pass" | "fail" | "skip"): YeetWatchCheck =>
  YeetWatchCheck.make({ name, outcome });

const thread = (id: string, isResolved: boolean): YeetWatchThread => YeetWatchThread.make({ id, isResolved });

describe("classifyYeetCheckOutcome", () => {
  it("classifies every failing bucket and failing state as fail", () => {
    for (const bucket of ["fail", "failing", "cancel", "cancelled", "error", "timed_out"]) {
      expect(classifyYeetCheckOutcome(YeetCheckSignal.make({ bucket, state: "COMPLETED" }))).toBe("fail");
    }
    for (const state of ["FAILURE", "CANCELLED", "ERROR", "TIMED_OUT"]) {
      expect(classifyYeetCheckOutcome(YeetCheckSignal.make({ bucket: "unknown-bucket", state }))).toBe("fail");
    }
  });

  it("classifies pending buckets and states as pending", () => {
    for (const bucket of ["pending", "running", "queued", "waiting"]) {
      expect(classifyYeetCheckOutcome(YeetCheckSignal.make({ bucket, state: "" }))).toBe("pending");
    }
    expect(classifyYeetCheckOutcome(YeetCheckSignal.make({ bucket: "novel", state: "IN_PROGRESS" }))).toBe("pending");
  });

  it("classifies skip vocabulary as skip", () => {
    for (const bucket of ["skipping", "skipped", "neutral"]) {
      expect(classifyYeetCheckOutcome(YeetCheckSignal.make({ bucket, state: "" }))).toBe("skip");
    }
    expect(classifyYeetCheckOutcome(YeetCheckSignal.make({ bucket: "novel", state: "SKIPPED" }))).toBe("skip");
  });

  it("classifies pass only on positive evidence", () => {
    expect(classifyYeetCheckOutcome(YeetCheckSignal.make({ bucket: "pass", state: "" }))).toBe("pass");
    expect(classifyYeetCheckOutcome(YeetCheckSignal.make({ bucket: "novel", state: "SUCCESS" }))).toBe("pass");
  });

  // The conservative fallback: vocabulary GitHub has not shown us degrades to
  // the one outcome the watch revisits, never to a conclusion.
  it("classifies unknown vocabulary as pending", () => {
    expect(classifyYeetCheckOutcome(YeetCheckSignal.make({ bucket: "brand-new-bucket", state: "BRAND_NEW" }))).toBe(
      "pending"
    );
  });

  it("lets failure evidence win over pending evidence", () => {
    expect(classifyYeetCheckOutcome(YeetCheckSignal.make({ bucket: "cancel", state: "QUEUED" }))).toBe("fail");
  });
});

describe("diffYeetWatchSnapshots", () => {
  const diff = (input: { at: string; next: YeetWatchSnapshot; prev: YeetWatchSnapshot }) =>
    diffYeetWatchSnapshots(YeetWatchDiffInput.make(input));

  it("emits nothing when nothing changed", () => {
    const same = snapshot({ checks: [check("Check", "pending")], threads: [thread("T1", false)] });
    expect(diff({ at: AT, next: same, prev: same })).toEqual([]);
  });

  it("emits one transition when a check goes red, carrying the prior outcome", () => {
    const events = diff({
      at: AT,
      next: snapshot({ checks: [check("Coverage", "fail")] }),
      prev: snapshot({ checks: [check("Coverage", "pending")] }),
    });
    expect(A.length(events)).toBe(1);
    const event = events[0] as YeetCheckTransition;
    expect(event.kind).toBe("check-transition");
    expect(event.from).toBe("pending");
    expect(event.to).toBe("fail");
    expect(event.name).toBe("Coverage");
    expect(event.headSha).toBe("aaa111");
  });

  it("reports a first observation as a transition from nothing", () => {
    const events = diff({
      at: AT,
      next: snapshot({ checks: [check("Late Lane", "pending")] }),
      prev: snapshot(),
    });
    expect(A.length(events)).toBe(1);
    expect((events[0] as YeetCheckTransition).from).toBeNull();
  });

  it("suppresses check and thread diffs when the head moved", () => {
    const events = diff({
      at: AT,
      next: snapshot({ checks: [check("Check", "pending")], headSha: "bbb222", threads: [thread("T1", false)] }),
      prev: snapshot({ checks: [check("Check", "fail")] }),
    });
    expect(A.length(events)).toBe(1);
    const event = events[0] as YeetHeadChanged;
    expect(event.kind).toBe("head-changed");
    expect(event.from).toBe("aaa111");
    expect(event.to).toBe("bbb222");
  });

  it("reports thread lifecycle transitions: opened, resolved, unresolved", () => {
    const opened = diff({ at: AT, next: snapshot({ threads: [thread("T1", false)] }), prev: snapshot() });
    expect(A.map(opened, (event) => (event as { readonly to: string }).to)).toEqual(["opened"]);

    const resolved = diff({
      at: AT,
      next: snapshot({ threads: [thread("T1", true)] }),
      prev: snapshot({ threads: [thread("T1", false)] }),
    });
    expect(A.map(resolved, (event) => (event as { readonly to: string }).to)).toEqual(["resolved"]);

    const reopened = diff({
      at: AT,
      next: snapshot({ threads: [thread("T1", false)] }),
      prev: snapshot({ threads: [thread("T1", true)] }),
    });
    expect(A.map(reopened, (event) => (event as { readonly to: string }).to)).toEqual(["unresolved"]);
  });

  it("does not report a thread that arrives already resolved", () => {
    const events = diff({ at: AT, next: snapshot({ threads: [thread("T1", true)] }), prev: snapshot() });
    expect(events).toEqual([]);
  });

  it("reports a mergeability change after check and thread events", () => {
    const events = diff({
      at: AT,
      next: snapshot({ checks: [check("Check", "pass")], mergeable: "CONFLICTING" }),
      prev: snapshot({ checks: [check("Check", "pending")] }),
    });
    expect(A.map(events, (event) => event.kind)).toEqual(["check-transition", "mergeability-changed"]);
  });
});

describe("yeetWatchEndReason", () => {
  it("ends on a merged PR regardless of checks", () => {
    const reason = yeetWatchEndReason(snapshot({ checks: [check("Check", "pending")], state: "MERGED" }));
    expect(O.getOrNull(reason)).toBe("pr-merged");
  });

  it("ends on a closed PR", () => {
    expect(O.getOrNull(yeetWatchEndReason(snapshot({ state: "CLOSED" })))).toBe("pr-closed");
  });

  it("continues while any check is pending", () => {
    const reason = yeetWatchEndReason(snapshot({ checks: [check("A", "pass"), check("B", "pending")] }));
    expect(O.isNone(reason)).toBe(true);
  });

  it("ends all-terminal when no check is pending", () => {
    const reason = yeetWatchEndReason(snapshot({ checks: [check("A", "pass"), check("B", "fail")] }));
    expect(O.getOrNull(reason)).toBe("all-terminal");
  });
});

describe("countYeetWatchFailures", () => {
  it("counts only failing checks", () => {
    const counted = countYeetWatchFailures(
      snapshot({ checks: [check("A", "fail"), check("B", "pass"), check("C", "fail"), check("D", "skip")] })
    );
    expect(counted).toBe(2);
  });
});

describe("renderYeetWatchEventLine", () => {
  const decodeLine = S.decodeUnknownEffect(S.fromJsonString(YeetWatchEvent));

  it.effect("renders one single-line JSON document that round-trips through the schema", () =>
    Effect.gen(function* () {
      const started = YeetWatchStarted.make({ at: AT, checks: 3, headSha: "aaa111" });
      const line = yield* renderYeetWatchEventLine(started);

      expect(Str.includes("\n")(line)).toBe(false);
      const decoded = yield* decodeLine(line);
      expect(decoded.kind).toBe("watch-started");
      expect(decoded.schemaVersion).toBe(YEET_WATCH_SCHEMA_VERSION);
    })
  );

  it.effect("stamps the schema version on every event without callers passing it", () =>
    Effect.gen(function* () {
      const ended = YeetWatchEnded.make({ at: AT, failing: 1, headSha: "aaa111", reason: "all-terminal" });
      const line = yield* renderYeetWatchEventLine(ended);
      const decoded = yield* decodeLine(line);

      expect(decoded.kind).toBe("watch-ended");
      expect(decoded.schemaVersion).toBe(YEET_WATCH_SCHEMA_VERSION);
    })
  );
});
