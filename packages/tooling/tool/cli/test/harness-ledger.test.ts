import {
  AiMetricsConfigSnapshotInput,
  contextSurfaceId,
  deriveHarnessHash,
  HarnessFingerprintInput,
  HarnessLedgerRow,
  HookPulseV1,
  makeAiMetricsConfigSnapshot,
  makeHarnessFingerprint,
} from "@beep/repo-ai-metrics";
import {
  HarnessLedgerDispositionOptions,
  HarnessLedgerListOptions,
  HarnessLedgerProposeOptions,
  HarnessLedgerPruneOptions,
  HarnessLedgerService,
  HarnessLedgerServiceLive,
  parseHarnessEditSpec,
  parseHarnessSurfaceSpec,
} from "@beep/repo-cli/commands/HarnessLedger";
import { Sha256Hex } from "@beep/schema";
import { A, pipe, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it, layer } from "@effect/vitest";
import { DateTime, Effect, FileSystem, Layer, Path, Result } from "effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";

const TestLayer = HarnessLedgerServiceLive.pipe(Layer.provideMerge(NodeServices.layer));

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
  hookEvent: "PostToolUse" | "SessionStart",
  surface: O.Option<Sha256Hex>,
  harnessHash: O.Option<Sha256Hex>
) =>
  HookPulseV1.encodeJsonEffect(
    HookPulseV1.make({
      schemaVersion: "hook-pulse/v1",
      ts: DateTime.makeUnsafe(ts),
      sessionId,
      agentKind: "claude-code",
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

const sessionStart = (sessionId: Sha256Hex, ts: string, harnessHash: Sha256Hex) =>
  pulseRow(sessionId, ts, "SessionStart", O.none(), O.some(harnessHash));

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
      const thisMonth = Str.slice(0, 7)(DateTime.formatIso(row.createdAt));
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
      const stateDir = yield* fs.makeTempDirectoryScoped({ prefix: "harness-ledger-state-" });
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
      expect(first?.row.windowSessions).toStrictEqual(O.some(5));
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
      // Only the skipped sessions newer than the window's oldest session count.
      expect([narrow.sessionsSkippedOutOfRegime, narrow.sessionsSkippedUnstamped]).toStrictEqual([1, 1]);
    }).pipe(Effect.scoped)
  );

  it.effect("prune-proposals --write appends each proposal once under the fence", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeRepo();
      const current = yield* repoHarnessHash(root);
      const stateDir = yield* fs.makeTempDirectoryScoped({ prefix: "harness-ledger-write-" });
      const alphaId = yield* contextSurfaceId("skill", "alpha");
      yield* writeShard(stateDir, "2026-09-25", sessionA, [
        yield* sessionStart(sessionA, "2026-09-25T09:59:00.000Z", current),
        yield* pulse(sessionA, "2026-09-25T10:00:00.000Z", O.some(alphaId)),
      ]);
      const ledger = yield* HarnessLedgerService;
      const options = HarnessLedgerPruneOptions.make({ repoRoot: root, stateDir, windowSessions: 30, write: true });

      const written = yield* ledger.pruneProposals(options);
      expect(written.written).toBe(true);
      expect(A.map(written.proposals, (proposal) => proposal.candidate.name)).toStrictEqual(["beta", "notion"]);
      const lines = yield* readLedgerLines(root);
      expect(lines).toHaveLength(2);
      const rows = yield* Effect.forEach(lines, (line) => HarnessLedgerRow.decodeJsonEffect(line));
      expect(A.map(rows, (row) => row.rowId)).toStrictEqual(A.map(written.proposals, (proposal) => proposal.row.rowId));
      expect(A.every(rows, (row) => row.disposition === "proposed")).toBe(true);
      // No paths in the evidence: only counts, a hash prefix, and an instant.
      expect(A.some(lines, (line) => pipe(line, Str.includes(root)))).toBe(false);
      expect(yield* fs.exists(path.join(root, "harness-ledger", ".write.lock"))).toBe(false);

      const second = yield* ledger.pruneProposals(options);
      expect(second.written).toBe(false);
      expect(second.proposals).toHaveLength(0);
      expect(second.alreadyProposed).toBe(2);
      expect(yield* readLedgerLines(root)).toHaveLength(2);
    }).pipe(Effect.scoped)
  );

  it.effect("prune-proposals reaches an older in-regime session past newer out-of-regime days", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeRepo();
      const current = yield* repoHarnessHash(root);
      const stateDir = yield* fs.makeTempDirectoryScoped({ prefix: "harness-ledger-reach-" });
      const betaId = yield* contextSurfaceId("skill", "beta");
      // The two newest sessions ran under another harness; the in-regime one is days older.
      yield* writeShard(stateDir, "2026-09-27", sessionC, [
        yield* sessionStart(sessionC, "2026-09-27T08:00:00.000Z", otherHarness),
      ]);
      yield* writeShard(stateDir, "2026-09-26", sessionD, [
        yield* pulse(sessionD, "2026-09-26T08:00:00.000Z", O.none()),
      ]);
      yield* writeShard(stateDir, "2026-09-20", sessionB, [
        yield* sessionStart(sessionB, "2026-09-20T08:00:00.000Z", current),
        yield* pulse(sessionB, "2026-09-20T08:05:00.000Z", O.some(betaId)),
      ]);
      // Spread across two days: every shard of a visited session is read.
      yield* writeShard(stateDir, "2026-09-19", sessionB, [
        yield* pulse(sessionB, "2026-09-19T23:59:00.000Z", O.none()),
      ]);
      // Older than the day before the window filled: never read.
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
      expect(report.shardsRead).toBe(7);
      expect(report.undecodableLines).toBe(1);
      expect(A.map(report.proposals, (proposal) => proposal.candidate.name)).toStrictEqual(["alpha", "notion"]);
    }).pipe(Effect.scoped)
  );

  it.effect("prune-proposals proposes nothing when no session was observed", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* makeRepo();
      const stateDir = yield* fs.makeTempDirectoryScoped({ prefix: "harness-ledger-empty-" });
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
