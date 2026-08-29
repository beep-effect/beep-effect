import { buildPortfolioIndexContent, PORTFOLIO_INDEX_PATH } from "@beep/repo-cli/commands/Goals";
import {
  enforcePortfolioIndexPublishIntent,
  PORTFOLIO_INDEX_WRITE_COMMAND,
  portfolioIndexPublishDisposition,
  RepoRunContext,
  YeetStagedPublishIntent,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";

const PlatformLayer = NodeChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer))
);

const spawnGit = (cwd: string, args: ReadonlyArray<string>) =>
  Effect.sync(() => {
    const command: Array<string> = ["git", ...args];
    const result = Bun.spawnSync(command, { cwd, stderr: "pipe", stdout: "pipe" });
    if (result.exitCode !== 0) {
      throw new Error(`${A.join(command, " ")} failed: ${result.stderr.toString()}`);
    }
    return result.stdout.toString();
  });

const runGit = (cwd: string, args: ReadonlyArray<string>) => spawnGit(cwd, args).pipe(Effect.asVoid);

const runGitStatus = (cwd: string) => spawnGit(cwd, ["status", "--porcelain"]).pipe(Effect.map(Str.trim));

const goalManifest = (slug: string): string =>
  JSON.stringify(
    {
      schemaVersion: "initiative-manifest/v2",
      initiative: { id: slug, title: `Packet ${slug}`, status: "active", updated: "2026-08-16" },
      mission: `Mission for ${slug}.`,
      completionGate: {
        operator: "yeet",
        requiresPullRequest: true,
        requiresMergeable: true,
        statement: "Merged through yeet.",
        grandfathered: false,
      },
    },
    undefined,
    2
  );

const withTempDirectory = <Result, Error, Requirements>(
  use: (tmpDir: string) => Effect.Effect<Result, Error, Requirements>
) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory();
    }),
    use,
    (tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(tmpDir, { recursive: true });
      })
  ).pipe(provideScopedLayer(PlatformLayer));

type TempPortfolioRepo = {
  readonly indexPath: string;
  readonly tempContext: RepoRunContext;
  readonly tmpDir: string;
};

// Seeds a git repo carrying two goal packets and no committed index, so each
// case can decide independently what `goals/INDEX.md` looks like.
const initPortfolioRepo = Effect.fn("initPortfolioRepo")(function* (tmpDir: string, slugs: ReadonlyArray<string>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* runGit(tmpDir, ["init"]);
  yield* runGit(tmpDir, ["config", "user.email", "yeet@example.test"]);
  yield* runGit(tmpDir, ["config", "user.name", "Yeet Test"]);

  for (const slug of slugs) {
    const opsDir = path.join(tmpDir, "goals", slug, "ops");
    yield* fs.makeDirectory(opsDir, { recursive: true });
    yield* fs.writeFileString(path.join(opsDir, "manifest.json"), goalManifest(slug));
  }
  yield* fs.writeFileString(path.join(tmpDir, "README.md"), "# temp\n");
  yield* runGit(tmpDir, ["add", "."]);
  yield* runGit(tmpDir, ["commit", "-m", "init"]);

  return {
    indexPath: path.join(tmpDir, PORTFOLIO_INDEX_PATH),
    tempContext: RepoRunContext.make({
      base: "origin/main",
      branch: "feature/e1",
      cwd: tmpDir,
      head: "HEAD",
      originalArgv: [],
      packetDir: ".beep/yeet",
      repoRoot: tmpDir,
      turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
    }),
    tmpDir,
  } satisfies TempPortfolioRepo;
});

const withPortfolioRepo = <Result, Error, Requirements>(
  use: (repo: TempPortfolioRepo) => Effect.Effect<Result, Error, Requirements>,
  slugs: ReadonlyArray<string> = ["alpha-packet", "beta-packet"]
) =>
  withTempDirectory((tmpDir) =>
    Effect.gen(function* () {
      return yield* use(yield* initPortfolioRepo(tmpDir, slugs));
    })
  );

