import { buildPortfolioIndexContent, PORTFOLIO_INDEX_PATH } from "@beep/repo-cli/commands/Goals";
import {
  enforcePortfolioIndexPublishIntent,
  PORTFOLIO_INDEX_WRITE_COMMAND,
  portfolioIndexPublishDisposition,
  RepoRunContext,
  YeetStagedPublishIntent,
} from "@beep/repo-cli/test/Yeet";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect } from "@effect/vitest";
import { Console, Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";

const PlatformLayer = NodeChildProcessSpawner.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(BunCrypto.layer, NodeFileSystem.layer, NodePath.layer))
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

const temporaryDirectory = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.makeTempDirectoryScoped();
});

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
  yield* runGit(tmpDir, ["config", "commit.gpgsign", "false"]);

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

const portfolioRepo = Effect.fnUntraced(function* (slugs: ReadonlyArray<string> = ["alpha-packet", "beta-packet"]) {
  const tmpDir = yield* temporaryDirectory;
  return yield* initPortfolioRepo(tmpDir, slugs);
});

const portfolioRepoAndOutside = Effect.gen(function* () {
  const tempRoot = yield* temporaryDirectory;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = path.join(tempRoot, "repo");
  const outsideRoot = path.join(tempRoot, "outside");
  yield* fs.makeDirectory(repoRoot);
  yield* fs.makeDirectory(outsideRoot);
  return Tuple.make(yield* initPortfolioRepo(repoRoot, ["alpha-packet", "beta-packet"]), outsideRoot);
});

