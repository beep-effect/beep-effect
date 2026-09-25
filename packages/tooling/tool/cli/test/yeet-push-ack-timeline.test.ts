import {
  appendYeetInboxRow,
  loadYeetHookFirstSeen,
  loadYeetPushToAckTimeline,
  renderYeetPushToAckTimeline,
  writeYeetAckReceipt,
  YeetAckFixResolution,
  YeetAckReceipt,
  YeetCheckFailedRow,
  YeetFailureCapsule,
  YeetHeadTimeline,
  YeetHookSessionState,
  YeetHookSessionStateJson,
  YeetInboxRow,
  YeetInboxRowJson,
  YeetPushToAckTimeline,
  yeetHeadTimelineStamp,
  yeetInboxPaths,
  yeetInboxRowId,
} from "@beep/repo-cli/test/Yeet";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import { Effect, FileSystem, HashMap, Layer, Path } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Arbitrary } from "effect/unstable/arbitrary";

const head = "abc1234def5678";
const pr = 754;

const PlatformLayer = Layer.mergeAll(BunCrypto.layer, NodeFileSystem.layer, NodePath.layer);
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const HeadTimelineJson = S.fromJsonString(YeetHeadTimeline);
const roundTripRuns = { arbitrary: { runs: 20, seed: 5 } };

const makeTempRoot = Effect.fn("pushAckTimelineTest.makeTempRoot")(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.makeTempDirectoryScoped({ prefix: "yeet-push-ack-" });
});

const writeRedRow = Effect.fn("pushAckTimelineTest.writeRedRow")(function* (
  root: string,
  lane: string,
  headSha: string,
  ts: string,
  severity: "P0" | "P1" = "P0"
) {
  const capsule = YeetFailureCapsule.make({
    bucket: "fail",
    headSha,
    lane,
    link: "https://github.com/beep/beep/actions/runs/9/job/9",
    observedAt: ts,
    prNumber: pr,
    state: "FAILURE",
    workflow: "Check",
  });
  const id = yield* yeetInboxRowId(capsule);
  yield* appendYeetInboxRow(root, YeetCheckFailedRow.make({ capsule, checkout: root, id, severity, ts }));
  return id;
});

const writeSessionFile = Effect.fn("pushAckTimelineTest.writeSessionFile")(function* (
  root: string,
  name: string,
  contents: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const paths = yield* yeetInboxPaths(root);
  const dir = path.join(paths.dir, "sessions");
  yield* fs.makeDirectory(dir, { recursive: true });
  yield* fs.writeFileString(path.join(dir, name), contents);
});

describe("push → row → ack rendering", () => {
  it("renders every absent stage as a dash", () => {
    expect(renderYeetPushToAckTimeline(YeetPushToAckTimeline.make({ headSha: head }))).toBe(
      "push→row→ack abc1234: pushed -, red -, row -, injected -, acked -"
    );
  });

  it("measures each stamped stage from the nearest earlier stamped stage", () => {
    const timeline = YeetPushToAckTimeline.make({
      headSha: head,
      pushedAt: O.some("2026-09-25T12:00:00Z"),
      redAt: O.some("2026-09-25T12:10:00Z"),
      rowAt: O.some("2026-09-25T12:10:20.000Z"),
      ackedAt: O.some("2026-09-25T12:15:20.000Z"),
    });
    expect(renderYeetPushToAckTimeline(timeline)).toBe(
      "push→row→ack abc1234: pushed 2026-09-25T12:00:00Z, red 2026-09-25T12:10:00Z (+10m), " +
        "row 2026-09-25T12:10:20.000Z (+20s), injected -, acked 2026-09-25T12:15:20.000Z (+5m)"
    );
  });

  it("anchors a stage stamped before the previous stage on the push instead of a negative gap", () => {
    const timeline = YeetPushToAckTimeline.make({
      headSha: head,
      pushedAt: O.some("2026-09-25T18:09:52.000Z"),
      redAt: O.some("2026-09-25T18:26:36Z"),
      rowAt: O.some("2026-09-25T18:10:18.811Z"),
      injectedAt: O.some("2026-09-25T18:28:48Z"),
    });
    strictEqual(
      renderYeetPushToAckTimeline(timeline),
      "push→row→ack abc1234: pushed 2026-09-25T18:09:52.000Z, red 2026-09-25T18:26:36Z (+16m 44s), " +
        "row 2026-09-25T18:10:18.811Z (push +26s 811ms), injected 2026-09-25T18:28:48Z (+18m 29s 189ms), acked -"
    );
    // Without a push to anchor on, the early stage prints its instant alone.
    strictEqual(
      renderYeetPushToAckTimeline(
        YeetPushToAckTimeline.make({
          headSha: head,
          redAt: O.some("2026-09-25T18:26:36Z"),
          rowAt: O.some("2026-09-25T18:10:18.811Z"),
        })
      ),
      "push→row→ack abc1234: pushed -, red 2026-09-25T18:26:36Z, row 2026-09-25T18:10:18.811Z, injected -, acked -"
    );
  });

  it("keeps the first red the loop stamped for a head", () => {
    const timeline = YeetHeadTimeline.make({ headSha: head, firstObservedAt: "2026-09-25T12:00:30Z" });
    const first = yeetHeadTimelineStamp(timeline, "redAt", "2026-09-25T12:10:00Z");
    const second = yeetHeadTimelineStamp(first, "redAt", "2026-09-25T12:20:00Z");
    assertSome(second.redAt, "2026-09-25T12:10:00Z");
  });

  it("decodes a hook session file written before firstSeenAt existed", () => {
    const legacy = YeetHookSessionStateJson.decodeOption(
      '{"schemaVersion":"yeet-hook-session/v1","incidentId":null,"seenIds":["coverage-abc"]}'
    );
    assertSome(
      O.map(legacy, (state) => [state.seenIds, state.firstSeenAt]),
      [["coverage-abc"], {}]
    );
    assertNone(YeetHookSessionStateJson.decodeOption('{"schemaVersion":"yeet-hook-session/v2"}'));
  });
});

