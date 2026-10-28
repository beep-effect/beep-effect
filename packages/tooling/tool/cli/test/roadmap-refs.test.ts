import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { lintCommand } from "@beep/repo-cli";
import { TSMorphServiceLive } from "@beep/repo-utils";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { expectReportedExit } from "./support/CommandTest.ts";

const FIXTURE_PATH = "packages/tooling/tool/cli/test/roadmap-refs.fixture.md";
const runLintCommand = Command.runWith(lintCommand, { version: "0.0.0" });
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const testLayer = Layer.mergeAll(
  NodeServices.layer,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer)),
  TSMorphServiceLive.pipe(Layer.provide(NodeServices.layer))
);

/** Writes the fixture checkout under `root`, marked as a repository root by its `bun.lock`. */
const writeFixtureAt = Effect.fn("RoadmapRefsTest.writeFixtureAt")(function* (root: string, roadmap: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* fs.makeDirectory(root, { recursive: true });
  yield* fs.writeFileString(path.join(root, "bun.lock"), "");
  yield* fs.makeDirectory(path.join(root, "docs"), { recursive: true });
  yield* fs.makeDirectory(path.join(root, "goals", "resolving", "ops"), { recursive: true });
  yield* fs.makeDirectory(path.join(root, "explorations", "resolving"), { recursive: true });
  yield* fs.writeFileString(path.join(root, "docs", "ROADMAP.md"), roadmap);
  yield* fs.writeFileString(path.join(root, "goals", "resolving", "README.md"), "# Resolving goal\n");
  yield* fs.writeFileString(path.join(root, "explorations", "resolving", "README.md"), "# Resolving exploration\n");
  yield* fs.writeFileString(
    path.join(root, "goals", "resolving", "ops", "manifest.json"),
    yield* encodeJson({
      schemaVersion: "initiative-manifest/v2",
      initiative: { id: "resolving", status: "active" },
      completionGate: {
        operator: "yeet",
        requiresPullRequest: true,
        requiresMergeable: true,
        statement: "Ship via yeet.",
        grandfathered: false,
      },
      phases: [
        { id: "P0", status: "complete" },
        { id: "P1", status: "pending" },
      ],
    })
  );
});

/** Writes the fixture checkout into a scoped temp directory and returns its root for `--repo-root`. */
const writeFixture = Effect.fn("RoadmapRefsTest.writeFixture")(function* (roadmap: string) {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "roadmap-refs-fixture-" });
  yield* writeFixtureAt(root, roadmap);
  return root;
});

describe("roadmap-refs lint command", { concurrent: false }, () => {
  it.layer(testLayer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "accepts deterministic projections that are intentionally absent from Git",
      () =>
        Effect.gen(function* () {
          const root = yield* writeFixture(
            "# Roadmap\n\n- [Exploration Atlas](../explorations/ATLAS.md)\n- [Goals index](../goals/INDEX.md)\n"
          );
          const exit = yield* Effect.exit(runLintCommand(["roadmap-refs", "--repo-root", root]));
          if (!Exit.isSuccess(exit)) throw new Error("Expected a success exit");
        }),
      20_000
    );

    it.effect(
      "blocks only the dead link and reports phase drift as advisory",
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const repoRoot = yield* findRepoRoot();
          const roadmap = yield* fs.readFileString(path.join(repoRoot, FIXTURE_PATH));
          const root = yield* writeFixture(roadmap);
          // The layer (and its TestConsole) is shared across this block, so count only this run's lines.
          const priorErrorLines = A.length(yield* TestConsole.errorLines);

          const exit = yield* Effect.exit(runLintCommand(["roadmap-refs", "--repo-root", root]));
          expectReportedExit(exit);
          exit.pipe(Exit.isFailure, assertTrue);

          const issueLines = pipe(
            yield* TestConsole.errorLines,
            A.drop(priorErrorLines),
            A.filter(P.isString),
            A.filter(Str.startsWith("[roadmap:issue]"))
          );
          const blocking = A.filter(issueLines, Str.includes('"severity":"error"'));
          const advisories = A.filter(issueLines, Str.includes('"severity":"warning"'));

          expect(blocking).toHaveLength(3);
          expect(A.some(blocking, Str.includes("../goals/dead/README.md"))).toBe(true);
          expect(A.some(blocking, Str.includes("../goals/dead-ref/README.md"))).toBe(true);
          // A label wrapped across lines must still surface its dead destination.
          expect(A.some(blocking, Str.includes("../goals/wrapped-dead/README.md"))).toBe(true);
          expect(A.some(blocking, Str.includes("../goals/resolving/README.md"))).toBe(false);
          // The fenced dead link must be invisible: the shared parser only reads prose lines.
          expect(A.some(blocking, Str.includes("fenced-dead"))).toBe(false);
          // Three drift advisories: the plain entry, the wrapped-snapshot entry, and the
          // wrapped-label entry whose snapshot trails its continuation line.
          expect(advisories).toHaveLength(3);
          expect(A.some(advisories, Str.includes("(0/2) disagrees with manifest phases (1/2)"))).toBe(true);
          // The wrapped entry's snapshot opens the line after its link, as the live roadmap does.
          expect(A.some(advisories, Str.includes("(2/2) disagrees with manifest phases (1/2)"))).toBe(true);
        }),
      20_000
    );
  });

  // Without --repo-root the command keeps finding its checkout upward from the working
  // directory. The memory volume holds a marked checkout at that path, so nothing on disk
  // is read or written and the working directory never changes.
  it.layer(Layer.mergeAll(testLayer, MemoryFileSystem.layer), { timeout: "30 seconds" })((it) => {
    it.effect(
      "defaults to the checkout enclosing the working directory",
      () =>
        Effect.gen(function* () {
          yield* writeFixtureAt(process.cwd(), "# Roadmap\n\n- [Default root](../goals/default-root-dead/README.md)\n");

          const exit = yield* Effect.exit(runLintCommand(["roadmap-refs"]));
          expectReportedExit(exit);
          exit.pipe(Exit.isFailure, assertTrue);

          const blocking = pipe(
            yield* TestConsole.errorLines,
            A.filter(P.isString),
            A.filter(Str.startsWith("[roadmap:issue]")),
            A.filter(Str.includes('"severity":"error"'))
          );
          expect(blocking).toHaveLength(1);
          expect(A.some(blocking, Str.includes("../goals/default-root-dead/README.md"))).toBe(true);
        }),
      20_000
    );
  });
});
