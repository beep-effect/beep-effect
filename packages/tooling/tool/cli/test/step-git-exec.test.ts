import { KnowledgeCloneAttributesError, KnowledgeOperationalError } from "@beep/repo-cli/commands/Knowledge";
import {
  BoundedOutput,
  boundedChunkReducer,
  collectBoundedText,
  emptyBoundedOutput,
  formatCommandLine,
  OutputBound,
  qualityStepOutputBound,
  repoRunOutputBound,
  runCapturedStreams,
} from "@beep/repo-cli/test/Process";
import {
  gitArchiveArgs,
  gitArchiveEnv,
  gitLinesFromOutput,
  gitPathListFromNulOutput,
  guardCloneLocalGitAttributes,
  isSafeOriginBranch,
  originBranchFromBase,
  safeOriginBranchFromBase,
  sortedUniquePaths,
  writeGitArchive,
} from "@beep/repo-cli/test/RepoRun";
import { provideScopedLayer } from "@beep/test-utils";
import { Str } from "@beep/utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it, layer } from "@effect/vitest";
import { assertExitFailure, assertInstanceOf, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import type { GitCommandErrorAdapter } from "@beep/repo-cli/test/RepoRun";

const encode = (value: string): Uint8Array => new TextEncoder().encode(value);

describe("StepExec bounded output fold", () => {
  const bound = OutputBound.make({ maxChars: 4, truncatedNotice: "!" });
  const reduce = boundedChunkReducer(bound);

  it("appends a chunk that fits within the bound", () => {
    expect(reduce(emptyBoundedOutput, "ab")).toEqual(BoundedOutput.make({ text: "ab", truncated: false }));
  });

  it("truncates a chunk that overflows the bound, slicing to the remaining budget", () => {
    expect(reduce(emptyBoundedOutput, "abcdef")).toEqual(BoundedOutput.make({ text: "abcd!", truncated: true }));
  });

  it("appends only the truncation notice when the text is already at the cap", () => {
    expect(reduce(BoundedOutput.make({ text: "abcd", truncated: false }), "e")).toEqual(
      BoundedOutput.make({ text: "abcd!", truncated: true })
    );
  });

  it("is idempotent once truncated", () => {
    const truncated = reduce(emptyBoundedOutput, "abcdef");
    expect(reduce(truncated, "ghi")).toBe(truncated);
  });

  it.effect(
    "folds a byte stream into bounded text with the truncation notice",
    Effect.fnUntraced(function* () {
      const result = yield* collectBoundedText(bound)(Stream.fromIterable([encode("ab"), encode("cdef")]));
      expect(result).toEqual(BoundedOutput.make({ text: "abcd!", truncated: true }));
    })
  );

  it.effect(
    "folds a short byte stream without truncating",
    Effect.fnUntraced(function* () {
      const result = yield* collectBoundedText(bound)(Stream.fromIterable([encode("hi")]));
      expect(result).toEqual(BoundedOutput.make({ text: "hi", truncated: false }));
    })
  );

  it("exposes the divergent repo-run and quality bounds", () => {
    expect(repoRunOutputBound.maxChars).toBe(512 * 1024);
    expect(qualityStepOutputBound.maxChars).toBe(8 * 1024 * 1024);
    expect(repoRunOutputBound.truncatedNotice).toContain("[repo-run]");
    expect(qualityStepOutputBound.truncatedNotice).toContain("[beep-cli]");
  });

  it("formats a command line", () => {
    expect(formatCommandLine("git", ["status", "--short"])).toBe("git status --short");
  });
});

layer(NodeServices.layer, { timeout: "5 seconds" })("StepExec process integration", (it) => {
  it.effect(
    "drains large stdout and stderr streams concurrently",
    Effect.fnUntraced(function* () {
      const charsPerStream = 1024 * 1024;
      const result = yield* runCapturedStreams({
        command: process.execPath,
        args: [
          "-e",
          `process.stdout.write("o".repeat(${charsPerStream}));process.stderr.write("e".repeat(${charsPerStream}));`,
        ],
      });

      expect(result.exitCode).toBe(0);
      expect(Str.length(result.stdout)).toBe(charsPerStream);
      expect(Str.length(result.stderr)).toBe(charsPerStream);
    })
  );
});

describe("GitExec path parsing", () => {
  it("parses NUL-delimited output into sorted unique paths", () => {
    expect(gitPathListFromNulOutput("src/z.ts\0src/a.ts\0src/a.ts\0")).toEqual(["src/a.ts", "src/z.ts"]);
  });

  it("sorts, dedupes, and drops empty path entries", () => {
    expect(sortedUniquePaths(["src/z.ts", "", "src/a.ts", "src/a.ts"])).toEqual(["src/a.ts", "src/z.ts"]);
  });

  it("splits captured output into trimmed non-empty lines", () => {
    expect(gitLinesFromOutput("a\n  b  \n\nc\n")).toEqual(["a", "b", "c"]);
  });
});

describe("GitExec origin-branch refname safety", () => {
  it("accepts safe plain branch names", () => {
    expect(isSafeOriginBranch("main")).toBe(true);
    expect(isSafeOriginBranch("feat/some-thing")).toBe(true);
  });

  it("rejects option-like, empty, and refname-metacharacter names", () => {
    expect(isSafeOriginBranch("")).toBe(false);
    expect(isSafeOriginBranch("--upload-pack=x")).toBe(false);
    expect(isSafeOriginBranch("a b")).toBe(false);
    expect(isSafeOriginBranch("a:b")).toBe(false);
    expect(isSafeOriginBranch("a~b")).toBe(false);
    expect(isSafeOriginBranch("a..b")).toBe(false);
    expect(isSafeOriginBranch("/leading")).toBe(false);
    expect(isSafeOriginBranch("trailing/")).toBe(false);
    expect(isSafeOriginBranch("locked.lock")).toBe(false);
  });

  it("extracts the branch from an origin base ref", () => {
    assertSome(originBranchFromBase("origin/main"), "main");
    assertNone(originBranchFromBase("HEAD"));
    assertNone(originBranchFromBase("origin/"));
  });

  it("extracts only safe branches from an origin base ref", () => {
    assertSome(safeOriginBranchFromBase("origin/main"), "main");
    assertNone(safeOriginBranchFromBase("origin/--upload-pack=x"));
  });
});

// `.gitattributes` declares `* text=auto`, so an archive written on a host carrying
// `core.autocrlf=true` differs byte-for-byte from the same commit archived on CI — and a global
// attributes file attaching `eol=crlf` overrides both `-c core.eol` and `-c core.autocrlf`, while
// ambient `tar.umask` rewrites tar header mode bits. Consumers that compare those bytes exactly
// (the knowledge semantic-delta index-drift finding) then report drift no source edit can clear,
// so the overrides are part of the archive's contract, not a preference.
describe("GitExec archive byte canonicality", () => {
  it("pins end-of-line, attribute-file, and umask handling ahead of the archive subcommand", () => {
    expect(gitArchiveArgs("/tmp/base.tar", "HEAD")).toEqual([
      "-c",
      "core.autocrlf=false",
      "-c",
      "core.eol=lf",
      "-c",
      "core.attributesFile=/dev/null",
      "-c",
      "tar.umask=0002",
      "archive",
      "--format=tar",
      "--output=/tmp/base.tar",
      "HEAD",
    ]);
  });

  it("pins the system-attribute escape hatch in the archive environment", () => {
    expect(gitArchiveEnv).toStrictEqual({ GIT_ATTR_NOSYSTEM: "1" });
  });

  it("passes a spaced and non-ASCII archive path through unquoted", () => {
    const archivePath = "/tmp/beep qa/ünicode/base.tar";
    expect(gitArchiveArgs(archivePath, "deadbeef")).toContain(`--output=${archivePath}`);
  });
});

describe("GitExec archive spawn wiring", () => {
  const emptyHandle = ChildProcessSpawner.makeHandle({
    all: Stream.empty,
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    stderr: Stream.empty,
    stdin: Sink.drain,
    stdout: Stream.empty,
    unref: Effect.succeed(Effect.void),
  });

  const adapter = {
    onSpawnFailure: (commandLine: string) => (cause: unknown) => new Error(`${commandLine}: ${String(cause)}`),
    onNonZeroExit: (failure: { readonly commandLine: string; readonly exitCode: number; readonly output: string }) =>
      new Error(`${failure.commandLine} exit ${failure.exitCode}`),
    onTruncated: O.none(),
  };

  it.effect(
    "sends the canonical vector, the attribute-isolation env, and extendEnv on the archive spawn",
    Effect.fnUntraced(function* () {
      type SpawnFacts = {
        readonly args: ReadonlyArray<string>;
        readonly env: Record<string, string | undefined> | undefined;
        readonly extendEnv: boolean | undefined;
      };
      const captured = yield* Ref.make<ReadonlyArray<SpawnFacts>>([]);
      const spawner = ChildProcessSpawner.make((command) => {
        if (!ChildProcess.isStandardCommand(command)) {
          return Effect.die("the archive writer never spawns a piped command");
        }
        return Ref.update(
          captured,
          A.append({ args: command.args, env: command.options.env, extendEnv: command.options.extendEnv })
        ).pipe(Effect.as(emptyHandle));
      });

      yield* writeGitArchive("/repo", "deadbeef", "/tmp/out.tar", adapter).pipe(
        provideScopedLayer(
          Layer.mergeAll(Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner), BunCrypto.layer)
        )
      );

      const calls = yield* Ref.get(captured);
      expect(calls).toHaveLength(1);
      expect(calls[0]?.args).toEqual(gitArchiveArgs("/tmp/out.tar", "deadbeef"));
      expect(calls[0]?.env).toStrictEqual(gitArchiveEnv);
      expect(calls[0]?.extendEnv).toBe(true);
    })
  );
});

