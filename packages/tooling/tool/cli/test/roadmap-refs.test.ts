import { lintCommand } from "@beep/repo-cli";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { provideScopedLayer } from "@beep/test-utils";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, Exit, FileSystem, Layer, Path, pipe } from "effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import { describe, expect, it } from "vitest";
import { expectReportedExit, withTempWorkingDirectory } from "./support/CommandTest.js";

const FIXTURE_PATH = "packages/tooling/tool/cli/test/roadmap-refs.fixture.md";
const runLintCommand = Command.runWith(lintCommand, { version: "0.0.0" });
const encodeJson = S.encodeUnknownEffect(S.UnknownFromJsonString);

const testLayer = Layer.mergeAll(
  NodeServices.layer,
  TestConsole.layer,
  FsUtilsLive.pipe(Layer.provide(NodeServices.layer))
);

const writeFixture = Effect.fn("RoadmapRefsTest.writeFixture")(function* (roadmap: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  yield* fs.writeFileString("bun.lock", "");
  yield* fs.makeDirectory(path.join("docs"), { recursive: true });
  yield* fs.makeDirectory(path.join("goals", "resolving", "ops"), { recursive: true });
  yield* fs.makeDirectory(path.join("explorations", "resolving"), { recursive: true });
  yield* fs.writeFileString(path.join("docs", "ROADMAP.md"), roadmap);
  yield* fs.writeFileString(path.join("goals", "resolving", "README.md"), "# Resolving goal\n");
  yield* fs.writeFileString(path.join("explorations", "resolving", "README.md"), "# Resolving exploration\n");
  yield* fs.writeFileString(
    path.join("goals", "resolving", "ops", "manifest.json"),
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

describe("roadmap-refs lint command", { concurrent: false }, () => {
  it(
    "blocks only the dead link and reports phase drift as advisory",
    () =>
      Effect.runPromise(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const repoRoot = yield* findRepoRoot();
          const roadmap = yield* fs.readFileString(path.join(repoRoot, FIXTURE_PATH));

          yield* withTempWorkingDirectory(
            Effect.gen(function* () {
              yield* writeFixture(roadmap);
              const exit = yield* Effect.exit(runLintCommand(["roadmap-refs"]));
              expectReportedExit(exit);
              expect(Exit.isFailure(exit)).toBe(true);

              const issueLines = pipe(
                yield* TestConsole.errorLines,
                A.filter(P.isString),
                A.filter(Str.startsWith("[roadmap:issue]"))
              );
              const blocking = A.filter(issueLines, Str.includes('"severity":"error"'));
              const advisories = A.filter(issueLines, Str.includes('"severity":"warning"'));

              expect(blocking).toHaveLength(2);
              expect(A.some(blocking, Str.includes("../goals/dead/README.md"))).toBe(true);
              expect(A.some(blocking, Str.includes("../goals/dead-ref/README.md"))).toBe(true);
              expect(A.some(blocking, Str.includes("../goals/resolving/README.md"))).toBe(false);
              expect(advisories).toHaveLength(1);
              expect(A.some(advisories, Str.includes("(0/2) disagrees with manifest phases (1/2)"))).toBe(true);
            })
          );
        }).pipe(provideScopedLayer(testLayer))
      ),
    20_000
  );
});
