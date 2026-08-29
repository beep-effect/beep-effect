import { fileURLToPath } from "node:url";
import { parseProcStatStartTime } from "@beep/repo-cli/commands/Worktree";
import { Unknown } from "@beep/schema/Unknown";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path, Stream } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ChildProcess } from "effect/unstable/process";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const watcherPath = `${repoRoot}scripts/yeet-pr-lease-watch.sh`;
const JsonObject = S.fromJsonString(S.Record(S.String, S.Unknown));
const decodeObject = S.decodeUnknownSync(JsonObject);
const encodeUnknown = Unknown.encodeUnknownEffectFromJsonString;
const provideNodeServices = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.scoped(
    Layer.build(NodeServices.layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context))))
  );

const runWatcher = Effect.fn("PrLeaseWatcherTest.run")(function* (root: string, env: Record<string, string>) {
  const handle = yield* ChildProcess.make(watcherPath, ["--once", root], {
    cwd: root,
    env: { ...env, BEEP_YEET_LEASE_STALE_SECONDS: "1" },
    extendEnv: true,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = yield* Effect.all(
    [
      Stream.mkString(Stream.decodeText(handle.stdout)),
      Stream.mkString(Stream.decodeText(handle.stderr)),
      handle.exitCode,
    ],
    { concurrency: "unbounded" }
  );
  return { stdout, stderr, exitCode } as const;
});

describe("Yeet PR lease watcher", () => {
  it("keeps fallback repair pushes on the leased PR branch and restores unregistered claims", async () => {
    const script = await Bun.file(watcherPath).text();
    expect(script).toContain('BEEP_YEET_PUSH_REFSPEC="HEAD:refs/heads/${head_branch}"');
    expect(script).toContain('mv -f "$original_lease" "$lease"');
    expect(script).toContain('parse_timestamp_epoch "$refreshed_at"');
  });

  it(
    "requires stale live P0 evidence and CAS-transfers a dead owner to a resumed fixer",
    () =>
      Effect.runPromise(
        provideNodeServices(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const root = yield* fs.makeTempDirectory({ prefix: "beep-pr-lease-watch-" });
            const inbox = path.join(root, ".beep", "inbox");
            const acks = path.join(inbox, "acks");
            yield* fs.makeDirectory(path.join(root, ".git"), { recursive: true });
            yield* fs.makeDirectory(acks, { recursive: true });
            const encodedFailure = yield* encodeUnknown({
              schemaVersion: "yeet-inbox/v1",
              kind: "check-failed",
              id: "check-live",
              severity: "P0",
              checkout: root,
              ts: "2026-08-27T00:00:00Z",
              capsule: {
                bucket: "fail",
                headSha: "abc123",
                lane: "Check / Unit",
                link: null,
                observedAt: "2026-08-27T00:00:00Z",
                prNumber: 900,
                state: "FAILURE",
                workflow: "Check",
              },
            });
            yield* fs.writeFileString(path.join(inbox, "failures.ndjson"), `${encodedFailure}\n`);
            const leasePath = path.join(inbox, "pr-lease.json");
            const encodedLease = yield* encodeUnknown({
              schemaVersion: "yeet-pr-lease/v1",
              generationId: "dead-generation",
              sessionId: "codex:owner-session",
              pid: 999_999,
              procStart: "dead",
              checkoutRoot: root,
              branch: "feature/lease",
              headSha: "abc123",
              prNumber: 900,
              acquiredAt: "2026-08-27T00:00:00Z",
              refreshedAt: "2026-08-27T00:00:00Z",
            });
            yield* fs.writeFileString(leasePath, `${encodedLease}\n`);

            const dryRun = yield* runWatcher(root, { BEEP_YEET_WATCHER_DRY_RUN: "1" });
            expect(dryRun.exitCode).toBe(0);
            expect(decodeObject(dryRun.stdout)).toMatchObject({
              schemaVersion: "yeet-pr-takeover-plan/v1",
              generationId: "dead-generation",
              capsuleIds: ["check-live"],
            });

            const resumePath = path.join(root, "resume-fixture.sh");
            yield* fs.writeFileString(
              resumePath,
              `#!/usr/bin/env bash
printf "%s" "$2" >"$1/.beep/inbox/resume-marker"
jq -r '.status + ":" + .generationId' "$1/.beep/inbox/pr-lease.json" >"$1/.beep/inbox/claim-marker"
sleep 2
`
            );
            yield* fs.chmod(resumePath, 0o755);
            const takeover = yield* runWatcher(root, { BEEP_YEET_RESUME_COMMAND: resumePath });
            expect(takeover.exitCode, takeover.stderr).toBe(0);
            expect(takeover.stderr).toBe("");
            expect(takeover.stdout).toContain("resume-owner generation dead-generation");
            const updated = decodeObject(yield* fs.readFileString(leasePath));
            expect(updated).toMatchObject({
              sessionId: "codex:owner-session",
              takeoverOf: "dead-generation",
              takeoverReason: "stale-unacked-dead-or-frozen",
              takeoverMode: "resume-owner",
            });
            expect(yield* fs.readFileString(path.join(inbox, "resume-marker"))).toBe("codex:owner-session");
            expect(yield* fs.readFileString(path.join(inbox, "claim-marker"))).toMatch(/^claiming:/u);
            const fixerPid = updated.pid;
            if (typeof fixerPid === "number") {
              process.kill(fixerPid, "SIGTERM");
            }
            yield* fs.remove(root, { recursive: true });
          })
        )
      ),
    15_000
  );

  it(
    "never takes over a retired PR ownership generation",
    () =>
      Effect.runPromise(
        provideNodeServices(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const root = yield* fs.makeTempDirectory({ prefix: "beep-pr-lease-retired-" });
            const inbox = path.join(root, ".beep", "inbox");
            yield* fs.makeDirectory(path.join(root, ".git"), { recursive: true });
            yield* fs.makeDirectory(path.join(inbox, "acks"), { recursive: true });
            const failure = yield* encodeUnknown({
              schemaVersion: "yeet-inbox/v1",
              kind: "check-failed",
              id: "retired-red",
              severity: "P0",
              checkout: root,
              ts: "2026-08-27T00:00:00Z",
              capsule: {
                bucket: "fail",
                headSha: "abc123",
                lane: "Check / Unit",
                link: null,
                observedAt: "2026-08-27T00:00:00Z",
                prNumber: 900,
                state: "FAILURE",
                workflow: "Check",
              },
            });
            yield* fs.writeFileString(path.join(inbox, "failures.ndjson"), `${failure}\n`);
            const lease = yield* encodeUnknown({
              schemaVersion: "yeet-pr-lease/v1",
              generationId: "retired-generation",
              sessionId: "codex:former-owner",
              pid: 999_999,
              procStart: "dead",
              checkoutRoot: root,
              branch: "feature/lease",
              headSha: "abc123",
              prNumber: 900,
              acquiredAt: "2026-08-27T00:00:00Z",
              refreshedAt: "2026-08-27T00:00:00Z",
              status: "retired",
              retiredAt: "2026-08-27T00:00:00Z",
              retireReason: "pr-closed",
            });
            const leasePath = path.join(inbox, "pr-lease.json");
            yield* fs.writeFileString(leasePath, `${lease}\n`);
            const resumePath = path.join(root, "resume-fixture.sh");
            yield* fs.writeFileString(resumePath, `#!/usr/bin/env bash\ntouch "$1/.beep/inbox/unexpected-resume"\n`);
            yield* fs.chmod(resumePath, 0o755);

            const result = yield* runWatcher(root, { BEEP_YEET_RESUME_COMMAND: resumePath });
            expect(result.exitCode, result.stderr).toBe(0);
            expect(result.stdout).toBe("");
            expect(yield* fs.exists(path.join(inbox, "unexpected-resume"))).toBe(false);
            expect(decodeObject(yield* fs.readFileString(leasePath))).toMatchObject({
              generationId: "retired-generation",
              status: "retired",
            });
            yield* fs.remove(root, { recursive: true });
          })
        )
      ),
    15_000
  );

  it(
    "reaps the exact fixer group recorded by an abandoned claiming generation before takeover",
    () =>
      Effect.runPromise(
        provideNodeServices(
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const path = yield* Path.Path;
            const root = yield* fs.makeTempDirectory({ prefix: "beep-pr-lease-claim-" });
            const inbox = path.join(root, ".beep", "inbox");
            yield* fs.makeDirectory(path.join(root, ".git"), { recursive: true });
            yield* fs.makeDirectory(path.join(inbox, "acks"), { recursive: true });
            const failure = yield* encodeUnknown({
              schemaVersion: "yeet-inbox/v1",
              kind: "check-failed",
              id: "claim-red",
              severity: "P0",
              checkout: root,
              ts: "2026-08-27T00:00:00Z",
              capsule: {
                bucket: "fail",
                headSha: "abc123",
                lane: "Check / Unit",
                link: null,
                observedAt: "2026-08-27T00:00:00Z",
                prNumber: 900,
                state: "FAILURE",
                workflow: "Check",
              },
            });
            yield* fs.writeFileString(path.join(inbox, "failures.ndjson"), `${failure}\n`);
            const readyPath = path.join(root, "abandoned-ready");
            const abandoned = yield* ChildProcess.make(
              "sh",
              ["-c", 'printf ready > "$1"; exec sleep 30', "claim-fixture", readyPath],
              {
                cwd: root,
                stdin: "ignore",
                stdout: "ignore",
                stderr: "ignore",
              }
            );
            const abandonedPid = Number(abandoned.pid);
            let ready = false;
            for (let attempt = 0; attempt < 200 && !ready; attempt += 1) {
              ready = yield* fs.exists(readyPath);
              if (!ready) yield* Effect.sleep("10 millis");
            }
            expect(ready).toBe(true);
            const exactStart = O.getOrThrow(
              parseProcStatStartTime(yield* fs.readFileString(`/proc/${abandonedPid}/stat`))
            );
            const lease = yield* encodeUnknown({
              schemaVersion: "yeet-pr-lease/v1",
              generationId: "abandoned-claim",
              sessionId: "watcher:abandoned-claim",
              pid: 999_999,
              procStart: "dead",
              checkoutRoot: root,
              branch: "feature/lease",
              headSha: "abc123",
              prNumber: 900,
              acquiredAt: "2026-08-27T00:00:00Z",
              refreshedAt: "2026-08-27T00:00:00Z",
              status: "claiming",
              claimWorkloadProcessGroupId: abandonedPid,
              claimWorkloadProcStart: exactStart,
            });
            const leasePath = path.join(inbox, "pr-lease.json");
            yield* fs.writeFileString(leasePath, `${lease}\n`);
            const resumePath = path.join(root, "resume-fixture.sh");
            yield* fs.writeFileString(resumePath, `#!/usr/bin/env bash\nsleep 2\n`);
            yield* fs.chmod(resumePath, 0o755);

            const result = yield* runWatcher(root, { BEEP_YEET_RESUME_COMMAND: resumePath });
            expect(result.exitCode, result.stderr).toBe(0);
            expect(result.stdout).toContain("generation abandoned-claim");
            expect(() => process.kill(-abandonedPid, 0)).toThrow();
            const updated = decodeObject(yield* fs.readFileString(leasePath));
            expect(updated).toMatchObject({ status: "active", takeoverOf: "abandoned-claim" });
            if (typeof updated.pid === "number") process.kill(-updated.pid, "SIGTERM");
            yield* fs.remove(root, { recursive: true });
          })
        )
      ),
    15_000
  );
});