it.layer(PlatformLayer, { timeout: "30 seconds" })((it) => {
  describe("yeet publish derived goals index", { concurrent: false }, () => {
    it("treats a checkout without a goals portfolio as out of scope", () => {
      expect(
        portfolioIndexPublishDisposition({
          committed: O.none(),
          present: false,
          regenerated: "# Goals Index\n",
          staged: true,
          stagedDeletion: false,
        })
      ).toBe("absent");
    });

    it("accepts an unstaged current projection and refuses a staged copy", () => {
      const regenerated = "# Goals Index\n\n1 packets\n";
      expect(
        portfolioIndexPublishDisposition({
          committed: O.some(regenerated),
          present: true,
          regenerated,
          staged: false,
          stagedDeletion: false,
        })
      ).toBe("current");
      expect(
        portfolioIndexPublishDisposition({
          committed: O.some(regenerated),
          present: true,
          regenerated,
          staged: true,
          stagedDeletion: false,
        })
      ).toBe("drifted");
    });

    it("regenerates an unstaged stale index and refuses a hand-staged one", () => {
      const regenerated = "# Goals Index\n\n2 packets\n";
      const committed = O.some("# Goals Index\n\nhand written\n");
      expect(
        portfolioIndexPublishDisposition({
          committed,
          present: true,
          regenerated,
          staged: false,
          stagedDeletion: false,
        })
      ).toBe("regenerated");
      expect(
        portfolioIndexPublishDisposition({ committed, present: true, regenerated, staged: true, stagedDeletion: false })
      ).toBe("drifted");
      expect(
        portfolioIndexPublishDisposition({
          committed: O.none(),
          present: true,
          regenerated,
          staged: false,
          stagedDeletion: false,
        })
      ).toBe("regenerated");
    });

    it("accepts a staged deletion that retires a legacy tracked projection", () => {
      const regenerated = "# Goals Index\n\n2 packets\n";
      expect(
        portfolioIndexPublishDisposition({
          committed: O.some(regenerated),
          present: true,
          regenerated,
          staged: true,
          stagedDeletion: true,
        })
      ).toBe("removed");
    });

    it.effect("leaves a repo without goals/ untouched", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
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
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("regenerates a missing index without staging it", () =>
      Effect.flatMap(portfolioRepo(), ({ indexPath, tempContext, tmpDir }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;

          const disposition = yield* enforcePortfolioIndexPublishIntent(
            tempContext,
            YeetStagedPublishIntent.make({ paths: ["goals/alpha-packet/ops/manifest.json"] })
          );

          expect(disposition).toBe("regenerated");
          expect(yield* fs.readFileString(indexPath)).toBe(yield* buildPortfolioIndexContent(tmpDir));
          expect(yield* runGitStatus(tmpDir)).toBe(`?? ${PORTFOLIO_INDEX_PATH}`);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("leaves a current unstaged local projection untouched", () =>
      Effect.flatMap(portfolioRepo(), ({ indexPath, tempContext, tmpDir }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const current = yield* buildPortfolioIndexContent(tmpDir);
          yield* fs.writeFileString(indexPath, current);

          const disposition = yield* enforcePortfolioIndexPublishIntent(
            tempContext,
            YeetStagedPublishIntent.make({ paths: ["goals/alpha-packet/ops/manifest.json"] })
          );

          expect(disposition).toBe("current");
          expect(yield* fs.readFileString(indexPath)).toBe(current);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("overwrites a stale unstaged index without staging the refresh", () =>
      Effect.flatMap(portfolioRepo(), ({ indexPath, tempContext, tmpDir }) =>
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
          expect(yield* runGitStatus(tmpDir)).toBe(`M ${PORTFOLIO_INDEX_PATH}`);
          expect(Str.trim(yield* spawnGit(tmpDir, ["diff", "--cached", "--name-only"]))).toBe("");
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("rejects a symlinked index file without writing or staging its destination", () =>
      Effect.flatMap(portfolioRepoAndOutside, ([{ indexPath, tempContext, tmpDir }, outsideRoot]) =>
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
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("rejects a symlinked index parent without writing or staging through it", () =>
      Effect.flatMap(portfolioRepoAndOutside, ([{ tempContext, tmpDir }, outsideRoot]) =>
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
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("refuses a staged index even when it equals the regenerated projection", () =>
      Effect.flatMap(portfolioRepo(), ({ indexPath, tempContext, tmpDir }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.writeFileString(indexPath, yield* buildPortfolioIndexContent(tmpDir));
          yield* runGit(tmpDir, ["add", PORTFOLIO_INDEX_PATH]);

          const failure = yield* enforcePortfolioIndexPublishIntent(
            tempContext,
            YeetStagedPublishIntent.make({ paths: [PORTFOLIO_INDEX_PATH] })
          ).pipe(Effect.flip);

          expect(failure.message).toContain("must never enter a commit");
          expect(yield* runGitStatus(tmpDir)).toContain(`A  ${PORTFOLIO_INDEX_PATH}`);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("preserves a staged deletion while regenerating the ignored local projection", () =>
      Effect.flatMap(portfolioRepo(), ({ indexPath, tempContext, tmpDir }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.writeFileString(indexPath, yield* buildPortfolioIndexContent(tmpDir));
          yield* runGit(tmpDir, ["add", PORTFOLIO_INDEX_PATH]);
          yield* runGit(tmpDir, ["commit", "-m", "track legacy index"]);
          yield* fs.remove(indexPath);
          yield* runGit(tmpDir, ["add", "-u", "--", PORTFOLIO_INDEX_PATH]);

          const disposition = yield* enforcePortfolioIndexPublishIntent(
            tempContext,
            YeetStagedPublishIntent.make({ paths: [PORTFOLIO_INDEX_PATH] })
          );

          expect(disposition).toBe("regenerated");
          expect(yield* fs.readFileString(indexPath)).toBe(yield* buildPortfolioIndexContent(tmpDir));
          expect(Str.trim(yield* spawnGit(tmpDir, ["diff", "--cached", "--diff-filter=D", "--name-only"]))).toBe(
            PORTFOLIO_INDEX_PATH
          );
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("refuses a hand-staged index that disagrees with the manifests", () =>
      Effect.flatMap(portfolioRepo(), ({ indexPath, tempContext, tmpDir }) =>
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
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );
  });
});
