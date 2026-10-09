import {
  AiMetricsConfigSnapshotInput,
  contextSurfaceId,
  deriveHarnessHash,
  HarnessFingerprintInput,
  HarnessLedgerRow,
  HookPulseDisarmWindow,
  HookPulseV1,
  hashPrivateIdentifier,
  hookPulseHashSalt,
  makeAiMetricsConfigSnapshot,
  makeHarnessFingerprint,
  makeHarnessLedgerRowId,
} from "@beep/repo-ai-metrics";
import {
  HarnessLedgerDispositionOptions,
  HarnessLedgerListOptions,
  HarnessLedgerProposeOptions,
  HarnessLedgerPruneOptions,
  HarnessLedgerService,
  HarnessLedgerServiceLive,
  harnessLedgerPruneReportLines,
  parseHarnessEditSpec,
  parseHarnessSurfaceSpec,
} from "@beep/repo-cli/commands/HarnessLedger";
import { Sha256Hex } from "@beep/schema";
import { A, pipe, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it, layer } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { HarnessLedgerPruneReport } from "@beep/repo-cli/commands/HarnessLedger";

const TestLayer = HarnessLedgerServiceLive.pipe(
  Layer.provideMerge(NodeServices.layer),
  Layer.provideMerge(ConfigProvider.layer(ConfigProvider.fromUnknown({})))
);

const makeHookStateDir = Effect.fnUntraced(function* (prefix: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix });
  const directory = path.join(root, "hook-events");
  yield* fs.makeDirectory(directory);
  return directory;
});

const sessionA = Sha256Hex.make("a".repeat(64));
const sessionB = Sha256Hex.make("b".repeat(64));
const sessionC = Sha256Hex.make("d".repeat(64));
const sessionD = Sha256Hex.make("e".repeat(64));
const sessionE = Sha256Hex.make("1".repeat(64));
const sessionF = Sha256Hex.make("2".repeat(64));
const cwdHash = Sha256Hex.make("c".repeat(64));
const otherHarness = Sha256Hex.make("f".repeat(64));

const makeRepo = Effect.fn("test.makeRepo")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "harness-ledger-repo-" });
  yield* fs.writeFileString(path.join(root, "AGENTS.md"), "# Agent Guide\n");
  yield* fs.makeDirectory(path.join(root, ".claude", "skills", "alpha"), { recursive: true });
  yield* fs.makeDirectory(path.join(root, ".claude", "skills", "beta"), { recursive: true });
  yield* fs.makeDirectory(path.join(root, ".claude", "skills", "_shared"), { recursive: true });
  yield* fs.makeDirectory(path.join(root, ".claude", "hooks"), { recursive: true });
  yield* fs.writeFileString(path.join(root, ".claude", "skills", "alpha", "SKILL.md"), "# alpha\n");
  yield* fs.writeFileString(path.join(root, ".claude", "skills", "beta", "SKILL.md"), "# beta\n");
  yield* fs.writeFileString(path.join(root, ".claude", "hooks", "pulse.sh"), "#!/bin/sh\n");
  yield* fs.writeFileString(path.join(root, ".mcp.json"), '{ "mcpServers": { "notion": {} } }\n');
  return root;
});

const readLedgerLines = Effect.fn("test.readLedgerLines")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = path.join(root, "harness-ledger", "rows");
  const files = yield* fs.readDirectory(dir);
  const texts = yield* Effect.forEach(files, (name) => fs.readFileString(path.join(dir, name)));
  return pipe(texts, A.join(""), Str.split("\n"), A.filter(Str.isNonEmpty));
});

const pulseRow = (
  sessionId: Sha256Hex,
  ts: string,
  hookEvent: "PostToolUse" | "SessionStart" | "UserPromptSubmit",
  surface: O.Option<Sha256Hex>,
  harnessHash: O.Option<Sha256Hex>,
  sessionRole: HookPulseV1["sessionRole"] = O.some("primary")
) =>
  HookPulseV1.encodeJsonEffect(
    HookPulseV1.make({
      schemaVersion: "hook-pulse/v1",
      ts: DateTime.makeUnsafe(ts),
      sessionId,
      agentKind: "claude-code",
      sessionRole,
      sessionStartSource: hookEvent === "SessionStart" ? O.some("startup") : O.none(),
      hookEvent,
      cwd: cwdHash,
      notifierRev: "test",
      instrumentClass: "production",
      evidenceTier: "derived",
      waitReason: "none",
      toolName: hookEvent === "PostToolUse" ? O.some("Skill") : O.none(),
      toolUseId: O.none(),
      promptId: O.none(),
      transcriptPath: O.none(),
      permissionMode: O.none(),
      notificationType: O.none(),
      durationMs: O.none(),
      sessionEndReason: O.none(),
      isInterrupt: O.none(),
      surface,
      harnessHash,
    })
  );

const pulse = (sessionId: Sha256Hex, ts: string, surface: O.Option<Sha256Hex>) =>
  pulseRow(sessionId, ts, "PostToolUse", surface, O.none());

const sessionStart = Effect.fnUntraced(function* (sessionId: Sha256Hex, ts: string, harnessHash: Sha256Hex) {
  const stamp = yield* pulseRow(sessionId, ts, "SessionStart", O.none(), O.some(harnessHash));
  const turn = yield* pulseRow(sessionId, ts, "UserPromptSubmit", O.none(), O.none());
  return `${stamp}\n${turn}`;
});

// The harness hash `prune-proposals` computes for a fixture repo: the same
// snapshot the fingerprint is built from, reduced by `deriveHarnessHash`.
const repoHarnessHash = Effect.fn("test.repoHarnessHash")(function* (repoRoot: string) {
  const snapshot = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot }));
  return yield* deriveHarnessHash(yield* makeHarnessFingerprint(HarnessFingerprintInput.make({ snapshot })));
});

const writeShard = Effect.fn("test.writeShard")(function* (
  stateDir: string,
  date: string,
  sessionId: Sha256Hex,
  lines: ReadonlyArray<string>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.writeFileString(path.join(stateDir, `hook-pulse-${date}-${sessionId}.ndjson`), `${A.join(lines, "\n")}\n`);
});

const seedProposalRows = Effect.fn("test.seedProposalRows")(function* (
  repoRoot: string,
  report: HarnessLedgerPruneReport
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = path.join(repoRoot, "harness-ledger", "rows");
  yield* fs.makeDirectory(dir, { recursive: true });
  if (A.isReadonlyArrayEmpty(report.proposals)) return;
  const first = pipe(A.head(report.proposals), O.getOrThrow).row;
  const month = pipe(DateTime.formatIso(first.createdAt), Str.slice(0, 7));
  const file = path.join(dir, `${month}.jsonl`);
  const existing = (yield* fs.exists(file)) ? yield* fs.readFileString(file) : "";
  const lines = yield* Effect.forEach(report.proposals, (proposal) => HarnessLedgerRow.encodeJsonEffect(proposal.row));
  yield* fs.writeFileString(file, `${existing}${A.join(lines, "\n")}\n`);
});

