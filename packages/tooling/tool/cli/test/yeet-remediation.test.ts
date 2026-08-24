import {
  decideYeetRemediation,
  dispatchYeetCheckFailure,
  loadYeetRemediationWave,
  renderYeetDispatchLine,
  renderYeetDispatchStateWarning,
  supersedeYeetDispatchState,
  supersedeYeetRemediationWave,
  YEET_DISPATCH_SCHEMA_VERSION,
  YeetCheckFailedRow,
  YeetCheckSignal,
  YeetDispatchReport,
  YeetFailureCapsule,
  YeetInboxRowJson,
  YeetRemediationInput,
  YeetRemediationOutcome,
  YeetRemediationWave,
  YeetRemediationWaveJson,
  YeetWatchCheck,
  YeetWatchSnapshot,
  YeetWaveSupersedeInput,
  yeetDispatchStatePath,
  yeetInboxPaths,
  yeetInboxRowId,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

const AT = "2026-08-17T00:00:00Z";
const LATER = "2026-08-17T00:00:10Z";

const wave = (overrides: Partial<Parameters<typeof YeetRemediationWave.make>[0]> = {}): YeetRemediationWave =>
  YeetRemediationWave.make({
    capsuleIds: ["coverage-abc"],
    headSha: "aaa111",
    prNumber: 751,
    sessionStartedAt: AT,
    updatedAt: AT,
    ...overrides,
  });

const decide = (input: Parameters<typeof YeetRemediationInput.make>[0]) =>
  decideYeetRemediation(YeetRemediationInput.make(input));

describe("decideYeetRemediation", () => {
  it("starts the repair session on the first red for a head", () => {
    const outcome = decide({ at: AT, capsuleId: "coverage-abc", headSha: "aaa111", prNumber: 751, wave: null });

    expect(outcome.decision).toBe("start-session");
    expect(outcome.wave.sessionStartedAt).toBe(AT);
    expect(outcome.wave.capsuleIds).toEqual(["coverage-abc"]);
    expect(outcome.wave.headSha).toBe("aaa111");
    expect(outcome.wave.prNumber).toBe(751);
  });

  it("queues a later red for the same head onto the running session", () => {
    const outcome = decide({ at: LATER, capsuleId: "lint-def", headSha: "aaa111", prNumber: 751, wave: wave() });

    expect(outcome.decision).toBe("queue");
    expect(outcome.wave.capsuleIds).toEqual(["coverage-abc", "lint-def"]);
    expect(outcome.wave.sessionStartedAt).toBe(AT);
    expect(outcome.wave.updatedAt).toBe(LATER);
  });

  it("drops an already-queued capsule as a duplicate without touching the wave", () => {
    const current = wave();
    const outcome = decide({ at: LATER, capsuleId: "coverage-abc", headSha: "aaa111", prNumber: 751, wave: current });

    expect(outcome.decision).toBe("duplicate");
    expect(outcome.wave).toStrictEqual(current);
  });

  it("starts fresh when the persisted wave belongs to another head", () => {
    const outcome = decide({ at: LATER, capsuleId: "lint-bbb", headSha: "bbb222", prNumber: 751, wave: wave() });

    expect(outcome.decision).toBe("start-session");
    expect(outcome.wave.headSha).toBe("bbb222");
    expect(outcome.wave.capsuleIds).toEqual(["lint-bbb"]);
    expect(outcome.wave.sessionStartedAt).toBe(LATER);
  });

  // A branch tip re-opened as a new PR shares the head with the dead PR's
  // wave; matching on head alone would swallow the new PR's session start.
  it("starts fresh when the persisted wave belongs to another pull request on the same head", () => {
    const outcome = decide({ at: LATER, capsuleId: "coverage-752", headSha: "aaa111", prNumber: 752, wave: wave() });

    expect(outcome.decision).toBe("start-session");
    expect(outcome.wave.prNumber).toBe(752);
    expect(outcome.wave.capsuleIds).toEqual(["coverage-752"]);
  });

  it("starts the session on the first red after a push opened an empty wave", () => {
    const empty = wave({ capsuleIds: [], sessionStartedAt: null });
    const outcome = decide({ at: LATER, capsuleId: "coverage-abc", headSha: "aaa111", prNumber: 751, wave: empty });

    expect(outcome.decision).toBe("start-session");
    expect(outcome.wave.sessionStartedAt).toBe(LATER);
    expect(outcome.wave.capsuleIds).toEqual(["coverage-abc"]);
  });
});

describe("supersedeYeetRemediationWave", () => {
  it("opens a fresh, sessionless wave for a new head", () => {
    const next = supersedeYeetRemediationWave(
      YeetWaveSupersedeInput.make({ at: LATER, headSha: "bbb222", prNumber: 751, wave: wave() })
    );

    expect(next.headSha).toBe("bbb222");
    expect(next.capsuleIds).toEqual([]);
    expect(next.sessionStartedAt).toBeNull();
  });

  it("opens the same fresh wave when no record exists", () => {
    const next = supersedeYeetRemediationWave(
      YeetWaveSupersedeInput.make({ at: LATER, headSha: "bbb222", prNumber: 751, wave: null })
    );

    expect(next.capsuleIds).toEqual([]);
  });

  it("passes a wave already on the observed head through unchanged", () => {
    const current = wave();
    const next = supersedeYeetRemediationWave(
      YeetWaveSupersedeInput.make({ at: LATER, headSha: "aaa111", prNumber: 751, wave: current })
    );

    expect(next).toStrictEqual(current);
  });

  it("supersedes a same-head wave that belongs to another pull request", () => {
    const next = supersedeYeetRemediationWave(
      YeetWaveSupersedeInput.make({ at: LATER, headSha: "aaa111", prNumber: 752, wave: wave() })
    );

    expect(next.prNumber).toBe(752);
    expect(next.capsuleIds).toEqual([]);
    expect(next.sessionStartedAt).toBeNull();
  });
});

const capsule = (overrides: Partial<Parameters<typeof YeetFailureCapsule.make>[0]> = {}): YeetFailureCapsule =>
  YeetFailureCapsule.make({
    bucket: "fail",
    headSha: "aaa111bbb",
    lane: "Check / Coverage",
    link: "https://github.com/beep/beep/actions/runs/1/job/2",
    observedAt: AT,
    prNumber: 751,
    state: "FAILURE",
    workflow: "Check",
    ...overrides,
  });

describe("renderYeetDispatchLine", () => {
  const report = (outcome: YeetRemediationOutcome): YeetDispatchReport => {
    const subject = capsule();
    return YeetDispatchReport.make({
      outcome,
      row: YeetCheckFailedRow.make({
        capsule: subject,
        checkout: "/repo",
        id: yeetInboxRowId(subject),
        severity: "P0",
        ts: AT,
      }),
    });
  };

  it("announces each decision distinctly", () => {
    const started = renderYeetDispatchLine(
      report(YeetRemediationOutcome.make({ decision: "start-session", wave: wave() }))
    );
    const queued = renderYeetDispatchLine(
      report(YeetRemediationOutcome.make({ decision: "queue", wave: wave({ capsuleIds: ["a", "b"] }) }))
    );
    const duplicate = renderYeetDispatchLine(
      report(YeetRemediationOutcome.make({ decision: "duplicate", wave: wave() }))
    );

    expect(started).toContain("repair session opened");
    expect(started).toContain('"Check / Coverage"');
    expect(started).toContain("aaa111b");
    expect(queued).toContain("queued to the head");
    expect(queued).toContain("2 capsules");
    expect(duplicate).toContain("already queued");
  });
});

describe("renderYeetDispatchStateWarning", () => {
  it("names the reason and the consequence", () => {
    const line = renderYeetDispatchStateWarning("disk is full");

    expect(line).toContain("disk is full");
    expect(line).toContain("dedup safely");
  });
});

const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const inTempRepo = Effect.fn("inTempRepo")(function* <Value, Failure, Requirements>(
  use: (root: string) => Effect.Effect<Value, Failure, Requirements>
) {
  const fs = yield* FileSystem.FileSystem;
  return yield* Effect.acquireUseRelease(fs.makeTempDirectory(), use, (root) =>
    Effect.ignore(fs.remove(root, { recursive: true }))
  );
});

const snapshotWithFailure = (root: YeetWatchCheck): YeetWatchSnapshot =>
  YeetWatchSnapshot.make({
    checks: [root],
    headSha: "aaa111bbb",
    mergeable: "MERGEABLE",
    prNumber: 751,
    state: "OPEN",
    threads: [],
  });

const failingCheck = YeetWatchCheck.make({
  name: "Check / Coverage",
  outcome: "fail",
  link: "https://github.com/beep/beep/actions/runs/1/job/2",
  signal: YeetCheckSignal.make({ bucket: "cancel", state: "CANCELLED" }),
  workflow: "Check",
});

const readInboxRows = Effect.fn("readInboxRows")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const paths = yield* yeetInboxPaths(root);
  const text = yield* Effect.option(fs.readFileString(paths.failuresPath));
  const lines = O.match(text, {
    onNone: () => A.empty<string>(),
    onSome: (value) => A.filter(Str.split(value, "\n"), Str.isNonEmpty),
  });
  return yield* Effect.forEach(lines, (line) => YeetInboxRowJson.decode(line));
});

