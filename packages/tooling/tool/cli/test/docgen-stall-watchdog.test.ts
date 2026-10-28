import { runDocgenStepWithStallWatchdogForTesting } from "@beep/repo-cli/test/Docgen";
import { runCapturedStreams, runToExit } from "@beep/repo-cli/test/Process";
import { DomainError } from "@beep/repo-utils";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { it } from "@beep/test-runner";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";

const ProcessDiagnosticTestLayer = Layer.mergeAll(NodeServices.layer, TestConsole.layer);

// The hosted Docgen lane runs turbo to completion and then never sees it exit:
// 2m8s of real work followed by 56 minutes of silence until the job timed out
// (run 31991634069). These bind the containment for that, which is otherwise
// only reachable against a child that outlives a multi-minute budget.
//
// Public layers exclude Test services: the watchdog is built on `Effect.timeoutOption`, and
// under the default TestClock no budget would ever elapse, so every one of
// these would pass without exercising anything.
describe("commands/Docgen docgen step stall watchdog", () => {
  it.layer(ProcessDiagnosticTestLayer, { excludeTestServices: true, timeout: "30 seconds" })((it) => {
    it.effect("resolves only cache references for native Turbo and degrades a denied session to local-only", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* findRepoRoot();
        const fixtures = path.join(repoRoot, ".beep");
        yield* fs.makeDirectory(fixtures, { recursive: true });
        const root = yield* fs.makeTempDirectoryScoped({ directory: fixtures });
        const bin = path.join(root, "bin");
        const nativeDirectory = path.join(root, "node_modules/.bin");
        yield* fs.makeDirectory(bin);
        yield* fs.makeDirectory(nativeDirectory, { recursive: true });
        const native = path.join(nativeDirectory, "turbo");
        const op = path.join(bin, "op");
        yield* fs.writeFileString(
          op,
          `#!/usr/bin/python3
import os,sys
if os.environ['FIXTURE_OP_DENY']=='1':raise SystemExit(78)
assert sys.argv[1:3]==['run','--']
args=sys.argv[3:];env=dict(os.environ)
assert 'APPLICATION_REFERENCE' not in env
env['TURBO_TOKEN']='fixture-resolved-bearer'
os.execvpe(args[0],args,env)
`
        );
        yield* fs.writeFileString(
          native,
          `#!/usr/bin/python3
import os,sys
assert 'APPLICATION_REFERENCE' not in os.environ
if os.environ['FIXTURE_OP_DENY']=='1':
 assert '--cache=local:rw' in sys.argv and 'TURBO_TOKEN' not in os.environ
else:
 assert os.environ['TURBO_TOKEN']=='fixture-resolved-bearer'
 assert '--cache=local:rw,remote:rw' in sys.argv
`
        );
        yield* fs.chmod(op, 0o700);
        yield* fs.chmod(native, 0o700);
        const driver = path.join(root, "driver.ts");
        yield* fs.writeFileString(
          driver,
          `import * as Effect from "effect/Effect";
import * as Duration from "effect/Duration";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { runDocgenStepWithStallWatchdogForTesting } from "@beep/repo-cli/test/Docgen";
const [, , command = "", cwd = ""] = Bun.argv;
await Effect.runPromise(runDocgenStepWithStallWatchdogForTesting("cache fixture", command,
 ["run", "docgen", "--cache=local:rw,remote:rw"], cwd,
 { first: Duration.seconds(10), retry: Duration.seconds(10) }).pipe(Effect.provide(NodeServices.layer)));
`
        );
        for (const denied of ["0", "1"]) {
          const result = yield* runCapturedStreams({
            command: "bun",
            args: [driver, native, root],
            cwd: repoRoot,
            env: {
              PATH: `${bin}:${Bun.env.PATH ?? ""}`,
              HOME: Bun.env.HOME ?? root,
              CI: "false",
              TURBO_API: "http://127.0.0.1:9427",
              TURBO_TOKEN: "op://fixture/cache/bearer",
              TURBO_TEAM: "fixture",
              TURBO_CACHE: "local:rw,remote:rw",
              BEEP_TURBO_TRUSTED_WRITER: "true",
              APPLICATION_REFERENCE: "op://fixture/application/secret",
              FIXTURE_OP_DENY: denied,
            },
            extendEnv: false,
          });
          expect(result.exitCode, result.stderr).toBe(0);
        }
      })
    );

    it.effect(
      "returns as soon as the child exits, without a retry",
      Effect.fnUntraced(function* () {
        const repoRoot = yield* findRepoRoot();

        yield* runDocgenStepWithStallWatchdogForTesting("watchdog probe", "true", [], repoRoot, {
          first: Duration.seconds(30),
          retry: Duration.seconds(30),
        });
      })
    );

    it.effect(
      "surfaces a nonzero child exit rather than treating it as a stall",
      Effect.fnUntraced(function* () {
        const repoRoot = yield* findRepoRoot();

        yield* runDocgenStepWithStallWatchdogForTesting("watchdog probe", "false", [], repoRoot, {
          first: Duration.seconds(30),
          retry: Duration.seconds(30),
        }).pipe(Effect.flip);
      })
    );

    it.effect(
      "abandons a child that outlives its budget and fails once the retry stalls too",
      Effect.fnUntraced(function* () {
        const repoRoot = yield* findRepoRoot();

        // Both attempts stall, which is the unrecoverable case: it has to fail
        // loudly rather than hang, since hanging is the whole defect.
        const failure = yield* runDocgenStepWithStallWatchdogForTesting("watchdog probe", "sleep", ["30"], repoRoot, {
          first: Duration.millis(250),
          retry: Duration.millis(250),
        }).pipe(Effect.flip);

        expect(S.is(DomainError)(failure)).toBe(true);
        expect(failure.message).toBe(
          "watchdog probe never returned within 250ms on retry; see the child process-tree diagnostics above."
        );
        const lines = A.filter(yield* TestConsole.logLines, P.isString);
        expect(lines).toContain("[docgen:local] watchdog probe: started: sleep 30");
        expect(lines).toContain("[docgen:local] watchdog probe (retry): started: sleep 30");
        expect(lines).toContain(
          "docgen:local: watchdog probe never returned within 250ms; abandoning it and retrying once against the warm cache."
        );
        expect(
          A.filter(lines, Str.startsWith("docgen:local: after abandoning watchdog probe: child process tree:"))
        ).toHaveLength(1);
        expect(
          A.filter(
            lines,
            Str.startsWith("docgen:local: after the watchdog probe retry also stalled: child process tree:")
          )
        ).toHaveLength(1);
      })
    );

    it.effect(
      "logs only the watched child tree without raw argument values",
      Effect.fnUntraced(function* () {
        const repoRoot = yield* findRepoRoot();
        const unrelated = yield* ChildProcess.make("sleep", ["30"], {
          cwd: repoRoot,
          stdin: "ignore",
          stdout: "ignore",
          stderr: "ignore",
          forceKillAfter: Duration.seconds(5),
        });
        const rawArgumentCanary = "docgen-raw-argv-canary";

        yield* runDocgenStepWithStallWatchdogForTesting(
          "watchdog process fixture",
          "sh",
          ["-c", "sleep 30 & wait", rawArgumentCanary],
          repoRoot,
          {
            first: Duration.millis(250),
            retry: Duration.millis(250),
          }
        ).pipe(Effect.flip);

        const diagnostics = A.join(
          A.filter(
            A.filter(yield* TestConsole.logLines, P.isString),
            Str.startsWith("docgen:local: after abandoning watchdog process fixture: child process tree:")
          ),
          "\n"
        );
        expect(diagnostics).toContain("executable=");
        expect(diagnostics).toContain("state=");
        expect(diagnostics).not.toContain(`pid=${unrelated.pid} ppid=`);
        expect(diagnostics).not.toContain(rawArgumentCanary);
        expect(diagnostics).not.toContain("args=");
      })
    );
  });
});

describe("internal/process runToExit force-kill escalation", () => {
  it.layer(NodeServices.layer, { excludeTestServices: true, timeout: "30 seconds" })((it) => {
    // Abandoning a step closes the child scope, which signals the process group
    // and then waits on the exit event. Without this escalation that wait is
    // unbounded against a child ignoring SIGTERM, so the watchdog above could not
    // actually reclaim anything.
    it.effect(
      "accepts a force-kill window without disturbing a normal exit",
      Effect.fnUntraced(function* () {
        const repoRoot = yield* findRepoRoot();

        const exitCode = yield* runToExit({
          command: "true",
          args: [],
          cwd: repoRoot,
          stdio: "ignore",
          forceKillAfter: Duration.seconds(5),
        });

        expect(exitCode).toBe(0);
      })
    );

    it.effect(
      "still reports a nonzero exit when a force-kill window is set",
      Effect.fnUntraced(function* () {
        const repoRoot = yield* findRepoRoot();

        const exitCode = yield* runToExit({
          command: "false",
          args: [],
          cwd: repoRoot,
          stdio: "ignore",
          forceKillAfter: Duration.seconds(5),
        });

        expect(exitCode).not.toBe(0);
      })
    );
  });
});