const proposePending = (repoRoot: string) =>
  Effect.flatMap(HarnessLedgerService, (ledger) =>
    ledger.propose(HarnessLedgerProposeOptions.make({ repoRoot, mechanismClass: "skill", edit: { kind: "pending" } }))
  );

describe("harness-ledger CLI", () => {
  it.effect("parses edit and surface tokens", () =>
    Effect.gen(function* () {
      expect((yield* parseHarnessEditSpec("pending")).kind).toBe("pending");
      expect(yield* parseHarnessEditSpec("commit:489ea7c488")).toMatchObject({ kind: "commit", ref: "489ea7c488" });
      expect((yield* parseHarnessEditSpec(`diff:${"d".repeat(64)}`)).kind).toBe("diff-digest");
      const bad = yield* Effect.flip(parseHarnessEditSpec("diff:not-a-digest"));
      expect(bad._tag).toBe("HarnessLedgerInputError");
      expect(yield* parseHarnessSurfaceSpec("skill:yeet")).toMatchObject({ kind: "skill", name: "yeet" });
      expect((yield* Effect.flip(parseHarnessSurfaceSpec("bogus:yeet")))._tag).toBe("HarnessLedgerInputError");
    })
  );
});

layer(TestLayer, { timeout: "30 seconds" })("harness-ledger service", (it) => {
  it.effect("propose appends one line that HarnessLedgerRow decodes", () =>
    Effect.gen(function* () {
      const root = yield* makeRepo();
      const row = yield* proposePending(root);
      const lines = yield* readLedgerLines(root);
      expect(lines).toHaveLength(1);
      const decoded = yield* HarnessLedgerRow.decodeJsonEffect(lines[0]);
      expect(decoded.rowId).toBe(row.rowId);
      expect(decoded.rowId).toMatch(/^hl-\d{8}-[0-9a-f]{8}$/);
      expect(decoded.disposition).toBe("proposed");
      expect(decoded.fingerprint.modelId).toBe("unknown");
      expect(HashSet.size(decoded.touched)).toBe(0);
      expect(O.isNone(decoded.previousRowId)).toBe(true);
    }).pipe(Effect.scoped)
  );

  it.effect("disposition appends a chained row and refuses a superseded reference", () =>
    Effect.gen(function* () {
      const root = yield* makeRepo();
      const ledger = yield* HarnessLedgerService;
      const proposed = yield* proposePending(root);
      const accepted = yield* ledger.disposition(
        HarnessLedgerDispositionOptions.make({
          repoRoot: root,
          rowId: proposed.rowId,
          to: "accepted",
          evidence: "score +0.05 on 4 tasks",
          touched: [{ kind: "skill", name: "alpha" }],
        })
      );
      expect(accepted.previousRowId).toStrictEqual(O.some(proposed.rowId));
      expect(accepted.disposition).toBe("accepted");
      expect(HashSet.has(accepted.touched, yield* contextSurfaceId("skill", "alpha"))).toBe(true);
      expect(accepted.fingerprint.fingerprintId).toBe(proposed.fingerprint.fingerprintId);

      const lines = yield* readLedgerLines(root);
      expect(lines).toHaveLength(2);
      // The first line is untouched: rows are appended, never rewritten.
      expect((yield* HarnessLedgerRow.decodeJsonEffect(lines[0])).disposition).toBe("proposed");

      const stale = yield* Effect.flip(
        ledger.disposition(
          HarnessLedgerDispositionOptions.make({
            repoRoot: root,
            rowId: proposed.rowId,
            to: "rejected",
            evidence: "second opinion",
          })
        )
      );
      expect(stale._tag).toBe("HarnessLedgerChainError");

      const misplaced = yield* Effect.flip(
        ledger.disposition(
          HarnessLedgerDispositionOptions.make({
            repoRoot: root,
            rowId: accepted.rowId,
            to: "rejected",
            evidence: "regressed",
            resurrectWhen: O.some("new model id"),
          })
        )
      );
      expect(misplaced._tag).toBe("HarnessLedgerInputError");
      expect(yield* readLedgerLines(root)).toHaveLength(2);
    }).pipe(Effect.scoped)
  );

  it.effect("fences concurrent dispositions and releases the fence after failures", () =>
    Effect.gen(function* () {
      const root = yield* makeRepo();
      const ledger = yield* HarnessLedgerService;
      const previous = yield* proposePending(root);
      const options = HarnessLedgerDispositionOptions.make({
        repoRoot: root,
        rowId: previous.rowId,
        to: "accepted",
        evidence: "concurrent review",
      });
      const outcomes = yield* Effect.all(
        [Effect.result(ledger.disposition(options)), Effect.result(ledger.disposition(options))],
        { concurrency: 2 }
      );
      expect(A.filter(outcomes, Result.isSuccess)).toHaveLength(1);
      expect(A.filter(outcomes, Result.isFailure)).toHaveLength(1);
      expect(yield* readLedgerLines(root)).toHaveLength(2);
      const stale = yield* Effect.flip(ledger.disposition(options));
      expect(stale._tag).toBe("HarnessLedgerChainError");
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      expect(yield* fs.exists(path.join(root, "harness-ledger", ".write.lock"))).toBe(false);
    }).pipe(Effect.scoped)
  );

  it.effect("fails busy on a held write fence without appending or removing the lock", () =>
    Effect.gen(function* () {
      const root = yield* makeRepo();
      const ledger = yield* HarnessLedgerService;
      const previous = yield* proposePending(root);
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const lockFile = path.join(root, "harness-ledger", ".write.lock");
      yield* fs.writeFileString(lockFile, "held by another writer\n");

      const busyDisposition = yield* Effect.flip(
        ledger.disposition(
          HarnessLedgerDispositionOptions.make({
            repoRoot: root,
            rowId: previous.rowId,
            to: "accepted",
            evidence: "blocked",
          })
        )
      );
      expect(busyDisposition._tag).toBe("HarnessLedgerBusyError");
      const busyPropose = yield* Effect.flip(proposePending(root));
      expect(busyPropose._tag).toBe("HarnessLedgerBusyError");
      expect(yield* readLedgerLines(root)).toHaveLength(1);
      expect(yield* fs.readFileString(lockFile)).toBe("held by another writer\n");

      yield* fs.remove(lockFile);
      yield* proposePending(root);
      expect(yield* readLedgerLines(root)).toHaveLength(2);
      expect(yield* fs.exists(lockFile)).toBe(false);
    }).pipe(Effect.scoped)
  );

  it.effect("bare list preserves each row's model provenance but observes guidance changes", () =>
    Effect.gen(function* () {
      const root = yield* makeRepo();
      const ledger = yield* HarnessLedgerService;
      yield* ledger.propose(
        HarnessLedgerProposeOptions.make({
          repoRoot: root,
          mechanismClass: "skill",
          edit: { kind: "pending" },
          modelId: O.some("opus"),
          reasoningEffort: O.some("medium"),
        })
      );
      yield* proposePending(root);
      expect(yield* ledger.list(HarnessLedgerListOptions.make({ repoRoot: root, staleOnly: true }))).toHaveLength(0);
      expect(
        yield* ledger.list(
          HarnessLedgerListOptions.make({ repoRoot: root, staleOnly: true, modelId: O.some("new-model") })
        )
      ).toHaveLength(2);
      // Supplying both components compares them: only the unknown-model row is stale.
      const matching = yield* ledger.list(
        HarnessLedgerListOptions.make({
          repoRoot: root,
          staleOnly: true,
          modelId: O.some("opus"),
          reasoningEffort: O.some("medium"),
        })
      );
      expect(A.map(matching, (entry) => entry.row.fingerprint.modelId)).toStrictEqual(["unknown"]);
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* fs.writeFileString(path.join(root, "AGENTS.md"), "# Changed guidance\n");
      expect(yield* ledger.list(HarnessLedgerListOptions.make({ repoRoot: root, staleOnly: true }))).toHaveLength(2);
    }).pipe(Effect.scoped)
  );

  it.effect("disposition refuses a row id the ledger never recorded", () =>
    Effect.gen(function* () {
      const root = yield* makeRepo();
      const ledger = yield* HarnessLedgerService;
      yield* proposePending(root);
      const missing = yield* Effect.flip(
        ledger.disposition(
          HarnessLedgerDispositionOptions.make({
            repoRoot: root,
            rowId: "hl-20260101-00000000",
            to: "accepted",
            evidence: "never recorded",
          })
        )
      );
      expect(missing._tag).toBe("HarnessLedgerChainError");
      expect(missing.message).toBe("No ledger row hl-20260101-00000000.");
      expect(yield* readLedgerLines(root)).toHaveLength(1);
    }).pipe(Effect.scoped)
  );

  it.effect("list filters chains by the month their latest row was written", () =>
    Effect.gen(function* () {
      const root = yield* makeRepo();
      const ledger = yield* HarnessLedgerService;
      const row = yield* proposePending(root);
      const thisMonth = row.createdAt.pipe(DateTime.formatIso, Str.slice(0, 7));
      const current = yield* ledger.list(HarnessLedgerListOptions.make({ repoRoot: root, month: O.some(thisMonth) }));
      expect(A.map(current, (entry) => entry.row.rowId)).toStrictEqual([row.rowId]);
      const elsewhere = yield* ledger.list(HarnessLedgerListOptions.make({ repoRoot: root, month: O.some("2000-01") }));
      expect(elsewhere).toHaveLength(0);
    }).pipe(Effect.scoped)
  );

  it.effect("list folds chains to their latest row and flags stale fingerprints", () =>
    Effect.gen(function* () {
      const root = yield* makeRepo();
      const ledger = yield* HarnessLedgerService;
      const first = yield* proposePending(root);
      const second = yield* proposePending(root);
      const tombstone = yield* ledger.disposition(
        HarnessLedgerDispositionOptions.make({
          repoRoot: root,
          rowId: first.rowId,
          to: "tombstoned",
          evidence: "no effect",
          resurrectWhen: O.some("model id changes"),
        })
      );

      const entries = yield* ledger.list(HarnessLedgerListOptions.make({ repoRoot: root }));
      expect(A.map(entries, (entry) => entry.row.rowId)).toStrictEqual([second.rowId, tombstone.rowId]);
      expect(A.map(entries, (entry) => entry.chainLength)).toStrictEqual([1, 2]);
      expect(A.every(entries, (entry) => !entry.stale)).toBe(true);

      const tombstoned = yield* ledger.list(
        HarnessLedgerListOptions.make({ repoRoot: root, disposition: O.some("tombstoned") })
      );
      expect(A.map(tombstoned, (entry) => entry.row.rowId)).toStrictEqual([tombstone.rowId]);

      const otherModel = yield* ledger.list(
        HarnessLedgerListOptions.make({ repoRoot: root, staleOnly: true, modelId: O.some("gpt-7") })
      );
      expect(A.length(otherModel)).toBe(2);
    }).pipe(Effect.scoped)
  );

  it.effect("prune-proposals proposes zero-touch skills and MCP servers from in-regime sessions only", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeRepo();
      const current = yield* repoHarnessHash(root);
      const stateDir = yield* makeHookStateDir("harness-ledger-state-");
      const alphaId = yield* contextSurfaceId("skill", "alpha");
      const betaId = yield* contextSurfaceId("skill", "beta");
      const notionId = yield* contextSurfaceId("mcp-server", "notion");
      // A: in regime, touches alpha, plus an undecodable line.
      yield* writeShard(stateDir, "2026-09-25", sessionA, [
        yield* sessionStart(sessionA, "2026-09-25T09:59:00.000Z", current),
        yield* pulse(sessionA, "2026-09-25T10:00:00.000Z", O.some(alphaId)),
        yield* pulse(sessionA, "2026-09-25T10:05:00.000Z", O.none()),
        "{not json",
      ]);
      // B: in regime, touches nothing.
      yield* writeShard(stateDir, "2026-09-24", sessionB, [
        yield* sessionStart(sessionB, "2026-09-24T07:59:00.000Z", current),
        yield* pulse(sessionB, "2026-09-24T08:00:00.000Z", O.none()),
      ]);
      // C: restarted across a harness edit (mixed stamps); its beta touch must not protect beta.
      yield* writeShard(stateDir, "2026-09-26", sessionC, [
        yield* sessionStart(sessionC, "2026-09-26T08:00:00.000Z", otherHarness),
        yield* sessionStart(sessionC, "2026-09-26T09:00:00.000Z", current),
        yield* pulse(sessionC, "2026-09-26T09:05:00.000Z", O.some(betaId)),
      ]);
      // D: never stamped; its notion touch must not protect notion.
      yield* writeShard(stateDir, "2026-09-27", sessionD, [
        yield* pulse(sessionD, "2026-09-27T09:05:00.000Z", O.some(notionId)),
      ]);
      const ledger = yield* HarnessLedgerService;
      const options = HarnessLedgerPruneOptions.make({ repoRoot: root, stateDir, windowSessions: 5 });

      const dryRun = yield* ledger.pruneProposals(options);
      expect(dryRun.harnessHash).toBe(current);
      expect(dryRun.sessionsObserved).toBe(2);
      expect(dryRun.sessionsSkippedOutOfRegime).toBe(1);
      expect(dryRun.sessionsSkippedUnstamped).toBe(1);
      expect(dryRun.shardsRead).toBe(4);
      expect(dryRun.undecodableLines).toBe(1);
      expect(dryRun.candidates).toBe(3);
      expect(dryRun.touchedCandidates).toBe(1);
      expect(dryRun.written).toBe(false);
      expect(dryRun.windowFull).toBe(false);
      expect(dryRun.decidedUnderHarness).toBe(0);
      const proposed = A.map(dryRun.proposals, (proposal) => `${proposal.candidate.kind}:${proposal.candidate.name}`);
      expect(proposed).toStrictEqual(["skill:beta", "mcp-server:notion"]);
      expect(A.map(dryRun.proposals, (proposal) => proposal.row.mechanismClass)).toStrictEqual([
        "skill",
        "client_tool",
      ]);
      const [first] = dryRun.proposals;
      expect(first?.row.dispositionEvidence).toStrictEqual(
        O.some(
          `zero touches across 2 sessions under harness hash ${Str.slice(0, 12)(current)} ending 2026-09-25T10:05:00.000Z`
        )
      );
      expect(first?.row.edit.kind).toBe("pending");
      // The row records the observed count, not the requested window.
      expect(first?.row.windowSessions).toStrictEqual(O.some(2));
      expect(A.last(harnessLedgerPruneReportLines(dryRun, false))).toStrictEqual(
        O.some(
          "dry run: nothing written; partial window (2 of 5 sessions under the current harness hash), so --write would append nothing."
        )
      );
      expect(harnessLedgerPruneReportLines(dryRun, false)[0]).toContain("observed 2 (partial window) ending");
      // Dry run: nothing written, not even the ledger directory or its lock.
      expect(yield* fs.exists(path.join(root, "harness-ledger"))).toBe(false);

      // An open chain head without a target surface is read but never dedupes a candidate.
      yield* proposePending(root);
      const again = yield* ledger.pruneProposals(options);
      expect(again.proposals).toHaveLength(2);
      expect(again.alreadyProposed).toBe(0);
      expect(yield* readLedgerLines(root)).toHaveLength(1);

      const narrow = yield* ledger.pruneProposals(HarnessLedgerPruneOptions.make({ ...options, windowSessions: 1 }));
      expect(narrow.sessionsObserved).toBe(1);
      expect(narrow.windowFull).toBe(true);
      expect(A.last(harnessLedgerPruneReportLines(narrow, false))).toStrictEqual(
        O.some("dry run: zero-touch candidates are advisory; transcript and surface coverage are unqualified.")
      );
      // Only the skipped sessions newer than the window's oldest session count.
      expect([narrow.sessionsSkippedOutOfRegime, narrow.sessionsSkippedUnstamped]).toStrictEqual([1, 1]);
    }).pipe(Effect.scoped)
  );

  it.effect("a full session window cannot write unqualified non-use proposals", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeRepo();
      const current = yield* repoHarnessHash(root);
      const stateDir = yield* makeHookStateDir("harness-unqualified-");
      yield* writeShard(stateDir, "2026-10-09", sessionA, [
        yield* sessionStart(sessionA, "2026-10-09T10:00:00Z", current),
        yield* pulse(sessionA, "2026-10-09T10:01:00Z", O.none()),
      ]);
      const ledger = yield* HarnessLedgerService;
      const report = yield* ledger.pruneProposals(
        HarnessLedgerPruneOptions.make({ repoRoot: root, stateDir, windowSessions: 1, write: true })
      );
      expect(report.windowFull).toBe(true);
      expect(report.nonUseQualified).toBe(false);
      expect(report.written).toBe(false);
      expect(report.proposals).toHaveLength(3);
      expect(yield* fs.exists(path.join(root, "harness-ledger"))).toBe(false);
      expect(A.last(harnessLedgerPruneReportLines(report, true))).toStrictEqual(
        O.some("nothing written: transcript and surface coverage are unqualified.")
      );
    }).pipe(Effect.scoped)
  );

  it.effect("prune-proposals respects decisions under the current harness until the harness changes", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeRepo();
      const current = yield* repoHarnessHash(root);
      const stateDir = yield* makeHookStateDir("harness-ledger-decided-");
      const alphaId = yield* contextSurfaceId("skill", "alpha");
      yield* writeShard(stateDir, "2026-09-25", sessionA, [
        yield* sessionStart(sessionA, "2026-09-25T09:59:00.000Z", current),
        yield* pulse(sessionA, "2026-09-25T10:00:00.000Z", O.none()),
      ]);
      const ledger = yield* HarnessLedgerService;
      const options = HarnessLedgerPruneOptions.make({ repoRoot: root, stateDir, windowSessions: 1, write: true });
      const namesOf = (report: HarnessLedgerPruneReport) =>
        A.map(report.proposals, (proposal) => proposal.candidate.name);
      const rowIdOf = (report: HarnessLedgerPruneReport, name: string) =>
        pipe(
          A.findFirst(report.proposals, (proposal) => proposal.candidate.name === name),
          O.map((proposal) => proposal.row.rowId),
          O.getOrThrow
        );
      const decide = (rowId: string, to: "accepted" | "deferred" | "rejected" | "tombstoned" | "waived") =>
        ledger.disposition(HarnessLedgerDispositionOptions.make({ repoRoot: root, rowId, to, evidence: "human call" }));
      const first = yield* ledger.pruneProposals(options);
      yield* seedProposalRows(root, first);
      expect(namesOf(first)).toStrictEqual(["alpha", "beta", "notion"]);
      yield* decide(rowIdOf(first, "alpha"), "waived");
      const betaDeferred = yield* decide(rowIdOf(first, "beta"), "deferred");
      yield* decide(rowIdOf(first, "notion"), "rejected");

      // Same hook-pulse data, same harness: the standing decisions block a re-proposal.
      const again = yield* ledger.pruneProposals(options);
      expect(again.proposals).toHaveLength(0);
      expect(again.alreadyProposed).toBe(0);
      expect(again.decidedUnderHarness).toBe(3);
      expect(again.written).toBe(false);
      expect(harnessLedgerPruneReportLines(again, true)[3]).toBe(
        "candidates: 3; touched: 0; already proposed: 0; decided under this harness: 3"
      );
      expect(yield* readLedgerLines(root)).toHaveLength(6);

      // A tombstone never blocks: beta is proposed afresh, and accepting it blocks again.
      yield* decide(betaDeferred.rowId, "tombstoned");
      const afterTombstone = yield* ledger.pruneProposals(options);
      expect(namesOf(afterTombstone)).toStrictEqual(["beta"]);
      expect(afterTombstone.decidedUnderHarness).toBe(2);
      yield* seedProposalRows(root, afterTombstone);
      yield* decide(rowIdOf(afterTombstone, "beta"), "accepted");
      const afterAccept = yield* ledger.pruneProposals(options);
      expect(afterAccept.proposals).toHaveLength(0);
      expect(afterAccept.decidedUnderHarness).toBe(3);
      expect(yield* readLedgerLines(root)).toHaveLength(9);

      // A harness edit expires every decision: a full window under the new hash proposes again.
      yield* fs.writeFileString(path.join(root, "AGENTS.md"), "# Changed guidance\n");
      const next = yield* repoHarnessHash(root);
      expect(next).not.toBe(current);
      yield* writeShard(stateDir, "2026-09-26", sessionB, [
        yield* sessionStart(sessionB, "2026-09-26T09:59:00.000Z", next),
        yield* pulse(sessionB, "2026-09-26T10:00:00.000Z", O.some(alphaId)),
      ]);
      const expired = yield* ledger.pruneProposals(options);
      expect(expired.harnessHash).toBe(next);
      expect(namesOf(expired)).toStrictEqual(["beta", "notion"]);
      expect([expired.alreadyProposed, expired.decidedUnderHarness]).toStrictEqual([0, 0]);
      expect(expired.written).toBe(false);
      yield* seedProposalRows(root, expired);

      // An open proposal blocks under any harness: another edit does not re-propose it.
      yield* fs.writeFileString(path.join(root, "AGENTS.md"), "# Changed guidance again\n");
      const latest = yield* repoHarnessHash(root);
      yield* writeShard(stateDir, "2026-09-27", sessionC, [
        yield* sessionStart(sessionC, "2026-09-27T09:59:00.000Z", latest),
        yield* pulse(sessionC, "2026-09-27T10:00:00.000Z", O.some(alphaId)),
      ]);
      const open = yield* ledger.pruneProposals(options);
      expect(open.harnessHash).toBe(latest);
      expect(open.proposals).toHaveLength(0);
      expect([open.alreadyProposed, open.decidedUnderHarness]).toStrictEqual([2, 0]);
      expect(yield* readLedgerLines(root)).toHaveLength(11);
    }).pipe(Effect.scoped)
  );

  it.effect("prune-proposals counts a decision under the harness it was made in, not the proposal's", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeRepo();
      const proposedUnder = yield* repoHarnessHash(root);
      const stateDir = yield* makeHookStateDir("harness-ledger-decided-later-");
      const alphaId = yield* contextSurfaceId("skill", "alpha");
      const betaId = yield* contextSurfaceId("skill", "beta");
      yield* writeShard(stateDir, "2026-09-25", sessionA, [
        yield* sessionStart(sessionA, "2026-09-25T09:59:00.000Z", proposedUnder),
        yield* pulse(sessionA, "2026-09-25T10:00:00.000Z", O.some(alphaId)),
        yield* pulse(sessionA, "2026-09-25T10:01:00.000Z", O.some(betaId)),
      ]);
      const ledger = yield* HarnessLedgerService;
      const options = HarnessLedgerPruneOptions.make({ repoRoot: root, stateDir, windowSessions: 1, write: true });
      const first = yield* ledger.pruneProposals(options);
      yield* seedProposalRows(root, first);
      const notion = pipe(A.head(first.proposals), O.getOrThrow);
      expect(notion.candidate.name).toBe("notion");

      // The harness changes while the proposal is open; the human then rejects it.
      yield* fs.writeFileString(path.join(root, "AGENTS.md"), "# Changed guidance\n");
      const decidedUnder = yield* repoHarnessHash(root);
      expect(decidedUnder).not.toBe(proposedUnder);
      const rejected = yield* ledger.disposition(
        HarnessLedgerDispositionOptions.make({
          repoRoot: root,
          rowId: notion.row.rowId,
          to: "rejected",
          evidence: "human call",
        })
      );
      expect(rejected.fingerprint).toStrictEqual(notion.row.fingerprint);
      expect(rejected.decidedUnder).toStrictEqual(O.some(decidedUnder));

      // A full window under the decision's harness: the rejection stands.
      yield* writeShard(stateDir, "2026-09-26", sessionB, [
        yield* sessionStart(sessionB, "2026-09-26T09:59:00.000Z", decidedUnder),
        yield* pulse(sessionB, "2026-09-26T10:00:00.000Z", O.some(alphaId)),
        yield* pulse(sessionB, "2026-09-26T10:01:00.000Z", O.some(betaId)),
      ]);
      const again = yield* ledger.pruneProposals(options);
      expect(again.harnessHash).toBe(decidedUnder);
      expect(again.proposals).toHaveLength(0);
      expect([again.alreadyProposed, again.decidedUnderHarness]).toStrictEqual([0, 1]);
      expect(again.written).toBe(false);
      expect(yield* readLedgerLines(root)).toHaveLength(2);
    }).pipe(Effect.scoped)
  );

  it.effect("prune-proposals falls back to the fingerprint's harness for a decision row without decidedUnder", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeRepo();
      const current = yield* repoHarnessHash(root);
      const stateDir = yield* makeHookStateDir("harness-ledger-legacy-decision-");
      const alphaId = yield* contextSurfaceId("skill", "alpha");
      const betaId = yield* contextSurfaceId("skill", "beta");
      yield* writeShard(stateDir, "2026-09-25", sessionA, [
        yield* sessionStart(sessionA, "2026-09-25T09:59:00.000Z", current),
        yield* pulse(sessionA, "2026-09-25T10:00:00.000Z", O.some(alphaId)),
        yield* pulse(sessionA, "2026-09-25T10:01:00.000Z", O.some(betaId)),
      ]);
      const ledger = yield* HarnessLedgerService;
      const options = HarnessLedgerPruneOptions.make({ repoRoot: root, stateDir, windowSessions: 1, write: true });
      const first = yield* ledger.pruneProposals(options);
      yield* seedProposalRows(root, first);
      const notion = pipe(A.head(first.proposals), O.getOrThrow);
      // A decision row written before rows carried `decidedUnder`: same chain,
      // the proposal's fingerprint, and no decision-time harness hash.
      const legacy = HarnessLedgerRow.make({
        ...notion.row,
        rowId: yield* makeHarnessLedgerRowId(notion.row.createdAt),
        disposition: "rejected",
        dispositionEvidence: O.some("human call"),
        previousRowId: O.some(notion.row.rowId),
      });
      expect(legacy.decidedUnder).toStrictEqual(O.none());
      const line = yield* HarnessLedgerRow.encodeJsonEffect(legacy);
      expect(line).not.toContain("decidedUnder");
      // Same createdAt as the proposal, so the same (only) month file.
      const dir = path.join(root, "harness-ledger", "rows");
      const files = yield* fs.readDirectory(dir);
      expect(files).toHaveLength(1);
      yield* fs.writeFileString(path.join(dir, ...files), `${line}\n`, { flag: "a" });

      const again = yield* ledger.pruneProposals(options);
      expect(again.proposals).toHaveLength(0);
      expect([again.alreadyProposed, again.decidedUnderHarness]).toStrictEqual([0, 1]);
    }).pipe(Effect.scoped)
  );

  it.effect("prune-proposals reads a shard whose name spells no calendar day instead of dying", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeRepo();
      const current = yield* repoHarnessHash(root);
      const stateDir = yield* makeHookStateDir("harness-ledger-baddate-");
      const alphaId = yield* contextSurfaceId("skill", "alpha");
      yield* fs.writeFileString(
        path.join(stateDir, `hook-pulse-2026-99-99-${sessionA}.ndjson`),
        `${yield* sessionStart(sessionA, "2026-09-25T09:59:00.000Z", current)}\n`
      );
      yield* fs.writeFileString(
        path.join(stateDir, `hook-pulse-2026-02-30-${sessionA}.ndjson`),
        `${yield* pulse(sessionA, "2026-09-25T10:00:00.000Z", O.some(alphaId))}\n`
      );
      const ledger = yield* HarnessLedgerService;
      const report = yield* ledger.pruneProposals(
        HarnessLedgerPruneOptions.make({ repoRoot: root, stateDir, windowSessions: 1 })
      );
      expect(report.shardsRead).toBe(2);
      expect(report.sessionsObserved).toBe(1);
      expect(A.map(report.proposals, (proposal) => proposal.candidate.name)).toStrictEqual(["beta", "notion"]);
    }).pipe(Effect.scoped)
  );

  it.effect("prune-proposals reaches an older in-regime session past newer out-of-regime days", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeRepo();
      const current = yield* repoHarnessHash(root);
      const stateDir = yield* makeHookStateDir("harness-ledger-reach-");
      const betaId = yield* contextSurfaceId("skill", "beta");
      // The two newest sessions ran under another harness; the in-regime one is days older.
      yield* writeShard(stateDir, "2026-09-27", sessionC, [
        yield* sessionStart(sessionC, "2026-09-27T08:00:00.000Z", otherHarness),
      ]);
      yield* writeShard(stateDir, "2026-09-26", sessionD, [
        yield* pulse(sessionD, "2026-09-26T08:00:00.000Z", O.none()),
      ]);
      yield* writeShard(stateDir, "2026-09-20", sessionB, [
        yield* pulse(sessionB, "2026-09-20T08:05:00.000Z", O.some(betaId)),
      ]);
      // Spread across two days: every shard of a visited session is read.
      yield* writeShard(stateDir, "2026-09-19", sessionB, [
        yield* sessionStart(sessionB, "2026-09-19T23:58:00.000Z", current),
        yield* pulse(sessionB, "2026-09-19T23:59:00.000Z", O.none()),
      ]);
      // Older than the window: still read to detect mixed parent histories.
      yield* writeShard(stateDir, "2026-09-10", sessionA, [
        yield* sessionStart(sessionA, "2026-09-10T08:00:00.000Z", current),
      ]);
      // A shard outside the naming scheme is always read, and its rows date their session.
      yield* fs.writeFileString(
        path.join(stateDir, "hook-pulse-legacy.ndjson"),
        `${yield* pulse(sessionE, "2026-09-21T08:00:00.000Z", O.none())}\n`
      );
      // Its older named shard is still read when the session is visited.
      yield* writeShard(stateDir, "2026-09-15", sessionE, [
        yield* pulse(sessionE, "2026-09-15T08:00:00.000Z", O.none()),
      ]);
      // A named shard with no decodable row names a session that never materializes.
      yield* writeShard(stateDir, "2026-09-28", sessionF, ["{not json"]);
      const ledger = yield* HarnessLedgerService;
      const report = yield* ledger.pruneProposals(
        HarnessLedgerPruneOptions.make({ repoRoot: root, stateDir, windowSessions: 1 })
      );

      expect(report.sessionsObserved).toBe(1);
      expect(report.windowEnd).toStrictEqual(O.some(DateTime.makeUnsafe("2026-09-20T08:05:00.000Z")));
      expect(report.sessionsSkippedOutOfRegime).toBe(1);
      expect(report.sessionsSkippedUnstamped).toBe(2);
      expect(report.shardsRead).toBe(8);
      expect(report.undecodableLines).toBe(1);
      expect(A.map(report.proposals, (proposal) => proposal.candidate.name)).toStrictEqual(["alpha", "notion"]);
    }).pipe(Effect.scoped)
  );

  it.effect("stamp-only sessions stay below the activity floor", () =>
    Effect.gen(function* () {
      const root = yield* makeRepo();
      const current = yield* repoHarnessHash(root);
      const stateDir = yield* makeHookStateDir("harness-activity-");
      yield* writeShard(stateDir, "2026-10-09", sessionA, [
        yield* sessionStart(sessionA, "2026-10-09T10:00:00Z", current),
      ]);
      const ledger = yield* HarnessLedgerService;
      const report = yield* ledger.pruneProposals(
        HarnessLedgerPruneOptions.make({ repoRoot: root, stateDir, windowSessions: 1 })
      );
      expect(report.sessionsObserved).toBe(0);
      expect(report.sessionsBelowActivityFloor).toBe(1);
      expect(report.proposals).toHaveLength(0);
    }).pipe(Effect.scoped)
  );

  it.effect("a child with its own session identity cannot inflate the root window", () =>
    Effect.gen(function* () {
      const root = yield* makeRepo();
      const current = yield* repoHarnessHash(root);
      const stateDir = yield* makeHookStateDir("harness-child-");
      yield* writeShard(stateDir, "2026-10-09", sessionA, [
        yield* sessionStart(sessionA, "2026-10-09T10:00:00Z", current),
        yield* pulse(sessionA, "2026-10-09T10:01:00Z", O.none()),
      ]);
      yield* writeShard(stateDir, "2026-10-09", sessionB, [
        yield* pulseRow(
          sessionB,
          "2026-10-09T10:00:00Z",
          "SessionStart",
          O.none(),
          O.some(current),
          O.some("subagent")
        ),
        yield* pulseRow(sessionB, "2026-10-09T10:00:00Z", "UserPromptSubmit", O.none(), O.none(), O.some("subagent")),
        yield* pulseRow(sessionB, "2026-10-09T10:01:00Z", "PostToolUse", O.none(), O.none(), O.some("subagent")),
      ]);
      const ledger = yield* HarnessLedgerService;
      const report = yield* ledger.pruneProposals(
        HarnessLedgerPruneOptions.make({ repoRoot: root, stateDir, windowSessions: 30 })
      );
      expect(report.sessionsObserved).toBe(1);
      expect(report.sessionsBelowActivityFloor).toBe(0);
      expect(report.sessionsSkippedRole).toBe(1);
      expect(report.windowFull).toBe(false);
    }).pipe(Effect.scoped)
  );

  it.effect("unknown-role rows on the root transcript cannot supply activity", () =>
    Effect.gen(function* () {
      const root = yield* makeRepo();
      const current = yield* repoHarnessHash(root);
      const stateDir = yield* makeHookStateDir("harness-unknown-role-");
      const unknown = yield* HookPulseV1.decodeJsonEffect(
        yield* pulseRow(sessionA, "2026-10-09T10:01:00Z", "PostToolUse", O.none(), O.none(), O.none())
      );
      yield* writeShard(stateDir, "2026-10-09", sessionA, [
        yield* sessionStart(sessionA, "2026-10-09T10:00:00Z", current),
        yield* pulseRow(sessionA, "2026-10-09T10:00:30Z", "UserPromptSubmit", O.none(), O.none(), O.none()),
        yield* HookPulseV1.encodeJsonEffect(unknown),
      ]);
      const ledger = yield* HarnessLedgerService;
      const report = yield* ledger.pruneProposals(
        HarnessLedgerPruneOptions.make({ repoRoot: root, stateDir, windowSessions: 1 })
      );
      expect(report.sessionsObserved).toBe(0);
      expect(report.sessionsBelowActivityFloor).toBe(1);
      expect(report.proposals).toHaveLength(0);
    }).pipe(Effect.scoped)
  );

  it.effect("unstamped children retain observed touches through a qualified parent", () =>
    Effect.gen(function* () {
      const root = yield* makeRepo();
      const current = yield* repoHarnessHash(root);
      const stateDir = yield* makeHookStateDir("harness-child-touch-");
      const alphaId = yield* contextSurfaceId("skill", "alpha");
      const child = yield* HookPulseV1.decodeJsonEffect(
        yield* pulseRow(sessionA, "2026-10-09T10:01:30Z", "PostToolUse", O.some(alphaId), O.none(), O.some("subagent"))
      );
      yield* writeShard(stateDir, "2026-10-09", sessionA, [
        yield* sessionStart(sessionA, "2026-10-09T10:00:00Z", current),
        yield* pulse(sessionA, "2026-10-09T10:01:00Z", O.none()),
        yield* HookPulseV1.encodeJsonEffect(
          HookPulseV1.make({ ...child, transcriptPath: O.some(Sha256Hex.make("e".repeat(64))) })
        ),
      ]);
      const ledger = yield* HarnessLedgerService;
      const report = yield* ledger.pruneProposals(
        HarnessLedgerPruneOptions.make({ repoRoot: root, stateDir, windowSessions: 1 })
      );
      expect(report.sessionsObserved).toBe(1);
      expect(report.touchedCandidates).toBe(1);
      expect(A.map(report.proposals, (proposal) => proposal.candidate.name)).toStrictEqual(["beta", "notion"]);
    }).pipe(Effect.scoped)
  );

  it.effect("shared skills require complete windows for every loading client", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeRepo();
      yield* fs.makeDirectory(path.join(root, ".agents"));
      yield* fs.symlink("../.claude/skills", path.join(root, ".agents/skills"));
      const current = yield* repoHarnessHash(root);
      const stateDir = yield* makeHookStateDir("harness-clients-");
      yield* writeShard(stateDir, "2026-10-09", sessionA, [
        yield* sessionStart(sessionA, "2026-10-09T10:00:00Z", current),
        yield* pulse(sessionA, "2026-10-09T10:01:00Z", O.none()),
      ]);
      const ledger = yield* HarnessLedgerService;
      const report = yield* ledger.pruneProposals(
        HarnessLedgerPruneOptions.make({ repoRoot: root, stateDir, windowSessions: 1, write: true })
      );
      expect(report.sessionsByAgentKind).toStrictEqual({ "claude-code": 1, "codex-cli": 0, "cursor-cli": 0 });
      expect(report.windowFull).toBe(true);
      expect(report.sharedHarnessWindowFull).toBe(false);
      expect(report.nonUseQualified).toBe(false);
      expect(report.written).toBe(false);
    }).pipe(Effect.scoped)
  );

  it.effect("reports mixed fingerprints and payload-free refusals separately", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeRepo();
      const current = yield* repoHarnessHash(root);
      const evidenceRoot = yield* fs.makeTempDirectoryScoped({ prefix: "harness-buckets-" });
      const stateDir = path.join(evidenceRoot, "hook-events");
      yield* fs.makeDirectory(stateDir);
      yield* writeShard(stateDir, "2026-10-09", sessionA, [
        yield* sessionStart(sessionA, "2026-10-09T10:00:00Z", current),
        yield* HookPulseV1.encodeJsonEffect(
          HookPulseV1.make({
            ...(yield* HookPulseV1.decodeJsonEffect(
              yield* pulseRow(
                sessionA,
                "2026-10-09T10:00:01Z",
                "SessionStart",
                O.none(),
                O.some(Sha256Hex.make("f".repeat(64)))
              )
            )),
            transcriptPath: O.some(Sha256Hex.make("e".repeat(64))),
          })
        ),
        yield* pulse(sessionA, "2026-10-09T10:01:00Z", O.none()),
      ]);
      yield* fs.writeFileString(
        path.join(evidenceRoot, "hook-pulse-refusals-2026-10-09.ndjson"),
        '{"ts":"2026-10-09T10:00:00Z","agentKind":"claude-code","reason":"encode-failed"}\n'
      );
      const ledger = yield* HarnessLedgerService;
      const report = yield* ledger.pruneProposals(
        HarnessLedgerPruneOptions.make({ repoRoot: root, stateDir, windowSessions: 1 })
      );
      expect(report.sessionsSkippedMixedFingerprint).toBe(1);
      expect(report.sessionsObserved).toBe(0);
      expect(report.refusalsByAgentKind["claude-code"]).toBe(1);
      expect(report.clientCoverage).toStrictEqual({
        "claude-code": O.none(),
        "codex-cli": O.none(),
        "cursor-cli": O.none(),
      });
      expect(report.nonUseQualified).toBe(false);
    }).pipe(Effect.scoped)
  );

  it.effect("two explicitly primary transcripts sharing an identity cannot qualify", () =>
    Effect.gen(function* () {
      const root = yield* makeRepo();
      const current = yield* repoHarnessHash(root);
      const stateDir = yield* makeHookStateDir("harness-primary-conflict-");
      const start = yield* HookPulseV1.decodeJsonEffect(
        yield* pulseRow(sessionA, "2026-10-09T10:00:00Z", "SessionStart", O.none(), O.some(current))
      );
      const second = HookPulseV1.make({ ...start, transcriptPath: O.some(Sha256Hex.make("e".repeat(64))) });
      yield* writeShard(stateDir, "2026-10-09", sessionA, [
        yield* HookPulseV1.encodeJsonEffect(start),
        yield* pulse(sessionA, "2026-10-09T10:01:00Z", O.none()),
        yield* HookPulseV1.encodeJsonEffect(second),
      ]);
      const report = yield* (yield* HarnessLedgerService).pruneProposals(
        HarnessLedgerPruneOptions.make({ repoRoot: root, stateDir, windowSessions: 1 })
      );
      expect(report.sessionsObserved).toBe(0);
      expect(report.sessionsSkippedUnknownRestart).toBe(1);
    }).pipe(Effect.scoped)
  );

  it.effect("a resumed session without an observed fresh start cannot qualify", () =>
    Effect.gen(function* () {
      const root = yield* makeRepo();
      const current = yield* repoHarnessHash(root);
      const stateDir = yield* makeHookStateDir("harness-resume-");
      const start = yield* HookPulseV1.decodeJsonEffect(
        yield* pulseRow(sessionA, "2026-10-09T10:00:00Z", "SessionStart", O.none(), O.some(current))
      );
      yield* writeShard(stateDir, "2026-10-09", sessionA, [
        yield* HookPulseV1.encodeJsonEffect(HookPulseV1.make({ ...start, sessionStartSource: O.some("resume") })),
        yield* pulseRow(sessionA, "2026-10-09T10:00:30Z", "UserPromptSubmit", O.none(), O.none()),
        yield* pulse(sessionA, "2026-10-09T10:01:00Z", O.none()),
      ]);
      const ledger = yield* HarnessLedgerService;
      const report = yield* ledger.pruneProposals(
        HarnessLedgerPruneOptions.make({ repoRoot: root, stateDir, windowSessions: 1 })
      );
      expect(report.sessionsObserved).toBe(0);
      expect(report.sessionsSkippedUnknownRestart).toBe(1);
    }).pipe(Effect.scoped)
  );

  it.effect("unknown restarts and corrupt refusal rows have explicit diagnostics", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeRepo();
      const current = yield* repoHarnessHash(root);
      const evidenceRoot = yield* fs.makeTempDirectoryScoped({ prefix: "harness-unknown-restart-" });
      const stateDir = path.join(evidenceRoot, "hook-events");
      yield* fs.makeDirectory(stateDir);
      yield* writeShard(stateDir, "2026-10-09", sessionA, [
        yield* sessionStart(sessionA, "2026-10-09T10:00:00Z", current),
        yield* pulse(sessionA, "2026-10-09T10:01:00Z", O.none()),
        yield* pulseRow(sessionA, "2026-10-09T10:02:00Z", "SessionStart", O.none(), O.none()),
      ]);
      yield* fs.writeFileString(
        path.join(evidenceRoot, "hook-pulse-refusals-2026-10-09.ndjson"),
        '{not-json\n{"ts":"2026-10-09T10:00:00Z","agentKind":"claude-code","reason":"disabled"}\n'
      );
      const ledger = yield* HarnessLedgerService;
      const report = yield* ledger.pruneProposals(
        HarnessLedgerPruneOptions.make({ repoRoot: root, stateDir, windowSessions: 1 })
      );
      expect(report.sessionsObserved).toBe(0);
      expect(report.sessionsSkippedUnknownRestart).toBe(1);
      expect(report.undecodableLines).toBe(1);
      expect(report.writerRefusalsTotal).toBe(1);
      expect(report.refusalsByAgentKind["claude-code"]).toBe(1);
      expect(report.clientCoverage["claude-code"]).toStrictEqual(O.none());
    }).pipe(Effect.scoped)
  );

  it.effect("a session overlapping a disarm window cannot qualify", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeRepo();
      const current = yield* repoHarnessHash(root);
      const evidenceRoot = yield* fs.makeTempDirectoryScoped({ prefix: "harness-disarmed-" });
      const stateDir = path.join(evidenceRoot, "hook-events");
      yield* fs.makeDirectory(stateDir);
      yield* writeShard(stateDir, "2026-10-09", sessionA, [
        yield* sessionStart(sessionA, "2026-10-09T10:00:00Z", current),
        yield* pulse(sessionA, "2026-10-09T10:01:00Z", O.none()),
      ]);
      const gap = HookPulseDisarmWindow.make({
        schemaVersion: "hook-pulse-disarm-window/v1",
        disarmedAt: O.some("2026-10-09T10:00:30Z"),
        rearmedAt: "2026-10-09T10:00:40Z",
        reason: O.none(),
        evidenceTier: "unknown",
      });
      yield* fs.writeFileString(
        path.join(evidenceRoot, "hook-pulse-disarm-windows.ndjson"),
        yield* HookPulseDisarmWindow.encodeJsonEffect(gap)
      );
      const ledger = yield* HarnessLedgerService;
      const report = yield* ledger.pruneProposals(
        HarnessLedgerPruneOptions.make({ repoRoot: root, stateDir, windowSessions: 1 })
      );
      expect(report.sessionsObserved).toBe(0);
      expect(report.sessionsSkippedDisarmed).toBe(1);
      yield* fs.writeFileString(
        path.join(evidenceRoot, "hook-pulse-disarm-windows.ndjson"),
        yield* HookPulseDisarmWindow.encodeJsonEffect(
          HookPulseDisarmWindow.make({ ...gap, disarmedAt: O.none(), rearmedAt: "2026-10-09T09:59:00Z" })
        )
      );
      const afterRearm = yield* ledger.pruneProposals(
        HarnessLedgerPruneOptions.make({ repoRoot: root, stateDir, windowSessions: 1 })
      );
      expect(afterRearm.sessionsObserved).toBe(1);
      expect(afterRearm.sessionsSkippedDisarmed).toBe(0);
    }).pipe(Effect.scoped)
  );

  it.effect("reconciliation resolves relative roots and stops symlink cycles", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "harness-reconcile-" });
      const transcriptDir = path.join(root, "transcripts");
      const stateDir = path.join(root, "hook-events");
      const parent = "00000000-0000-4000-8000-000000000001";
      const nested = path.join(transcriptDir, parent, "workflow");
      yield* fs.makeDirectory(nested, { recursive: true });
      yield* fs.makeDirectory(stateDir);
      const encode = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
      const toolRow = yield* encode({ sessionId: parent, message: { content: [{ type: "tool_use", id: "one" }] } });
      yield* fs.writeFileString(path.join(transcriptDir, `${parent}.jsonl`), toolRow);
      yield* fs.writeFileString(path.join(nested, "child.jsonl"), toolRow);
      const identity = Sha256Hex.make(yield* hashPrivateIdentifier(parent, yield* hookPulseHashSalt));
      yield* writeShard(stateDir, "2026-10-09", identity, [
        yield* pulse(identity, "2026-10-09T10:00:00Z", O.none()),
        yield* pulse(identity, "2026-10-09T10:01:00Z", O.none()),
      ]);
      const ledger = yield* HarnessLedgerService;
      yield* fs.symlink(transcriptDir, path.join(nested, "loop"));
      yield* fs.symlink(path.join(transcriptDir, `${parent}.jsonl`), path.join(nested, "alias.jsonl"));
      yield* fs.symlink(path.join(root, "missing"), path.join(nested, "dangling.jsonl"));
      const report = yield* ledger.reconcile(stateDir, path.relative(".", transcriptDir), "claude-code");
      expect(report.transcriptToolEvents).toBe(2);
      expect(report.hookedToolEvents).toBe(2);
      expect(report.ratio).toStrictEqual(O.some(1));
      expect(report.qualifiedForNonUse).toBe(false);
      expect(report.undecodableLines).toBe(1);
    }).pipe(Effect.scoped)
  );

  it.effect("mixed transcript identities remain unmatched instead of assigning all calls to the last session", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "harness-mixed-transcript-" });
      const stateDir = yield* makeHookStateDir("harness-mixed-hooks-");
      const encode = S.encodeEffect(S.fromJsonString(S.Unknown));
      yield* fs.writeFileString(
        path.join(root, "mixed.jsonl"),
        [
          yield* encode({ sessionId: "first", message: { content: [{ type: "tool_use" }] } }),
          yield* encode({ sessionId: "second", message: { content: [{ type: "tool_use" }] } }),
        ].join("\n")
      );
      const report = yield* (yield* HarnessLedgerService).reconcile(stateDir, root, "claude-code");
      expect(report.transcriptToolEvents).toBe(2);
      expect(report.sessionsWithoutHooks).toBe(1);
      expect(report.undecodableLines).toBe(1);
      expect(report.qualifiedForNonUse).toBe(false);
    }).pipe(Effect.scoped)
  );

  it.effect("prune-proposals proposes nothing when no session was observed", () =>
    Effect.gen(function* () {
      const root = yield* makeRepo();
      const stateDir = yield* makeHookStateDir("harness-ledger-empty-");
      const ledger = yield* HarnessLedgerService;
      const report = yield* ledger.pruneProposals(
        HarnessLedgerPruneOptions.make({ repoRoot: root, stateDir, windowSessions: 30 })
      );
      expect(report.sessionsObserved).toBe(0);
      expect(report.proposals).toHaveLength(0);
      expect(report.written).toBe(false);
    }).pipe(Effect.scoped)
  );
});