describe("loadYeetRemediationWave", () => {
  it.live("reads back what was persisted and refuses everything else", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        expect(O.isNone(yield* loadYeetRemediationWave(root))).toBe(true);

        const statePath = yield* yeetDispatchStatePath(root);
        yield* fs.makeDirectory(`${root}/.beep/inbox`, { recursive: true });
        yield* fs.writeFileString(statePath, "garbage");
        expect(O.isNone(yield* loadYeetRemediationWave(root))).toBe(true);

        const json = yield* YeetRemediationWaveJson.encode(wave());
        yield* fs.writeFileString(statePath, `${json}\n`);
        const loaded = yield* loadYeetRemediationWave(root);
        expect(O.isSome(loaded)).toBe(true);
        if (O.isSome(loaded)) {
          expect(loaded.value.schemaVersion).toBe(YEET_DISPATCH_SCHEMA_VERSION);
          expect(loaded.value).toStrictEqual(wave());
        }
      })
    ).pipe(provideScopedLayer(PlatformLayer))
  );
});

describe("supersedeYeetDispatchState", () => {
  // A push that lands before any red superseded nothing worth announcing:
  // the empty wave rolls forward silently.
  it.live("stays silent when the superseded wave held no capsules", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const statePath = yield* yeetDispatchStatePath(root);
        yield* fs.makeDirectory(`${root}/.beep/inbox`, { recursive: true });
        const empty = wave({ capsuleIds: [], sessionStartedAt: null });
        yield* fs.writeFileString(statePath, `${yield* YeetRemediationWaveJson.encode(empty)}\n`);

        yield* supersedeYeetDispatchState(root, "bbb222", 751, LATER);

        const persisted = yield* loadYeetRemediationWave(root);
        if (O.isSome(persisted)) {
          expect(persisted.value.headSha).toBe("bbb222");
        }
        expect(A.length(yield* TestConsole.errorLines)).toBe(0);
      })
    ).pipe(provideScopedLayer(Layer.mergeAll(TestConsole.layer, PlatformLayer)))
  );

  it.live("announces when an in-flight wave is superseded", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const statePath = yield* yeetDispatchStatePath(root);
        yield* fs.makeDirectory(`${root}/.beep/inbox`, { recursive: true });
        yield* fs.writeFileString(statePath, `${yield* YeetRemediationWaveJson.encode(wave())}\n`);

        yield* supersedeYeetDispatchState(root, "bbb222", 751, LATER);

        const errors = A.map(yield* TestConsole.errorLines, String);
        expect(A.some(errors, (line) => Str.includes("1-capsule wave for aaa111 is superseded")(line))).toBe(true);
      })
    ).pipe(provideScopedLayer(Layer.mergeAll(TestConsole.layer, PlatformLayer)))
  );

  it.live("rejects a symlinked dispatch file without replacing its destination", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repoRoot = `${root}/repo`;
        const outsideRoot = `${root}/outside`;
        yield* fs.makeDirectory(`${repoRoot}/.beep/inbox`, { recursive: true });
        yield* fs.makeDirectory(outsideRoot);
        const outsideDispatch = `${outsideRoot}/dispatch.json`;
        const sentinel = "outside target must stay unchanged\n";
        yield* fs.writeFileString(outsideDispatch, sentinel);
        yield* fs.symlink(outsideDispatch, yield* yeetDispatchStatePath(repoRoot));

        yield* supersedeYeetDispatchState(repoRoot, "bbb222", 751, LATER);

        expect(yield* fs.readFileString(outsideDispatch)).toBe(sentinel);
        const errors = A.map(yield* TestConsole.errorLines, String);
        expect(A.some(errors, (line) => Str.includes("could not persist the remediation wave record")(line))).toBe(
          true
        );
      })
    ).pipe(provideScopedLayer(Layer.mergeAll(TestConsole.layer, PlatformLayer)))
  );

  it.live("rejects a symlinked dispatch parent without writing through it", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repoRoot = `${root}/repo`;
        const outsideInbox = `${root}/outside-inbox`;
        yield* fs.makeDirectory(`${repoRoot}/.beep`, { recursive: true });
        yield* fs.makeDirectory(outsideInbox);
        const outsideDispatch = `${outsideInbox}/dispatch.json`;
        const sentinel = "outside parent must stay unchanged\n";
        yield* fs.writeFileString(outsideDispatch, sentinel);
        yield* fs.symlink(outsideInbox, `${repoRoot}/.beep/inbox`);

        yield* supersedeYeetDispatchState(repoRoot, "bbb222", 751, LATER);

        expect(yield* fs.readFileString(outsideDispatch)).toBe(sentinel);
        const errors = A.map(yield* TestConsole.errorLines, String);
        expect(A.some(errors, (line) => Str.includes("could not persist the remediation wave record")(line))).toBe(
          true
        );
      })
    ).pipe(provideScopedLayer(Layer.mergeAll(TestConsole.layer, PlatformLayer)))
  );
});