describe("push → row → ack schemas", () => {
  it.effect.prop(
    "round trips a hook session state through the session file codec",
    [Arbitrary.schema(YeetHookSessionState)],
    Effect.fnUntraced(function* ([state]) {
      const decoded = yield* YeetHookSessionStateJson.decode(yield* YeetHookSessionStateJson.encode(state));
      assertTrue(S.toEquivalence(YeetHookSessionState)(decoded, state));
    }),
    roundTripRuns
  );

  it.effect.prop(
    "round trips a check-failed row and its failure capsule through the inbox row codec",
    [Arbitrary.schema(YeetCheckFailedRow)],
    Effect.fnUntraced(function* ([row]) {
      const decoded = yield* YeetInboxRowJson.decode(yield* YeetInboxRowJson.encode(row));
      assertTrue(S.toEquivalence(YeetInboxRow)(decoded, row));
    }),
    roundTripRuns
  );

  it.effect.prop(
    "round trips a head timeline through its JSON encoding",
    [Arbitrary.schema(YeetHeadTimeline)],
    Effect.fnUntraced(function* ([timeline]) {
      const decoded = yield* S.decodeEffect(HeadTimelineJson)(yield* S.encodeEffect(HeadTimelineJson)(timeline));
      assertTrue(S.toEquivalence(YeetHeadTimeline)(decoded, timeline));
    }),
    roundTripRuns
  );
});

