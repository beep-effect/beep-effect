import { contextSurfaceId, HarnessLedgerRow, HookPulseV1 } from "@beep/repo-ai-metrics";
import {
  HarnessLedgerDispositionOptions,
  HarnessLedgerInputError,
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
import { assertFailure } from "@effect/vitest/utils";
import { DateTime, Effect, FileSystem, Layer, Path, Result } from "effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";

const TestLayer = HarnessLedgerServiceLive.pipe(Layer.provideMerge(NodeServices.layer));

const sessionA = Sha256Hex.make("a".repeat(64));
const sessionB = Sha256Hex.make("b".repeat(64));
const cwdHash = Sha256Hex.make("c".repeat(64));

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

const pulse = (sessionId: Sha256Hex, ts: string, surface: O.Option<Sha256Hex>) =>
  HookPulseV1.encodeJsonEffect(
    HookPulseV1.make({
      schemaVersion: "hook-pulse/v1",
      ts: DateTime.makeUnsafe(ts),
      sessionId,
      agentKind: "claude-code",
      hookEvent: "PostToolUse",
      cwd: cwdHash,
      notifierRev: "test",
      instrumentClass: "production",
      evidenceTier: "derived",
      waitReason: "none",
      toolName: O.some("Skill"),
      toolUseId: O.none(),
      promptId: O.none(),
      transcriptPath: O.none(),
      permissionMode: O.none(),
      notificationType: O.none(),
      durationMs: O.none(),
      sessionEndReason: O.none(),
      isInterrupt: O.none(),
      surface,
    })
  );

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

  it.effect("prune-proposals proposes zero-touch skills, hooks, and MCP servers", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeRepo();
      const stateDir = yield* fs.makeTempDirectoryScoped({ prefix: "harness-ledger-state-" });
      const alphaId = yield* contextSurfaceId("skill", "alpha");
      yield* fs.writeFileString(
        path.join(stateDir, `hook-pulse-2026-09-25-${sessionA}.ndjson`),
        A.join(
          [
            yield* pulse(sessionA, "2026-09-25T10:00:00.000Z", O.some(alphaId)),
            yield* pulse(sessionA, "2026-09-25T10:05:00.000Z", O.none()),
            "{not json",
            "",
          ],
          "\n"
        )
      );
      yield* fs.writeFileString(
        path.join(stateDir, `hook-pulse-2026-09-24-${sessionB}.ndjson`),
        `${yield* pulse(sessionB, "2026-09-24T08:00:00.000Z", O.none())}\n`
      );
      const ledger = yield* HarnessLedgerService;
      const options = HarnessLedgerPruneOptions.make({ repoRoot: root, stateDir, windowSessions: 5 });

      const dryRun = yield* ledger.pruneProposals(options);
      expect(dryRun.sessionsObserved).toBe(2);
      expect(dryRun.undecodableLines).toBe(1);
      expect(dryRun.candidates).toBe(3);
      expect(dryRun.touchedCandidates).toBe(1);
      const proposed = A.map(dryRun.proposals, (proposal) => `${proposal.candidate.kind}:${proposal.candidate.name}`);
      expect(proposed).toStrictEqual(["skill:beta", "mcp-server:notion"]);
      expect(A.map(dryRun.proposals, (proposal) => proposal.row.mechanismClass)).toStrictEqual([
        "skill",
        "client_tool",
      ]);
      const [first] = dryRun.proposals;
      expect(first?.row.dispositionEvidence).toStrictEqual(
        O.some("zero touches across 2 sessions ending 2026-09-25T10:05:00.000Z")
      );
      expect(first?.row.edit.kind).toBe("pending");
      expect(first?.row.windowSessions).toStrictEqual(O.some(5));
      expect(yield* fs.exists(path.join(root, "harness-ledger"))).toBe(false);

      const denied = yield* Effect.result(
        ledger.pruneProposals(HarnessLedgerPruneOptions.make({ ...options, write: true }))
      );
      assertFailure(
        denied,
        HarnessLedgerInputError.new(
          "Cannot append pruning proposals until hook-pulse sessions are scoped by the current harness hash."
        )
      );
      expect(yield* fs.exists(path.join(root, "harness-ledger"))).toBe(false);

      // An open chain head without a target surface is read but never dedupes a candidate.
      yield* proposePending(root);
      const again = yield* ledger.pruneProposals(options);
      expect(again.proposals).toHaveLength(2);
      expect(again.alreadyProposed).toBe(0);

      const narrow = yield* ledger.pruneProposals(HarnessLedgerPruneOptions.make({ ...options, windowSessions: 1 }));
      expect(narrow.sessionsObserved).toBe(1);
    })
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
    }).pipe(Effect.scoped)
  );
});
