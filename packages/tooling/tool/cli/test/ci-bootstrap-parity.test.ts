import { CiOperationalPatterns, ciOperationalPatterns } from "@beep/repo-cli/commands/Ci";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { assert } from "@effect/vitest";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// The pre-toolchain commands of the compiled CI binary against the shell
// adapters they replace: `ci change-profile` vs scripts/ci-change-profile.sh,
// `ci prune-apt` vs scripts/ci-prune-apt-sources.sh, and the runner-resources
// fallback of scripts/ci-runner-resources.sh. The typed side runs the slim
// entry (src/bin-ci.ts) that `beep ci compile-binary` compiles.

const CLI_ENTRY = "packages/tooling/tool/cli/src/bin-ci.ts";
const PROFILE_SCRIPT = "scripts/ci-change-profile.sh";
const PRUNE_SCRIPT = "scripts/ci-prune-apt-sources.sh";

const gitIn =
  (cwd: string) =>
  (args: ReadonlyArray<string>): string => {
    const result = Bun.spawnSync(["git", ...args], { cwd, stderr: "pipe", stdout: "pipe" });
    assert.strictEqual(result.exitCode, 0, result.stderr.toString());
    return Str.trim(result.stdout.toString());
  };

interface Run {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

const run = (argv: ReadonlyArray<string>, cwd: string, env: Readonly<Record<string, string>>): Run => {
  const result = Bun.spawnSync([...argv], { cwd, env: { ...process.env, ...env }, stdout: "pipe", stderr: "pipe" });
  return { exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() };
};

const encodePatterns = S.encodeEffect(S.fromJsonString(CiOperationalPatterns));
const UNAVAILABLE = "ci-change-profile: pinned PR diff unavailable; keeping every verification profile active";

it.layer(NodeServices.layer, { timeout: "120 seconds" })("CI bootstrap command parity", (it) => {
  it.effect(
    "emits the shell adapter's change profile for every diff shape",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      const git = gitIn(tempRoot);
      const write = Effect.fnUntraced(function* (relative: string) {
        yield* fs.makeDirectory(path.dirname(path.join(tempRoot, relative)), { recursive: true });
        yield* fs.writeFileString(path.join(tempRoot, relative), `${relative}\n`);
      });
      const branch = Effect.fnUntraced(function* (name: string, files: ReadonlyArray<string>) {
        git(["checkout", "-q", "-b", name, base]);
        yield* Effect.forEach(files, write, { discard: true });
        git(["add", "."]);
        git(["commit", "-q", "--allow-empty", "-m", name]);
        return git(["rev-parse", "HEAD"]);
      });
      git(["init", "-q"]);
      git(["config", "user.email", "ci-profile@example.test"]);
      git(["config", "user.name", "CI Profile Test"]);
      git(["config", "commit.gpgsign", "false"]);
      yield* write("packages/example/index.ts");
      git(["add", "."]);
      git(["commit", "-q", "-m", "baseline"]);
      const base = git(["rev-parse", "HEAD"]);

      const heads = {
        goals: yield* branch("goals-only", ["goals/demo/PLAN.md", "goals/demo/ops/manifest.json"]),
        docs: yield* branch("docs-only", ["docs/runbooks/ci.md", "README.md", ".changeset/quiet.md"]),
        desktop: yield* branch("desktop", ["apps/professional-desktop/src-tauri/src/lib.rs"]),
        mixed: yield* branch("mixed", ["docs/notes.md", "packages/example/next.ts"]),
        packageDocs: yield* branch("package-docs", ["packages/example/README.md"]),
        quoted: yield* branch("quoted", ["docs/café.md"]),
      };

      // [label, event, positional args, pinned base, pinned head]
      const cases: ReadonlyArray<readonly [string, string, ReadonlyArray<string>, string, string]> = [
        ["goals-only", "pull_request", [base, heads.goals], "", ""],
        ["docs-only", "pull_request", [base, heads.docs], "", ""],
        ["desktop", "pull_request", [base, heads.desktop], "", ""],
        ["mixed", "pull_request", [base, heads.mixed], "", ""],
        ["package docs", "pull_request", [base, heads.packageDocs], "", ""],
        ["quoted path", "pull_request", [base, heads.quoted], "", ""],
        ["empty diff", "pull_request", [base, base], "", ""],
        ["pins win over arguments", "pull_request", [base, heads.mixed], base, heads.goals],
        ["pinned only", "pull_request", [], base, heads.docs],
        ["missing head", "pull_request", [base], "", ""],
        ["missing pins", "pull_request", [], "", ""],
        ["failed diff", "pull_request", ["missing-base", heads.docs], "", ""],
        ["push", "push", [base, heads.docs], "", ""],
        ["local", "", [base, heads.docs], "", ""],
      ];
      for (const [label, event, positional, pinnedBase, pinnedHead] of cases) {
        const shellOutput = path.join(tempRoot, ".git", "shell-output");
        const typedOutput = path.join(tempRoot, ".git", "typed-output");
        yield* fs.writeFileString(shellOutput, "prior=1\n");
        yield* fs.writeFileString(typedOutput, "prior=1\n");
        const env = (output: string) => ({
          GITHUB_EVENT_NAME: event,
          GITHUB_OUTPUT: output,
          BEEP_CI_PR_BASE_SHA: pinnedBase,
          BEEP_CI_PR_HEAD_SHA: pinnedHead,
        });
        const shell = run(["bash", path.join(repoRoot, PROFILE_SCRIPT), ...positional], tempRoot, env(shellOutput));
        const typed = run(
          ["bun", path.join(repoRoot, CLI_ENTRY), "ci", "change-profile", ...positional],
          tempRoot,
          env(typedOutput)
        );
        assert.strictEqual(shell.exitCode, 0, `${label}: ${shell.stderr}`);
        assert.strictEqual(typed.exitCode, 0, `${label}: ${typed.stderr}`);
        assert.strictEqual(typed.stdout, shell.stdout, label);
        assert.strictEqual(Str.includes(UNAVAILABLE)(typed.stderr), Str.includes(UNAVAILABLE)(shell.stderr), label);
        const shellFile = yield* fs.readFileString(shellOutput);
        const typedFile = yield* fs.readFileString(typedOutput);
        assert.strictEqual(typedFile, shellFile, label);
      }

      // Spot-check the shapes themselves, so a shared regression cannot pass as parity.
      const profile = (positional: ReadonlyArray<string>) =>
        run(["bun", path.join(repoRoot, CLI_ENTRY), "ci", "change-profile", ...positional], tempRoot, {
          GITHUB_EVENT_NAME: "pull_request",
          GITHUB_OUTPUT: "",
          BEEP_CI_PR_BASE_SHA: "",
          BEEP_CI_PR_HEAD_SHA: "",
        }).stdout;
      assert.strictEqual(
        profile([base, heads.goals]),
        "goals_only=true\ndocs_only=true\ndesktop_rust_relevant=false\n"
      );
      assert.strictEqual(
        profile([base, heads.docs]),
        "goals_only=false\ndocs_only=true\ndesktop_rust_relevant=false\n"
      );
      assert.strictEqual(
        profile([base, heads.desktop]),
        "goals_only=false\ndocs_only=false\ndesktop_rust_relevant=true\n"
      );
      assert.strictEqual(profile([base, base]), "goals_only=false\ndocs_only=false\ndesktop_rust_relevant=false\n");
      assert.strictEqual(profile([base]), "goals_only=false\ndocs_only=false\ndesktop_rust_relevant=true\n");
    })
  );

