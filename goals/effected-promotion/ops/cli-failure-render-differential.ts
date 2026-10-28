/**
 * repo-cli failure-rendering differential (wave 4, 4-C-A, W4-d).
 *
 * 4-C-A moves repo-cli's entry (`packages/tooling/tool/cli/src/bin-main.ts`) from its own teardown renderer,
 * `renderCliFailure`, onto `@beep/cli-kit` `CliRuntime.main` with a custom `render`. This script runs the real
 * bin as a child process over a fixed matrix and records, per case, the stdout bytes, the stderr bytes and the
 * exit code:
 *
 * - `--version` and `--help` (exit 0), an unknown subcommand (a usage error);
 * - a `CliReportedExit` failure that also writes an `Effect.logWarning` line (`version-sync` in a tree with no
 *   `.bun-version`/`.nvmrc`);
 * - a typed failure, plain and with `--log-level debug` (`yeet job logs <uuid> --tail -1`);
 * - a defect, plain and verbose (`graft deep status` with `HOME` unset dies on `Config.String("HOME")`);
 * - EPIPE: `--completions zsh | head -c1`, which must print the `[beep-cli] exiting with code` drain line;
 * - the quality fast path (`check` outside a repository) and the ci fast path (`ci`, `ci nosuch`);
 * - every case with and without `GITHUB_ACTIONS=true`.
 *
 * Each child runs with a cleared environment (`PATH`, a scratch `HOME`, `TERM=dumb`). Before comparing, the
 * output is normalized: the checkout is `<repo>`, the scratch root `<tmp>`, the log timestamp `[<time>]`, the
 * fiber id `(#<fiber>)` and every stack-frame position `:<line>:<col>`, because editing `bin-main.ts` moves line
 * numbers. With `--compare <baseline.json>` every case whose normalized output differs from the baseline must
 * fall into an INTENDED class, or the run fails:
 *
 * - `workflow-command-neutralized`: the kit's report puts a zero-width space in front of a report line that
 *   starts with `::` or `##`, so a runner never reads it as a workflow command. Equal once U+200B is removed.
 *
 * Usage (from the repo root):
 *
 *   bun goals/effected-promotion/ops/cli-failure-render-differential.ts [--out <report.json>]
 *     [--compare <baseline.json>] [--only <case-id>]
 *
 * Exit code 1 when a difference is unclassified.
 */
import * as NodeURL from "node:url";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import type * as PlatformError from "effect/PlatformError";

const repoRoot = Str.replace(/\/$/, "")(NodeURL.fileURLToPath(new URL("../../..", import.meta.url)));
const BIN = "packages/tooling/tool/cli/src/bin.ts";
const JOB_ID = "0f5c9a3e-6d3b-4c1e-9a8f-2b7d1c4e5a60";

const flagValue = (flag: string): O.Option<string> =>
  pipe(
    A.findFirstIndex(process.argv, (arg) => arg === flag),
    O.flatMap((index) => A.get(process.argv, index + 1))
  );

const Fixture = S.Literals(["empty", "version-sync"]);

const CaseSpec = S.Struct({
  id: S.String,
  argv: S.Array(S.String),
  fixture: Fixture,
  home: S.Boolean,
  pipeHead: S.Boolean,
});
type CaseSpec = typeof CaseSpec.Type;

const CaseResult = S.Struct({
  id: S.String,
  argv: S.Array(S.String),
  githubActions: S.Boolean,
  exitCode: S.Finite,
  stdout: S.String,
  stderr: S.String,
});
type CaseResult = typeof CaseResult.Type;

const Report = S.Struct({
  tool: S.String,
  bin: S.String,
  normalization: S.Array(S.String),
  cases: S.Array(CaseResult),
});
const ReportJson = S.fromJsonString(Report, { space: 2 });

const spec = (id: string, argv: ReadonlyArray<string>, extra: Partial<Omit<CaseSpec, "id" | "argv">> = {}) =>
  CaseSpec.make({ id, argv, fixture: "empty", home: true, pipeHead: false, ...extra });

