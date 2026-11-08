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

// Golden outputs for the pre-toolchain commands of the compiled CI binary.
// The expected strings were captured from the retired shell adapters
// (ci-change-profile.sh, ci-prune-apt-sources.sh) on 2026-11-07, before they
// were deleted, so the typed commands keep the bytes the workflows `eval`.
// The typed side runs the slim entry (src/bin-ci.ts) that
// `beep ci compile-binary` compiles.

const CLI_ENTRY = "packages/tooling/tool/cli/src/bin-ci.ts";

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

it.layer(NodeServices.layer, { timeout: "120 seconds" })("CI bootstrap command golden outputs", (it) => {
  it.effect(
    "emits the golden change profile for every diff shape",
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

      const profileLines = (goals: boolean, docs: boolean, desktop: boolean) =>
        `goals_only=${goals}\ndocs_only=${docs}\ndesktop_rust_relevant=${desktop}\n`;
      const full = profileLines(false, false, true);
      const none = profileLines(false, false, false);
      // [label, event, positional args, pinned base, pinned head, golden stdout, warns unavailable]
      const cases: ReadonlyArray<readonly [string, string, ReadonlyArray<string>, string, string, string, boolean]> = [
        ["goals-only", "pull_request", [base, heads.goals], "", "", profileLines(true, true, false), false],
        ["docs-only", "pull_request", [base, heads.docs], "", "", profileLines(false, true, false), false],
        ["desktop", "pull_request", [base, heads.desktop], "", "", profileLines(false, false, true), false],
        ["mixed", "pull_request", [base, heads.mixed], "", "", none, false],
        ["package docs", "pull_request", [base, heads.packageDocs], "", "", none, false],
        ["quoted path", "pull_request", [base, heads.quoted], "", "", none, false],
        ["empty diff", "pull_request", [base, base], "", "", none, false],
        [
          "pins win over arguments",
          "pull_request",
          [base, heads.mixed],
          base,
          heads.goals,
          profileLines(true, true, false),
          false,
        ],
        ["pinned only", "pull_request", [], base, heads.docs, profileLines(false, true, false), false],
        ["missing head", "pull_request", [base], "", "", full, true],
        ["missing pins", "pull_request", [], "", "", full, true],
        ["failed diff", "pull_request", ["missing-base", heads.docs], "", "", full, true],
        ["push", "push", [base, heads.docs], "", "", full, false],
        ["local", "", [base, heads.docs], "", "", full, false],
      ];
      for (const [label, event, positional, pinnedBase, pinnedHead, golden, warns] of cases) {
        const typedOutput = path.join(tempRoot, ".git", "typed-output");
        yield* fs.writeFileString(typedOutput, "prior=1\n");
        const typed = run(["bun", path.join(repoRoot, CLI_ENTRY), "ci", "change-profile", ...positional], tempRoot, {
          GITHUB_EVENT_NAME: event,
          GITHUB_OUTPUT: typedOutput,
          BEEP_CI_PR_BASE_SHA: pinnedBase,
          BEEP_CI_PR_HEAD_SHA: pinnedHead,
        });
        assert.strictEqual(typed.exitCode, 0, `${label}: ${typed.stderr}`);
        assert.strictEqual(typed.stdout, golden, label);
        assert.strictEqual(Str.includes(UNAVAILABLE)(typed.stderr), warns, label);
        const typedFile = yield* fs.readFileString(typedOutput);
        assert.strictEqual(typedFile, `prior=1\n${golden}`, label);
      }
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
    "prunes the golden apt sources without privilege",
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
      const typedDir = yield* fixture("typed");
      const typed = run(["bun", path.join(repoRoot, CLI_ENTRY), "ci", "prune-apt", typedDir], tempRoot, {});
      assert.strictEqual(typed.exitCode, 0, typed.stderr);
      // `ls -l` owner, mode and size columns vary by host; keep each entry's
      // name (with its link target), the `total` line and the headings.
      const entryName = /^[-dlbcps][-rwxsStT.+@]{9,}\s+\d+\s+\S+\s+\S+\s+\d+\s+\S+\s+\S+\s+\S+\s(.+)$/u;
      const normalized = (stdout: string) => {
        const lines = A.filter(Str.split(Str.replaceAll(typedDir, "<dir>")(stdout), "\n"), Str.isNonEmpty);
        const after = O.getOrThrow(A.findFirstIndex(lines, (line) => line === "apt sources after pruning:"));
        const shape = (line: string) =>
          Str.startsWith("total ")(line)
            ? "total"
            : O.getOrElse(
                O.flatMap(Str.match(entryName)(line), (match) => O.fromUndefinedOr(match[1])),
                () => line
              );
        const before = A.map(A.take(lines, after), shape);
        return {
          before: A.filter(before, (line) => !Str.startsWith("<dir>/")(line)),
          pruned: A.sort(A.filter(before, Str.startsWith("<dir>/")), Str.Order),
          after: A.map(A.drop(lines, after), shape),
        };
      };
      assert.deepStrictEqual(normalized(typed.stdout), {
        before: [
          "apt sources before pruning:",
          "total",
          "google-chrome.sources",
          "link.list -> ../outside.list",
          "microsoft-prod.list",
          "nested.list",
          "notes.txt",
          "ubuntu.sources",
        ],
        pruned: ["<dir>/google-chrome.sources", "<dir>/microsoft-prod.list"],
        after: [
          "apt sources after pruning:",
          "total",
          "link.list -> ../outside.list",
          "nested.list",
          "notes.txt",
          "ubuntu.sources",
        ],
      });
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