// Each hostile profile is proven live by a negative-control witness: the unpinned vector must
// produce different bytes under the profile, or the profile has gone inert and the assertion on the
// pinned vector proves nothing. Verified empirically for PR #741: an attributes-file `eol=crlf`
// beats `-c core.eol`, and `tar.umask` rewrites header modes.
layer(NodeServices.layer, { timeout: "5 seconds" })("GitExec archive hostile-profile canonicality", (it) => {
  const runGit = (cwd: string, args: ReadonlyArray<string>, env: Record<string, string>): void => {
    const result = Bun.spawnSync(["git", ...args], { cwd, env, stderr: "pipe", stdout: "pipe" });
    if (result.exitCode !== 0) {
      throw new Error(`git ${A.join(args, " ")} failed: ${result.stderr.toString()}`);
    }
  };

  const archiveScenario = Effect.fnUntraced(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const tmpDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-git-archive-" });

    const body = Effect.gen(function* () {
      // The checkout deliberately sits under a deep, spaced, non-ASCII path so the differential
      // exercises location-depth behavior in the live spawn path (the retired ASLR control's real
      // half — research/p3-hermetic-lane-decisions.md H2/H3), and archives land in a spaced
      // output directory so `--output` quoting is exercised live rather than only as argv.
      const repoDir = path.join(tmpDir, "nested depth", "ünïcode", "level-3", "repo");
      const outDir = path.join(tmpDir, "out put ü");
      const hostileXdg = path.join(tmpDir, "xdg-hostile");
      const cleanXdg = path.join(tmpDir, "xdg-clean");
      const home = path.join(tmpDir, "home");
      const umaskConfig = path.join(tmpDir, "umask.gitconfig");
      yield* fs.makeDirectory(repoDir, { recursive: true });
      yield* fs.makeDirectory(outDir, { recursive: true });
      yield* fs.makeDirectory(path.join(hostileXdg, "git"), { recursive: true });
      yield* fs.makeDirectory(cleanXdg, { recursive: true });
      yield* fs.makeDirectory(home, { recursive: true });
      yield* fs.writeFileString(path.join(hostileXdg, "git", "attributes"), "*.md eol=crlf\n");
      yield* fs.writeFileString(umaskConfig, "[tar]\n\tumask = 077\n");

      const envWith = (overrides: Record<string, string>): Record<string, string> => ({
        // `Bun.env` is the same live object the default ConfigProvider reads; using it keeps the
        // spawn seed out of `process.env` (effect/processEnv) without changing behaviour.
        PATH: Bun.env.PATH ?? "",
        HOME: home,
        XDG_CONFIG_HOME: cleanXdg,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
        ...overrides,
      });

      const seedEnv = envWith({});
      yield* Effect.sync(() => {
        runGit(repoDir, ["init", "-b", "main"], seedEnv);
        runGit(repoDir, ["config", "user.email", "archive@example.test"], seedEnv);
        runGit(repoDir, ["config", "user.name", "Archive Test"], seedEnv);
      });
      yield* fs.writeFileString(path.join(repoDir, ".gitattributes"), "* text=auto\n");
      yield* fs.writeFileString(path.join(repoDir, "doc.md"), "one\ntwo\nthree\n");
      yield* Effect.sync(() => {
        runGit(repoDir, ["add", "."], seedEnv);
        runGit(repoDir, ["commit", "-m", "seed"], seedEnv);
      });

      const unpinnedArgs = (out: string): ReadonlyArray<string> => [
        "archive",
        "--format=tar",
        `--output=${out}`,
        "HEAD",
      ];
      const archiveBytes = Effect.fnUntraced(function* (
        name: string,
        argsFor: (out: string) => ReadonlyArray<string>,
        env: Record<string, string>
      ) {
        const out = path.join(outDir, name);
        yield* Effect.sync(() => runGit(repoDir, argsFor(out), env));
        return yield* fs.readFile(out);
      });
      const pinnedArgs = (out: string): ReadonlyArray<string> => gitArchiveArgs(out, "HEAD");

      const canonical = yield* archiveBytes("clean.tar", pinnedArgs, envWith({ ...gitArchiveEnv }));

      const attrEnv = { XDG_CONFIG_HOME: hostileXdg };
      const attrPinned = yield* archiveBytes("attr-pinned.tar", pinnedArgs, envWith({ ...attrEnv, ...gitArchiveEnv }));
      const attrWitness = yield* archiveBytes("attr-witness.tar", unpinnedArgs, envWith(attrEnv));
      expect(attrPinned).toStrictEqual(canonical);
      expect(attrWitness).not.toStrictEqual(canonical);

      const umaskEnv = { GIT_CONFIG_GLOBAL: umaskConfig };
      const umaskPinned = yield* archiveBytes(
        "umask-pinned.tar",
        pinnedArgs,
        envWith({ ...umaskEnv, ...gitArchiveEnv })
      );
      const umaskWitness = yield* archiveBytes("umask-witness.tar", unpinnedArgs, envWith(umaskEnv));
      expect(umaskPinned).toStrictEqual(canonical);
      expect(umaskWitness).not.toStrictEqual(canonical);
    });

    yield* body;
  });

  it.effect(
    "emits canonical bytes under hostile attribute and umask profiles, each proven live by a witness",
    archiveScenario
  );
  for (const mode of ["setup failure", "interruption", "cleanup failure"]) {
    it.effect(
      `archive fixture releases its native root after ${mode}`,
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* Ref.make("");
        const faulted = yield* Ref.make(false);
        const removalError = yield* Ref.make<O.Option<PlatformError.PlatformError>>(O.none());
        const failure = PlatformError.systemError({
          _tag: "PermissionDenied",
          module: "FileSystem",
          method: "makeDirectory",
          pathOrDescriptor: "resource-control",
          description: "injected fixture failure",
        });
        // Rescue is outside the observed scope: failed assertions cannot leave mode-000 residue.
        yield* Effect.addFinalizer(
          Effect.fnUntraced(function* () {
            const directory = yield* Ref.get(root);
            if (directory !== "" && (yield* fs.exists(directory).pipe(Effect.orDie))) {
              yield* fs.chmod(directory, 0o700).pipe(Effect.orDie);
              yield* fs.remove(directory, { recursive: true }).pipe(Effect.orDie);
            }
          })
        );
        const observedFs = FileSystem.FileSystem.of({
          ...fs,
          makeTempDirectoryScoped: Effect.fnUntraced(function* (
            options: Parameters<FileSystem.FileSystem["makeTempDirectoryScoped"]>[0]
          ) {
            const directory = yield* Effect.acquireRelease(fs.makeTempDirectory(options), (directory) =>
              fs.remove(directory, { recursive: true }).pipe(
                Effect.tapError((error) => Ref.set(removalError, O.some(error))),
                Effect.orDie
              )
            );
            yield* Ref.set(root, directory);
            return directory;
          }),
          makeDirectory: Effect.fnUntraced(function* (
            target: string,
            options: Parameters<FileSystem.FileSystem["makeDirectory"]>[1]
          ) {
            expect(target).toBe(path.join(yield* Ref.get(root), "nested depth", "ünïcode", "level-3", "repo"));
            expect(options).toEqual({ recursive: true });
            yield* Ref.set(faulted, true);
            if (mode === "cleanup failure") {
              const directory = yield* Ref.get(root);
              yield* fs.writeFileString(path.join(directory, "cleanup-witness"), "retained\n");
              yield* fs.chmod(directory, 0o000);
            }
            if (mode === "interruption") return yield* Effect.interrupt;
            return yield* failure;
          }),
        });
        const exit = yield* archiveScenario().pipe(
          Effect.provideService(FileSystem.FileSystem, observedFs),
          Effect.scoped,
          Effect.exit
        );
        assertTrue(exit._tag === "Failure");
        if (mode === "interruption") {
          exit.cause.pipe(Cause.hasInterruptsOnly, assertTrue);
        } else if (mode !== "cleanup failure") {
          const expected = Cause.annotate(Cause.fail(failure), Cause.annotations(exit.cause));
          assertExitFailure(exit, expected);
          expect(() =>
            assertExitFailure(Exit.failCause(Cause.combine(expected, Cause.die("extra defect"))), expected)
          ).toThrow();
          expect(() =>
            assertExitFailure(Exit.failCause(Cause.combine(expected, Cause.fail("extra failure"))), expected)
          ).toThrow();
        }
        const directory = yield* Ref.get(root);
        expect(directory).not.toBe("");
        expect(yield* Ref.get(faulted)).toBe(true);
        if (mode === "cleanup failure") {
          const error = O.getOrThrow(yield* Ref.get(removalError));
          assertInstanceOf(error.reason, PlatformError.SystemError);
          expect(error.reason._tag).toBe("PermissionDenied");
          expect(error.reason.method).toBe("remove");
          expect(error.reason.pathOrDescriptor).toBe(directory);
          const expected = Cause.annotate(
            Cause.combine(Cause.fail(failure), Cause.die(error)),
            Cause.annotations(exit.cause)
          );
          assertExitFailure(exit, expected);
          const wrongDie = Cause.annotate(
            Cause.combine(Cause.fail(failure), Cause.die(new Error("boom"))),
            Cause.annotations(exit.cause)
          );
          expect(() => assertExitFailure(Exit.failCause(wrongDie), expected)).toThrow();
          expect(() =>
            assertExitFailure(Exit.failCause(Cause.combine(expected, Cause.die("extra defect"))), expected)
          ).toThrow();
          expect(() =>
            assertExitFailure(Exit.failCause(Cause.combine(expected, Cause.fail("extra failure"))), expected)
          ).toThrow();
          expect(yield* fs.exists(directory)).toBe(true);
        } else {
          expect(yield* fs.exists(directory)).toBe(false);
        }
      })
    );
  }
});

