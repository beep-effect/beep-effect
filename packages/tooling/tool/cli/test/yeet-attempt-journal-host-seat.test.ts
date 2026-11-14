// PERIL-11 slice 3: optional `host` and `seat` keys on attempt-started rows.
// `fixtures/yeet-attempt-journal/mixed-revision.ndjson` is a mixed-revision
// journal: its first two lines were encoded by origin/main's encoder at
// 9d2ce0c0ea0 (before the keys existed), its last two by this revision's
// encoder with both keys set. The new decoder reads both revisions, an older
// reader (origin/main's started-row field set, frozen below, and the journal's
// own retention reader) reads the new rows, and economics folds them into the
// host and seat mixes.
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { attemptInputFactFields, repoRunArtifactId } from "@beep/repo-cli/test/RepoRun";
import { HostLabel, hostLabelOf, UUID } from "@beep/repo-cli/test/SharedInternals";
import {
  appendYeetAttemptJournalEventForCheckout,
  buildYeetEconomicsReport,
  currentYeetAttemptOrigin,
  decodeYeetAttemptJournalEvent,
  EconomicsScope,
  EconomicsScopeRequest,
  economicsCountMix,
  renderYeetEconomicsReport,
  TurboForceReceipt,
  YeetAttemptJournalEvent,
  YeetAttemptStarted,
  YeetEconomicsSource,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Digest from "effect/crypto/Digest";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const fixtureJournal = pipe(
  R.values(
    import.meta.glob<string>("./fixtures/yeet-attempt-journal/mixed-revision.ndjson", {
      eager: true,
      import: "default",
      query: "?raw",
    })
  ),
  A.head,
  O.getOrThrow
);

const fixtureLines = A.filter(Str.split(fixtureJournal, "\n"), Str.isNonEmpty);
const ORIGIN_MAIN_STARTED = 0;
const NEW_STARTED = 2;
const lineAt = (index: number): string => O.getOrThrow(A.get(fixtureLines, index));

// origin/main's `YeetAttemptStarted` fields at 9d2ce0c0ea0, frozen: the reader
// every checkout still on that revision decodes start rows with.
const OriginMainAttemptStarted = S.TaggedStruct("attempt-started", {
  schemaVersion: S.tag("yeet-attempt-journal/v1"),
  attemptId: UUID,
  runId: S.String,
  branch: S.String,
  base: S.String,
  head: S.String,
  mode: S.String,
  startedAt: S.String,
  ownerPid: S.Finite.pipe(S.OptionFromOptionalKey),
  ownerProcStart: S.String.pipe(S.OptionFromOptionalKey),
  ...attemptInputFactFields,
  forceLocal: S.Boolean.pipe(S.OptionFromOptionalKey),
  turboForce: TurboForceReceipt.pipe(S.OptionFromOptionalKey),
});
const decodeWithOriginMainReader = S.decodeUnknownEffect(S.fromJsonString(OriginMainAttemptStarted));
const encodeEvent = S.encodeUnknownEffect(S.fromJsonString(YeetAttemptJournalEvent));

const startedAt = Effect.fnUntraced(function* (index: number) {
  const event = yield* decodeYeetAttemptJournalEvent(lineAt(index));
  return yield* YeetAttemptJournalEvent.guards["attempt-started"](event)
    ? Effect.succeed(event)
    : Effect.die(`line ${index} is not an attempt-started row`);
});

describe("attempt-started host and seat keys", () => {
  it.effect("the new decoder reads origin/main rows with both keys absent and new rows with both set", () =>
    Effect.gen(function* () {
      const decoded = yield* Effect.forEach(fixtureLines, (line) => decodeYeetAttemptJournalEvent(line));
      expect(A.map(decoded, (event) => event._tag)).toEqual([
        "attempt-started",
        "attempt-terminated",
        "attempt-started",
        "attempt-terminated",
      ]);
      const before = yield* startedAt(ORIGIN_MAIN_STARTED);
      assertNone(before.host);
      assertNone(before.seat);
      const after = yield* startedAt(NEW_STARTED);
      assertSome(after.host, HostLabel.make("beep-worker"));
      assertSome(after.seat, "codex");
    })
  );

  it.effect("the new encoder writes an origin/main row back byte for byte and never emits absent keys", () =>
    Effect.gen(function* () {
      const before = yield* startedAt(ORIGIN_MAIN_STARTED);
      const beforeLine = yield* encodeEvent(before);
      expect(beforeLine).toBe(lineAt(ORIGIN_MAIN_STARTED));
      const after = yield* startedAt(NEW_STARTED);
      const afterLine = yield* encodeEvent(after);
      expect(afterLine).toBe(lineAt(NEW_STARTED));
    })
  );

  it.effect("origin/main's reader decodes the new rows, ignoring host and seat as excess keys", () =>
    Effect.gen(function* () {
      const older = yield* decodeWithOriginMainReader(lineAt(NEW_STARTED));
      expect(older.attemptId).toBe("4f1d2c3b-5a6e-4b7c-8d9e-000000000002");
      expect(older.mode).toBe("verify");
      expect(R.keys(older)).not.toContain("host");
      const oldest = yield* decodeWithOriginMainReader(lineAt(ORIGIN_MAIN_STARTED));
      expect(oldest.head).toBe(Str.repeat(40)("a"));
    })
  );
});

const Platform = Layer.mergeAll(MemoryFileSystem.layer, Path.layer, Digest.layerWebCrypto, SecureRandom.layerWebCrypto);
const LiveSource = Layer.provideMerge(YeetEconomicsSource.layer, Platform);
const RUN_BRANCH = "feature/mixed";
const NOW = DateTime.makeUnsafe("2026-11-14T01:00:00.000Z");

it.layer(LiveSource, { timeout: "30 seconds" })("a mixed-revision journal in a checkout", (it) => {
  it.effect("the journal's retention keeps the new keys and economics folds both revisions", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const checkout = "/projects/beep-effect-mixed";
      const runId = yield* repoRunArtifactId(RUN_BRANCH);
      const directory = path.join(checkout, ".beep", "yeet", "runs", runId);
      yield* fs.makeDirectory(directory, { recursive: true });
      const journalPath = path.join(directory, "attempts.ndjson");
      yield* fs.writeFileString(journalPath, fixtureJournal);
      // An append runs the journal's retention reader, which predates the keys: the new
      // rows' bytes, host and seat included, stay as written.
      const third = YeetAttemptStarted.make({
        schemaVersion: "yeet-attempt-journal/v1",
        _tag: "attempt-started",
        attemptId: UUID.make("4f1d2c3b-5a6e-4b7c-8d9e-000000000003"),
        runId: "feature-mixed-0123456789ab",
        branch: RUN_BRANCH,
        base: "origin/main",
        head: Str.repeat(40)("c"),
        mode: "final-check",
        startedAt: "2026-11-14T00:20:00.000Z",
        host: O.some(HostLabel.make("dankserver")),
        seat: O.some("claude-code"),
      });
      yield* appendYeetAttemptJournalEventForCheckout(checkout, RUN_BRANCH, third);
      const retained = yield* fs.readFileString(journalPath);
      expect(Str.startsWith(fixtureJournal)(retained)).toBe(true);
      expect(Str.includes('"seat":"claude-code"')(retained)).toBe(true);

      const source = yield* YeetEconomicsSource;
      const journals = yield* source.read(
        EconomicsScopeRequest.make({ repoRoot: checkout, branch: O.some(RUN_BRANCH), fleet: false })
      );
      const report = buildYeetEconomicsReport(
        journals,
        EconomicsScope.make({ kind: "branch", checkouts: ["beep-effect-mixed"], branch: O.some(RUN_BRANCH) }),
        NOW,
        []
      );
      // The appended start carries no owner, so the append's reconciliation terminates it
      // (`legacy-unowned-start`) and all three attempts are folded.
      deepStrictEqual(report.attempts.all.hostMix, economicsCountMix(["unrecorded", "beep-worker", "dankserver"]));
      deepStrictEqual(report.attempts.all.seatMix, economicsCountMix(["unrecorded", "codex", "claude-code"]));
      expect(
        Str.includes("  hosts: beep-worker 1, dankserver 1, unrecorded 1; seats: claude-code 1, codex 1, unrecorded 1")(
          renderYeetEconomicsReport(report)
        )
      ).toBe(true);
    })
  );
});

describe("currentYeetAttemptOrigin", () => {
  const originWith = (env: Record<string, string>) =>
    currentYeetAttemptOrigin.pipe(
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }))
    );

  it.effect("names the seat from the harness environment, Codex first, and always stamps a host", () =>
    Effect.gen(function* () {
      const both = yield* originWith({ CODEX_THREAD_ID: "thread", CLAUDE_CODE_SESSION_ID: "session" });
      assertSome(both.seat, "codex");
      const claude = yield* originWith({ CLAUDE_CODE_SESSION_ID: "session" });
      assertSome(claude.seat, "claude-code");
      const bare = yield* originWith({});
      assertSome(bare.seat, "unknown");
      assertTrue(O.exists(bare.host, S.is(HostLabel)));
      expect(hostLabelOf("Worker-1.tail.example")).toBe("worker-1");
    })
  );
});
