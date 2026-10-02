import {
  PROOF_FACT_SCHEMA_VERSION,
  ProofEpoch,
  ProofFact,
  ProofInputDigest,
  ProofLedger,
  ProofLedgerFactRow,
  ProofLedgerLocation,
  ProofLedgerShadowRow,
  ProofProvenance,
  ProofReuseHit,
  ProofReuseMiss,
  proofLedgerPathForCheckout,
  resolveProofLedgerLocation,
} from "@beep/repo-cli/test/Yeet";
import { it } from "@beep/test-runner";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import { DateTime, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import { constFalse, constTrue } from "effect/Function";
import * as Str from "effect/String";
import type { ProofChangedPackageTripwire, ProofLedgerShape } from "@beep/repo-cli/test/Yeet";

const MemoryLayer = Layer.mergeAll(MemoryFileSystem.layer, NodePath.layer);
const PlatformLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const NOW = DateTime.makeUnsafe("2026-09-03T12:30:00.000Z");

const epoch = (digest = "epoch-1"): ProofEpoch =>
  ProofEpoch.make({
    lockfileDigest: "lock-digest",
    bunVersion: "1.4.0",
    nodeVersion: "24",
    rootTurboConfigDigest: "turbo-digest",
    rootTsconfigDigest: "tsconfig-digest",
    policyPackVersion: "0.1.0",
    digest,
  });

const input = (overrides: Partial<Parameters<typeof ProofInputDigest.make>[0]> = {}): ProofInputDigest =>
  ProofInputDigest.make({
    laneId: "coverage",
    laneClass: "cli-runnable",
    commandDigest: "command-digest",
    envProfile: "local",
    inputDigest: "input-digest",
    inputSource: "turbo-task-hash",
    epochDigest: "epoch-1",
    key: "proof-key",
    ...overrides,
  });

const fact = (overrides: Partial<Parameters<typeof ProofFact.make>[0]> = {}): ProofFact =>
  ProofFact.make({
    schemaVersion: PROOF_FACT_SCHEMA_VERSION,
    key: input(),
    epoch: epoch(),
    outcome: "passed",
    durationMs: 1_200,
    provenance: ProofProvenance.make({
      runId: "run-1",
      attemptId: "attempt-1",
      originKey: "origin-1",
      tier: "full",
      stage: "pre-push",
      headSha: "88fa371cb0",
      hostedRunId: null,
    }),
    recordedAt: "2026-09-03T12:00:00.000Z",
    expiresAt: "2026-10-03T12:00:00.000Z",
    ...overrides,
  });

const inTempRepo = Effect.fn("ProofLedgerTest.inTempRepo")(function* <Value, Failure, Requirements>(
  use: (root: string) => Effect.Effect<Value, Failure, Requirements>
) {
  const fs = yield* FileSystem.FileSystem;
  return yield* Effect.acquireUseRelease(fs.makeTempDirectory(), use, (root) =>
    fs.remove(root, { recursive: true }).pipe(Effect.orDie)
  );
});

const withLedger = <Value, Failure, Requirements>(
  root: string,
  use: (ledger: ProofLedgerShape) => Effect.Effect<Value, Failure, Requirements>,
  tripwire: ProofChangedPackageTripwire = constFalse
) =>
  Effect.gen(function* () {
    const ledger = yield* ProofLedger;
    return yield* use(ledger);
  }).pipe(Effect.provideServiceEffect(ProofLedger, ProofLedger.make(root, tripwire)));

describe("ProofLedger", () => {
  it.layer(MemoryLayer, { excludeTestServices: true, timeout: "10 seconds" })((it) => {
    it.effect("returns no-fact for an empty checkout ledger", () =>
      inTempRepo((root) =>
        withLedger(root, (ledger) =>
          Effect.gen(function* () {
            const decision = yield* ledger.lookup(input(), NOW);
            expect(decision).toStrictEqual(ProofReuseMiss.make({ key: "proof-key", reason: "no-fact" }));
            expect(yield* ledger.malformedRows).toBe(0);
            expect(yield* ledger.expire(NOW)).toBe(0);
            expect(yield* ledger.disagreements).toStrictEqual([]);
          })
        )
      )
    );
  });

  it.layer(MemoryLayer, { excludeTestServices: true, timeout: "10 seconds" })((it) => {
    it.effect("records a passed fact and returns a reuse hit", () =>
      inTempRepo((root) =>
        withLedger(root, (ledger) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* ledger.record(fact());

            const decision = yield* ledger.lookup(input(), NOW);
            expect(decision).toStrictEqual(
              ProofReuseHit.make({ key: "proof-key", factRecordedAt: "2026-09-03T12:00:00.000Z" })
            );

            const ledgerPath = yield* proofLedgerPathForCheckout(root);
            const contents = yield* fs.readFileString(ledgerPath);
            expect(Str.endsWith("\n")(contents)).toBe(true);
            expect(A.length(Str.split(contents, "\n"))).toBe(2);
          })
        )
      )
    );
  });

  it.layer(MemoryLayer, { excludeTestServices: true, timeout: "10 seconds" })((it) => {
    it.effect("returns prior-failed for the latest exact failed fact", () =>
      inTempRepo((root) =>
        withLedger(root, (ledger) =>
          Effect.gen(function* () {
            yield* ledger.record(fact());
            yield* ledger.record(fact({ outcome: "failed", recordedAt: "2026-09-03T12:10:00.000Z" }));

            expect(yield* ledger.lookup(input(), NOW)).toStrictEqual(
              ProofReuseMiss.make({ key: "proof-key", reason: "prior-failed" })
            );
          })
        )
      )
    );
  });

  it.layer(MemoryLayer, { excludeTestServices: true, timeout: "10 seconds" })((it) => {
    it.effect("returns expired and counts logical expiration without rewriting history", () =>
      inTempRepo((root) =>
        withLedger(root, (ledger) =>
          Effect.gen(function* () {
            yield* ledger.record(fact({ expiresAt: "2026-09-03T12:15:00.000Z" }));
            expect(yield* ledger.lookup(input(), NOW)).toStrictEqual(
              ProofReuseMiss.make({ key: "proof-key", reason: "expired" })
            );

            yield* ledger.record(fact({ key: input({ key: "invalid-expiry" }), expiresAt: "not-a-date" }));
            yield* ledger.record(fact({ key: input({ key: "active" }), expiresAt: "2026-09-03T13:00:00.000Z" }));
            expect(yield* ledger.expire(NOW)).toBe(2);
          })
        )
      )
    );
  });

  it.layer(MemoryLayer, { excludeTestServices: true, timeout: "10 seconds" })((it) => {
    it.effect("classifies epoch, profile, and inconsistent-key misses", () =>
      inTempRepo((root) =>
        withLedger(root, (ledger) =>
          Effect.gen(function* () {
            yield* ledger.record(fact());

            expect(yield* ledger.lookup(input({ key: "epoch-key", epochDigest: "epoch-2" }), NOW)).toStrictEqual(
              ProofReuseMiss.make({ key: "epoch-key", reason: "epoch-changed" })
            );
            expect(yield* ledger.lookup(input({ key: "profile-key", envProfile: "pr-posture" }), NOW)).toStrictEqual(
              ProofReuseMiss.make({ key: "profile-key", reason: "profile-mismatch" })
            );
            expect(yield* ledger.lookup(input({ key: "inconsistent-key" }), NOW)).toStrictEqual(
              ProofReuseMiss.make({ key: "inconsistent-key", reason: "no-fact" })
            );
            expect(yield* ledger.lookup(input({ key: "new-input", inputDigest: "changed-input" }), NOW)).toStrictEqual(
              ProofReuseMiss.make({ key: "new-input", reason: "no-fact" })
            );

            yield* ledger.record(
              fact({
                key: input({ commandDigest: "corrupt-command", key: "colliding-key" }),
              })
            );
            expect(yield* ledger.lookup(input({ key: "colliding-key" }), NOW)).toStrictEqual(
              ProofReuseMiss.make({ key: "colliding-key", reason: "no-fact" })
            );

            yield* ledger.record(
              fact({
                epoch: epoch("stored-epoch"),
                key: input({ epochDigest: "different-epoch", key: "inconsistent-epoch" }),
              })
            );
            expect(
              yield* ledger.lookup(input({ epochDigest: "different-epoch", key: "inconsistent-epoch" }), NOW)
            ).toStrictEqual(ProofReuseMiss.make({ key: "inconsistent-epoch", reason: "no-fact" }));

            yield* ledger.record(
              fact({
                key: input({ inputSource: "undeclared", key: "undeclared-fact" }),
              })
            );
            expect(yield* ledger.lookup(input({ key: "undeclared-fact" }), NOW)).toStrictEqual(
              ProofReuseMiss.make({ key: "undeclared-fact", reason: "no-fact" })
            );
          })
        )
      )
    );
  });

  it.layer(MemoryLayer, { excludeTestServices: true, timeout: "10 seconds" })((it) => {
    it.effect("refuses undeclared inputs and caller-owned changed-package tripwires before reading", () =>
      inTempRepo((root) =>
        Effect.gen(function* () {
          yield* withLedger(root, (ledger) =>
            Effect.gen(function* () {
              expect(yield* ledger.lookup(input({ inputSource: "undeclared" }), NOW)).toStrictEqual(
                ProofReuseMiss.make({ key: "proof-key", reason: "undeclared-inputs" })
              );
            })
          );
          yield* withLedger(
            root,
            (ledger) =>
              Effect.gen(function* () {
                expect(yield* ledger.lookup(input(), NOW)).toStrictEqual(
                  ProofReuseMiss.make({ key: "proof-key", reason: "changed-package-tripwire" })
                );
              }),
            () => true
          );
        })
      )
    );
  });

  it.layer(MemoryLayer, { excludeTestServices: true, timeout: "10 seconds" })((it) => {
    it.effect("decides many keys against one snapshot and appends many rows in one write", () =>
      inTempRepo((root) =>
        withLedger(root, (ledger) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* ledger.appendAll([
              ProofLedgerFactRow.make({ schemaVersion: PROOF_FACT_SCHEMA_VERSION, fact: fact() }),
              ProofLedgerFactRow.make({
                schemaVersion: PROOF_FACT_SCHEMA_VERSION,
                fact: fact({ key: input({ laneId: "quality:check", key: "check-key" }), outcome: "failed" }),
              }),
            ]);
            const contents = yield* fs.readFileString(yield* proofLedgerPathForCheckout(root));
            expect(A.length(A.filter(Str.split(contents, "\n"), Str.isNonEmpty))).toBe(2);

            const decisions = yield* ledger.lookupAll(
              [
                input(),
                input({ laneId: "quality:check", key: "check-key" }),
                input({ laneId: "quality:labs", key: "labs-key", inputSource: "undeclared" }),
                input({ laneId: "quality:lint", key: "lint-key" }),
              ],
              NOW
            );
            expect(decisions).toStrictEqual([
              ProofReuseHit.make({ key: "proof-key", factRecordedAt: "2026-09-03T12:00:00.000Z" }),
              ProofReuseMiss.make({ key: "check-key", reason: "prior-failed" }),
              ProofReuseMiss.make({ key: "labs-key", reason: "undeclared-inputs" }),
              ProofReuseMiss.make({ key: "lint-key", reason: "no-fact" }),
            ]);
            expect(yield* ledger.lookupAll([], NOW)).toStrictEqual([]);
            const snapshot = yield* ledger.snapshot(NOW);
            expect(snapshot).toMatchObject({ facts: 2, expiredFacts: 0, malformedRows: 0 });
            expect(snapshot.shadowRows).toStrictEqual([]);
            const expired = yield* ledger.snapshot(DateTime.makeUnsafe("2026-12-01T00:00:00.000Z"));
            expect(expired.expiredFacts).toBe(2);
            const tripped = yield* withLedger(root, (guarded) => guarded.lookupAll([input()], NOW), constTrue);
            expect(tripped).toStrictEqual([
              ProofReuseMiss.make({ key: "proof-key", reason: "changed-package-tripwire" }),
            ]);
            yield* ledger.appendAll([]);
            expect(yield* ledger.facts).toBe(2);
          })
        )
      )
    );
  });

  it.layer(MemoryLayer, { excludeTestServices: true, timeout: "10 seconds" })((it) => {
    it.effect("records shadow rows and returns only hit-versus-failed disagreements", () =>
      inTempRepo((root) =>
        withLedger(root, (ledger) =>
          Effect.gen(function* () {
            const disagreement = ProofLedgerShadowRow.make({
              schemaVersion: PROOF_FACT_SCHEMA_VERSION,
              attemptId: "attempt-1",
              laneId: "quality:coverage",
              branch: "feat/example",
              stage: "pre-push",
              envProfile: "local",
              decision: ProofReuseHit.make({ key: "proof-key", factRecordedAt: "2026-09-03T12:00:00.000Z" }),
              observed: "failed",
              durationMs: 1_200,
              recordedAt: "2026-09-03T12:31:00.000Z",
            });
            yield* ledger.recordShadow(disagreement);
            yield* ledger.recordShadow(
              ProofLedgerShadowRow.make({
                schemaVersion: PROOF_FACT_SCHEMA_VERSION,
                attemptId: "attempt-2",
                laneId: "quality:coverage",
                branch: "feat/example",
                stage: "pre-push",
                envProfile: "local",
                decision: ProofReuseHit.make({
                  key: "proof-key",
                  factRecordedAt: "2026-09-03T12:00:00.000Z",
                }),
                observed: "passed",
                durationMs: 1_200,
                recordedAt: "2026-09-03T12:32:00.000Z",
              })
            );
            yield* ledger.recordShadow(
              ProofLedgerShadowRow.make({
                schemaVersion: PROOF_FACT_SCHEMA_VERSION,
                attemptId: "attempt-3",
                laneId: "quality:coverage",
                branch: "feat/example",
                stage: "pre-push",
                envProfile: "local",
                decision: ProofReuseMiss.make({ key: "proof-key", reason: "no-fact" }),
                observed: "failed",
                durationMs: 1_200,
                recordedAt: "2026-09-03T12:33:00.000Z",
              })
            );

            expect(yield* ledger.disagreements).toStrictEqual([disagreement]);
          })
        )
      )
    );
  });

  it.layer(MemoryLayer, { excludeTestServices: true, timeout: "10 seconds" })((it) => {
    it.effect("counts malformed terminated rows and ignores an unterminated append tail", () =>
      inTempRepo((root) =>
        withLedger(root, (ledger) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            yield* ledger.record(fact());
            const ledgerPath = yield* proofLedgerPathForCheckout(root);
            yield* fs.writeFileString(ledgerPath, "malformed\n", { flag: "a" });
            yield* fs.writeFileString(ledgerPath, '{"kind":"shadow"', { flag: "a" });

            expect(yield* ledger.malformedRows).toBe(1);
            expect(yield* ledger.lookup(input(), NOW)).toStrictEqual(
              ProofReuseHit.make({ key: "proof-key", factRecordedAt: "2026-09-03T12:00:00.000Z" })
            );

            const recoveredFact = fact({
              key: input({ key: "recovered-key" }),
              recordedAt: "2026-09-03T12:40:00.000Z",
            });
            yield* ledger.record(recoveredFact);
            expect(yield* ledger.lookup(input({ key: "recovered-key" }), NOW)).toStrictEqual(
              ProofReuseHit.make({ key: "recovered-key", factRecordedAt: "2026-09-03T12:40:00.000Z" })
            );
            expect(yield* ledger.malformedRows).toBe(2);
          })
        )
      )
    );
  });

  it.layer(MemoryLayer, { excludeTestServices: true, timeout: "10 seconds" })((it) => {
    it.effect("treats a wholly unterminated first row as in-flight rather than malformed", () =>
      inTempRepo((root) =>
        withLedger(root, (ledger) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const ledgerPath = yield* proofLedgerPathForCheckout(root);
            yield* fs.makeDirectory(yield* Effect.map(Path.Path, (path) => path.dirname(ledgerPath)), {
              recursive: true,
            });
            yield* fs.writeFileString(ledgerPath, '{"kind":"fact"');

            expect(yield* ledger.malformedRows).toBe(0);
            expect(yield* ledger.lookup(input(), NOW)).toStrictEqual(
              ProofReuseMiss.make({ key: "proof-key", reason: "no-fact" })
            );
          })
        )
      )
    );
  });

  it.layer(MemoryLayer, { excludeTestServices: true, timeout: "10 seconds" })((it) => {
    it.effect("fails with a typed error when the ledger path is not a readable regular file", () =>
      inTempRepo((root) =>
        withLedger(root, (ledger) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const ledgerPath = yield* proofLedgerPathForCheckout(root);
            yield* fs.makeDirectory(ledgerPath, { recursive: true });

            const error = yield* ledger.malformedRows.pipe(Effect.flip);
            expect(error._tag).toBe("YeetCommandError");
            expect(error.message).toContain("not a readable regular file");

            const appendError = yield* ledger.record(fact()).pipe(Effect.flip);
            expect(appendError._tag).toBe("YeetCommandError");
            expect(appendError.message).toContain("not a readable regular file");
          })
        )
      )
    );
  });

  // TTC rulings 59–60: the ledger and its fact schema never read a legacy proof store, so no
  // ProofFact can be built from rows that lack per-lane input digests, env profiles, or epochs.
  it.layer(PlatformLayer, { timeout: "30 seconds" })("legacy proof-store boundary", (it) => {
    it.effect("keeps the ledger and fact modules free of legacy proof-store imports", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const internal = path.join(import.meta.dirname, "..", "src", "commands", "Yeet", "internal");
        const sources = yield* Effect.forEach(["ProofLedger.ts", "ProofFact.ts"], (file) =>
          fs.readFileString(path.join(internal, file))
        );
        const legacyImports = A.filter(sources, (source) =>
          A.some(["ProofState.ts", "LaneProofReuse.ts"], (legacy) => Str.includes(`/${legacy}"`)(source))
        );
        expect(A.length(sources)).toBe(2);
        expect(legacyImports).toStrictEqual([]);
      })
    );
  });

  // TTC ruling 71: the ledger's checkout is the owning clone, so every lane cut from one clone
  // appends to and reads one sample, and retiring a lane never deletes it.
  it.layer(MemoryLayer, { timeout: "30 seconds" })("owning-clone ledger", (it) => {
    // A primary clone (a `.git` directory) and linked worktrees laid out the way
    // `git worktree add` writes them: `<lane>/.git` is `gitdir: <clone>/.git/worktrees/<name>`,
    // and that directory's `commondir` is `../..`.
    const cloneWithLanes = Effect.fn("ProofLedgerTest.cloneWithLanes")(function* (
      names: ReadonlyArray<string>,
      relativeGitdir: boolean
    ) {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const base = yield* fs.makeTempDirectoryScoped({ prefix: "proof-ledger-clone-" });
      const clone = path.join(base, "repo");
      yield* fs.makeDirectory(path.join(clone, ".git"), { recursive: true });
      const lanes = yield* Effect.forEach(
        names,
        Effect.fnUntraced(function* (name: string) {
          const lane = path.join(base, "repo-worktrees", name);
          const gitDir = path.join(clone, ".git", "worktrees", name);
          yield* fs.makeDirectory(gitDir, { recursive: true });
          yield* fs.makeDirectory(lane, { recursive: true });
          yield* fs.writeFileString(path.join(gitDir, "commondir"), "../..\n");
          yield* fs.writeFileString(path.join(gitDir, "gitdir"), `${path.join(lane, ".git")}\n`);
          const target = relativeGitdir ? path.relative(lane, gitDir) : gitDir;
          yield* fs.writeFileString(path.join(lane, ".git"), `gitdir: ${target}\n`);
          return lane;
        })
      );
      return { clone, lanes, ledgerPath: path.join(clone, ".beep", "yeet", "proof-ledger.ndjson") };
    });

    it.effect(
      "resolves a primary clone and a bare directory to themselves",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { clone, ledgerPath } = yield* cloneWithLanes([], false);
        expect(yield* resolveProofLedgerLocation(clone)).toStrictEqual(
          ProofLedgerLocation.make({ originRoot: clone, ledgerRoot: clone, ledgerPath })
        );
        const bare = yield* fs.makeTempDirectoryScoped({ prefix: "proof-ledger-bare-" });
        expect(yield* proofLedgerPathForCheckout(bare)).toBe(path.join(bare, ".beep", "yeet", "proof-ledger.ndjson"));
      })
    );

    it.effect(
      "resolves a linked worktree to its owning clone through gitdir and commondir",
      Effect.fnUntraced(function* () {
        const absolute = yield* cloneWithLanes(["lane-a"], false);
        const laneA = A.getUnsafe(absolute.lanes, 0);
        expect(yield* resolveProofLedgerLocation(laneA)).toStrictEqual(
          ProofLedgerLocation.make({ originRoot: laneA, ledgerRoot: absolute.clone, ledgerPath: absolute.ledgerPath })
        );
        // `git worktree add` with `worktree.useRelativePaths` writes a relative gitdir,
        // which resolves against the worktree itself.
        const relative = yield* cloneWithLanes(["lane-r"], true);
        expect(yield* proofLedgerPathForCheckout(A.getUnsafe(relative.lanes, 0))).toBe(relative.ledgerPath);
      })
    );

    it.effect(
      "keeps the ledger inside a common dir not named .git",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const base = yield* fs.makeTempDirectoryScoped({ prefix: "proof-ledger-bare-common-" });
        // A worktree of a bare repository: `<base>/repo.git/worktrees/lane` with `commondir` `../..`.
        const common = path.join(base, "repo.git");
        const gitDir = path.join(common, "worktrees", "lane");
        const lane = path.join(base, "lane");
        yield* fs.makeDirectory(gitDir, { recursive: true });
        yield* fs.makeDirectory(lane, { recursive: true });
        yield* fs.writeFileString(path.join(gitDir, "commondir"), "../..\n");
        yield* fs.writeFileString(path.join(lane, ".git"), `gitdir: ${gitDir}\n`);
        expect(yield* resolveProofLedgerLocation(lane)).toStrictEqual(
          ProofLedgerLocation.make({
            originRoot: lane,
            ledgerRoot: common,
            ledgerPath: path.join(common, ".beep", "yeet", "proof-ledger.ndjson"),
          })
        );
      })
    );

    it.effect(
      "keeps the ledger inside a separated git dir that has no commondir file",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const base = yield* fs.makeTempDirectoryScoped({ prefix: "proof-ledger-separate-git-dir-" });
        // `git init --separate-git-dir <base>/store/repo.git <base>/checkout`: the checkout's `.git`
        // names the git dir directly, and that git dir is its own common dir (no `commondir` file).
        const gitDir = path.join(base, "store", "repo.git");
        const checkout = path.join(base, "checkout");
        yield* fs.makeDirectory(gitDir, { recursive: true });
        yield* fs.makeDirectory(checkout, { recursive: true });
        yield* fs.writeFileString(path.join(checkout, ".git"), "gitdir: ../store/repo.git\n");
        expect(yield* resolveProofLedgerLocation(checkout)).toStrictEqual(
          ProofLedgerLocation.make({
            originRoot: checkout,
            ledgerRoot: gitDir,
            ledgerPath: path.join(gitDir, ".beep", "yeet", "proof-ledger.ndjson"),
          })
        );
      })
    );

    it.effect(
      "refuses a .git file that names no gitdir instead of splitting the sample",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "proof-ledger-gitfile-" });
        yield* fs.writeFileString(path.join(root, ".git"), "not a gitfile\n");
        const error = yield* resolveProofLedgerLocation(root).pipe(Effect.flip);
        expect(error._tag).toBe("YeetCommandError");
        expect(error.message).toContain('without a "gitdir:" line');
      })
    );

    it.effect(
      "keeps a separate git directory without commondir as the ledger owner",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const base = yield* fs.makeTempDirectoryScoped({ prefix: "proof-ledger-separate-" });
        const checkout = path.join(base, "checkout");
        const gitDir = path.join(base, "metadata.git");
        yield* fs.makeDirectory(checkout);
        yield* fs.makeDirectory(gitDir);
        yield* fs.writeFileString(path.join(checkout, ".git"), "gitdir: ../metadata.git\n");

        expect(yield* resolveProofLedgerLocation(checkout)).toStrictEqual(
          ProofLedgerLocation.make({
            originRoot: checkout,
            ledgerRoot: gitDir,
            ledgerPath: path.join(gitDir, ".beep", "yeet", "proof-ledger.ndjson"),
          })
        );
      })
    );

    it.effect(
      "shares one sample: a fact recorded from one lane is read by a sibling lane and the clone",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { clone, lanes, ledgerPath } = yield* cloneWithLanes(["lane-a", "lane-b"], false);
        const laneA = A.getUnsafe(lanes, 0);
        const laneB = A.getUnsafe(lanes, 1);
        const fromA = yield* ProofLedger.make(laneA);
        yield* fromA.record(fact({ provenance: ProofProvenance.make({ ...fact().provenance, originKey: laneA }) }));

        const hit = ProofReuseHit.make({ key: "proof-key", factRecordedAt: "2026-09-03T12:00:00.000Z" });
        expect(yield* (yield* ProofLedger.make(laneB)).lookup(input(), NOW)).toStrictEqual(hit);
        expect(yield* (yield* ProofLedger.make(clone)).lookup(input(), NOW)).toStrictEqual(hit);
        // The row lands in the clone, carries the lane that ran as its origin, and no lane
        // keeps a private ledger that `yeet sweep --retire` would delete.
        expect(Str.includes(`"originKey":"${laneA}"`)(yield* fs.readFileString(ledgerPath))).toBe(true);
        expect(yield* fs.exists(path.join(laneA, ".beep"))).toBe(false);
        expect(yield* fs.exists(path.join(laneB, ".beep"))).toBe(false);
      })
    );
  });
});
