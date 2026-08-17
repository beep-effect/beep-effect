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
  isSafeOriginBranch,
  originBranchFromBase,
  safeOriginBranchFromBase,
  sortedUniquePaths,
  writeGitArchive,
} from "@beep/repo-cli/test/RepoRun";
import { provideScopedLayer } from "@beep/test-utils";
import { Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Ref, Sink, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

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
    expect(qualityStepOutputBound.maxChars).toBe(256 * 1024);
    expect(repoRunOutputBound.truncatedNotice).toContain("[repo-run]");
    expect(qualityStepOutputBound.truncatedNotice).toContain("[beep-cli]");
  });

  it("formats a command line", () => {
    expect(formatCommandLine("git", ["status", "--short"])).toBe("git status --short");
  });
});

layer(NodeServices.layer)("StepExec process integration", (it) => {
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
    expect(originBranchFromBase("origin/main")).toEqual(O.some("main"));
    expect(originBranchFromBase("HEAD")).toEqual(O.none());
    expect(originBranchFromBase("origin/")).toEqual(O.none());
  });

  it("extracts only safe branches from an origin base ref", () => {
    expect(safeOriginBranchFromBase("origin/main")).toEqual(O.some("main"));
    expect(safeOriginBranchFromBase("origin/--upload-pack=x")).toEqual(O.none());
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
        provideScopedLayer(Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, spawner))
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
layer(NodeServices.layer)("GitExec archive hostile-profile canonicality", (it) => {
  const runGit = (cwd: string, args: ReadonlyArray<string>, env: Record<string, string>): void => {
    const result = Bun.spawnSync(["git", ...args], { cwd, env, stderr: "pipe", stdout: "pipe" });
    if (result.exitCode !== 0) {
      throw new Error(`git ${A.join(args, " ")} failed: ${result.stderr.toString()}`);
    }
  };

  it.effect(
    "emits canonical bytes under hostile attribute and umask profiles, each proven live by a witness",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tmpDir = yield* fs.makeTempDirectory();

      const body = Effect.gen(function* () {
        const repoDir = path.join(tmpDir, "repo");
        const hostileXdg = path.join(tmpDir, "xdg-hostile");
        const cleanXdg = path.join(tmpDir, "xdg-clean");
        const home = path.join(tmpDir, "home");
        const umaskConfig = path.join(tmpDir, "umask.gitconfig");
        yield* fs.makeDirectory(repoDir, { recursive: true });
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
          const out = path.join(tmpDir, name);
          yield* Effect.sync(() => runGit(repoDir, argsFor(out), env));
          return yield* fs.readFile(out);
        });
        const pinnedArgs = (out: string): ReadonlyArray<string> => gitArchiveArgs(out, "HEAD");

        const canonical = yield* archiveBytes("clean.tar", pinnedArgs, envWith({ ...gitArchiveEnv }));

        const attrEnv = { XDG_CONFIG_HOME: hostileXdg };
        const attrPinned = yield* archiveBytes(
          "attr-pinned.tar",
          pinnedArgs,
          envWith({ ...attrEnv, ...gitArchiveEnv })
        );
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

      yield* body.pipe(Effect.ensuring(fs.remove(tmpDir, { recursive: true }).pipe(Effect.ignore)));
    })
  );
});