  it.effect(
    "classifies with the checkout's pattern file and fails closed on an invalid one",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      const git = gitIn(tempRoot);
      const patternFile = path.join(tempRoot, "packages/tooling/tool/cli/src/commands/Ci/CiOperational.patterns.json");
      git(["init", "-q"]);
      git(["config", "user.email", "ci-profile@example.test"]);
      git(["config", "user.name", "CI Profile Test"]);
      git(["config", "commit.gpgsign", "false"]);
      git(["commit", "-q", "--allow-empty", "-m", "baseline"]);
      const base = git(["rev-parse", "HEAD"]);
      yield* fs.makeDirectory(path.join(tempRoot, "docs"));
      yield* fs.writeFileString(path.join(tempRoot, "docs/notes.md"), "# notes\n");
      git(["add", "docs"]);
      git(["commit", "-q", "-m", "docs"]);
      const head = git(["rev-parse", "HEAD"]);
      const profile = () =>
        run(["bun", path.join(repoRoot, CLI_ENTRY), "ci", "change-profile", base, head], tempRoot, {
          GITHUB_EVENT_NAME: "pull_request",
          GITHUB_OUTPUT: "",
          BEEP_CI_PR_BASE_SHA: "",
          BEEP_CI_PR_HEAD_SHA: "",
        });
      // Absent: the compiled-in patterns, docs-only.
      assert.include(profile().stdout, "docs_only=true");
      // Present: the checkout's own patterns classify its tree.
      yield* fs.makeDirectory(path.dirname(patternFile), { recursive: true });
      const narrowedPatterns = yield* encodePatterns(
        CiOperationalPatterns.make({ ...ciOperationalPatterns, docs: "^nothing/" })
      );
      yield* fs.writeFileString(patternFile, narrowedPatterns);
      const narrowed = profile();
      assert.strictEqual(narrowed.exitCode, 0, narrowed.stderr);
      assert.include(narrowed.stdout, "docs_only=false");
      // Present but missing a key: fail closed.
      yield* fs.writeFileString(patternFile, '{ "goals": "^goals/" }\n');
      const invalid = profile();
      assert.notStrictEqual(invalid.exitCode, 0);
      assert.include(invalid.stderr, "could not read the CI patterns");
      assert.strictEqual(invalid.stdout, "");
    })
  );

  it.effect(
    "prunes the same apt sources as the shell adapter without privilege",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      // 2026-01-02T03:04:05Z in epoch seconds, the unit `utimes` takes for a number.
      const stamp = 1767323045;
      const fixture = Effect.fnUntraced(function* (name: string) {
        const directory = path.join(tempRoot, name, "sources.list.d");
        yield* fs.makeDirectory(path.join(directory, "nested.list"), { recursive: true });
        yield* fs.writeFileString(path.join(tempRoot, name, "outside.list"), "deb outside\n");
        for (const file of ["google-chrome.sources", "microsoft-prod.list", "ubuntu.sources", "notes.txt"]) {
          yield* fs.writeFileString(path.join(directory, file), `${file}\n`);
        }
        yield* fs.symlink("../outside.list", path.join(directory, "link.list"));
        for (const entry of [
          "google-chrome.sources",
          "microsoft-prod.list",
          "ubuntu.sources",
          "notes.txt",
          "nested.list",
        ]) {
          yield* fs.utimes(path.join(directory, entry), stamp, stamp);
        }
        return directory;
      });
      const shellDir = yield* fixture("shell");
      const typedDir = yield* fixture("typed");
      const shell = run(["bash", path.join(repoRoot, PRUNE_SCRIPT), shellDir], tempRoot, {});
      const typed = run(["bun", path.join(repoRoot, CLI_ENTRY), "ci", "prune-apt", typedDir], tempRoot, {});
      assert.strictEqual(shell.exitCode, 0, shell.stderr);
      assert.strictEqual(typed.exitCode, 0, typed.stderr);
      const sections = (stdout: string, directory: string) => {
        const lines = Str.split(Str.replaceAll(directory, "<dir>")(stdout), "\n");
        const after = O.getOrThrow(A.findFirstIndex(lines, (line) => line === "apt sources after pruning:"));
        const pruned = A.filter(A.take(lines, after), Str.startsWith("<dir>/"));
        return {
          listings: A.filter(lines, (line) => !Str.startsWith("<dir>/")(line)),
          pruned: A.sort(pruned, Str.Order),
        };
      };
      assert.deepStrictEqual(sections(typed.stdout, typedDir), sections(shell.stdout, shellDir));
      assert.deepStrictEqual(sections(typed.stdout, typedDir).pruned, [
        "<dir>/google-chrome.sources",
        "<dir>/microsoft-prod.list",
      ]);
      const remaining = yield* fs.readDirectory(typedDir);
      assert.deepStrictEqual(A.sort(remaining, Str.Order), ["link.list", "nested.list", "notes.txt", "ubuntu.sources"]);
    })
  );

  it.effect(
    "runs the lane directly, once, when the measurement cannot start it",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      const ambientPath = yield* Config.String("PATH");
      // The real executable: PATH's `bun` may be a wrapper script needing other tools.
      const bun = Str.trim(run(["bun", "-e", "console.log(process.execPath)"], tempRoot, { PATH: ambientPath }).stdout);
      const emptyPath = path.join(tempRoot, "empty-path");
      const receipt = path.join(tempRoot, "lane-runs");
      yield* fs.makeDirectory(emptyPath);
      // No `bash` on PATH: the measured spawn fails before the lane starts.
      const result = Bun.spawnSync(
        [
          bun,
          path.join(repoRoot, CLI_ENTRY),
          "ci",
          "runner-resources",
          "check",
          "--",
          "/bin/sh",
          "-c",
          'printf run >> "$1"; exit 7',
          "fixture",
          receipt,
        ],
        {
          cwd: tempRoot,
          env: { HOME: tempRoot, PATH: emptyPath, RUNNER_TEMP: tempRoot },
          stdout: "pipe",
          stderr: "pipe",
        }
      );
      assert.strictEqual(result.exitCode, 7, result.stderr.toString());
      assert.include(
        result.stderr.toString(),
        "::warning::Runner resource measurement unavailable; running lane directly."
      );
      const runs = yield* fs.readFileString(receipt);
      assert.strictEqual(runs, "run");
    })
  );

  it.effect(
    "forwards termination to the measured lane",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const tempRoot = yield* fs.makeTempDirectoryScoped();
      const started = path.join(tempRoot, "started");
      const terminated = path.join(tempRoot, "terminated");
      // bash owns the background process: start the measured lane, wait for it,
      // signal the CLI, and report the CLI's exit status.
      const driver = A.join(
        [
          'bun "$1" ci runner-resources check -- bash -c \'trap "printf term > \\"$1\\"; exit 143" TERM; printf up > "$2"; sleep 30 & wait\' fixture "$2" "$3" &',
          "cli=$!",
          'for _ in $(seq 100); do [ -s "$3" ] && break; sleep 0.1; done',
          'kill -TERM "$cli"',
          'wait "$cli"',
          'printf "%s" "$?"',
        ],
        "\n"
      );
      const result = Bun.spawnSync(
        ["bash", "-c", driver, "driver", path.join(repoRoot, CLI_ENTRY), terminated, started],
        { cwd: tempRoot, env: { ...process.env, RUNNER_TEMP: tempRoot }, stdout: "pipe", stderr: "pipe" }
      );
      const status = Str.trim(result.stdout.toString());
      assert.notStrictEqual(status, "0", result.stderr.toString());
      const up = yield* fs.readFileString(started);
      assert.strictEqual(up, "up");
      const marker = yield* fs.readFileString(terminated);
      assert.strictEqual(marker, "term");
    })
  );
});