// The clone-local info/attributes file is the one attribute layer no git invocation can disable
// (research/p3-hermetic-lane-decisions.md "Measured residual"): the guard must pass while the file
// is absent or empty, fail closed with the resolved path once it is non-empty, and resolve through
// `rev-parse --git-path` so a worktree reaches the shared common-dir file.
layer(NodeServices.layer, { timeout: "5 seconds" })("GitExec clone-local attributes guard", (it) => {
  const runGit = (cwd: string, args: ReadonlyArray<string>, env: Record<string, string>): void => {
    const result = Bun.spawnSync(["git", ...args], { cwd, env, stderr: "pipe", stdout: "pipe" });
    if (result.exitCode !== 0) {
      throw new Error(`git ${A.join(args, " ")} failed: ${result.stderr.toString()}`);
    }
  };

  const guardScenario = Effect.fnUntraced(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    // realPath keeps the joined expectation byte-identical to what git records for the common
    // dir even when the temp root contains symlinked segments.
    const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-git-guard-" });
    const tmpDir = yield* fs.realPath(root);

    const body = Effect.gen(function* () {
      const repoDir = path.join(tmpDir, "repo");
      const home = path.join(tmpDir, "home");
      yield* fs.makeDirectory(repoDir, { recursive: true });
      yield* fs.makeDirectory(home, { recursive: true });
      const env = {
        PATH: Bun.env.PATH ?? "",
        HOME: home,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
      };
      yield* Effect.sync(() => {
        runGit(repoDir, ["init", "-b", "main"], env);
        runGit(repoDir, ["config", "user.email", "guard@example.test"], env);
        runGit(repoDir, ["config", "user.name", "Guard Test"], env);
      });

      const adapter: GitCommandErrorAdapter<KnowledgeOperationalError> = {
        onSpawnFailure: (commandLine) => (cause) =>
          KnowledgeOperationalError.make({ message: `spawn ${commandLine}`, cause }),
        onNonZeroExit: ({ commandLine, exitCode }) =>
          KnowledgeOperationalError.make({ message: `${commandLine} exit ${exitCode}` }),
        onTruncated: O.none(),
      };
      const guardAt = (cwd: string) =>
        guardCloneLocalGitAttributes(cwd, adapter, KnowledgeCloneAttributesError.at, (attributesPath) =>
          KnowledgeOperationalError.new(`stat failed for "${attributesPath}".`)
        );
      const attributesPath = path.join(repoDir, ".git", "info", "attributes");

      yield* guardAt(repoDir);
      yield* fs.writeFileString(attributesPath, "");
      yield* guardAt(repoDir);

      yield* fs.writeFileString(attributesPath, "*.md eol=crlf\n");
      const failure = yield* Effect.flip(guardAt(repoDir));
      if (failure._tag !== "KnowledgeCloneAttributesError") {
        throw new Error(`expected KnowledgeCloneAttributesError, got ${failure._tag}`);
      }
      expect(failure.attributesPath).toBe(attributesPath);
      expect(failure.message).toContain(attributesPath);

      const worktreeDir = path.join(tmpDir, "wt");
      yield* fs.writeFileString(path.join(repoDir, "seed.txt"), "seed\n");
      yield* Effect.sync(() => {
        runGit(repoDir, ["add", "."], env);
        runGit(repoDir, ["commit", "-m", "seed"], env);
        runGit(repoDir, ["worktree", "add", worktreeDir], env);
      });
      const worktreeFailure = yield* Effect.flip(guardAt(worktreeDir));
      if (worktreeFailure._tag !== "KnowledgeCloneAttributesError") {
        throw new Error(`expected KnowledgeCloneAttributesError, got ${worktreeFailure._tag}`);
      }
      expect(worktreeFailure.attributesPath).toBe(attributesPath);

      yield* fs.remove(attributesPath);
      yield* guardAt(worktreeDir);
      yield* guardAt(repoDir);
    });

    yield* body;
  });

  it.effect(
    "passes on absent and empty info/attributes, fails closed on non-empty, and follows worktrees to the common dir",
    guardScenario
  );
  for (const mode of ["setup failure", "interruption", "cleanup failure"]) {
    it.effect(
      `attributes-guard fixture releases its native root after ${mode}`,
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* Ref.make("");
        const faulted = yield* Ref.make(false);
        const removalError = yield* Ref.make<O.Option<PlatformError.PlatformError>>(O.none());
        const failure = PlatformError.systemError({
          _tag: "PermissionDenied",
          module: "FileSystem",
          method: "realPath",
          pathOrDescriptor: "resource-control",
          description: "injected fixture failure",
        });
        // Rescue is outside the observed scope: failed assertions cannot leave mode-000 residue.
        yield* Effect.addFinalizer(
          Effect.fnUntraced(function* () {
            const directory = yield* Ref.get(root);
            if (directory !== "" && (yield* fs.exists(directory).pipe(Effect.orDie))) {
              yield* fs.chmod(directory, 0o700).pipe(Effect.orDie);
              yield* fs.remove(directory, { recursive: true }).pipe(Effect.orDie);
            }
          })
        );
        const observedFs = FileSystem.FileSystem.of({
          ...fs,
          makeTempDirectoryScoped: Effect.fnUntraced(function* (
            options: Parameters<FileSystem.FileSystem["makeTempDirectoryScoped"]>[0]
          ) {
            const directory = yield* Effect.acquireRelease(fs.makeTempDirectory(options), (directory) =>
              fs.remove(directory, { recursive: true }).pipe(
                Effect.tapError((error) => Ref.set(removalError, O.some(error))),
                Effect.orDie
              )
            );
            yield* Ref.set(root, directory);
            return directory;
          }),
          realPath: Effect.fnUntraced(function* (target: string) {
            expect(target).toBe(yield* Ref.get(root));
            yield* Ref.set(faulted, true);
            if (mode === "cleanup failure") {
              const directory = yield* Ref.get(root);
              yield* fs.writeFileString(path.join(directory, "cleanup-witness"), "retained\n");
              yield* fs.chmod(directory, 0o000);
            }
            if (mode === "interruption") return yield* Effect.interrupt;
            return yield* failure;
          }),
        });
        const exit = yield* guardScenario().pipe(
          Effect.provideService(FileSystem.FileSystem, observedFs),
          Effect.scoped,
          Effect.exit
        );
        assertTrue(exit._tag === "Failure");
        if (mode === "interruption") {
          exit.cause.pipe(Cause.hasInterruptsOnly, assertTrue);
        } else if (mode !== "cleanup failure") {
          const expected = Cause.annotate(Cause.fail(failure), Cause.annotations(exit.cause));
          assertExitFailure(exit, expected);
          expect(() =>
            assertExitFailure(Exit.failCause(Cause.combine(expected, Cause.die("extra defect"))), expected)
          ).toThrow();
          expect(() =>
            assertExitFailure(Exit.failCause(Cause.combine(expected, Cause.fail("extra failure"))), expected)
          ).toThrow();
        }
        const directory = yield* Ref.get(root);
        expect(directory).not.toBe("");
        expect(yield* Ref.get(faulted)).toBe(true);
        if (mode === "cleanup failure") {
          const error = O.getOrThrow(yield* Ref.get(removalError));
          assertInstanceOf(error.reason, PlatformError.SystemError);
          expect(error.reason._tag).toBe("PermissionDenied");
          expect(error.reason.method).toBe("remove");
          expect(error.reason.pathOrDescriptor).toBe(directory);
          const expected = Cause.annotate(
            Cause.combine(Cause.fail(failure), Cause.die(error)),
            Cause.annotations(exit.cause)
          );
          assertExitFailure(exit, expected);
          const wrongDie = Cause.annotate(
            Cause.combine(Cause.fail(failure), Cause.die(new Error("boom"))),
            Cause.annotations(exit.cause)
          );
          expect(() => assertExitFailure(Exit.failCause(wrongDie), expected)).toThrow();
          expect(() =>
            assertExitFailure(Exit.failCause(Cause.combine(expected, Cause.die("extra defect"))), expected)
          ).toThrow();
          expect(() =>
            assertExitFailure(Exit.failCause(Cause.combine(expected, Cause.fail("extra failure"))), expected)
          ).toThrow();
          expect(yield* fs.exists(directory)).toBe(true);
        } else {
          expect(yield* fs.exists(directory)).toBe(false);
        }
      })
    );
  }
});