it.layer(PlatformLayer, { timeout: "30 seconds" })("push → row → ack join", (it) => {
  it.effect("joins the head's first red row, its earliest injection, and its ack", () =>
    Effect.gen(function* () {
      const root = yield* makeTempRoot();
      const later = yield* writeRedRow(root, "Check / Lint", head, "2026-09-25T12:11:00.000Z");
      const first = yield* writeRedRow(root, "Check / Coverage", head, "2026-09-25T12:10:20.000Z");
      yield* writeRedRow(root, "Check / Coverage", "0ld0ld0ld", "2026-09-25T11:00:00.000Z");
      yield* writeSessionFile(
        root,
        "claude-1.json",
        yield* encodeJson({
          schemaVersion: "yeet-hook-session/v1",
          incidentId: null,
          seenIds: [first],
          firstSeenAt: { [first]: "2026-09-25T12:10:50Z", [later]: "2026-09-25T12:11:05Z" },
        })
      );
      yield* writeSessionFile(
        root,
        "codex-2.json",
        yield* encodeJson({
          schemaVersion: "yeet-hook-session/v1",
          incidentId: first,
          seenIds: [],
          firstSeenAt: { [first]: "2026-09-25T12:10:40Z" },
        })
      );
      // The hook's in-flight temp file and an unreadable file never count.
      yield* writeSessionFile(
        root,
        ".yeet-hook-state.AbC123",
        '{"schemaVersion":"yeet-hook-session/v1","firstSeenAt":{}}'
      );
      yield* writeSessionFile(root, "claude-3.json", "not json");
      yield* writeYeetAckReceipt(
        root,
        YeetAckReceipt.make({
          id: first,
          ackedAt: "2026-09-25T12:14:00.000Z",
          resolution: YeetAckFixResolution.make({ sha: "fix5678" }),
        })
      );

      const firstSeen = yield* loadYeetHookFirstSeen(root);
      assertSome(HashMap.get(firstSeen, first), "2026-09-25T12:10:40Z");
      assertSome(HashMap.get(firstSeen, later), "2026-09-25T12:11:05Z");

      const timeline = YeetHeadTimeline.make({
        headSha: head,
        firstObservedAt: "2026-09-25T12:00:30.000Z",
        pushedAt: O.some("2026-09-25T12:00:00.000Z"),
        redAt: O.some("2026-09-25T12:10:00Z"),
      });
      const joined = yield* loadYeetPushToAckTimeline(root, timeline, O.some(pr));
      expect(joined).toStrictEqual(
        YeetPushToAckTimeline.make({
          headSha: head,
          pushedAt: O.some("2026-09-25T12:00:00.000Z"),
          redAt: O.some("2026-09-25T12:10:00Z"),
          rowAt: O.some("2026-09-25T12:10:20.000Z"),
          injectedAt: O.some("2026-09-25T12:10:40Z"),
          ackedAt: O.some("2026-09-25T12:14:00.000Z"),
        })
      );

      // An unknown pull request number, or a head with no red row, keeps the
      // inbox stages absent instead of failing.
      const unknownPr = yield* loadYeetPushToAckTimeline(root, timeline, O.none());
      assertNone(unknownPr.rowAt);
      assertNone(unknownPr.injectedAt);
      assertNone(unknownPr.ackedAt);
      const green = yield* loadYeetPushToAckTimeline(
        root,
        YeetHeadTimeline.make({ headSha: "feedface", firstObservedAt: "2026-09-25T13:00:00Z" }),
        O.some(pr)
      );
      expect(renderYeetPushToAckTimeline(green)).toBe(
        "push→row→ack feedfac: pushed -, red -, row -, injected -, acked -"
      );
    })
  );

  it.effect("follows the first required red's P0 row past an earlier optional P1 row", () =>
    Effect.gen(function* () {
      const root = yield* makeTempRoot();
      // The observed PR #1270 shape: the optional Vercel red lands a P1 row
      // sixteen minutes before the required red that stamps the head's red.
      const optional = yield* writeRedRow(root, "Vercel", head, "2026-09-25T18:10:18.811Z", "P1");
      const required = yield* writeRedRow(root, "JSDoc Ratchet", head, "2026-09-25T18:27:50.483Z");
      yield* writeSessionFile(
        root,
        "claude-1.json",
        yield* encodeJson({
          schemaVersion: "yeet-hook-session/v1",
          incidentId: null,
          seenIds: [optional, required],
          firstSeenAt: { [optional]: "2026-09-25T18:10:30Z", [required]: "2026-09-25T18:28:48Z" },
        })
      );
      yield* writeYeetAckReceipt(
        root,
        YeetAckReceipt.make({
          id: optional,
          ackedAt: "2026-09-25T18:12:00.000Z",
          resolution: YeetAckFixResolution.make({ sha: "fix1111" }),
        })
      );
      yield* writeYeetAckReceipt(
        root,
        YeetAckReceipt.make({
          id: required,
          ackedAt: "2026-09-25T18:35:10.000Z",
          resolution: YeetAckFixResolution.make({ sha: "fix2222" }),
        })
      );

      const joined = yield* loadYeetPushToAckTimeline(
        root,
        YeetHeadTimeline.make({
          headSha: head,
          firstObservedAt: "2026-09-25T18:10:00.000Z",
          pushedAt: O.some("2026-09-25T18:09:52.000Z"),
          redAt: O.some("2026-09-25T18:26:36Z"),
        }),
        O.some(pr)
      );
      deepStrictEqual(
        joined,
        YeetPushToAckTimeline.make({
          headSha: head,
          pushedAt: O.some("2026-09-25T18:09:52.000Z"),
          redAt: O.some("2026-09-25T18:26:36Z"),
          rowAt: O.some("2026-09-25T18:27:50.483Z"),
          injectedAt: O.some("2026-09-25T18:28:48Z"),
          ackedAt: O.some("2026-09-25T18:35:10.000Z"),
        })
      );
      strictEqual(
        renderYeetPushToAckTimeline(joined),
        "push→row→ack abc1234: pushed 2026-09-25T18:09:52.000Z, red 2026-09-25T18:26:36Z (+16m 44s), " +
          "row 2026-09-25T18:27:50.483Z (+1m 14s 483ms), injected 2026-09-25T18:28:48Z (+57s 517ms), " +
          "acked 2026-09-25T18:35:10.000Z (+6m 22s)"
      );
    })
  );

  it.effect("keeps every inbox stage absent when the head has only an optional red's P1 row", () =>
    Effect.gen(function* () {
      const root = yield* makeTempRoot();
      const optional = yield* writeRedRow(root, "Vercel", head, "2026-09-25T18:10:18.811Z", "P1");
      yield* writeSessionFile(
        root,
        "claude-1.json",
        yield* encodeJson({
          schemaVersion: "yeet-hook-session/v1",
          incidentId: null,
          seenIds: [optional],
          firstSeenAt: { [optional]: "2026-09-25T18:10:30Z" },
        })
      );
      const joined = yield* loadYeetPushToAckTimeline(
        root,
        YeetHeadTimeline.make({
          headSha: head,
          firstObservedAt: "2026-09-25T18:10:00.000Z",
          pushedAt: O.some("2026-09-25T18:09:52.000Z"),
        }),
        O.some(pr)
      );
      strictEqual(
        renderYeetPushToAckTimeline(joined),
        "push→row→ack abc1234: pushed 2026-09-25T18:09:52.000Z, red -, row -, injected -, acked -"
      );
    })
  );

  it.effect("reads no stamps when the hook never wrote a session file", () =>
    Effect.gen(function* () {
      const root = yield* makeTempRoot();
      expect(HashMap.size(yield* loadYeetHookFirstSeen(root))).toBe(0);
    })
  );
});