const MATRIX: ReadonlyArray<CaseSpec> = [
  spec("version", ["--version"]),
  spec("help", ["--help"]),
  spec("usage-error", ["nosuchcmd"]),
  spec("reported-exit-with-log-line", ["version-sync", "--skip-network"], { fixture: "version-sync" }),
  spec("typed-failure", ["yeet", "job", "logs", JOB_ID, "--tail", "-1"]),
  spec("typed-failure-verbose", ["yeet", "job", "logs", JOB_ID, "--tail", "-1", "--log-level", "debug"]),
  spec("defect", ["graft", "deep", "status"], { home: false }),
  spec("defect-verbose", ["graft", "deep", "status", "--log-level=debug"], { home: false }),
  spec("epipe", ["--completions", "zsh"], { pipeHead: true }),
  spec("quality-fast-path-failure", ["check"]),
  spec("ci-fast-path-help", ["ci"]),
  spec("ci-fast-path-usage-error", ["ci", "nosuch"]),
];

const NORMALIZATION = [
  "the checkout path is <repo>, the scratch root <tmp>",
  "log timestamps [HH:MM:SS.mmm] are [<time>]",
  "fiber ids (#N) are (#<fiber>)",
  "stack-frame positions :L:C are :<line>:<col>",
];

const normalize = (tmp: string) => (text: string) =>
  pipe(
    text,
    Str.replaceAll(tmp, "<tmp>"),
    Str.replaceAll(repoRoot, "<repo>"),
    Str.replace(/\[\d{2}:\d{2}:\d{2}\.\d{3}\]/g, "[<time>]"),
    Str.replace(/\(#\d+\)/g, "(#<fiber>)"),
    Str.replace(/:\d+:\d+\)/g, ":<line>:<col>)")
  );

const collect = (stream: Stream.Stream<Uint8Array, PlatformError.PlatformError>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runFold(
      () => "",
      (acc: string, chunk: string) => acc + chunk
    )
  );

const runCase = Effect.fn("CliFailureRenderDifferential.runCase")(function* (
  tmp: string,
  item: CaseSpec,
  githubActions: boolean
) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const env: Record<string, string> = {
    PATH: yield* Config.String("PATH").pipe(Config.withDefault("/usr/bin:/bin")),
    TERM: "dumb",
    ...(item.home ? { HOME: `${tmp}/home` } : {}),
    ...(githubActions ? { GITHUB_ACTIONS: "true" } : {}),
  };
  const bin = `${repoRoot}/${BIN}`;
  const command = item.pipeHead
    ? ChildProcess.make(
        "bash",
        ["-c", 'set -o pipefail; "$0" "$@" | head -c1 >/dev/null', process.execPath, bin, ...item.argv],
        { cwd: `${tmp}/${item.fixture}`, env, extendEnv: false }
      )
    : ChildProcess.make(process.execPath, [bin, ...item.argv], {
        cwd: `${tmp}/${item.fixture}`,
        env,
        extendEnv: false,
      });
  const [stdout, stderr, exitCode] = yield* Effect.scoped(
    Effect.flatMap(spawner.spawn(command), (handle) =>
      Effect.all([collect(handle.stdout), collect(handle.stderr), handle.exitCode], { concurrency: "unbounded" })
    )
  );
  const clean = normalize(tmp);
  return CaseResult.make({
    id: item.id,
    argv: item.argv,
    githubActions,
    exitCode: Number(exitCode),
    stdout: clean(stdout),
    stderr: clean(stderr),
  });
});

const ZERO_WIDTH_SPACE = "​";