describe("dispatchYeetCheckFailure", () => {
  it.live("derives the capsule from the failing check's own record", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        yield* dispatchYeetCheckFailure(root, snapshotWithFailure(failingCheck), failingCheck, AT);

        const rows = yield* readInboxRows(root);
        expect(A.length(rows)).toBe(1);
        const entry = rows[0];
        expect(entry?.checkout).toBe(root);
        expect(entry?.capsule.lane).toBe("Check / Coverage");
        expect(entry?.capsule.link).toBe("https://github.com/beep/beep/actions/runs/1/job/2");
        expect(entry?.capsule.workflow).toBe("Check");
        // The raw signal survives: CANCELLED steers repair toward a rerun.
        expect(entry?.capsule.bucket).toBe("cancel");
        expect(entry?.capsule.state).toBe("CANCELLED");

        const persisted = yield* loadYeetRemediationWave(root);
        expect(O.isSome(persisted)).toBe(true);
        const errors = A.map(yield* TestConsole.errorLines, String);
        expect(A.some(errors, (line) => Str.includes("repair session opened")(line))).toBe(true);
      })
    ).pipe(provideScopedLayer(Layer.mergeAll(TestConsole.layer, PlatformLayer)))
  );

  it.live("skips every write on a duplicate observation", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        yield* dispatchYeetCheckFailure(root, snapshotWithFailure(failingCheck), failingCheck, AT);
        yield* dispatchYeetCheckFailure(root, snapshotWithFailure(failingCheck), failingCheck, LATER);

        const rows = yield* readInboxRows(root);
        expect(A.length(rows)).toBe(1);
        const persisted = yield* loadYeetRemediationWave(root);
        if (O.isSome(persisted)) {
          expect(persisted.value.updatedAt).toBe(AT);
        }
      })
    ).pipe(provideScopedLayer(Layer.mergeAll(TestConsole.layer, PlatformLayer)))
  );

  // The wave must never claim a capsule the inbox does not hold: a failed
  // append skips the persist so the next observation retries the delivery.
  it.live("does not record the wave when the inbox append fails", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory(`${root}/.beep`, { recursive: true });
        yield* fs.writeFileString(`${root}/.beep/inbox`, "squatter");

        yield* dispatchYeetCheckFailure(root, snapshotWithFailure(failingCheck), failingCheck, AT);

        expect(O.isNone(yield* loadYeetRemediationWave(root))).toBe(true);
        const errors = A.map(yield* TestConsole.errorLines, String);
        expect(A.some(errors, (line) => Str.includes("failed to deliver capsule")(line))).toBe(true);
        expect(A.some(errors, (line) => Str.includes("NOT queued")(line))).toBe(true);
      })
    ).pipe(provideScopedLayer(Layer.mergeAll(TestConsole.layer, PlatformLayer)))
  );

  it.live("delivers the capsule and warns when only the wave record cannot be written", () =>
    inTempRepo((root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const statePath = yield* yeetDispatchStatePath(root);
        // A directory squatting on dispatch.json fails the state write only.
        yield* fs.makeDirectory(statePath, { recursive: true });

        yield* dispatchYeetCheckFailure(root, snapshotWithFailure(failingCheck), failingCheck, AT);

        expect(A.length(yield* readInboxRows(root))).toBe(1);
        const errors = A.map(yield* TestConsole.errorLines, String);
        expect(A.some(errors, (line) => Str.includes("could not persist the remediation wave record")(line))).toBe(
          true
        );
      })
    ).pipe(provideScopedLayer(Layer.mergeAll(TestConsole.layer, PlatformLayer)))
  );
});