const withPortfolioRepoAndOutside = <Result, Error, Requirements>(
  use: (repo: TempPortfolioRepo, outsideRoot: string) => Effect.Effect<Result, Error, Requirements>
) =>
  withTempDirectory((tempRoot) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = path.join(tempRoot, "repo");
      const outsideRoot = path.join(tempRoot, "outside");
      yield* fs.makeDirectory(repoRoot);
      yield* fs.makeDirectory(outsideRoot);
      return yield* use(yield* initPortfolioRepo(repoRoot, ["alpha-packet", "beta-packet"]), outsideRoot);
    })
  );

describe("yeet publish derived goals index", () => {
  it("treats a checkout without a goals portfolio as out of scope", () => {
    expect(
      portfolioIndexPublishDisposition({
        committed: O.none(),
        present: false,
        regenerated: "# Goals Index\n",
        staged: true,
      })
    ).toBe("absent");
  });

  it("accepts a committed index that already equals the projection", () => {
    const regenerated = "# Goals Index\n\n1 packets\n";
    expect(
      portfolioIndexPublishDisposition({ committed: O.some(regenerated), present: true, regenerated, staged: false })
    ).toBe("current");
    expect(
      portfolioIndexPublishDisposition({ committed: O.some(regenerated), present: true, regenerated, staged: true })
    ).toBe("current");
  });

  it("regenerates an unstaged stale index and refuses a hand-staged one", () => {
    const regenerated = "# Goals Index\n\n2 packets\n";
    const committed = O.some("# Goals Index\n\nhand written\n");
    expect(portfolioIndexPublishDisposition({ committed, present: true, regenerated, staged: false })).toBe(
      "regenerated"
    );
    expect(portfolioIndexPublishDisposition({ committed, present: true, regenerated, staged: true })).toBe("drifted");
    expect(portfolioIndexPublishDisposition({ committed: O.none(), present: true, regenerated, staged: false })).toBe(
      "regenerated"
    );
  });

  it("leaves a repo without goals/ untouched", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* runGit(tmpDir, ["init"]);
          const tempContext = RepoRunContext.make({
            base: "origin/main",
            branch: "feature/e1",
            cwd: tmpDir,
            head: "HEAD",
            originalArgv: [],
            packetDir: ".beep/yeet",
            repoRoot: tmpDir,
            turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
          });

          const disposition = yield* enforcePortfolioIndexPublishIntent(
            tempContext,
            YeetStagedPublishIntent.make({ paths: ["src/index.ts"] })
          );

          expect(disposition).toBe("absent");
          expect(yield* fs.exists(path.join(tmpDir, PORTFOLIO_INDEX_PATH))).toBe(false);
        })
      )
    ));

  it("regenerates a missing index and stages it into the commit", () =>
    Effect.runPromise(
      withPortfolioRepo(({ indexPath, tempContext, tmpDir }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;

          const disposition = yield* enforcePortfolioIndexPublishIntent(
            tempContext,
            YeetStagedPublishIntent.make({ paths: ["goals/alpha-packet/ops/manifest.json"] })
          );

          expect(disposition).toBe("regenerated");
          expect(yield* fs.readFileString(indexPath)).toBe(yield* buildPortfolioIndexContent(tmpDir));
          expect(yield* runGitStatus(tmpDir)).toBe(`A  ${PORTFOLIO_INDEX_PATH}`);
        })
      )
    ));

  it("overwrites a stale unstaged index instead of committing the drift", () =>
    Effect.runPromise(
      withPortfolioRepo(({ indexPath, tempContext, tmpDir }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.writeFileString(indexPath, "# Goals Index\n\nstale copy from a merge\n");
          yield* runGit(tmpDir, ["add", PORTFOLIO_INDEX_PATH]);
          yield* runGit(tmpDir, ["commit", "-m", "stale index"]);

          const disposition = yield* enforcePortfolioIndexPublishIntent(
            tempContext,
            YeetStagedPublishIntent.make({ paths: ["goals/alpha-packet/ops/manifest.json"] })
          );

          expect(disposition).toBe("regenerated");
          expect(yield* fs.readFileString(indexPath)).toBe(yield* buildPortfolioIndexContent(tmpDir));
          expect(yield* runGitStatus(tmpDir)).toBe(`M  ${PORTFOLIO_INDEX_PATH}`);
        })
      )
    ));

  it("rejects a symlinked index file without writing or staging its destination", () =>
    Effect.runPromise(
      withPortfolioRepoAndOutside(({ indexPath, tempContext, tmpDir }, outsideRoot) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const outsideIndex = path.join(outsideRoot, "INDEX.md");
          const sentinel = "outside target must stay unchanged\n";
          yield* fs.writeFileString(outsideIndex, sentinel);
          yield* fs.symlink(outsideIndex, indexPath);

          const failure = yield* enforcePortfolioIndexPublishIntent(
            tempContext,
            YeetStagedPublishIntent.make({ paths: ["goals/alpha-packet/ops/manifest.json"] })
          ).pipe(Effect.flip);

          expect(failure._tag).toBe("YeetCommandError");
          expect(yield* fs.readFileString(outsideIndex)).toBe(sentinel);
          expect(Str.trim(yield* spawnGit(tmpDir, ["diff", "--cached", "--name-only"]))).toBe("");
        })
      )
    ));

  it("rejects a symlinked index parent without writing or staging through it", () =>
    Effect.runPromise(
      withPortfolioRepoAndOutside(({ tempContext, tmpDir }, outsideRoot) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const goalsPath = path.join(tmpDir, "goals");
          const outsideGoals = path.join(outsideRoot, "goals");
          yield* fs.rename(goalsPath, outsideGoals);
          yield* fs.symlink(outsideGoals, goalsPath);
          const outsideIndex = path.join(outsideGoals, "INDEX.md");
          const sentinel = "outside parent must stay unchanged\n";
          yield* fs.writeFileString(outsideIndex, sentinel);

          const failure = yield* enforcePortfolioIndexPublishIntent(
            tempContext,
            YeetStagedPublishIntent.make({ paths: ["goals/alpha-packet/ops/manifest.json"] })
          ).pipe(Effect.flip);

          expect(failure._tag).toBe("YeetCommandError");
          expect(yield* fs.readFileString(outsideIndex)).toBe(sentinel);
          expect(Str.trim(yield* spawnGit(tmpDir, ["diff", "--cached", "--name-only"]))).toBe("");
        })
      )
    ));

  it("proceeds when the staged index already equals the regenerated projection", () =>
    Effect.runPromise(
      withPortfolioRepo(({ indexPath, tempContext, tmpDir }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.writeFileString(indexPath, yield* buildPortfolioIndexContent(tmpDir));
          yield* runGit(tmpDir, ["add", PORTFOLIO_INDEX_PATH]);

          const disposition = yield* enforcePortfolioIndexPublishIntent(
            tempContext,
            YeetStagedPublishIntent.make({ paths: [PORTFOLIO_INDEX_PATH] })
          );

          expect(disposition).toBe("current");
          expect(yield* runGitStatus(tmpDir)).toBe(`A  ${PORTFOLIO_INDEX_PATH}`);
        })
      )
    ));

  it("refuses a hand-staged index that disagrees with the manifests", () =>
    Effect.runPromise(
      withPortfolioRepo(({ indexPath, tempContext, tmpDir }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const handEdited = "# Goals Index\n\nhand-merged by an agent\n";
          yield* fs.writeFileString(indexPath, handEdited);
          yield* runGit(tmpDir, ["add", PORTFOLIO_INDEX_PATH]);

          const failure = yield* enforcePortfolioIndexPublishIntent(
            tempContext,
            YeetStagedPublishIntent.make({ paths: [PORTFOLIO_INDEX_PATH] })
          ).pipe(Effect.flip);

          expect(failure.message).toContain(PORTFOLIO_INDEX_PATH);
          expect(failure.message).toContain(PORTFOLIO_INDEX_WRITE_COMMAND);
          // The refusal must never silently replace the agent's staged copy.
          expect(yield* fs.readFileString(indexPath)).toBe(handEdited);
        })
      )
    ));
});