const classify = (
  base: CaseResult,
  head: CaseResult
): "identical" | "workflow-command-neutralized" | "UNCLASSIFIED" => {
  if (base.exitCode === head.exitCode && base.stdout === head.stdout && base.stderr === head.stderr) {
    return "identical";
  }
  const strip = Str.replaceAll(ZERO_WIDTH_SPACE, "");
  return base.exitCode === head.exitCode && base.stdout === strip(head.stdout) && base.stderr === strip(head.stderr)
    ? "workflow-command-neutralized"
    : "UNCLASSIFIED";
};

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tmp = yield* fs.makeTempDirectoryScoped({ prefix: "cli-failure-render-" });
  yield* fs.makeDirectory(path.join(tmp, "empty"));
  yield* fs.makeDirectory(path.join(tmp, "home"));
  yield* fs.makeDirectory(path.join(tmp, "version-sync"));
  yield* fs.writeFileString(path.join(tmp, "version-sync", "package.json"), '{"name":"x","private":true}\n');
  yield* fs.writeFileString(path.join(tmp, "version-sync", "bun.lock"), "");
  // The `empty` cases rely on repo-root discovery failing. A `.git` or `bun.lock` in any ancestor of the scratch
  // root (a tool writing into the temp directory) would turn `check` into a real turbo run, so refuse to run then.
  const ancestors = A.unfold(tmp, (dir) => (dir === path.dirname(dir) ? O.none() : O.some([dir, path.dirname(dir)])));
  const markers = yield* Effect.filter(
    A.flatMap(ancestors, (dir) => [path.join(dir, ".git"), path.join(dir, "bun.lock")]),
    (marker) => fs.exists(marker)
  );
  if (A.isReadonlyArrayNonEmpty(markers)) {
    return yield* Effect.die(`a repository marker sits above the scratch root: ${A.join(markers, ", ")}`);
  }
  const only = flagValue("--only");
  const selected = O.match(only, { onNone: () => MATRIX, onSome: (id) => A.filter(MATRIX, (item) => item.id === id) });
  const cases = yield* Effect.forEach(
    A.flatMap(
      selected,
      (item) =>
        [
          [item, false],
          [item, true],
        ] as const
    ),
    ([item, githubActions]) => runCase(tmp, item, githubActions)
  );
  const report = Report.make({
    tool: "cli-failure-render-differential",
    bin: BIN,
    normalization: NORMALIZATION,
    cases,
  });
  const json = yield* S.encodeEffect(ReportJson)(report);
  yield* O.match(flagValue("--out"), {
    onNone: () => Effect.void,
    onSome: (out) => fs.writeFileString(out, `${json}\n`),
  });
  const compare = flagValue("--compare");
  if (O.isNone(compare)) {
    yield* Console.log(
      A.join(
        A.map(cases, (c) => `${c.id}${c.githubActions ? " [actions]" : ""}: exit ${c.exitCode}`),
        "\n"
      )
    );
    return;
  }
  const baseline = yield* S.decodeEffect(ReportJson)(yield* fs.readFileString(compare.value));
  const verdicts = A.map(cases, (head) => {
    const base = A.findFirst(baseline.cases, (c) => c.id === head.id && c.githubActions === head.githubActions);
    const verdict = O.match(base, { onNone: () => "UNCLASSIFIED" as const, onSome: (b) => classify(b, head) });
    return `${head.id}${head.githubActions ? " [actions]" : ""}: ${verdict}`;
  });
  // A baseline case the head run lost counts as unclassified, except under `--only`.
  const missing = A.filter(
    baseline.cases,
    (b) => O.isNone(only) && !A.some(cases, (c) => c.id === b.id && c.githubActions === b.githubActions)
  );
  yield* Console.log(A.join(verdicts, "\n"));
  const unclassified = A.filter(verdicts, Str.endsWith("UNCLASSIFIED")).length + missing.length;
  yield* Console.log(`cases: ${cases.length}; unclassified: ${unclassified}`);
  if (unclassified > 0) process.exitCode = 1;
});

NodeRuntime.runMain(program.pipe(Effect.scoped, Effect.provide(NodeServices.layer)));
